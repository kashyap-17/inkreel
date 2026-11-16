"use client";

import { useRef, useState } from "react";
import type { FlowAction, FlowState } from "@/lib/flow/flow";
import { filledSections, SECTIONS, type SectionKey } from "@/lib/words/draft";
import { draftError, requestDraft } from "./drafting";
import { DraftingNote } from "./DraftingNote";
import { StepBar } from "./StepBar";

/** The server takes up to this many characters per answer. */
const MAX_ANSWER = 3000;

/** Write with Inkreel, first part: one writing surface with a labelled section per question. */
export function AnswersStep({
  state,
  dispatch,
  onInviteRejected,
}: {
  state: FlowState;
  dispatch: (a: FlowAction) => void;
  onInviteRejected: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Asked once: with only one answer, a second detail makes the lines more the person's own.
  const [nudge, setNudge] = useState<"not yet" | "showing" | "done">("not yet");
  const fields = useRef<Partial<Record<SectionKey, HTMLTextAreaElement | null>>>({});
  const filled = filledSections(state.answers);
  // The nudge suggests the sections that help most: a moment, a place, how it felt.
  const missing = SECTIONS.filter((s) => s.key !== "other" && !filled.includes(s.key)).slice(0, 2);

  async function draft(anyway = false) {
    if (filled.length === 0) {
      setError("Write something in at least one section first.");
      return;
    }
    if (!anyway && filled.length === 1 && nudge === "not yet") {
      setNudge("showing");
      return;
    }
    setNudge("done");
    if (state.draft.some((l) => l.edited) && !window.confirm("Draft again? Your changes to the lines will be replaced.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      dispatch({ type: "setDraft", lines: await requestDraft(state.answers) });
    } catch (e) {
      setError(draftError(e, onInviteRejected));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StepBar current={0} />
      <h1>A few thoughts for your caption</h1>
      <p className="lede">
        Write about one or more. A few words is enough. Inkreel turns them into short lines and finds the photos that go
        with them.
      </p>

      <div className="answers">
        {SECTIONS.map((s) => (
          <div key={s.key} className="answer">
            <label htmlFor={`answer-${s.key}`}>{s.label}</label>
            <textarea
              id={`answer-${s.key}`}
              ref={(el) => {
                fields.current[s.key] = el;
              }}
              rows={2}
              maxLength={MAX_ANSWER}
              value={state.answers[s.key]}
              onChange={(e) => dispatch({ type: "setAnswer", section: s.key, text: e.target.value })}
            />
          </div>
        ))}
      </div>

      {nudge === "showing" && (
        <div className="warn nudge">
          <p>
            A second detail makes the lines more yours. Add {missing.map((s) => s.short).join(" or ")}?
          </p>
          <div className="row">
            <button
              type="button"
              className="secondary small-button"
              onClick={() => {
                setNudge("done");
                fields.current[missing[0]!.key]?.focus();
              }}
            >
              Add one
            </button>
            <button type="button" className="secondary small-button" onClick={() => void draft(true)}>
              Draft anyway
            </button>
          </div>
        </div>
      )}
      {error && <p className="warn">{error}</p>}
      {busy && <DraftingNote />}

      <p className="small muted">Your answers go to Google’s Gemini AI to draft the lines.</p>
      <div className="row actions">
        <button type="button" className="secondary" onClick={() => dispatch({ type: "goTo", step: "start" })}>
          Back
        </button>
        <button type="button" disabled={busy} onClick={() => void draft()}>
          {busy ? "Drafting…" : state.draft.length ? "Draft again from these" : "Next: draft it with Inkreel"}
        </button>
      </div>
      {state.draft.length > 0 && !busy && (
        <p className="small">
          <button type="button" className="link" onClick={() => dispatch({ type: "goTo", step: "draft" })}>
            Back to your lines
          </button>{" "}
          <span className="muted">without a new draft</span>
        </p>
      )}
    </>
  );
}
