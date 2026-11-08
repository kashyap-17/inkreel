import { photoEstimate, type FlowAction, type FlowState } from "@/lib/flow/flow";
import { formatEstimate } from "@/lib/words/estimate";
import { StepBar } from "./StepBar";

const EXAMPLE = `The fort at sunrise, nobody else there yet.

We got lost in the market and didn’t mind.

That last evening by the river, nothing moved.`;

export function WordsStep({ state, dispatch }: { state: FlowState; dispatch: (a: FlowAction) => void }) {
  const estimate = photoEstimate(state);
  return (
    <>
      <StepBar current={0} />
      <h1>Your words</h1>
      <p className="lede">
        Write it however it comes: notes from the trip, a poem, a few lines about how it felt. Inkreel splits it to fit
        your photos, and never changes a word.
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

      <p className="estimate" aria-live="polite">
        {estimate ? (
          <>
            <strong>{formatEstimate(estimate)}.</strong> You can change this after matching.
            {estimate.overLimit && " That’s a big post: Instagram allows 20 photos, so some of your words may go in the caption."}
          </>
        ) : (
          <span className="muted">As you write, you’ll see roughly how many photos it makes.</span>
        )}
      </p>

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
