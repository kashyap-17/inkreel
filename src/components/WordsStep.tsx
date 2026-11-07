import type { FlowAction, FlowState } from "@/lib/flow/flow";
import { StepBar } from "./StepBar";

const EXAMPLE = `The fort at sunrise, nobody else there yet.

We got lost in the market and didn’t mind.

That last evening by the river, nothing moved.`;

export function WordsStep({ state, dispatch }: { state: FlowState; dispatch: (a: FlowAction) => void }) {
  const count = state.pieces.length;
  return (
    <>
      <StepBar current={0} />
      <h1>Your words</h1>
      <p className="lede">
        Paste or type anything from the trip. Each piece of writing will get its own photo, so a few short pieces work
        best.
      </p>

      <label htmlFor="writing" className="visually-hidden">
        Your writing
      </label>
      <textarea
        id="writing"
        rows={9}
        placeholder={EXAMPLE}
        value={state.text}
        onChange={(e) => dispatch({ type: "setText", text: e.target.value })}
      />

      {count > 0 && (
        <>
          <div className="row pieces-head">
            <strong>
              {count} {count === 1 ? "piece" : "pieces"}
            </strong>
            <div className="toggle small" role="group" aria-label="Split into pieces by">
              <span className="muted">Split by</span>
              <button
                type="button"
                className={state.splitBy === "paragraph" ? "on" : undefined}
                onClick={() => dispatch({ type: "setSplit", splitBy: "paragraph" })}
              >
                Paragraph
              </button>
              <button
                type="button"
                className={state.splitBy === "line" ? "on" : undefined}
                onClick={() => dispatch({ type: "setSplit", splitBy: "line" })}
              >
                Line
              </button>
            </div>
          </div>
          <ol className="pieces">
            {state.pieces.map((p, i) => (
              <li key={p.id} className="card">
                <p className="piece-text">{p.text}</p>
                <div className="row small">
                  <span className="tag">{p.source === "user" ? "Yours" : "AI"}</span>
                  {i < count - 1 && (
                    <button
                      type="button"
                      className="link"
                      onClick={() => dispatch({ type: "joinWithNext", index: i })}
                    >
                      Join with next
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <p className="muted small">Your words aren’t changed. To edit them, edit the text above.</p>
        </>
      )}

      <div className="row actions">
        <button type="button" className="secondary" onClick={() => dispatch({ type: "goTo", step: "start" })}>
          Back
        </button>
        <button type="button" disabled={count === 0} onClick={() => dispatch({ type: "goTo", step: "photos" })}>
          Next: add photos
        </button>
      </div>
    </>
  );
}
