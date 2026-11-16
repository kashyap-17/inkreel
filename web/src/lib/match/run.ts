// Runs matching in the browser: index photos (call 1), photo searches (call 2), scores and
// chunks in code, then check and explain (call 3). Failure paths follow docs/plan.md §2.
import {
  CHECK_IMAGE_PX,
  CHUNKS_PER_CHECK_REQUEST,
  IMAGES_PER_EMBED_REQUEST,
  INDEX_IMAGE_PX,
} from "@/config/ai";
import { AiError, checkMatches, embed, searchQueries } from "@/lib/ai/client";
import type { PartOfDay } from "@/lib/ai/schemas";
import {
  cardPhotoIds,
  cardText,
  proposeCards,
  stackLookup,
  stanzaBreaks,
  verdictKey,
  type Card,
  type FlowState,
  type MatchData,
  type Verdict,
} from "@/lib/flow/flow";
import { base64Jpeg } from "@/lib/photos/canvas";
import { getPhoto, getVectors, kvGet, kvSet, putVector } from "@/lib/store/db";
import { timeBonus, tripDays } from "./time";

/** Progress of matching; looking at the photos and reading the writing run at the same time. */
export type Stage =
  | { kind: "index"; done: number; total: number }
  | { kind: "queries"; status: "running" | "done" | "fellBack" }
  | { kind: "match" }
  | { kind: "check"; done: number; total: number };

interface SavedQuery {
  /** Up to three readings of the sentence as a photo; a photo only needs to match one. */
  readings: string[];
  partOfDay: PartOfDay;
  day: number;
  vectors?: number[][];
}

/**
 * Searches are saved by sentence text, so editing one sentence only re-runs that search.
 * The key carries the search format: searches saved in an older format are not reused.
 */
const QUERIES_KEY = "queries-v3";

/** The check call takes up to three photos per piece of writing. */
const PHOTOS_PER_CHECK = 3;

async function pool<T>(items: T[], concurrency: number, work: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await work(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

const chunked = <T>(xs: T[], size: number) =>
  Array.from({ length: Math.ceil(xs.length / size) }, (_, i) => xs.slice(i * size, i * size + size));

function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Call 1: one vector per stack's top pick. Photos already indexed are never sent again. */
async function indexPhotos(ids: string[], onStage: (s: Stage) => void): Promise<Map<string, Float32Array>> {
  const vectors = await getVectors(ids);
  const missing = ids.filter((id) => !vectors.has(id));
  let done = ids.length - missing.length;
  onStage({ kind: "index", done, total: ids.length });
  let failure: unknown = null;

  await pool(chunked(missing, IMAGES_PER_EMBED_REQUEST), 2, async (batch) => {
    if (failure) return;
    try {
      const images = await Promise.all(
        batch.map(async (id) => {
          const stored = await getPhoto(id);
          if (!stored) throw new Error(`Photo ${id} is missing from this device.`);
          return base64Jpeg(stored.full, INDEX_IMAGE_PX);
        }),
      );
      const { vectors: got } = await embed({ kind: "images", images });
      await Promise.all(batch.map((id, i) => putVector(id, got[i]!)));
      batch.forEach((id, i) => vectors.set(id, Float32Array.from(got[i]!)));
      done += batch.length;
      onStage({ kind: "index", done, total: ids.length });
    } catch (e) {
      failure = e;
    }
  });

  // Matching goes ahead with the photos indexed so far; a later run only sends the rest.
  if (failure && vectors.size === 0) throw failure;
  return vectors;
}

/** Call 2, plus embedding each search. Falls back to the sentence itself if the call fails. */
async function sentenceSearches(
  state: FlowState,
  days: number,
  onStage: (s: Stage) => void,
): Promise<{ queries: SavedQuery[]; fellBack: boolean; model?: string }> {
  onStage({ kind: "queries", status: "running" });
  const saved = (await kvGet<Record<string, SavedQuery>>(QUERIES_KEY)) ?? {};
  let fellBack = false;
  let model: string | undefined;

  if (state.sentences.some((s) => !saved[s.text])) {
    try {
      const reply = await searchQueries({
        sentences: state.sentences.map(({ id, text }) => ({ id, text })),
        // Albums can include old photos; a "trip" over a year long carries no day hints worth using.
        tripDays: Math.min(days, 366),
      });
      model = reply.model;
      reply.queries.forEach((q, i) => {
        const text = state.sentences[i]!.text;
        // The sentence itself is always one of the searches: on real tests it often matched as
        // well as the AI's readings, and it keeps a good match if the readings are off.
        if (!saved[text]) {
          const readings = [text, ...q.readings.filter((r) => r.trim().toLowerCase() !== text.trim().toLowerCase())];
          saved[text] = { readings, partOfDay: q.partOfDay, day: q.day };
        }
      });
    } catch (e) {
      if (e instanceof AiError && e.status === 401) throw e;
      fellBack = true;
      for (const s of state.sentences) saved[s.text] ??= { readings: [s.text], partOfDay: "none", day: 0 };
    }
  }

  // Every reading still without a vector, embedded together in as few calls as possible.
  const need = state.sentences.map((s) => saved[s.text]!).filter((q) => !q.vectors);
  const texts = need.flatMap((q) => q.readings.map((text) => ({ q, text })));
  const got: number[][] = [];
  for (const batch of chunked(texts, 100)) {
    const { vectors } = await embed({ kind: "texts", texts: batch.map((t) => t.text) });
    got.push(...vectors);
  }
  let at = 0;
  for (const q of need) {
    q.vectors = got.slice(at, at + q.readings.length);
    at += q.readings.length;
  }
  if (!fellBack) await kvSet(QUERIES_KEY, saved);
  onStage({ kind: "queries", status: fellBack ? "fellBack" : "done" });
  return { queries: state.sentences.map((s) => saved[s.text]!), fellBack, model };
}

/** The saved search for each sentence (for the test record), or null where there is none. */
export async function savedSearches(state: FlowState) {
  const saved = (await kvGet<Record<string, SavedQuery>>(QUERIES_KEY).catch(() => undefined)) ?? {};
  return state.sentences.map((s) => {
    const q = saved[s.text];
    return q ? { readings: q.readings, partOfDay: q.partOfDay, day: q.day } : null;
  });
}

export async function runMatching(
  state: FlowState,
  target: number,
  onStage: (s: Stage) => void,
): Promise<{ match: MatchData; cards: Card[] }> {
  const started = Date.now();
  const topPicks = state.stacks.map((k) => k.topPick);
  const byId = new Map(state.photos.map((p) => [p.id, p]));
  const { dayOf, count } = tripDays(state.photos);
  const since = () => Date.now() - started;
  // Independent steps, so they run together: the wait is the longer of the two, not both.
  const [indexed, searched] = await Promise.all([
    indexPhotos(topPicks, onStage).then((vectors) => ({ vectors, ms: since() })),
    sentenceSearches(state, count, onStage).then((result) => ({ ...result, ms: since() })),
  ]);
  const vectors = indexed.vectors;
  const { queries, fellBack, model } = searched;

  onStage({ kind: "match" });
  const candidates = state.stacks
    .filter((k) => vectors.has(k.topPick))
    .map((k) => ({ photoId: k.topPick, stackId: k.id }));
  // A photo's score for a sentence is its best match across the sentence's readings.
  const scores = queries.map((q) =>
    candidates.map((c) => {
      const photo = vectors.get(c.photoId)!;
      return Math.max(...q.vectors!.map((v) => cosine(v, photo))) + timeBonus(q, byId.get(c.photoId)!, dayOf);
    }),
  );

  const notes: string[] = [];
  const missed = topPicks.length - candidates.length;
  if (missed > 0) {
    notes.push(
      `${missed} ${missed === 1 ? "photo" : "photos"} couldn’t be looked at this time, so ${missed === 1 ? "it wasn’t" : "they weren’t"} matched. Matching again later sends only those.`,
    );
  }

  const match: MatchData = {
    sentenceIds: state.sentences.map((s) => s.id),
    candidates,
    scores,
    lookedFor: Object.fromEntries(state.sentences.map((s, i) => [s.id, queries[i]!.readings.join(" · ")])),
    verdicts: {},
    byHand: false,
    fixed: {},
    queriesModel: model,
    searchesFellBack: fellBack,
    timings: { photosMs: indexed.ms, searchesMs: searched.ms, totalMs: since() },
    notes,
  };
  return { match, cards: proposeCards(match, target, stackLookup(state), stanzaBreaks(state)) };
}

/** Matching by hand: the writing is split in code, and the user picks every photo. */
export function matchByHand(state: FlowState, target: number): { match: MatchData; cards: Card[] } {
  const match: MatchData = {
    sentenceIds: state.sentences.map((s) => s.id),
    candidates: [],
    scores: [],
    lookedFor: {},
    verdicts: {},
    byHand: true,
    fixed: {},
    notes: [],
  };
  return { match, cards: proposeCards(match, target, undefined, stanzaBreaks(state)) };
}

/**
 * Call 3: checks each part's photos and its alternatives, and writes the reasons.
 * Photos that fail to check keep their place, shown without a reason.
 */
export async function checkCards(
  state: FlowState,
  cards: Card[],
  onStage?: (s: Stage) => void,
  /** Called with each batch's results as they arrive. */
  onVerdicts?: (verdicts: Record<string, Verdict>) => void,
): Promise<Record<string, Verdict>> {
  const match = state.match;
  if (!match || match.byHand) return {};
  // One item per group of up to three photos of a part: its own photos first, then the alternatives.
  const todo = cards.flatMap((card) => {
    if (card.captionOnly) return [];
    const own = cardPhotoIds(card).filter((id) => !(verdictKey(card.sentenceIds, id) in match.verdicts));
    if (own.length === 0) return [];
    const ids = [...own, ...card.alternatives.filter((id) => !(verdictKey(card.sentenceIds, id) in match.verdicts))];
    const groups = chunked(ids, PHOTOS_PER_CHECK).slice(0, Math.ceil(own.length / PHOTOS_PER_CHECK));
    return groups.map((photoIds, i) => ({ id: `${card.id}-${i + 1}`, card, photoIds }));
  });
  const verdicts: Record<string, Verdict> = {};
  let done = 0;
  onStage?.({ kind: "check", done, total: todo.length });

  // Two requests at a time, so a busy answer on one doesn't hold up the rest.
  await pool(chunked(todo, CHUNKS_PER_CHECK_REQUEST), 2, async (batch) => {
    const found: Record<string, Verdict> = {};
    try {
      const chunks = await Promise.all(
        batch.map(async ({ id, card, photoIds }) => {
          const photos = await Promise.all(
            photoIds.map(async (photoId) => {
              const stored = await getPhoto(photoId);
              if (!stored) throw new Error(`Photo ${photoId} is missing from this device.`);
              return { id: photoId, image: await base64Jpeg(stored.full, CHECK_IMAGE_PX) };
            }),
          );
          return {
            id,
            text: cardText(state, card),
            lookedFor: card.sentenceIds.map((s) => match.lookedFor[s] ?? "").join("; ").slice(0, 2000),
            photos,
          };
        }),
      );
      const reply = await checkMatches({ chunks });
      for (const result of reply.results) {
        const item = batch.find((b) => b.id === result.chunkId);
        if (!item) continue;
        for (const v of result.photos) {
          found[verdictKey(item.card.sentenceIds, v.id)] = { fits: v.fits, reason: v.reason };
        }
      }
    } catch (e) {
      if (e instanceof AiError && e.status === 401) throw e;
      // Leave these photos unchecked.
    }
    Object.assign(verdicts, found);
    if (Object.keys(found).length) onVerdicts?.(found);
    done += batch.length;
    onStage?.({ kind: "check", done, total: todo.length });
  });
  return verdicts;
}
