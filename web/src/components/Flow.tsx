"use client";

import { useEffect, useReducer } from "react";
import { flowReducer, initialFlow, photoEstimate } from "@/lib/flow/flow";
import { formatEstimate } from "@/lib/words/estimate";
import { PhotoStep } from "./PhotoStep";
import { StartScreen } from "./StartScreen";
import { StepBar } from "./StepBar";
import { WordsStep } from "./WordsStep";

export function Flow() {
  const [state, dispatch] = useReducer(flowReducer, initialFlow);
  const estimate = photoEstimate(state);

  // Block body on purpose: newer browsers return a Promise from scrollTo, and React would
  // treat a returned value as a clean-up function and crash on the next step change.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.step]);

  return (
    <main>
      {state.step === "start" && <StartScreen onChoose={(mode) => dispatch({ type: "chooseMode", mode })} />}
      {state.step === "words" && <WordsStep state={state} dispatch={dispatch} />}

      {/* Kept mounted while hidden, so going back to the words keeps the chosen photos. */}
      <div hidden={state.step !== "photos"}>
        <StepBar current={1} />
        <h1>Now, the photos</h1>
        <p className="lede">
          Choose every photo from the trip, even hundreds. Inkreel sorts them into moments, then finds the ones that
          go with your words.
        </p>
        <p className="muted">
          A moment is a run of photos taken close together: a morning at the market, an evening by the river.
        </p>
        <p className="muted small">Your photos stay on your phone.</p>
        <PhotoStep
          footer={(moments) => {
            const capped = photoEstimate(state, moments);
            return (
              <div className="card next">
                <strong>Next: matching</strong>
                <p className="small">
                  Inkreel will split your writing to fit these {moments} moments and pick a photo for each, with a
                  short reason.
                  {capped && ` ${formatEstimate(capped)} for this trip.`}
                  {capped && estimate && capped.max < estimate.min && " Fewer than your writing suggests, because the trip has fewer moments."}
                </p>
                <p className="small muted">This step is being built.</p>
              </div>
            );
          }}
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
