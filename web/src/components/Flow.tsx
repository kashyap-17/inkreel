"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { APP_NAME } from "@/config/app";
import { BUILD_ID } from "@/config/build";
import { AiError, forgetInvite, sendTestRecord } from "@/lib/ai/client";
import {
  canGoTo,
  cardPhotoIds,
  defaultTarget,
  flowReducer,
  initialFlow,
  orderedPhotos,
  verdictKey,
  type FlowAction,
  type FlowState,
  type Step,
} from "@/lib/flow/flow";
import { describeAction } from "@/lib/flow/record";
import { checkCards, matchByHand } from "@/lib/match/run";
import { clearAll, kvGet, kvSet } from "@/lib/store/db";
import { logEvent } from "@/lib/store/events";
import { AnswersStep } from "./AnswersStep";
import { ConsentStep } from "./ConsentStep";
import { DraftStep } from "./DraftStep";
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
  /** Why the start screen asks for the invite code again. */
  const [startMessage, setStartMessage] = useState<string | null>(null);

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
          .filter((c) => !c.captionOnly)
          .flatMap((c) =>
            orderedPhotos(state, c)
              .filter((photo) => photo.status === "suggested")
              .map((photo) => verdictKey(c.sentenceIds, photo.photoId)),
          )
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
    const snapshot = latest.current;
    // Reasons appear part by part as each answer arrives.
    checkCards(snapshot, snapshot.cards, undefined, (verdicts) => rawDispatch({ type: "verdicts", verdicts }))
      .catch((e: unknown) => {
        // The code is asked for again the next time the start screen is shown.
        if (e instanceof AiError && e.status === 401) {
          forgetInvite();
          setStartMessage("That invite code isn’t right.");
        }
      });
  }, [uncheckedKey]);

  // Tester mode: the test record goes to the server log each time a different post reaches the
  // preview, so it can be read there without downloading a file.
  const sentRecord = useRef("");
  const postKey =
    state.step === "preview"
      ? state.cards
          .map((c) => `${c.sentenceIds.join(",")}:${c.captionOnly ? "-" : cardPhotoIds(c).join("+")}`)
          .join("|")
      : "";
  useEffect(() => {
    if (!tester || !postKey || sentRecord.current === postKey || state.match?.byHand !== false) return;
    sentRecord.current = postKey;
    void currentRecord(latest.current).then(sendTestRecord, () => {});
  }, [tester, postKey, state.match?.byHand]);
  // Write with Inkreel: each new draft also goes to the log, so its lines can be read straight away.
  const sentDraft = useRef("");
  const draftKey = state.step === "draft" ? state.draft.map((l) => l.text).join("|") : "";
  useEffect(() => {
    if (!tester || !draftKey || sentDraft.current === draftKey) return;
    sentDraft.current = draftKey;
    void currentRecord(latest.current).then(sendTestRecord, () => {});
  }, [tester, draftKey]);

  // A page left open keeps its old code after an update. When the server runs a newer build,
  // reload at a safe moment (the draft is saved on the device, so nothing is lost), once per build.
  const stepNow = useRef(state.step);
  useEffect(() => {
    stepNow.current = state.step;
  });
  useEffect(() => {
    if (BUILD_ID === "dev") return;
    let lastCheck = 0;
    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      try {
        const { build } = (await (await fetch("/api/version", { cache: "no-store" })).json()) as { build?: string };
        if (!build || build === "dev" || build === BUILD_ID || stepNow.current === "matching") return;
        if (sessionStorage.getItem("inkreel.reloadedFor") === build) return;
        sessionStorage.setItem("inkreel.reloadedFor", build);
        await kvSet(DRAFT_KEY, { version: DRAFT_VERSION, state: latest.current } satisfies SavedDraft);
        window.location.reload();
      } catch {
        // Offline or storage blocked: try again next time the page is shown.
      }
    };
    void check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

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

  // The server turned the saved code down: back to the start screen to enter it again. The
  // writing, photos and draft stay, so choosing the same way to start picks up where it was.
  const inviteRejected = useCallback(
    (message: string) => {
      forgetInvite();
      setStartMessage(message);
      dispatch({ type: "goTo", step: "start" });
    },
    [dispatch],
  );

  if (!loaded) return <main aria-busy="true" />;

  const hasDraft =
    state.text.length > 0 ||
    state.photos.length > 0 ||
    state.draft.length > 0 ||
    Object.values(state.answers).some((a) => a.trim());
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
      {state.step === "start" && (
        <StartScreen
          message={startMessage}
          onChoose={(mode) => {
            setStartMessage(null);
            dispatch({ type: "chooseMode", mode });
          }}
        />
      )}
      {state.step === "words" &&
        (state.mode === "help" ? (
          <AnswersStep state={state} dispatch={dispatch} onInviteRejected={inviteRejected} />
        ) : (
          <WordsStep state={state} dispatch={dispatch} />
        ))}
      {state.step === "draft" && <DraftStep state={state} dispatch={dispatch} onInviteRejected={inviteRejected} />}
      {state.step === "photos" && <PhotoStep state={state} dispatch={dispatch} />}
      {state.step === "consent" && (
        <ConsentStep state={state} dispatch={dispatch} onMatchByHand={byHand} />
      )}
      {state.step === "matching" && (
        <MatchingStep state={state} dispatch={dispatch} onMatchByHand={byHand} onInviteRejected={inviteRejected} />
      )}
      {state.step === "review" && <ReviewStep state={state} dispatch={dispatch} />}
      {state.step === "preview" && <PreviewStep state={state} dispatch={dispatch} />}
      {tester && (state.step === "review" || state.step === "preview") && <TestRecordLink state={state} />}
    </main>
    </TesterContext.Provider>
  );
}
