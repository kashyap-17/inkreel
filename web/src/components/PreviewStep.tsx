"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/config/app";
import { captionOf, type FlowAction, type FlowState } from "@/lib/flow/flow";
import { getPhoto } from "@/lib/store/db";
import { logEvent } from "@/lib/store/events";
import { Photo } from "./Photo";
import { StepBar } from "./StepBar";
import { SwapSheet } from "./SwapSheet";

const MAX_SLIDES = 20; // Instagram's carousel limit
const MAX_CAPTION = 2200; // Instagram's caption limit

export function PreviewStep({ state, dispatch }: { state: FlowState; dispatch: (a: FlowAction) => void }) {
  const [status, setStatus] = useState<{ text: string; copyAgain?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [swapping, setSwapping] = useState<string | null>(null);
  const slideCards = state.cards.filter((c) => c.photoId && !c.captionOnly);
  const slides = slideCards.map((c) => c.photoId!);
  const swapCard = state.cards.find((c) => c.id === swapping);
  const caption = captionOf(state);
  const tooMany = slides.length > MAX_SLIDES;
  const tooLong = caption.length > MAX_CAPTION;
  const slideKey = slides.join(",");

  // Slides are drawn as soon as the preview opens: browsers only allow sharing right after a
  // tap, so the files must be ready before the button is pressed.
  const [files, setFiles] = useState<{ key: string; files: File[] } | { key: string; error: string } | null>(null);
  useEffect(() => {
    let live = true;
    void renderSlides(slideKey ? slideKey.split(",") : []).then(
      (f) => live && setFiles({ key: slideKey, files: f }),
      (e: unknown) =>
        live && setFiles({ key: slideKey, error: e instanceof Error ? e.message : "Couldn’t prepare the photos." }),
    );
    return () => {
      live = false;
    };
  }, [slideKey]);
  const ready = files && files.key === slideKey && "files" in files ? files.files : null;
  const prepError = files && files.key === slideKey && "error" in files ? files.error : null;

  const log = (action: string, detail: Record<string, unknown> = {}) =>
    logEvent({ at: new Date().toISOString(), action, detail });

  async function copyCaption(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(caption);
      return true;
    } catch {
      return false;
    }
  }

  async function copyOnly() {
    const ok = await copyCaption();
    log("copyCaption", { ok });
    setStatus(ok ? { text: "Caption copied." } : { text: "Couldn’t copy. Select the caption and copy it." });
  }

  async function share(files: File[]) {
    setBusy(true);
    let copied = false;
    try {
      if (navigator.canShare?.({ files })) {
        // Both start straight away, inside the tap; the caption can't travel with the photos.
        const copying = copyCaption();
        const sharing = navigator.share({ files });
        copied = await copying;
        await sharing;
        log("share", { result: "shared", captionCopied: copied });
        setStatus(
          copied
            ? { text: "Caption copied. Paste it when you post.", copyAgain: true }
            : { text: "Copy the caption above, then paste it when you post.", copyAgain: true },
        );
      } else {
        copied = await copyCaption();
        download(files);
        log("share", { result: "downloaded", captionCopied: copied });
        setStatus({
          text: `This browser can’t share photos directly, so they were saved instead.${copied ? " Caption copied." : ""}`,
          copyAgain: true,
        });
      }
    } catch (e) {
      const cancelled = e instanceof DOMException && e.name === "AbortError";
      log("share", { result: cancelled ? "cancelled" : "failed", captionCopied: copied });
      setStatus(cancelled ? null : { text: "Sharing didn’t work. Save the photos instead, then post them." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StepBar current={3} />
      <h1>Your post</h1>
      <p className="lede">
        {slides.length} {slides.length === 1 ? "photo" : "photos"}, sized for Instagram, in the order of your writing.
        Your words go in the caption.
      </p>

      <div className="slides" aria-label="Carousel">
        {slideCards.map((card, i) => (
          <div key={card.id} className="slide">
            <button
              type="button"
              className="photo-button"
              onClick={() => setSwapping(card.id)}
              aria-label={`Change photo ${i + 1}`}
            >
              <Photo id={card.photoId!} size="full" alt={`Slide ${i + 1}`} />
            </button>
            <span className="slide-num">{i + 1}</span>
          </div>
        ))}
      </div>
      <p className="small muted">Tap a photo to change it.</p>
      {tooMany && (
        <p className="warn">Instagram allows {MAX_SLIDES} photos in a post. Go back and drop some, or ask for fewer.</p>
      )}

      {swapCard && (
        <SwapSheet
          state={state}
          card={swapCard}
          onClose={() => setSwapping(null)}
          onPick={(photoId) => {
            dispatch({ type: "swap", cardId: swapCard.id, photoId });
            setSwapping(null);
          }}
        />
      )}

      <div className="caption-head">
        <h2>Caption</h2>
        <button type="button" className="secondary small-button" disabled={busy} onClick={() => void copyOnly()}>
          Copy
        </button>
      </div>
      <p className="caption card">{caption}</p>
      {caption.length > MAX_CAPTION - 200 && (
        <p className={`small ${tooLong ? "warn" : "muted"}`}>
          {caption.length.toLocaleString("en-GB")} of {MAX_CAPTION.toLocaleString("en-GB")} characters
          {tooLong && ". Instagram cuts captions at this length, so shorten your writing."}
        </p>
      )}

      <div className="share">
        <button
          type="button"
          className="wide"
          disabled={busy || tooMany || !ready}
          onClick={() => ready && void share(ready)}
        >
          {ready || prepError ? "Share" : "Preparing photos…"}
        </button>
        <p className="small muted">
          Opens your phone’s share options: Instagram, WhatsApp, anything. Your caption is copied too, ready to paste.
        </p>
        {prepError && <p className="warn">{prepError}</p>}
        {status && (
          <p className="card small status" aria-live="polite">
            {status.text}
            {status.copyAgain && (
              <>
                {" "}
                <button type="button" className="link" onClick={() => void copyOnly()}>
                  Copy again
                </button>
              </>
            )}
          </p>
        )}
        <ol className="small muted share-help">
          <li>Tap Share and choose Instagram.</li>
          <li>When Instagram asks for a caption, tap and hold the caption box, then tap Paste.</li>
        </ol>
        <p className="small">
          <button
            type="button"
            className="link"
            disabled={busy || tooMany || !ready}
            onClick={() => {
              if (!ready) return;
              download(ready);
              log("savePhotos");
              setStatus({ text: "Photos saved to your phone." });
            }}
          >
            Save the photos instead
          </button>
        </p>
      </div>

      <div className="row actions">
        <button type="button" className="secondary" onClick={() => dispatch({ type: "goTo", step: "review" })}>
          Back to matches
        </button>
      </div>
    </>
  );
}

async function renderSlides(ids: string[]): Promise<File[]> {
  const { renderSlide } = await import("@/lib/photos/canvas");
  return Promise.all(
    ids.map(async (id, i) => {
      const stored = await getPhoto(id);
      if (!stored) throw new Error("A photo is missing from this device. Go back and choose it again.");
      const blob = await renderSlide(stored.full);
      return new File([blob], `${APP_NAME.toLowerCase()}-${String(i + 1).padStart(2, "0")}.jpg`, { type: "image/jpeg" });
    }),
  );
}

function download(files: File[]) {
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
