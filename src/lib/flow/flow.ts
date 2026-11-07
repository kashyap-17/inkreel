// The flow as a typed state machine (a reducer). Steps follow docs/plan.md:
// words first, then photos; matching and sharing come next.
import { joiner, splitText, suggestSplit, type SplitBy } from "@/lib/words/pieces";

export type Mode = "own" | "help" | "mix";
export type Step = "start" | "words" | "photos";

export interface Piece {
  id: string;
  text: string;
  /** Who wrote it. Only "user" exists until "help me write" and "mix" are built. */
  source: "user" | "ai";
}

export interface FlowState {
  step: Step;
  mode: Mode | null;
  text: string;
  splitBy: SplitBy;
  /** True once the user picks a split themselves, so typing doesn't override it. */
  splitChosen: boolean;
  pieces: Piece[];
}

export type FlowAction =
  | { type: "chooseMode"; mode: Mode }
  | { type: "setText"; text: string }
  | { type: "setSplit"; splitBy: SplitBy }
  | { type: "joinWithNext"; index: number }
  | { type: "goTo"; step: Step };

export const initialFlow: FlowState = {
  step: "start",
  mode: null,
  text: "",
  splitBy: "paragraph",
  splitChosen: false,
  pieces: [],
};

const toPieces = (parts: string[]): Piece[] =>
  parts.map((text, i) => ({ id: `w${i + 1}`, text, source: "user" }));

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "chooseMode":
      // Only "I have writing" is built so far.
      if (action.mode !== "own") return state;
      return { ...state, mode: action.mode, step: "words" };

    case "setText": {
      const splitBy = state.splitChosen ? state.splitBy : suggestSplit(action.text);
      return { ...state, text: action.text, splitBy, pieces: toPieces(splitText(action.text, splitBy)) };
    }

    case "setSplit":
      return {
        ...state,
        splitBy: action.splitBy,
        splitChosen: true,
        pieces: toPieces(splitText(state.text, action.splitBy)),
      };

    case "joinWithNext": {
      const { index } = action;
      const a = state.pieces[index];
      const b = state.pieces[index + 1];
      if (!a || !b) return state;
      const texts = state.pieces.map((p) => p.text);
      texts.splice(index, 2, `${a.text}${joiner(state.splitBy)}${b.text}`);
      return { ...state, pieces: toPieces(texts) };
    }

    case "goTo":
      if (action.step === "photos" && state.pieces.length === 0) return state;
      return { ...state, step: action.step };
  }
}
