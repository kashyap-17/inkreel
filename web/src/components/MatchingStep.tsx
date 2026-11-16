"use client";

import { useEffect, useRef, useState } from "react";
import { AiError, onWait, type Wait } from "@/lib/ai/client";
import { defaultTarget, type FlowAction, type FlowState } from "@/lib/flow/flow";
import { logEvent } from "@/lib/store/events";
import { runMatching, type Stage } from "@/lib/match/run";
import { StepBar } from "./StepBar";

/** After this long, matching by hand is offered while matching carries on. */
const OFFER_BY_HAND_AFTER_S = 15;

type Status = "waiting" | "running" | "done";

interface Progress {
  photos: { status: Status; done: number; total: number };
  words: { status: Status; fellBack: boolean };
  match: Status;
}

const START: Progress = {
  photos: { status: "running", done: 0, total: 0 },
  words: { status: "running", fellBack: false },
  match: "waiting",
};

function advance(p: Progress, stage: Stage): Progress {
  switch (stage.kind) {
    case "index":
      return {
        ...p,
        photos: { status: stage.done >= stage.total ? "done" : "running", done: stage.done, total: stage.total },
      };
    case "queries":
      return {
        ...p,
        words: { status: stage.status === "running" ? "running" : "done", fellBack: stage.status === "fellBack" },
      };
    case "match":
      return { ...p, photos: { ...p.photos, status: "done" }, words: { ...p.words, status: "done" }, match: "running" };
    default:
      return p;
  }
}

const WAIT_TEXT: Record<Wait["reason"], string> = {
  busy: "Google’s AI is busy right now",
  limit: "Google’s AI asked Inkreel to slow down",
  connection: "The connection dropped",
};

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
  const [progress, setProgress] = useState<Progress>(START);
  const [wait, setWait] = useState<{ text: string; until: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const started = useRef(-1);
  // Set when the user leaves this screen (e.g. "Match by hand instead"), so a run that finishes
  // later doesn't replace what they did meanwhile.
  const left = useRef(false);
  useEffect(() => {
    left.current = false;
    return () => {
      left.current = true;
    };
  }, []);

  // The seconds counter, so the screen never stands still.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  // Keeps the screen on while matching: phones pause a page whose screen has gone off.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let live = true;
    const request = () => {
      if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      navigator.wakeLock.request("screen").then(
        (l) => {
          if (live) lock = l;
          else void l.release();
        },
        () => {},
      );
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", request);
      void lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    onWait((w) => setWait({ text: WAIT_TEXT[w.reason], until: Date.now() + w.seconds * 1000 }));
    return () => onWait(null);
  }, []);

  useEffect(() => {
    // Runs once per attempt, even when React mounts effects twice in development.
    if (started.current === attempt) return;
    started.current = attempt;
    const target = state.target ?? defaultTarget(state);
    const thisAttempt = attempt;
    const current = () => !left.current && started.current === thisAttempt;
    runMatching(state, target, (stage) => {
      if (!current()) return;
      setWait(null);
      setProgress((p) => advance(p, stage));
    })
      .then(({ match, cards }) => {
        if (!current()) return;
        if (match.timings) logEvent({ at: new Date().toISOString(), action: "matchingTimes", detail: match.timings });
        dispatch({ type: "matched", match, cards, target });
      })
      .catch((e: unknown) => {
        if (!current()) return;
        if (e instanceof AiError && e.status === 401) onInviteRejected("That invite code isn’t right.");
        else setError(e instanceof Error ? e.message : "Matching failed.");
      });
  }, [attempt, state, dispatch, onInviteRejected]);

  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const waitLeft = wait ? Math.ceil((wait.until - now) / 1000) : 0;
  const { photos, words, match } = progress;

  return (
    <>
      <StepBar current={2} />
      <h1>Finding your matches</h1>
      {!error ? (
        <>
          <ol className="card stages" aria-live="polite">
            <StageRow status={photos.status}>
              Looking at your photos
              {photos.total > 0 && photos.status !== "done" && ` · ${photos.done} of ${photos.total}`}
            </StageRow>
            <StageRow status={words.status}>
              {words.status === "done" && words.fellBack
                ? "Reading your writing · using your lines as they are"
                : "Reading your writing"}
            </StageRow>
            <StageRow status={match}>Picking the photos that fit</StageRow>
          </ol>
          <p className="small muted" aria-live="polite">
            {wait && waitLeft > 0
              ? `${wait.text}. Trying again in ${waitLeft} s…`
              : `${seconds} s · usually under 20 seconds`}
          </p>
          {seconds >= OFFER_BY_HAND_AFTER_S && (
            <div className="card next">
              <p className="small">
                Taking longer than usual. You can keep waiting, or pick the photos yourself instead.
              </p>
              <button type="button" className="secondary small-button" onClick={onMatchByHand}>
                Match by hand instead
              </button>
            </div>
          )}
          <p className="small muted">Keep this screen open until it’s done.</p>
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
                setProgress(START);
                setWait(null);
                setStartedAt(Date.now());
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

function StageRow({ status, children }: { status: Status; children: React.ReactNode }) {
  return (
    <li className={`stage ${status}`}>
      <span className="stage-mark" aria-hidden="true">
        {status === "done" ? "✓" : status === "running" ? "" : "·"}
      </span>
      <span>{children}</span>
      <span className="visually-hidden">{status === "done" ? " (done)" : status === "running" ? " (in progress)" : ""}</span>
    </li>
  );
}
