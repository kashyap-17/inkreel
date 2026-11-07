"use client";

import { useEffect, useReducer } from "react";
import { flowReducer, initialFlow } from "@/lib/flow/flow";
import { PhotoStep } from "./PhotoStep";
import { StartScreen } from "./StartScreen";
import { StepBar } from "./StepBar";
import { WordsStep } from "./WordsStep";

export function Flow() {
  const [state, dispatch] = useReducer(flowReducer, initialFlow);
  const pieces = state.pieces.length;

  // Each step starts at the top of the page.
  useEffect(() => window.scrollTo(0, 0), [state.step]);

  return (
    <main>
      {state.step === "start" && <StartScreen onChoose={(mode) => dispatch({ type: "chooseMode", mode })} />}
      {state.step === "words" && <WordsStep state={state} dispatch={dispatch} />}

      {/* Kept mounted while hidden, so going back to the words keeps the chosen photos. */}
      <div hidden={state.step !== "photos"}>
        <StepBar current={1} />
        <h1>Now, the photos</h1>
        <p className="lede">
          Choose every photo from the trip, even hundreds. Inkreel sorts them into moments, so your{" "}
          {pieces === 1 ? "piece of writing" : `${pieces} pieces of writing`} can find the right ones.
        </p>
        <p className="muted">
          A moment is a run of photos taken close together: a morning at the market, an evening by the river. Your
          words are matched to moments, and you pick the photo.
        </p>
        <p className="muted small">Your photos stay on your phone.</p>
        <PhotoStep
          footer={(moments) => (
            <div className="card next">
              <strong>Next: matching</strong>
              <p className="small">
                Inkreel will match your {pieces === 1 ? "piece" : `${pieces} pieces`} to these {moments} moments, each
                with a short reason. This step is being built.
              </p>
            </div>
          )}
        />
        <div className="row actions">
          <button type="button" className="secondary" onClick={() => dispatch({ type: "goTo", step: "words" })}>
            Back to your words
          </button>
        </div>
      </div>
    </main>
  );
}
