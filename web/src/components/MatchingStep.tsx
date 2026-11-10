"use client";

import { useEffect, useRef, useState } from "react";
import { AiError } from "@/lib/ai/client";
import { photoEstimate, type FlowAction, type FlowState } from "@/lib/flow/flow";
import { defaultTarget, runMatching, type Stage } from "@/lib/match/run";
import { StepBar } from "./StepBar";

function describe(stage: Stage | null): { label: string; done?: number; total?: number } {
  switch (stage?.kind) {
    case "index":
      return { label: "Looking through your photos", done: stage.done, total: stage.total };
    case "queries":
      return { label: "Working out what each line would look like" };
    case "match":
      return { label: "Matching your words to photos" };
    case "check":
      return { label: "Checking the matches", done: stage.done, total: stage.total };
    default:
      return { label: "Starting" };
  }
}

export function MatchingStep({
  state,
  dispatch,
  onMatchByHand,
  onInviteRejected,
}: {
  state: FlowState;
  dispatch: (a: FlowAction) => void;
  onMatchByHand: () => void;
  onInviteRejected: (message: string) => void;
}) {
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  useEffect(() => {
    // Runs once per attempt, even when React mounts effects twice in development.
    if (started.current === attempt) return;
    started.current = attempt;
    const target = state.target ?? defaultTarget(photoEstimate(state));
    runMatching(state, target, setStage)
      .then(({ match, cards }) => dispatch({ type: "matched", match, cards, target }))
      .catch((e: unknown) => {
        if (e instanceof AiError && e.status === 401) onInviteRejected("That invite code isn’t right.");
        else setError(e instanceof Error ? e.message : "Matching failed.");
      });
  }, [attempt, state, dispatch, onInviteRejected]);

  const { label, done, total } = describe(stage);
  return (
    <>
      <StepBar current={2} />
      <h1>Finding your matches</h1>
      {!error ? (
        <>
          <div className="card" aria-live="polite">
            <p>
              {label}…{total ? ` ${done} of ${total}` : ""}
            </p>
            <div className="progress">
              <div style={{ width: total ? `${(100 * (done ?? 0)) / total}%` : "15%" }} />
            </div>
            <p className="small muted">The first time takes longest. Photos already looked at aren’t sent again.</p>
          </div>
          <p className="small muted">
            What to expect: Inkreel turns each line into a description of a photo, then finds the closest ones in your
            album, using what’s in them and when they were taken. Lines about feelings are harder, so a weak match is
            marked.
          </p>
        </>
      ) : (
        <>
          <p className="warn">{error}</p>
          <div className="row actions">
            <button type="button" className="secondary" onClick={onMatchByHand}>
              Match by hand
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStage(null);
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </button>
          </div>
        </>
      )}
    </>
  );
}
