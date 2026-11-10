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
  cardText,
  proposeCards,
  stackLookup,
  verdictKey,
  type Card,
  type FlowState,
  type MatchData,
  type Verdict,
} from "@/lib/flow/flow";
import { base64Jpeg } from "@/lib/photos/canvas";
import { getPhoto, getVectors, kvGet, kvSet, putVector } from "@/lib/store/db";
import { timeBonus, tripDays } from "./time";

export type Stage =
  | { kind: "index"; done: number; total: number }
  | { kind: "queries" }
  | { kind: "match" }
  | { kind: "check"; done: number; total: number };

interface SavedQuery {
  query: string;
  partOfDay: PartOfDay;
  day: number;
  vector?: number[];
}

/** Searches are saved by sentence text, so editing one sentence only re-runs that search. */
const QUERIES_KEY = "queries";

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
  onStage({ kind: "queries" });
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
        if (!saved[text]) saved[text] = { query: q.query, partOfDay: q.partOfDay, day: q.day };
      });
    } catch (e) {
      if (e instanceof AiError && e.status === 401) throw e;
      fellBack = true;
      for (const s of state.sentences) saved[s.text] ??= { query: s.text, partOfDay: "none", day: 0 };
    }
  }

  const needVectors = state.sentences.map((s) => saved[s.text]!).filter((q) => !q.vector);
  for (const batch of chunked(needVectors, 100)) {
    const { vectors } = await embed({ kind: "texts", texts: batch.map((q) => q.query) });
    batch.forEach((q, i) => (q.vector = vectors[i]));
  }
  if (!fellBack) await kvSet(QUERIES_KEY, saved);
  return { queries: state.sentences.map((s) => saved[s.text]!), fellBack, model };
}

/** The saved search for each sentence (for the test record), or null where there is none. */
export async function savedSearches(state: FlowState) {
  const saved = (await kvGet<Record<string, SavedQuery>>(QUERIES_KEY).catch(() => undefined)) ?? {};
  return state.sentences.map((s) => {
    const q = saved[s.text];
    return q ? { query: q.query, partOfDay: q.partOfDay, day: q.day } : null;
  });
}

/** The photo count to aim for: the middle of the estimate. */
export function defaultTarget(estimate: { min: number; max: number } | null): number {
  return estimate ? Math.round((estimate.min + estimate.max) / 2) : 1;
}

export async function runMatching(
  state: FlowState,
  target: number,
  onStage: (s: Stage) => void,
): Promise<{ match: MatchData; cards: Card[] }> {
  const topPicks = state.stacks.map((k) => k.topPick);
  const vectors = await indexPhotos(topPicks, onStage);
  const byId = new Map(state.photos.map((p) => [p.id, p]));
  const { dayOf, count } = tripDays(state.photos);
  const { queries, fellBack, model } = await sentenceSearches(state, count, onStage);

  onStage({ kind: "match" });
  const candidates = state.stacks
    .filter((k) => vectors.has(k.topPick))
    .map((k) => ({ photoId: k.topPick, stackId: k.id }));
  const scores = queries.map((q) =>
    candidates.map((c) => cosine(q.vector!, vectors.get(c.photoId)!) + timeBonus(q, byId.get(c.photoId)!, dayOf)),
  );

  const notes: string[] = [];
  if (candidates.length < topPicks.length) {
    notes.push(`${topPicks.length - candidates.length} photos couldn't be indexed this time, so they weren't matched.`);
  }
  if (fellBack) notes.push("Inkreel couldn't write photo searches this time, so it searched with your sentences as written.");

  const match: MatchData = {
    sentenceIds: state.sentences.map((s) => s.id),
    candidates,
    scores,
    lookedFor: Object.fromEntries(state.sentences.map((s, i) => [s.id, queries[i]!.query])),
    verdicts: {},
    byHand: false,
    fixed: {},
    queriesModel: model,
    notes,
  };
  return { match, cards: proposeCards(match, target, stackLookup(state)) };
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
  return { match, cards: proposeCards(match, target) };
}

/**
 * Call 3: checks each suggested card's photo and its alternatives, and writes the reasons.
 * Cards that fail to check keep their match, shown with what Inkreel looked for.
 */
export async function checkCards(
  state: FlowState,
  cards: Card[],
  onStage?: (s: Stage) => void,
): Promise<Record<string, Verdict>> {
  const match = state.match;
  if (!match || match.byHand) return {};
  const todo = cards.filter(
    (c) => c.photoId && !c.captionOnly && !(verdictKey(c.sentenceIds, c.photoId) in match.verdicts),
  );
  const verdicts: Record<string, Verdict> = {};
  let done = 0;
  onStage?.({ kind: "check", done, total: todo.length });

  for (const batch of chunked(todo, CHUNKS_PER_CHECK_REQUEST)) {
    try {
      const chunks = await Promise.all(
        batch.map(async (card) => {
          const photoIds = [card.photoId!, ...card.alternatives].slice(0, 3);
          const photos = await Promise.all(
            photoIds.map(async (id) => {
              const stored = await getPhoto(id);
              if (!stored) throw new Error(`Photo ${id} is missing from this device.`);
              return { id, image: await base64Jpeg(stored.full, CHECK_IMAGE_PX) };
            }),
          );
          return {
            id: card.id,
            text: cardText(state, card),
            lookedFor: card.sentenceIds.map((id) => match.lookedFor[id] ?? "").join("; "),
            photos,
          };
        }),
      );
      const reply = await checkMatches({ chunks });
      for (const result of reply.results) {
        const card = batch.find((c) => c.id === result.chunkId);
        if (!card) continue;
        for (const v of result.photos) {
          verdicts[verdictKey(card.sentenceIds, v.id)] = { fits: v.fits, reason: v.reason };
        }
      }
    } catch (e) {
      if (e instanceof AiError && e.status === 401) throw e;
      // Leave these cards unchecked; the review shows what Inkreel looked for instead.
    }
    done += batch.length;
    onStage?.({ kind: "check", done, total: todo.length });
  }
  return verdicts;
}
