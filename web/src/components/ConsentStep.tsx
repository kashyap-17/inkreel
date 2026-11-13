"use client";

import { useState } from "react";
import { AiError, savedInvite, saveInvite, verifyInvite } from "@/lib/ai/client";
import type { FlowAction, FlowState } from "@/lib/flow/flow";
import { StepBar } from "./StepBar";

export function ConsentStep({
  state,
  dispatch,
  onMatchByHand,
  message,
}: {
  state: FlowState;
  dispatch: (a: FlowAction) => void;
  onMatchByHand: () => void;
  /** Shown when matching came back here, e.g. a wrong invite code. */
  message?: string | null;
}) {
  const [code, setCode] = useState(savedInvite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(message ?? null);
  const count = state.photos.length;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      if (!(await verifyInvite(code.trim()))) {
        setError("That invite code isn’t right.");
        return;
      }
      saveInvite(code.trim());
      dispatch({ type: "goTo", step: "matching" });
    } catch (e) {
      setError(e instanceof AiError ? e.message : "Couldn’t reach Inkreel’s server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StepBar current={1} />
      <h1>Before anything is sent</h1>
      <p className="lede">
        To find the photos that fit your words, Inkreel uses Google’s Gemini AI. This is what it sends, once for this
        trip:
      </p>
      <ul className="consent card">
        <li>
          <strong>
            Small copies of your {count === 1 ? "photo" : `${count} photos`}
          </strong>
          , with location and camera details removed. Your originals stay on your phone.
        </li>
        <li>
          <strong>Your writing</strong>, to work out what each line could look like as a photo.
        </li>
        <li>
          <strong>A few of the matched photos</strong> again, to check each match and say why it fits.
        </li>
      </ul>
      <p className="small muted">
        Google’s Gemini API terms apply to what Google receives. Inkreel’s server passes the requests on and keeps
        nothing.
      </p>

      <label htmlFor="invite" className="small">
        Invite code
      </label>
      <input
        id="invite"
        className="text-input"
        autoComplete="off"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="From whoever shared Inkreel with you"
      />
      {error && <p className="warn">{error}</p>}

      <div className="row actions">
        <button type="button" className="secondary" onClick={() => dispatch({ type: "goTo", step: "photos" })}>
          Back
        </button>
        <button type="button" disabled={busy} onClick={() => void send()}>
          {busy ? "Checking…" : "Send and find matches"}
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
