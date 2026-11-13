// The flow as a typed state machine (a reducer). Steps follow docs/plan.md:
// words → photos → consent → matching → review → preview.
import { chunkAndMatch, type Candidate } from "@/lib/match/chunk";
import type { PhotoRecord, Stack } from "@/lib/photos/types";
import { estimatePhotos, type PhotoEstimate } from "@/lib/words/estimate";
import { countWords, splitSentences } from "@/lib/words/sentences";

export type Mode = "own" | "help" | "mix";
export type Step = "start" | "words" | "photos" | "consent" | "matching" | "review" | "preview";

export interface Sentence {
  id: string;
  text: string;
  /** Who wrote it. Only "user" exists until "help me write" and "mix" are built. */
  source: "user" | "ai";
  /** Where it sits in the writing, so a card's text is an exact slice of what the user wrote. */
  start: number;
  end: number;
}

export interface Verdict {
  fits: boolean;
  reason: string;
}

/** One slide: a run of consecutive sentences and the photo shown with them. */
export interface Card {
  id: string;
  sentenceIds: string[];
  photoId: string | null;
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
  /** Which model wrote the photo searches (Flash, or Lite as the fallback); absent if none ran. */
  queriesModel?: string;
  /** True when the searches couldn't be written and the sentences themselves were searched. */
  searchesFellBack?: boolean;
  /** Shown to the user, e.g. when some photos couldn't be indexed. */
  notes: string[];
}

export interface FlowState {
  step: Step;
  mode: Mode | null;
  /** The writing exactly as the user typed or pasted it. */
  text: string;
  sentences: Sentence[];
  words: number;
  /** Prepared photos in capture order. */
  photos: PhotoRecord[];
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
  | { type: "goTo"; step: Step }
  | { type: "setPhotos"; photos: PhotoRecord[]; stacks: Stack[] }
  | { type: "matched"; match: MatchData; cards: Card[]; target: number }
  | { type: "verdicts"; verdicts: Record<string, Verdict> }
  | { type: "swap"; cardId: string; photoId: string }
  | { type: "moveSentence"; cardId: string; to: "previous" | "next" }
  | { type: "toggleCaptionOnly"; cardId: string }
  | { type: "setTarget"; target: number }
  | { type: "undo" };

export const initialFlow: FlowState = {
  step: "start",
  mode: null,
  text: "",
  sentences: [],
  words: 0,
  photos: [],
  stacks: [],
  target: null,
  match: null,
  cards: [],
  history: [],
};

export const verdictKey = (sentenceIds: string[], photoId: string) => `${sentenceIds.join(",")}|${photoId}`;

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
      return { ...initialFlow, ...action.state };

    case "reset":
      return initialFlow;

    case "chooseMode":
      // Only "I have writing" is built so far.
      if (action.mode !== "own") return state;
      return { ...state, mode: action.mode, step: "words" };

    case "setText": {
      const sentences = locateSentences(action.text);
      const same =
        sentences.length === state.sentences.length && sentences.every((s, i) => s.text === state.sentences[i]?.text);
      return {
        ...state,
        text: action.text,
        words: countWords(action.text),
        sentences,
        // Different sentences mean the matches no longer fit; matching runs again (saved searches are reused).
        ...(same ? {} : { match: null, cards: [], history: [], target: null }),
      };
    }

    case "goTo":
      return canGoTo(state, action.step) ? { ...state, step: action.step } : state;

    case "setPhotos":
      return { ...state, photos: action.photos, stacks: action.stacks, match: null, cards: [], history: [], target: null };

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
      // A post never repeats a shot: if another slide shows this scene, the two slides trade photos.
      const stackOf = stackLookup(state);
      const other = state.cards.find(
        (c) => c.id !== card.id && !c.captionOnly && c.photoId && stackOf(c.photoId) === stackOf(action.photoId),
      );
      const fixed = { ...state.match?.fixed, [card.sentenceIds.join(",")]: action.photoId };
      if (other) {
        if (card.photoId) fixed[other.sentenceIds.join(",")] = card.photoId;
        else delete fixed[other.sentenceIds.join(",")];
      }
      const match = state.match && { ...state.match, fixed };
      const chosen = (c: Card, photoId: string | null): Card => ({
        ...c,
        photoId,
        status: "swapped",
        textChanged: false,
        captionOnly: false,
        alternatives: c.photoId ? [c.photoId, ...c.alternatives.filter((p) => p !== photoId)] : c.alternatives,
      });
      return withHistory(
        { ...state, match },
        state.cards.map((c) =>
          c.id === card.id ? chosen(c, action.photoId) : c.id === other?.id ? chosen(c, card.photoId) : c,
        ),
      );
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
      return withHistory(
        state,
        cards.filter((c) => c.sentenceIds.length > 0),
      );
    }

    case "toggleCaptionOnly":
      return withHistory(
        state,
        state.cards.map((c) => (c.id === action.cardId ? { ...c, captionOnly: !c.captionOnly } : c)),
      );

    case "setTarget": {
      if (!state.match) return state;
      const cards = proposeCards(state.match, action.target, stackLookup(state), stanzaBreaks(state));
      return { ...withHistory(state, cards), target: action.target };
    }

    case "undo": {
      const previous = state.history[state.history.length - 1];
      if (!previous) return state;
      // An undone swap is no longer the user's choice.
      let match = state.match;
      if (match) {
        const fixed = { ...match.fixed };
        for (const card of state.cards) {
          const before = previous.find((c) => c.id === card.id);
          if (card.status === "swapped" && before?.photoId !== card.photoId) delete fixed[card.sentenceIds.join(",")];
        }
        match = { ...match, fixed };
      }
      return { ...state, match, cards: previous, history: state.history.slice(0, -1) };
    }
  }
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
  return cards;
}

/** Most and fewest photos the user can ask for. */
export function targetBounds(state: FlowState): { min: number; max: number } {
  const stacks = state.match?.byHand ? state.photos.length : (state.match?.candidates.length ?? state.stacks.length);
  return { min: 1, max: Math.max(1, Math.min(state.sentences.length, stacks || state.sentences.length, 20)) };
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

/**
 * True when the user added no more distinct photos than the writing needs: Inkreel then uses
 * every one and only decides which part each goes with.
 */
export function usesEveryPhoto(state: FlowState): boolean {
  const estimate = wordsEstimate(state);
  return estimate !== null && state.stacks.length > 0 && state.stacks.length <= estimate.max;
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
export function locateSentences(text: string): Sentence[] {
  let cursor = 0;
  return splitSentences(text).map((sentence, i) => {
    const start = text.indexOf(sentence, cursor);
    cursor = start + sentence.length;
    return { id: `s${i + 1}`, text: sentence, source: "user", start, end: cursor };
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
