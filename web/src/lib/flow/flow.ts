// The flow as a typed state machine (a reducer). Steps follow docs/plan.md:
// words (or answers → draft, writing with Inkreel) → photos → consent → matching → review → preview.
import { chunkAndMatch, makeRangeScorer, MATCHING, type Candidate } from "@/lib/match/chunk";
import { buildStacks, sortByTime } from "@/lib/photos/stacks";
import type { PhotoRecord, Stack } from "@/lib/photos/types";
import { estimatePhotos, MAX_PHOTOS, type PhotoEstimate } from "@/lib/words/estimate";
import { draftText, emptyAnswers, type Answers, type DraftLine, type SectionKey } from "@/lib/words/draft";
import { countWords, splitSentences } from "@/lib/words/sentences";

export type Mode = "own" | "help" | "mix";
export type Step = "start" | "words" | "draft" | "photos" | "consent" | "matching" | "review" | "preview";

export interface Sentence {
  id: string;
  text: string;
  /** Who wrote it: the user, or Inkreel (Write with Inkreel, drafted from the user's answers). */
  source: "user" | "ai";
  /** Where it sits in the writing, so a card's text is an exact slice of what the user wrote. */
  start: number;
  end: number;
}

export interface Verdict {
  fits: boolean;
  reason: string;
}

/** A further photo for a part that has more than one. */
export interface ExtraPhoto {
  photoId: string;
  status: "suggested" | "swapped";
}

/** One part of the post: a run of consecutive sentences and the photo or photos that go with them. */
export interface Card {
  id: string;
  sentenceIds: string[];
  photoId: string | null;
  /** More photos for this part, when the post has more photos than parts. Empty unless `photoId` is set. */
  extras: ExtraPhoto[];
  /** Next-best photos from other stacks, best first. */
  alternatives: string[];
  strength: "strong" | "weak";
  /** "suggested" by Inkreel, or "swapped" by the user (never moved by re-chunking). */
  status: "suggested" | "swapped";
  /** The card's words changed after matching, so the match should be checked again. */
  textChanged: boolean;
  /** Kept in the caption with no photo. */
  captionOnly: boolean;
}

/** What matching worked from, kept so fewer/more photos can re-chunk instantly in code. */
export interface MatchData {
  sentenceIds: string[];
  /** Indexed photos (stack top picks) that can be matched. */
  candidates: Candidate[];
  /** scores[sentence][candidate]. Empty when matching by hand. */
  scores: number[][];
  /** What Inkreel looked for, per sentence ID. */
  lookedFor: Record<string, string>;
  /** Check results, keyed by `verdictKey(sentenceIds, photoId)`. */
  verdicts: Record<string, Verdict>;
  byHand: boolean;
  /** Photos the user chose, keyed by the card's sentence IDs; kept when the writing is re-chunked. */
  fixed: Record<string, string>;
  /** Extra photos the user chose for a part, keyed the same way. */
  fixedExtras?: Record<string, string[]>;
  /** Which model wrote the photo searches (Flash, or Lite as the fallback); absent if none ran. */
  queriesModel?: string;
  /** True when the searches couldn't be written and the sentences themselves were searched. */
  searchesFellBack?: boolean;
  /** How long matching took, in ms from its start: photos indexed, searches written and embedded, all done. */
  timings?: { photosMs: number; searchesMs: number; totalMs: number };
  /** Shown to the user, e.g. when some photos couldn't be indexed. */
  notes: string[];
}

export interface FlowState {
  step: Step;
  mode: Mode | null;
  /** The writing the post uses: as the user typed or pasted it, or the draft's lines. */
  text: string;
  /** The user's own writing, kept while they write with Inkreel instead. */
  ownText: string;
  /** Write with Inkreel: the user's answers, and the lines drafted from them. */
  answers: Answers;
  draft: DraftLine[];
  /** Named places from the draft, as hashtags for the end of the caption ("#HydePark"). */
  hashtags: string[];
  sentences: Sentence[];
  words: number;
  /** Prepared photos in capture order: the ones matching chooses from. */
  photos: PhotoRecord[];
  /** Photos held back as blurry, too dark, washed out or screenshots; the user can bring any back. */
  setAside: PhotoRecord[];
  stacks: Stack[];
  /** How many photos the post should have; set at matching, changed with fewer/more. */
  target: number | null;
  match: MatchData | null;
  cards: Card[];
  /** Earlier versions of the cards, for undo. */
  history: Card[][];
}

export type FlowAction =
  | { type: "restore"; state: FlowState }
  | { type: "reset" }
  | { type: "chooseMode"; mode: Mode }
  | { type: "setText"; text: string }
  | { type: "setAnswer"; section: SectionKey; text: string }
  /** A new draft from the answers; it becomes the writing. */
  | { type: "setDraft"; lines: DraftLine[]; hashtags?: string[] }
  | { type: "dropHashtag"; tag: string }
  | { type: "editLine"; lineId: string; text: string }
  | { type: "dropLine"; lineId: string }
  | { type: "goTo"; step: Step }
  | { type: "setPhotos"; photos: PhotoRecord[]; stacks: Stack[]; setAside?: PhotoRecord[] }
  /** Brings a set-aside photo back into the photos matching chooses from. */
  | { type: "usePhoto"; photoId: string }
  | { type: "matched"; match: MatchData; cards: Card[]; target: number }
  | { type: "verdicts"; verdicts: Record<string, Verdict> }
  /** `replacing`: which of the card's photos to change; the first when left out. */
  | { type: "swap"; cardId: string; photoId: string; replacing?: string }
  | { type: "addPhoto"; cardId: string; photoId: string }
  | { type: "removePhoto"; cardId: string; photoId: string }
  | { type: "moveSentence"; cardId: string; to: "previous" | "next" }
  | { type: "toggleCaptionOnly"; cardId: string }
  | { type: "setTarget"; target: number }
  | { type: "undo" };

export const initialFlow: FlowState = {
  step: "start",
  mode: null,
  text: "",
  ownText: "",
  answers: emptyAnswers(),
  draft: [],
  hashtags: [],
  sentences: [],
  words: 0,
  photos: [],
  setAside: [],
  stacks: [],
  target: null,
  match: null,
  cards: [],
  history: [],
};

export const verdictKey = (sentenceIds: string[], photoId: string) => `${sentenceIds.join(",")}|${photoId}`;

/** Every photo of a card: the first, then the extras. */
export const cardPhotoIds = (card: Pick<Card, "photoId" | "extras">): string[] =>
  card.photoId ? [card.photoId, ...card.extras.map((e) => e.photoId)] : [];

/** Takes a photo out of a card; an extra moves up when the first photo goes. */
function withoutPhoto(card: Card, photoId: string): Card {
  if (card.photoId !== photoId) return { ...card, extras: card.extras.filter((e) => e.photoId !== photoId) };
  const [next, ...rest] = card.extras;
  return next
    ? { ...card, photoId: next.photoId, status: next.status, extras: rest }
    : { ...card, photoId: null, status: "swapped" };
}

/** Puts the user's photo in a card: in place of `old`, or as one more photo when `old` is null. */
function withPhoto(card: Card, old: string | null, photoId: string): Card {
  if (!card.photoId || card.photoId === old) {
    return {
      ...card,
      photoId,
      status: "swapped",
      textChanged: false,
      captionOnly: false,
      alternatives: card.photoId ? [card.photoId, ...card.alternatives.filter((p) => p !== photoId)] : card.alternatives,
    };
  }
  const extras = old
    ? card.extras.map((e) => (e.photoId === old ? { photoId, status: "swapped" as const } : e))
    : [...card.extras, { photoId, status: "swapped" as const }];
  return { ...card, extras, captionOnly: false };
}

/** Records which photos are the user's own choices, so re-chunking keeps them. */
function remember(match: MatchData | null, cards: Card[]): MatchData | null {
  if (!match) return match;
  const fixed = { ...match.fixed };
  const fixedExtras = { ...match.fixedExtras };
  for (const card of cards) {
    const key = card.sentenceIds.join(",");
    if (card.status === "swapped" && card.photoId) fixed[key] = card.photoId;
    else delete fixed[key];
    const chosen = card.extras.filter((e) => e.status === "swapped").map((e) => e.photoId);
    if (chosen.length) fixedExtras[key] = chosen;
    else delete fixedExtras[key];
  }
  return { ...match, fixed, fixedExtras };
}

const HISTORY_LIMIT = 30;
const withHistory = (state: FlowState, cards: Card[]): FlowState => ({
  ...state,
  cards,
  history: [...state.history, state.cards].slice(-HISTORY_LIMIT),
});

/** Whether a step can be shown with what the user has done so far. */
export function canGoTo(state: FlowState, step: Step): boolean {
  switch (step) {
    case "start":
    case "words":
      return true;
    case "draft":
      return state.mode === "help" && state.draft.length > 0;
    case "photos":
      return state.sentences.length > 0;
    case "consent":
    case "matching":
      return state.sentences.length > 0 && state.photos.length > 0;
    case "review":
      return state.cards.length > 0;
    case "preview":
      return state.cards.some((c) => c.photoId && !c.captionOnly);
  }
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "restore":
      // Drafts saved before parts could hold several photos have no `extras`.
      return {
        ...initialFlow,
        ...action.state,
        // Drafts saved before Write with Inkreel have no answers or draft.
        answers: { ...emptyAnswers(), ...action.state.answers },
        draft: action.state.draft ?? [],
        hashtags: action.state.hashtags ?? [],
        ownText: action.state.ownText ?? "",
        cards: (action.state.cards ?? []).map((c) => ({ ...c, extras: c.extras ?? [] })),
        history: (action.state.history ?? []).map((cards) => cards.map((c) => ({ ...c, extras: c.extras ?? [] }))),
      };

    case "reset":
      return initialFlow;

    case "chooseMode": {
      // Mix (suggested lines in the user's own writing) isn't built.
      if (action.mode === "mix") return state;
      // Each mode keeps its own writing: the user's own text is put aside while writing with
      // Inkreel and comes back after, so AI lines are never taken for the user's words.
      const ownText = state.mode === "help" ? state.ownText : state.text;
      const next =
        action.mode === "own"
          ? withText({ ...state, mode: "own", ownText: "" }, ownText)
          : withText({ ...state, mode: "help", ownText }, draftText(state.draft));
      return { ...next, step: action.mode === "help" && state.draft.length ? "draft" : "words" };
    }

    case "setText":
      return state.mode === "help" ? state : withText(state, action.text);

    case "setAnswer":
      return { ...state, answers: { ...state.answers, [action.section]: action.text } };

    case "setDraft":
      if (state.mode !== "help" || action.lines.length === 0) return state;
      return {
        ...withText({ ...state, draft: action.lines, hashtags: action.hashtags ?? [] }, draftText(action.lines)),
        step: "draft",
      };

    case "dropHashtag":
      return { ...state, hashtags: state.hashtags.filter((t) => t !== action.tag) };

    case "editLine": {
      const text = action.text.replace(/\s+/g, " ").trim();
      // Edited by the user: their change, so the "check this line" flag is theirs to judge.
      const draft = text
        ? state.draft.map((l) => (l.id === action.lineId ? { ...l, text, edited: true, flagged: false } : l))
        : state.draft.filter((l) => l.id !== action.lineId);
      return withText({ ...state, draft }, draftText(draft));
    }

    case "dropLine": {
      const draft = state.draft.filter((l) => l.id !== action.lineId);
      return withText({ ...state, draft }, draftText(draft));
    }

    case "goTo":
      return canGoTo(state, action.step) ? { ...state, step: action.step } : state;

    case "setPhotos":
      // The photo count the user chose is kept; matches are redone with the new photos.
      return {
        ...state,
        photos: action.photos,
        stacks: action.stacks,
        setAside: action.setAside ?? [],
        match: null,
        cards: [],
        history: [],
      };

    case "usePhoto": {
      const photo = state.setAside.find((p) => p.id === action.photoId);
      if (!photo) return state;
      const photos = sortByTime([...state.photos, { ...photo, kept: true }]);
      return {
        ...state,
        photos,
        stacks: buildStacks(photos),
        setAside: state.setAside.filter((p) => p.id !== action.photoId),
        match: null,
        cards: [],
        history: [],
      };
    }

    case "matched":
      return { ...state, match: action.match, cards: action.cards, target: action.target, history: [], step: "review" };

    case "verdicts": {
      if (!state.match) return state;
      const verdicts = { ...state.match.verdicts, ...action.verdicts };
      // A suggested photo the check says doesn't fit is replaced by the first alternative that does.
      const cards = state.cards.map((card) => {
        if (card.status !== "suggested" || !card.photoId) return card;
        const own = verdicts[verdictKey(card.sentenceIds, card.photoId)];
        if (!own || own.fits) return card;
        const better = card.alternatives.find((p) => verdicts[verdictKey(card.sentenceIds, p)]?.fits);
        if (!better) return { ...card, strength: "weak" as const };
        return {
          ...card,
          photoId: better,
          alternatives: [card.photoId, ...card.alternatives.filter((p) => p !== better)],
        };
      });
      return { ...state, match: { ...state.match, verdicts }, cards };
    }

    case "swap": {
      const card = state.cards.find((c) => c.id === action.cardId);
      if (!card) return state;
      const old = action.replacing ?? card.photoId;
      if (old === action.photoId) return state;
      // A post never repeats a shot: if another slide shows this scene, the two slides trade photos.
      const stackOf = stackLookup(state);
      const shown = (c: Card) =>
        c.captionOnly ? undefined : cardPhotoIds(c).find((p) => p !== old && stackOf(p) === stackOf(action.photoId));
      const holder = state.cards.find(shown);
      if (holder?.id === card.id) return state;
      const cards = state.cards.map((c) => {
        if (c.id === card.id) return withPhoto(c, old, action.photoId);
        if (c.id !== holder?.id) return c;
        return old ? withPhoto(c, shown(c)!, old) : withoutPhoto(c, shown(c)!);
      });
      return withHistory({ ...state, match: remember(state.match, cards) }, cards);
    }

    case "addPhoto": {
      const card = state.cards.find((c) => c.id === action.cardId);
      if (!card) return state;
      const stackOf = stackLookup(state);
      const same = (c: Card) => cardPhotoIds(c).find((p) => stackOf(p) === stackOf(action.photoId));
      if (!card.captionOnly && same(card)) return state;
      // A photo that is in another part moves here.
      const cards = state.cards.map((c) => {
        if (c.id === card.id) return withPhoto(c, null, action.photoId);
        const there = c.captionOnly ? undefined : same(c);
        return there ? withoutPhoto(c, there) : c;
      });
      return withHistory({ ...state, match: remember(state.match, cards) }, cards);
    }

    case "removePhoto": {
      const cards = state.cards.map((c) => (c.id === action.cardId ? withoutPhoto(c, action.photoId) : c));
      return withHistory({ ...state, match: remember(state.match, cards) }, cards);
    }

    case "moveSentence": {
      const i = state.cards.findIndex((c) => c.id === action.cardId);
      const j = action.to === "previous" ? i - 1 : i + 1;
      const card = state.cards[i];
      const other = state.cards[j];
      if (!card || !other || card.sentenceIds.length === 0) return state;
      const moved = action.to === "previous" ? card.sentenceIds[0]! : card.sentenceIds[card.sentenceIds.length - 1]!;
      const cards = state.cards.map((c, k) => {
        if (k === i) return { ...c, sentenceIds: c.sentenceIds.filter((id) => id !== moved), textChanged: true };
        if (k === j) {
          const ids = action.to === "previous" ? [...c.sentenceIds, moved] : [moved, ...c.sentenceIds];
          return { ...c, sentenceIds: ids, textChanged: true };
        }
        return c;
      });
      // A part left with no words goes; its photos join the part that took its words.
      const emptied = cards[i]!.sentenceIds.length === 0 && !card.captionOnly ? cardPhotoIds(card) : [];
      const merged = cards.map((c, k) =>
        k === j && emptied.length
          ? emptied.reduce((acc, p) => (cardPhotoIds(acc).includes(p) ? acc : withPhoto(acc, null, p)), c)
          : c,
      );
      return withHistory(
        state,
        merged.filter((c) => c.sentenceIds.length > 0),
      );
    }

    case "toggleCaptionOnly":
      return withHistory(
        state,
        state.cards.map((c) => (c.id === action.cardId ? { ...c, captionOnly: !c.captionOnly } : c)),
      );

    case "setTarget": {
      // Before matching, this is the count chosen on the photos screen.
      if (!state.match) return { ...state, target: action.target };
      const cards = proposeCards(state.match, action.target, stackLookup(state), stanzaBreaks(state));
      return { ...withHistory(state, cards), target: action.target };
    }

    case "undo": {
      const previous = state.history[state.history.length - 1];
      if (!previous) return state;
      // An undone choice is no longer the user's choice.
      const match = remember(state.match, previous);
      return { ...state, match, cards: previous, history: state.history.slice(0, -1) };
    }
  }
}

/**
 * Sets the writing and its sentences (the user's, or Inkreel's when writing with Inkreel).
 * Different sentences mean the matches no longer fit; matching runs again (saved searches are reused).
 */
function withText(state: FlowState, text: string): FlowState {
  const sentences = locateSentences(text, state.mode === "help" ? "ai" : "user");
  const same =
    sentences.length === state.sentences.length &&
    sentences.every((s, i) => s.text === state.sentences[i]?.text && s.source === state.sentences[i]?.source);
  return {
    ...state,
    text,
    words: countWords(text),
    sentences,
    ...(same ? {} : { match: null, cards: [], history: [], target: null }),
  };
}

/** Stack ID for any photo, so two cards never show shots from one stack. */
export function stackLookup(state: Pick<FlowState, "stacks">): (photoId: string) => string {
  const map = new Map(state.stacks.flatMap((k) => k.photoIds.map((id) => [id, k.id] as const)));
  return (photoId) => map.get(photoId) ?? photoId;
}

/**
 * Chunks and matches in code. A card with the same sentences as one the user swapped keeps
 * the user's photo, and no other card takes a photo from that photo's stack.
 */
export function proposeCards(
  match: MatchData,
  target: number,
  stackOf: (photoId: string) => string = (id) => id,
  breaks: boolean[] = [],
): Card[] {
  const scores = match.byHand ? match.sentenceIds.map(() => []) : match.scores;
  const candidates = match.byHand ? [] : match.candidates;
  const chunks = chunkAndMatch(scores, candidates, target, breaks);

  const cards: Card[] = chunks.map((chunk, i) => {
    const sentenceIds = match.sentenceIds.slice(chunk.start, chunk.end);
    const fixed = match.fixed[sentenceIds.join(",")];
    return {
      id: `c${i + 1}`,
      sentenceIds,
      photoId: fixed ?? chunk.photoId,
      extras: [],
      alternatives: chunk.alternatives.filter((p) => p !== fixed),
      strength: chunk.strength,
      status: fixed ? "swapped" : "suggested",
      textChanged: false,
      captionOnly: false,
    };
  });

  // A suggestion that clashes with the user's choice moves to its next alternative from a free stack.
  const taken = new Set(cards.filter((c) => c.status === "swapped" && c.photoId).map((c) => stackOf(c.photoId!)));
  for (const card of cards) {
    if (card.status !== "suggested" || !card.photoId || !taken.has(stackOf(card.photoId))) continue;
    const free = card.alternatives.find((p) => !taken.has(stackOf(p)));
    card.photoId = free ?? null;
    card.alternatives = card.alternatives.filter((p) => p !== free);
    if (free) taken.add(stackOf(free));
  }

  // More photos than parts: the user's extra choices first, then each further photo goes to the
  // part it fits best. A part that already has photos is a little less likely to get another.
  const used = new Set(cards.flatMap((c) => cardPhotoIds(c).map(stackOf)));
  const count = () => cards.reduce((n, c) => n + cardPhotoIds(c).length, 0);
  const want = Math.min(target, MAX_PHOTOS);
  for (const card of cards) {
    if (!card.photoId) continue;
    for (const photoId of match.fixedExtras?.[card.sentenceIds.join(",")] ?? []) {
      if (used.has(stackOf(photoId))) continue;
      card.extras.push({ photoId, status: "swapped" });
      used.add(stackOf(photoId));
    }
  }
  if (candidates.length) {
    const scorer = makeRangeScorer(scores, candidates.length);
    const fit = chunks.map((chunk) => scorer(chunk.start, chunk.end));
    while (count() < want) {
      let best: { card: Card; photoId: string; value: number } | null = null;
      cards.forEach((card, ci) =>
        candidates.forEach((candidate, pi) => {
          if (used.has(stackOf(candidate.photoId))) return;
          const value = fit[ci]![pi]! - MATCHING.spreadWeight * cardPhotoIds(card).length;
          if (!best || value > best.value) best = { card, photoId: candidate.photoId, value };
        }),
      );
      if (!best) break;
      const { card, photoId } = best as { card: Card; photoId: string };
      if (card.photoId) card.extras.push({ photoId, status: "suggested" });
      else card.photoId = photoId;
      used.add(stackOf(photoId));
    }
  }
  for (const card of cards) card.alternatives = card.alternatives.filter((p) => !used.has(stackOf(p)));
  return cards;
}

/** A card's photos in the order they were taken. */
export function orderedPhotos(
  state: Pick<FlowState, "photos">,
  card: Pick<Card, "photoId" | "extras" | "status">,
): { photoId: string; status: "suggested" | "swapped" }[] {
  if (!card.photoId) return [];
  const at = new Map(state.photos.map((p) => [p.id, p.takenAt]));
  return [{ photoId: card.photoId, status: card.status }, ...card.extras]
    .map((photo, i) => ({ photo, i }))
    .sort((a, b) => (at.get(a.photo.photoId) ?? 0) - (at.get(b.photo.photoId) ?? 0) || a.i - b.i)
    .map(({ photo }) => photo);
}

/** The post's slides in order: each part's photos, part by part. */
export function slidesOf(state: Pick<FlowState, "photos" | "cards">): { cardId: string; photoId: string }[] {
  return state.cards
    .filter((c) => !c.captionOnly)
    .flatMap((c) => orderedPhotos(state, c).map(({ photoId }) => ({ cardId: c.id, photoId })));
}

/**
 * Most and fewest photos the user can ask for: up to one of every distinct shot. Matching by hand,
 * the number sets how many parts the writing is split into, and the user adds photos to them.
 */
export function targetBounds(state: FlowState): { min: number; max: number } {
  const most = state.match?.byHand ? state.sentences.length : (state.match?.candidates.length ?? state.stacks.length);
  return { min: 1, max: Math.max(1, Math.min(most || state.sentences.length, MAX_PHOTOS)) };
}

/** The photo estimate for the current writing, capped at the number of distinct photos once added. */
export function photoEstimate(state: FlowState): PhotoEstimate | null {
  return estimatePhotos(state.words, state.sentences.length, state.stacks.length || undefined);
}

/** The estimate from the writing alone, before photos are counted in. */
export function wordsEstimate(state: Pick<FlowState, "words" | "sentences">): PhotoEstimate | null {
  return estimatePhotos(state.words, state.sentences.length);
}

/** `breaks[i]` is true when a blank line follows sentence i: a stanza or paragraph ends there. */
export function stanzaBreaks(state: Pick<FlowState, "text" | "sentences">): boolean[] {
  return state.sentences
    .slice(0, -1)
    .map((s, i) => /\n[^\S\n]*\n/.test(state.text.slice(s.end, state.sentences[i + 1]!.start)));
}

/** Up to this many distinct photos, the post starts with all of them: the user picked them on purpose. */
export const USE_ALL_UP_TO = 10;

/** True when the user added few enough photos that Inkreel starts with every one. */
export function usesEveryPhoto(state: FlowState): boolean {
  const estimate = wordsEstimate(state);
  return state.stacks.length > 0 && state.stacks.length <= Math.max(USE_ALL_UP_TO, estimate?.max ?? 0);
}

/**
 * The photo count to aim for: every photo when there are only a few; else one per stanza when
 * the writing has stanzas and that fits the estimate; else the middle of the estimate.
 */
export function defaultTarget(state: FlowState): number {
  if (usesEveryPhoto(state)) return state.stacks.length;
  const estimate = photoEstimate(state);
  if (!estimate) return 1;
  const stanzas = stanzaBreaks(state).filter(Boolean).length + 1;
  if (stanzas > 1 && stanzas >= estimate.min && stanzas <= estimate.max) return stanzas;
  return Math.round((estimate.min + estimate.max) / 2);
}

/** Splits the writing into sentences and records where each one sits in it. */
export function locateSentences(text: string, source: Sentence["source"] = "user"): Sentence[] {
  let cursor = 0;
  return splitSentences(text).map((sentence, i) => {
    const start = text.indexOf(sentence, cursor);
    cursor = start + sentence.length;
    return { id: `s${i + 1}`, text: sentence, source, start, end: cursor };
  });
}

/**
 * A card's words exactly as the user wrote them: the slice of the writing from its first
 * sentence to its last, so line breaks inside a poem are kept.
 */
export function cardText(state: Pick<FlowState, "text" | "sentences">, card: Pick<Card, "sentenceIds">): string {
  const byId = new Map(state.sentences.map((s) => [s.id, s]));
  const first = byId.get(card.sentenceIds[0] ?? "");
  const last = byId.get(card.sentenceIds[card.sentenceIds.length - 1] ?? "");
  return first && last ? state.text.slice(first.start, last.end) : "";
}

/**
 * The caption: the writing exactly as the user wrote it, line breaks and stanzas included.
 * Every sentence is always in some card, in order, so this is also every card's text.
 */
export function captionOf(state: Pick<FlowState, "text" | "sentences">): string {
  const first = state.sentences[0];
  const last = state.sentences[state.sentences.length - 1];
  return first && last ? state.text.slice(first.start, last.end) : "";
}

/**
 * What goes in Instagram's caption box: the writing, then (writing with Inkreel) the draft's
 * hashtags on a line of their own. Hashtags are never matched to photos.
 */
export function postCaption(state: Pick<FlowState, "text" | "sentences" | "mode" | "hashtags">): string {
  const words = captionOf(state);
  const tags = state.mode === "help" ? state.hashtags : [];
  return tags.length && words ? `${words}\n\n${tags.join(" ")}` : words;
}
