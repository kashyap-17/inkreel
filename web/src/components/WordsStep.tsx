import type { FlowAction, FlowState } from "@/lib/flow/flow";
import { StepBar } from "./StepBar";

const EXAMPLE = `The fort at sunrise, nobody else there yet.

We got lost in the market and didn’t mind.

That last evening by the river, nothing moved.`;

export function WordsStep({ state, dispatch }: { state: FlowState; dispatch: (a: FlowAction) => void }) {
  return (
    <>
      <StepBar current={0} />
      <h1>Your words</h1>
      <p className="lede">
        Write it however it comes: notes, a poem, a few lines about how it felt. Inkreel finds the photos that go
        with it, and never changes a word.
      </p>

      <label htmlFor="writing" className="visually-hidden">
        Your writing
      </label>
      <textarea
        id="writing"
        rows={10}
        placeholder={EXAMPLE}
        value={state.text}
        onChange={(e) => dispatch({ type: "setText", text: e.target.value })}
      />

      <div className="row actions">
        <button type="button" className="secondary" onClick={() => dispatch({ type: "goTo", step: "start" })}>
          Back
        </button>
        <button
          type="button"
          disabled={state.sentences.length === 0}
          onClick={() => dispatch({ type: "goTo", step: "photos" })}
        >
          Next: add photos
        </button>
      </div>
    </>
  );
}
