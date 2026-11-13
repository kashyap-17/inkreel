"use client";

import { useState } from "react";
import { photoEstimate, type FlowAction, type FlowState } from "@/lib/flow/flow";
import { isPhoto } from "@/lib/photos/files";
import { formatDay } from "@/lib/photos/format";
import { buildStacks, sortByTime } from "@/lib/photos/stacks";
import type { PhotoFailure } from "@/lib/photos/prepare";
import type { PhotoRecord } from "@/lib/photos/types";
import { deletePhotos, putPhoto } from "@/lib/store/db";
import { sendPhotoReport } from "@/lib/report";
import { logEvent } from "@/lib/store/events";
import { formatEstimate } from "@/lib/words/estimate";
import { forgetPhotoUrls, Photo } from "./Photo";
import { StepBar } from "./StepBar";
import { TestRecordLink } from "./TestRecordLink";

const SHOWN = 60;

type Status =
  | { kind: "idle" }
  | { kind: "reading"; done: number; total: number }
  | { kind: "done"; videos: number; failures: PhotoFailure[]; repeats: number }
  | { kind: "error"; message: string; detail: string };

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

    const added: PhotoRecord[] = [];
    const failures: PhotoFailure[] = [];
    // What failed goes to the server log (no photos or file names), so it can be fixed without a screenshot.
    const report = (error?: string) =>
      sendPhotoReport({
        picked: images.length,
        added: added.length,
        error,
        failures: failures.map(({ type, format, sizeMB, reason }) => ({ type, format, sizeMB, reason })),
      });
    try {
      // Loaded on first use: keeps the EXIF reader and canvas code out of the first page load.
      const { preparePhoto } = await import("@/lib/photos/prepare");
      let repeats = 0;
      let done = 0;
      let next = 0;
      const worker = async () => {
        while (next < images.length) {
          const file = images[next++]!;
          const id = `p${crypto.randomUUID().slice(0, 8)}`;
          const result = await preparePhoto(file, id);
          if (!result.ok) failures.push(result.failure);
          else {
            const prepared = result.photo;
            const key = `${prepared.record.fileName}|${prepared.record.takenAt}`;
            if (seen.has(key)) repeats++;
            else {
              try {
                await putPhoto({ id, ...prepared });
                seen.add(key);
                added.push(prepared.record);
              } catch (e) {
                if (e instanceof Error && e.name === "QuotaExceededError") throw e;
                failures.push({
                  fileName: file.name,
                  type: file.type || "(none)",
                  format: "unknown",
                  sizeMB: Math.round(file.size / 100_000) / 10,
                  reason: `saving · ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`,
                });
              }
            }
          }
          setStatus({ kind: "reading", done: ++done, total: images.length });
        }
      };
      // Two at a time: full-size photos are decoded in memory, and phones run out with more.
      await Promise.all(Array.from({ length: Math.min(2, images.length) }, worker));
      // Kept in the session log, so the test record shows why photos were left out.
      if (failures.length) {
        logEvent({ at: new Date().toISOString(), action: "photosFailed", detail: { count: failures.length, failures } });
        report();
      }

      if (replace && photos.length) {
        forgetPhotoUrls();
        await deletePhotos(photos.map((p) => p.id));
      }
      const sorted = sortByTime([...existing, ...added]);
      dispatch({ type: "setPhotos", photos: sorted, stacks: buildStacks(sorted) });
      setStatus({ kind: "done", videos: all.length - images.length, failures, repeats });
    } catch (e) {
      const detail = e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 400) : String(e).slice(0, 400);
      logEvent({ at: new Date().toISOString(), action: "photosError", detail: { error: detail } });
      report(detail);
      setStatus({
        kind: "error",
        message:
          e instanceof Error && e.name === "QuotaExceededError"
            ? "This device is out of space for more photos. Try fewer photos."
            : "Something went wrong reading those photos. Try again.",
        detail,
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
        {status.kind === "error" && (
          <>
            <div className="warn">
              <p>{status.message}</p>
              <p className="small">Error details were sent to fix this: file types, sizes and errors, no photos or file names.</p>
              <details>
                <summary>Details</summary>
                <p className="small failures">{status.detail}</p>
              </details>
            </div>
            <TestRecordLink state={state} />
          </>
        )}
        {status.kind === "done" && status.failures.length > 0 && (
          <>
            <Failures failures={status.failures} />
            <TestRecordLink state={state} />
          </>
        )}
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

/** What couldn't be opened and why, so the cause is visible (and can be sent with feedback). */
function Failures({ failures }: { failures: PhotoFailure[] }) {
  const heic = failures.filter((f) => f.format === "heic").length;
  const other = failures.length - heic;
  return (
    <div className="warn">
      <p>
        {plural(failures.length, "photo", "photos")} couldn’t be opened in this browser, so{" "}
        {failures.length === 1 ? "it was" : "they were"} left out.
        {heic > 0 &&
          ` ${heic === failures.length ? (heic === 1 ? "It’s" : "They’re all") : `${heic} are`} HEIC (“high efficiency”) photos, which this browser can’t read yet.`}
        {other > 0 && heic > 0 && ` ${other} failed for another reason.`}
      </p>
      <p className="small">Error details were sent to fix this: file types, sizes and errors, no photos or file names.</p>
      <details>
        <summary>Details</summary>
        <ul className="small failures">
          {failures.slice(0, 40).map((f, i) => (
            <li key={`${f.fileName}-${i}`}>
              {f.fileName} · {f.format.toUpperCase()} (labelled {f.type}) · {f.sizeMB} MB · {f.reason}
            </li>
          ))}
          {failures.length > 40 && <li>…and {failures.length - 40} more</li>}
        </ul>
      </details>
    </div>
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
