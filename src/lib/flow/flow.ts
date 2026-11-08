// The flow as a typed state machine (a reducer). Steps follow docs/plan.md:
// words first, then photos; chunking and matching come next.
import { estimatePhotos, type PhotoEstimate } from "@/lib/words/estimate";
import { countWords, splitSentences } from "@/lib/words/sentences";

export type Mode = "own" | "help" | "mix";
export type Step = "start" | "words" | "photos";

export interface Sentence {
  id: string;
  text: string;
  /** Who wrote it. Only "user" exists until "help me write" and "mix" are built. */
  source: "user" | "ai";
}

export interface FlowState {
  step: Step;
  mode: Mode | null;
  /** The writing exactly as the user typed or pasted it. */
  text: string;
  sentences: Sentence[];
  words: number;
}

export type FlowAction =
  | { type: "chooseMode"; mode: Mode }
  | { type: "setText"; text: string }
  | { type: "goTo"; step: Step };

export const initialFlow: FlowState = { step: "start", mode: null, text: "", sentences: [], words: 0 };

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "chooseMode":
      // Only "I have writing" is built so far.
      if (action.mode !== "own") return state;
      return { ...state, mode: action.mode, step: "words" };

    case "setText":
      return {
        ...state,
        text: action.text,
        words: countWords(action.text),
        sentences: splitSentences(action.text).map((text, i) => ({ id: `s${i + 1}`, text, source: "user" })),
      };

    case "goTo":
      if (action.step === "photos" && state.sentences.length === 0) return state;
      return { ...state, step: action.step };
  }
}

/** The photo estimate for the current writing, optionally capped at the number of moments. */
export function photoEstimate(state: FlowState, moments?: number): PhotoEstimate | null {
  return estimatePhotos(state.words, state.sentences.length, moments);
}
