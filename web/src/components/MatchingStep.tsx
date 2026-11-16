"use client";

import { useEffect, useRef, useState } from "react";
import { AiError, onWait, type Wait } from "@/lib/ai/client";
import { defaultTarget, type FlowAction, type FlowState, type Verdict } from "@/lib/flow/flow";
import { logEvent } from "@/lib/store/events";
import { checkCards, runMatching, type Stage } from "@/lib/match/run";
import { StepBar } from "./StepBar";

/** Expected times, for the progress bar: a batch of 6 photos takes about 0.9 s (two run at once);
 *  the searches about 4 s; picking the photos about 1 s; checking them and writing reasons about 5 s. */
const EXPECTED = { perPhotoBatchMs: 900, searchesMs: 4_000, matchMs: 1_000, checkMs: 5_000 };

/** The matches screen opens after this long even if some reasons haven't arrived; they follow. */
const CHECK_WAIT_MS = 15_000;

/**
 * How far along matching is, 0–1. Real steps move it forward; between them it creeps on with
 * time, slowing as it nears the end, so it never stands still and never reaches the end early.
 */
function fraction(p: Progress, elapsedMs: number, expectedMs: number): number {
  const photos = p.photos.status === "done" ? 1 : p.photos.total ? p.photos.done / p.photos.total : 0;
  const check = p.check.total ? p.check.done / p.check.total : 0;
  const real = 0.3 * photos + (p.words.status === "done" ? 0.3 : 0) + (p.match === "done" ? 0.1 : 0) + 0.25 * check;
  // Between real steps the bar keeps closing part of the gap to 95%, so it always moves.
  return real + (0.95 - real) * (1 - Math.exp((-1.2 * elapsedMs) / expectedMs));
}

type Status = "waiting" | "running" | "done";

interface Progress {
  photos: { status: Status; done: number; total: number };
  words: { status: Status; fellBack: boolean };
  match: Status;
  check: { status: Status; done: number; total: number };
}

const START: Progress = {
  photos: { status: "running", done: 0, total: 0 },
  words: { status: "running", fellBack: false },
  match: "waiting",
  check: { status: "waiting", done: 0, total: 0 },
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
    case "check":
      return {
        ...p,
        match: "done",
        check: { status: stage.done >= stage.total ? "done" : "running", done: stage.done, total: stage.total },
      };
  }
}

const WAIT_TEXT: Record<Wait["reason"], string> = {
  busy: "The AI is busy right now",
  limit: "The AI asked Inkreel to slow down",
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
    let checkStarted = Date.now();
    const current = () => !left.current && started.current === thisAttempt;
    runMatching(state, target, (stage) => {
      if (!current()) return;
      if (stage.kind === "match") checkStarted = Date.now();
      setWait(null);
      setProgress((p) => advance(p, stage));
    })
      .then(async ({ match, cards }) => {
        if (!current()) return;
        // Last stage: check the matches and write the reasons, so the matches screen opens with
        // them (and with any rejected photo already replaced). After 15 s it opens anyway; reasons
        // still on their way are added when they arrive.
        const checked: Record<string, Verdict> = {};
        let opened = false;
        const checks = checkCards({ ...state, match, cards }, cards, (stage) => {
          if (!opened && current()) setProgress((p) => advance(p, stage));
        }, (verdicts) => {
          if (opened) dispatch({ type: "verdicts", verdicts });
          else Object.assign(checked, verdicts);
        }).catch((e: unknown) => {
          if (e instanceof AiError && e.status === 401) throw e;
        });
        await Promise.race([checks, new Promise((r) => setTimeout(r, CHECK_WAIT_MS))]);
        if (!current()) return;
        opened = true;
        const checkMs = Date.now() - checkStarted;
        if (match.timings) {
          logEvent({ at: new Date().toISOString(), action: "matchingTimes", detail: { ...match.timings, checkMs } });
        }
        dispatch({ type: "matched", match, cards, target });
        if (Object.keys(checked).length) dispatch({ type: "verdicts", verdicts: checked });
      })
      .catch((e: unknown) => {
        if (!current()) return;
        if (e instanceof AiError && e.status === 401) onInviteRejected("That invite code isn’t right.");
        else setError(e instanceof Error ? e.message : "Matching failed.");
      });
  }, [attempt, state, dispatch, onInviteRejected]);

  const elapsed = Math.max(0, now - startedAt);
  const waitLeft = wait ? Math.ceil((wait.until - now) / 1000) : 0;
  const { photos, words } = progress;
  const expected =
    Math.max((Math.ceil(photos.total / 6) / 2) * EXPECTED.perPhotoBatchMs, EXPECTED.searchesMs) +
    EXPECTED.matchMs +
    EXPECTED.checkMs;
  const done = fraction(progress, elapsed, expected);
  const secondsLeft = Math.round((expected - elapsed) / 1000);
  const step =
    photos.status !== "done"
      ? `Looking at your photos${photos.total ? ` · ${photos.done} of ${photos.total}` : ""}`
      : words.status !== "done"
        ? "Reading your writing"
        : progress.match !== "done"
          ? "Picking the photos that fit"
          : `Checking each match${progress.check.total ? ` · ${progress.check.done} of ${progress.check.total}` : ""}`;

  return (
    <>
      <StepBar current={2} />
      <h1>Finding your matches</h1>
      {!error ? (
        <div className="card" aria-live="polite">
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(done * 100)}
            aria-label="Matching"
          >
            <div style={{ width: `${Math.round(done * 100)}%` }} />
          </div>
          <p className="small">
            {step}
            <span className="muted">
              {" · "}
              {wait && waitLeft > 0
                ? `${wait.text}, trying again in ${waitLeft} s`
                : secondsLeft > 1
                  ? `about ${secondsLeft} s left`
                  : "almost there"}
            </span>
          </p>
          <p className="small muted">Keep this screen open until it’s done.</p>
        </div>
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
