"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { APP_NAME } from "@/config/app";
import { AiError, sendTestRecord } from "@/lib/ai/client";
import {
  canGoTo,
  defaultTarget,
  flowReducer,
  initialFlow,
  verdictKey,
  type FlowAction,
  type FlowState,
  type Step,
} from "@/lib/flow/flow";
import { describeAction } from "@/lib/flow/record";
import { checkCards, matchByHand } from "@/lib/match/run";
import { clearAll, kvGet, kvSet } from "@/lib/store/db";
import { logEvent } from "@/lib/store/events";
import { ConsentStep } from "./ConsentStep";
import { MatchingStep } from "./MatchingStep";
import { forgetPhotoUrls } from "./Photo";
import { PhotoStep } from "./PhotoStep";
import { PreviewStep } from "./PreviewStep";
import { ReviewStep } from "./ReviewStep";
import { StartScreen } from "./StartScreen";
import { currentRecord, TestRecordLink } from "./TestRecordLink";
import { readTesterMode, TesterContext } from "./Tester";
import { WordsStep } from "./WordsStep";

const DRAFT_KEY = "draft";
const DRAFT_VERSION = 2;

interface SavedDraft {
  version: number;
  state: FlowState;
}

export function Flow() {
  const [state, rawDispatch] = useReducer(flowReducer, initialFlow);
  // Every user action is also written to the log for the test record.
  const dispatch = useCallback((action: FlowAction) => {
    rawDispatch(action);
    const event = describeAction(action, new Date());
    if (event) logEvent(event);
  }, []);
  const [loaded, setLoaded] = useState(false);
  // Read on the client only; the first render (before the draft loads) looks the same either way.
  const [tester] = useState(() => typeof window !== "undefined" && readTesterMode());
  const [checking, setChecking] = useState(false);
  const [consentMessage, setConsentMessage] = useState<string | null>(null);

  // Restore the draft saved on this device, at the step the user left.
  useEffect(() => {
    let live = true;
    kvGet<SavedDraft>(DRAFT_KEY)
      .then((saved) => {
        if (!live || !saved || saved.version !== DRAFT_VERSION) return;
        const step: Step = saved.state.step === "matching" ? "consent" : saved.state.step;
        rawDispatch({ type: "restore", state: { ...saved.state, step: canGoTo(saved.state, step) ? step : "words" } });
      })
      .catch(() => {
        // No saved draft (or storage is blocked): start fresh.
      })
      .finally(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, []);

  // Save the draft after every change.
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      void kvSet(DRAFT_KEY, { version: DRAFT_VERSION, state } satisfies SavedDraft).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [state, loaded]);

  // Each step is a browser history entry, so the phone's back button moves between steps.
  useEffect(() => {
    if (!loaded) return;
    const current = (window.history.state as { inkreel?: Step } | null)?.inkreel;
    if (current === state.step) return;
    if (current === undefined || state.step === "matching" || current === "matching") {
      window.history.replaceState({ inkreel: state.step }, "");
    } else {
      window.history.pushState({ inkreel: state.step }, "");
    }
  }, [state.step, loaded]);
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const step = (e.state as { inkreel?: Step } | null)?.inkreel;
      if (step) dispatch({ type: "goTo", step });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dispatch]);

  // Block body on purpose: newer browsers return a Promise from scrollTo, and React would
  // treat a returned value as a clean-up function and crash on the next step change.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.step]);

  // Check and explain (call 3) for any suggested card without a check, in the background.
  const checkingFor = useRef<string | null>(null);
  const uncheckedKey =
    state.step === "review" && state.match && !state.match.byHand
      ? state.cards
          .filter((c) => c.photoId && !c.captionOnly && c.status === "suggested")
          .map((c) => verdictKey(c.sentenceIds, c.photoId!))
          .filter((k) => !(k in state.match!.verdicts))
          .join(";")
      : "";
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  });
  useEffect(() => {
    if (!uncheckedKey || checkingFor.current === uncheckedKey) return;
    checkingFor.current = uncheckedKey;
    setChecking(true);
    const snapshot = latest.current;
    checkCards(snapshot, snapshot.cards)
      .then((verdicts) => rawDispatch({ type: "verdicts", verdicts }))
      .catch((e: unknown) => {
        if (e instanceof AiError && e.status === 401) setConsentMessage("That invite code isn’t right.");
      })
      .finally(() => setChecking(false));
  }, [uncheckedKey]);

  // Tester mode: the test record goes to the server log each time a different post reaches the
  // preview, so it can be read there without downloading a file.
  const sentRecord = useRef("");
  const postKey =
    state.step === "preview"
      ? state.cards.map((c) => `${c.sentenceIds.join(",")}:${c.captionOnly ? "-" : (c.photoId ?? "")}`).join("|")
      : "";
  useEffect(() => {
    if (!tester || !postKey || sentRecord.current === postKey || state.match?.byHand !== false) return;
    sentRecord.current = postKey;
    void currentRecord(latest.current).then(sendTestRecord, () => {});
  }, [tester, postKey, state.match?.byHand]);

  const startOver = useCallback(async () => {
    if (!window.confirm("Start over? This deletes your writing, photos and matches from this device.")) return;
    forgetPhotoUrls();
    await clearAll().catch(() => {});
    rawDispatch({ type: "reset" });
  }, []);

  const byHand = useCallback(() => {
    const target = state.target ?? defaultTarget(state);
    const { match, cards } = matchByHand(state, target);
    dispatch({ type: "matched", match, cards, target });
  }, [state, dispatch]);

  const inviteRejected = useCallback((message: string) => {
    setConsentMessage(message);
    dispatch({ type: "goTo", step: "consent" });
  }, [dispatch]);

  if (!loaded) return <main aria-busy="true" />;

  const hasDraft = state.text.length > 0 || state.photos.length > 0;
  return (
    <TesterContext.Provider value={tester}>
    <main>
      {state.step !== "start" && (
        <header className="topbar">
          <span className="wordmark">{APP_NAME}</span>
          {hasDraft && (
            <button type="button" className="link small" onClick={() => void startOver()}>
              Start over
            </button>
          )}
        </header>
      )}
      {state.step === "start" && <StartScreen onChoose={(mode) => dispatch({ type: "chooseMode", mode })} />}
      {state.step === "words" && <WordsStep state={state} dispatch={dispatch} />}
      {state.step === "photos" && <PhotoStep state={state} dispatch={dispatch} />}
      {state.step === "consent" && (
        <ConsentStep state={state} dispatch={dispatch} onMatchByHand={byHand} message={consentMessage} />
      )}
      {state.step === "matching" && (
        <MatchingStep state={state} dispatch={dispatch} onMatchByHand={byHand} onInviteRejected={inviteRejected} />
      )}
      {state.step === "review" && <ReviewStep state={state} dispatch={dispatch} checking={checking} />}
      {state.step === "preview" && <PreviewStep state={state} dispatch={dispatch} />}
      {tester && (state.step === "review" || state.step === "preview") && <TestRecordLink state={state} />}
    </main>
    </TesterContext.Provider>
  );
}
