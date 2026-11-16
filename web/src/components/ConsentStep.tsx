"use client";

import type { FlowAction, FlowState } from "@/lib/flow/flow";
import { StepBar } from "./StepBar";

export function ConsentStep({
  state,
  dispatch,
  onMatchByHand,
}: {
  state: FlowState;
  dispatch: (a: FlowAction) => void;
  onMatchByHand: () => void;
}) {
  const count = state.photos.length;

  return (
    <>
      <StepBar current={1} />
      {/* Writing with Inkreel, the answers were already sent (with a note) to draft the lines. */}
      <h1>{state.mode === "help" ? "Before your photos are sent" : "Before anything is sent"}</h1>
      <p className="lede">
        To find the photos that fit your words, Inkreel uses Google’s Gemini AI. This is what it sends, once for these
        photos:
      </p>
      <ul className="consent card">
        <li>
          <strong>
            Small copies of your {count === 1 ? "photo" : `${count} photos`}
          </strong>
          , with location and camera details removed. Your originals stay on your phone.
        </li>
        <li>
          <strong>{state.mode === "help" ? "Your lines" : "Your writing"}</strong>, to work out what each line could look
          like as a photo.
        </li>
        <li>
          <strong>A few of the matched photos</strong> again, to check each match and say why it fits.
        </li>
      </ul>
      <p className="small muted">
        Google’s Gemini API terms apply to what Google receives. Inkreel’s server passes the requests on and keeps
        nothing.
      </p>

      <div className="row actions">
        <button type="button" className="secondary" onClick={() => dispatch({ type: "goTo", step: "photos" })}>
          Back
        </button>
        <button type="button" onClick={() => dispatch({ type: "goTo", step: "matching" })}>
          Send and find matches
        </button>
      </div>
      <p className="small">
        <button type="button" className="link" onClick={onMatchByHand}>
          Match by hand instead
        </button>{" "}
        <span className="muted">Nothing is sent; you pick a photo for each part of your writing.</span>
      </p>
    </>
  );
}
