"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/config/app";
import { captionOf, type FlowAction, type FlowState } from "@/lib/flow/flow";
import { getPhoto } from "@/lib/store/db";
import { Photo } from "./Photo";
import { StepBar } from "./StepBar";

const MAX_SLIDES = 20; // Instagram's carousel limit
const MAX_CAPTION = 2200; // Instagram's caption limit

export function PreviewStep({ state, dispatch }: { state: FlowState; dispatch: (a: FlowAction) => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const slides = state.cards.filter((c) => c.photoId && !c.captionOnly).map((c) => c.photoId!);
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

  async function copyCaption(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(caption);
      return true;
    } catch {
      return false;
    }
  }

  async function share(files: File[]) {
    setBusy(true);
    try {
      if (navigator.canShare?.({ files })) {
        // Both start straight away, inside the tap; the caption can't travel with the photos.
        const copying = copyCaption();
        const sharing = navigator.share({ files });
        const copied = await copying;
        await sharing;
        setStatus(copied ? "Caption copied. Paste it when you post." : "Copy the caption below when you post.");
      } else {
        const copied = await copyCaption();
        download(files);
        setStatus(
          `This browser can’t share photos directly, so they were downloaded.${copied ? " Caption copied." : ""}`,
        );
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") setStatus(null);
      else setStatus(e instanceof Error ? e.message : "Sharing didn’t work. Try downloading instead.");
    } finally {
      setBusy(false);
    }
  }


  return (
    <>
      <StepBar current={3} />
      <h1>Your post</h1>
      <p className="lede">
        {slides.length} {slides.length === 1 ? "photo" : "photos"}, cropped to 4:5 as Instagram shows them, with your
        words as the caption.
      </p>

      <div className="slides" aria-label="Carousel">
        {slides.map((id, i) => (
          <div key={`${id}-${i}`} className="slide">
            <Photo id={id} size="full" alt={`Slide ${i + 1}`} />
            <span className="slide-num">{i + 1}</span>
          </div>
        ))}
      </div>
      {tooMany && (
        <p className="warn">Instagram allows {MAX_SLIDES} photos in a post. Go back and drop some, or ask for fewer.</p>
      )}

      <h2>Caption</h2>
      <p className="caption card">{caption}</p>
      <p className={`small ${tooLong ? "warn" : "muted"}`}>
        {caption.length.toLocaleString("en-GB")} of {MAX_CAPTION.toLocaleString("en-GB")} characters
        {tooLong && ". Instagram cuts captions at this length, so drop some parts from the caption."}
      </p>

      <div className="row actions">
        <button type="button" disabled={busy || tooMany || !ready} onClick={() => ready && void share(ready)}>
          {ready || prepError ? "Share photos" : "Preparing photos…"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => void copyCaption().then((ok) => setStatus(ok ? "Caption copied." : "Couldn’t copy. Select the caption and copy it."))}
        >
          Copy caption
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy || tooMany || !ready}
          onClick={() => {
            if (!ready) return;
            download(ready);
            setStatus("Photos downloaded.");
          }}
        >
          Download photos
        </button>
      </div>
      {prepError && <p className="warn">{prepError}</p>}
      {status && (
        <p className="small" aria-live="polite">
          {status}
        </p>
      )}
      <p className="small muted">Inkreel never posts for you. Share the photos to Instagram, then paste the caption.</p>

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
