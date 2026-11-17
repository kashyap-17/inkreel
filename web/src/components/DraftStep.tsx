"use client";

import { useState } from "react";
import type { FlowAction, FlowState } from "@/lib/flow/flow";
import { ownWords, unknownNames, type Answers, type DraftLine } from "@/lib/words/draft";
import { draftError, requestDraft } from "./drafting";
import { DraftingNote } from "./DraftingNote";
import { StepBar } from "./StepBar";

/**
 * Write with Inkreel, second part: the drafted lines. Each shows the words of the person's it
 * came from, with their own words highlighted; any line can be edited or dropped.
 */
export function DraftStep({
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

  async function again() {
    if (state.draft.some((l) => l.edited) && !window.confirm("Draft again? Your changes to these lines will be replaced.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      dispatch({ type: "setDraft", ...(await requestDraft(state.answers)) });
    } catch (e) {
      setError(draftError(e, onInviteRejected));
    } finally {
      setBusy(false);
    }
  }

  const hasOwnWords = state.draft.some((l) => ownWords(l.text, state.answers).some((p) => p.mine));

  return (
    <>
      <StepBar current={0} />
      <h1>Your lines</h1>
      <p className="lede">Drafted from your answers. Change any line, or drop it.</p>
      <span className="label ai">Written with Inkreel</span>

      <ol className="draft-lines">
        {state.draft.map((line) => (
          <LineItem key={line.id} line={line} answers={state.answers} dispatch={dispatch} />
        ))}
      </ol>
      {state.draft.length === 0 && <p className="muted">No lines left. Draft again, or change your answers.</p>}
      {hasOwnWords && (
        <p className="small muted legend">
          <mark className="mine">Highlighted</mark> words are yours.
        </p>
      )}

      {state.hashtags.length > 0 && (
        <div className="hashtags">
          <p className="small muted">Hashtags, added at the end of your caption:</p>
          <ul className="row">
            {state.hashtags.map((tag) => (
              <li key={tag} className="tag">
                {tag}
                <button
                  type="button"
                  className="link"
                  aria-label={`Remove ${tag}`}
                  onClick={() => dispatch({ type: "dropHashtag", tag })}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="warn">{error}</p>}
      {busy && <DraftingNote />}

      <div className="row card-actions">
        <button type="button" className="secondary small-button" disabled={busy} onClick={() => void again()}>
          {busy ? "Drafting…" : "Draft again"}
        </button>
      </div>

      <div className="row actions">
        <button type="button" className="secondary" onClick={() => dispatch({ type: "goTo", step: "words" })}>
          Change my answers
        </button>
        <button
          type="button"
          disabled={state.sentences.length === 0 || busy}
          onClick={() => dispatch({ type: "goTo", step: "photos" })}
        >
          Next: add photos
        </button>
      </div>
    </>
  );
}

function LineItem({
  line,
  answers,
  dispatch,
}: {
  line: DraftLine;
  answers: Answers;
  dispatch: (a: FlowAction) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const names = line.flagged ? unknownNames(line.text, answers) : [];

  if (editing !== null) {
    return (
      <li className="draft-line">
        <label htmlFor={`line-${line.id}`} className="visually-hidden">
          Edit this line
        </label>
        <textarea
          id={`line-${line.id}`}
          rows={2}
          maxLength={400}
          autoFocus
          value={editing}
          onChange={(e) => setEditing(e.target.value)}
        />
        <div className="row card-actions">
          <button
            type="button"
            className="small-button"
            onClick={() => {
              if (editing.trim() !== line.text) dispatch({ type: "editLine", lineId: line.id, text: editing });
              setEditing(null);
            }}
          >
            Done
          </button>
          <button type="button" className="link small" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="draft-line">
      <p className="line-text">
        {ownWords(line.text, answers).map((part, i) =>
          part.mine ? (
            <mark key={i} className="mine">
              {part.text}
            </mark>
          ) : (
            part.text
          ),
        )}
      </p>
      <div className="small">
        {line.edited && <span className="label you">Edited by you</span>}
        {line.flagged && <span className="label weak">Check this line</span>}
        {/* Most lines are in Inkreel's words (the draft is labelled as a whole); a line that keeps the
            person's own words says which. */}
        {!line.edited && line.quote && <p className="muted source">From your answer: “{line.quote}”</p>}
        {names.length > 0 && (
          <p className="muted source">
            {names.map((n) => `“${n}”`).join(", ")} {names.length === 1 ? "isn’t" : "aren’t"} in your answers.
          </p>
        )}
      </div>
      <div className="row card-actions">
        <button type="button" className="secondary small-button" onClick={() => setEditing(line.text)}>
          Edit
        </button>
        <button
          type="button"
          className="link small"
          onClick={() => dispatch({ type: "dropLine", lineId: line.id })}
        >
          Drop
        </button>
      </div>
    </li>
  );
}
