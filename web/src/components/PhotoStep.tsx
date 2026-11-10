"use client";

import { useState } from "react";
import { photoEstimate, type FlowAction, type FlowState } from "@/lib/flow/flow";
import { isPhoto } from "@/lib/photos/files";
import { formatDay } from "@/lib/photos/format";
import { buildStacks, sortByTime } from "@/lib/photos/stacks";
import type { PhotoRecord } from "@/lib/photos/types";
import { deletePhotos, putPhoto } from "@/lib/store/db";
import { formatEstimate } from "@/lib/words/estimate";
import { forgetPhotoUrls, Photo } from "./Photo";
import { StepBar } from "./StepBar";

const SHOWN = 60;

type Status =
  | { kind: "idle" }
  | { kind: "reading"; done: number; total: number }
  | { kind: "done"; videos: number; unreadable: number; repeats: number }
  | { kind: "error"; message: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function PhotoStep({ state, dispatch }: { state: FlowState; dispatch: (a: FlowAction) => void }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const photos = state.photos;
  const reading = status.kind === "reading";

  async function onPick(list: FileList | null, replace: boolean) {
    if (!list || list.length === 0) return;
    const all = Array.from(list);
    const images = all.filter(isPhoto);
    const existing = replace ? [] : photos;
    const seen = new Set(existing.map((p) => `${p.fileName}|${p.takenAt}`));
    setStatus({ kind: "reading", done: 0, total: images.length });

    try {
      // Loaded on first use: keeps the EXIF reader and canvas code out of the first page load.
      const { preparePhoto } = await import("@/lib/photos/prepare");
      const added: PhotoRecord[] = [];
      let unreadable = 0;
      let repeats = 0;
      let done = 0;
      let next = 0;
      const worker = async () => {
        while (next < images.length) {
          const file = images[next++]!;
          const id = `p${crypto.randomUUID().slice(0, 8)}`;
          const prepared = await preparePhoto(file, id);
          if (!prepared) unreadable++;
          else if (seen.has(`${prepared.record.fileName}|${prepared.record.takenAt}`)) repeats++;
          else {
            seen.add(`${prepared.record.fileName}|${prepared.record.takenAt}`);
            await putPhoto({ id, ...prepared });
            added.push(prepared.record);
          }
          setStatus({ kind: "reading", done: ++done, total: images.length });
        }
      };
      // Three at a time: full-size photos are decoded in memory.
      await Promise.all(Array.from({ length: Math.min(3, images.length) }, worker));

      if (replace && photos.length) {
        forgetPhotoUrls();
        await deletePhotos(photos.map((p) => p.id));
      }
      const sorted = sortByTime([...existing, ...added]);
      dispatch({ type: "setPhotos", photos: sorted, stacks: buildStacks(sorted) });
      setStatus({ kind: "done", videos: all.length - images.length, unreadable, repeats });
    } catch (e) {
      setStatus({
        kind: "error",
        message:
          e instanceof Error && e.name === "QuotaExceededError"
            ? "This device is out of space for more photos. Try fewer photos."
            : "Something went wrong reading those photos. Try again.",
      });
    }
  }

  const byFileDate = photos.filter((p) => p.timeSource === "file").length;
  const stacked = photos.length - state.stacks.length;
  const estimate = photoEstimate(state);
  const first = photos[0];
  const last = photos[photos.length - 1];
  const span = first && last ? (formatDay(first) === formatDay(last) ? formatDay(first) : `${formatDay(first)} to ${formatDay(last)}`) : "";

  return (
    <>
      <StepBar current={1} />
      <h1>Now, the photos</h1>
      <p className="lede">
        Choose every photo from the trip, even hundreds. Inkreel finds the ones that go with your words.
      </p>
      <p className="muted small">Nothing leaves your phone until you say so on the next screen.</p>

      <section className="photo-step">
        <div className="row">
          <PickButton label={photos.length ? "Add more photos" : "Choose photos"} disabled={reading} onPick={(f) => onPick(f, false)} />
          {photos.length > 0 && (
            <PickButton label="Choose again" secondary disabled={reading} onPick={(f) => onPick(f, true)} />
          )}
        </div>

        {status.kind === "reading" && (
          <div className="card" aria-live="polite">
            <p>
              Getting your photos ready… {status.done} of {status.total}
            </p>
            <div className="progress">
              <div style={{ width: `${status.total ? (100 * status.done) / status.total : 0}%` }} />
            </div>
          </div>
        )}
        {status.kind === "error" && <p className="warn">{status.message}</p>}
        {status.kind === "done" && photos.length === 0 && (
          <p className="warn">None of those could be used. Inkreel works with photos for now, not videos.</p>
        )}

        {photos.length > 0 && !reading && (
          <>
            <div className="card">
              <p className="summary">
                {plural(photos.length, "photo", "photos")}
                {span && <span className="muted"> · {span}</span>}
              </p>
              {stacked > 0 && (
                <p className="muted small">
                  {plural(stacked, "shot looks", "shots look")} nearly the same as the one before, so Inkreel won’t put
                  both in a post. You can still choose any of them later.
                </p>
              )}
              {byFileDate > 0 && (
                <p className="warn">
                  {plural(byFileDate, "photo has", "photos have")} no saved time, so{" "}
                  {byFileDate === 1 ? "it’s" : "they’re"} placed by file date and marked “no time”.
                </p>
              )}
              {status.kind === "done" && status.unreadable > 0 && (
                <p className="warn">
                  {plural(status.unreadable, "photo", "photos")} couldn’t be opened in this browser (often HEIC
                  photos on a computer), so {status.unreadable === 1 ? "it was" : "they were"} left out.
                </p>
              )}
              {status.kind === "done" && status.repeats > 0 && (
                <p className="muted small">{plural(status.repeats, "photo was", "photos were")} already added.</p>
              )}
              {status.kind === "done" && status.videos > 0 && (
                <p className="muted small">
                  {plural(status.videos, "video was", "videos were")} left out. Inkreel works with photos for now.
                </p>
              )}
              <details>
                <summary className="small">Photo details</summary>
                <dl className="stats">
                  <Stat label="Time saved in photo" value={photos.length - byFileDate} />
                  <Stat label="Placed by file date" value={byFileDate} />
                  <Stat label="Time zone saved" value={photos.filter((p) => p.offsetMinutes !== null).length} />
                  <Stat label="Location saved" value={photos.filter((p) => p.gps !== null).length} />
                  <Stat label="Distinct shots" value={state.stacks.length} />
                </dl>
              </details>
            </div>

            <div className="thumbs">
              {photos.slice(0, SHOWN).map((p) => (
                <div key={p.id} className="thumb">
                  <Photo id={p.id} />
                  {p.timeSource === "file" && <span className="flag">no time</span>}
                </div>
              ))}
              {photos.length > SHOWN && <div className="thumb">+{photos.length - SHOWN}</div>}
            </div>

            <div className="card next">
              <strong>Next: matching</strong>
              <p className="small">
                Inkreel will split your writing and pick a photo for each part, with a short reason.
                {estimate && ` ${formatEstimate(estimate)}, chosen from these ${photos.length}.`}
              </p>
            </div>
          </>
        )}
      </section>

      <div className="row actions">
        <button type="button" className="secondary" onClick={() => dispatch({ type: "goTo", step: "words" })}>
          Back to your words
        </button>
        <button
          type="button"
          disabled={photos.length === 0 || reading}
          onClick={() => dispatch({ type: "goTo", step: state.cards.length ? "review" : "consent" })}
        >
          {state.cards.length ? "Next: your matches" : "Next: find matches"}
        </button>
      </div>
    </>
  );
}

function PickButton({
  label,
  secondary,
  disabled,
  onPick,
}: {
  label: string;
  secondary?: boolean;
  disabled?: boolean;
  onPick: (files: FileList | null) => void;
}) {
  return (
    <label className={`button${secondary ? " secondary" : ""}${disabled ? " disabled" : ""}`}>
      {label}
      <input
        className="visually-hidden"
        type="file"
        accept="image/*"
        multiple
        disabled={disabled}
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
