// The test record: one file that shows what Inkreel did on a trip and what the user changed,
// to send with feedback. Photo details only (time, size, hash, sharpness); never the photos.
import { APP_NAME } from "@/config/app";
import { EMBED_DIMENSIONS, MODELS, PROMPT_VERSIONS } from "@/config/ai";
import { displayClock } from "@/lib/photos/format";
import { photoIssue } from "@/lib/photos/quality";
import { cardText, captionOf, verdictKey, type FlowAction, type FlowState } from "./flow";

export const RECORD_VERSION = 1;

export interface RecordEvent {
  at: string;
  action: string;
  detail?: Record<string, unknown>;
}

export interface SavedSearch {
  readings: string[];
  partOfDay: string;
  day: number;
}

/** A short entry for the action log; large payloads are reduced to counts. Null = not logged. */
export function describeAction(action: FlowAction, at: Date): RecordEvent | null {
  const stamp = at.toISOString();
  switch (action.type) {
    case "restore":
    case "verdicts":
      return null;
    case "setText":
      return { at: stamp, action: "setText", detail: { characters: action.text.length } };
    case "setAnswer":
      return { at: stamp, action: "setAnswer", detail: { section: action.section, characters: action.text.length } };
    case "setDraft":
      return {
        at: stamp,
        action: "setDraft",
        detail: { lines: action.lines.length, flagged: action.lines.filter((l) => l.flagged).length },
      };
    case "editLine":
      return { at: stamp, action: "editLine", detail: { lineId: action.lineId, characters: action.text.length } };
    case "setPhotos":
      return {
        at: stamp,
        action: "setPhotos",
        detail: { photos: action.photos.length, stacks: action.stacks.length, setAside: action.setAside?.length ?? 0 },
      };
    case "matched":
      return {
        at: stamp,
        action: "matched",
        detail: { cards: action.cards.length, target: action.target, byHand: action.match.byHand },
      };
    default: {
      const { type, ...detail } = action;
      return { at: stamp, action: type, ...(Object.keys(detail).length ? { detail } : {}) };
    }
  }
}

const round = (x: number) => Math.round(x * 10_000) / 10_000;
const localTime = (p: FlowState["photos"][number]) => displayClock(p).toISOString().slice(0, 19);

export function buildTestRecord(
  state: FlowState,
  extras: { searches: (SavedSearch | null)[]; events: RecordEvent[]; now: Date },
) {
  const stackOf = new Map(state.stacks.flatMap((k) => k.photoIds.map((id) => [id, k.id] as const)));
  const topPicks = new Set(state.stacks.map((k) => k.topPick));
  const match = state.match;

  return {
    record: `${APP_NAME} test record`,
    recordVersion: RECORD_VERSION,
    createdAt: extras.now.toISOString(),
    step: state.step,
    settings: { models: MODELS, promptVersions: PROMPT_VERSIONS, embedDimensions: EMBED_DIMENSIONS },
    writing: {
      mode: state.mode,
      /** Write with Inkreel: the answers and the draft's lines (edited ones marked). */
      answers: state.mode === "help" ? state.answers : null,
      draft: state.mode === "help" ? state.draft : null,
      text: state.text,
      words: state.words,
      sentences: state.sentences.map((s, i) => ({
        id: s.id,
        text: s.text,
        source: s.source,
        search: extras.searches[i] ?? null,
      })),
    },
    photos: state.photos.map((p) => ({
      id: p.id,
      fileName: p.fileName,
      takenLocal: localTime(p),
      timeSource: p.timeSource,
      offsetMinutes: p.offsetMinutes,
      hasLocation: p.gps !== null,
      width: p.width,
      height: p.height,
      hash: p.hash,
      sharpness: round(p.sharpness),
      dark: p.dark === undefined ? null : round(p.dark),
      bright: p.bright === undefined ? null : round(p.bright),
      stack: stackOf.get(p.id) ?? null,
      topPick: topPicks.has(p.id),
    })),
    stacks: state.stacks,
    setAside: state.setAside.map((p) => ({
      id: p.id,
      fileName: p.fileName,
      issue: photoIssue(p),
      sharpness: round(p.sharpness),
      dark: p.dark === undefined ? null : round(p.dark),
      bright: p.bright === undefined ? null : round(p.bright),
    })),
    matching: match && {
      byHand: match.byHand,
      queriesModel: match.queriesModel ?? null,
      searchesFellBack: match.searchesFellBack ?? false,
      timings: match.timings ?? null,
      notes: match.notes,
      target: state.target,
      candidates: match.candidates,
      /** scores[sentence][candidate], in the order of writing.sentences and candidates. */
      scores: match.scores.map((row) => row.map(round)),
      verdicts: match.verdicts,
      fixed: match.fixed,
    },
    cards: state.cards.map((c) => ({
      ...c,
      text: cardText(state, c),
      verdict: c.photoId && match ? (match.verdicts[verdictKey(c.sentenceIds, c.photoId)] ?? null) : null,
    })),
    caption: state.cards.length ? captionOf(state) : null,
    undoSteps: state.history.length,
    events: extras.events,
  };
}
