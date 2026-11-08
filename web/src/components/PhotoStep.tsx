"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { isHeic, isPhoto } from "@/lib/photos/files";
import { formatDay, formatTime } from "@/lib/photos/format";
import { DEFAULT_GROUPING, groupIntoMoments } from "@/lib/photos/moments";
import type { Moment, PhotoMeta } from "@/lib/photos/types";

const BREAK_CHOICES = [15, 30, 45, 60, 90, 120];
const THUMBS_PER_MOMENT = 8;

type Status = { kind: "idle" } | { kind: "reading"; done: number; total: number } | { kind: "ready" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function PhotoStep({ footer }: { footer?: (moments: number) => ReactNode }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_GROUPING.gapMinutes);
  // Preview URL per photo ID; null for HEIC, which most browsers can't show.
  const [previews, setPreviews] = useState<Map<string, string | null>>(() => new Map());

  // Free the previous set of preview URLs when the photos change or the page closes.
  useEffect(() => () => previews.forEach((url) => url && URL.revokeObjectURL(url)), [previews]);

  async function onPick(list: FileList | null) {
    if (!list || list.length === 0) return;
    setPhotos([]);
    setPreviews(new Map());

    const all = Array.from(list);
    const images = all.filter(isPhoto);
    setSkipped(all.length - images.length);
    setStatus({ kind: "reading", done: 0, total: images.length });

    // Loaded on first use: keeps the EXIF reader out of the first page load and the server.
    const { readAllPhotoMeta } = await import("@/lib/photos/exif");
    const meta = await readAllPhotoMeta(images, (done, total) => setStatus({ kind: "reading", done, total }));
    setPreviews(new Map(meta.map((m, i) => [m.id, isHeic(images[i]!) ? null : URL.createObjectURL(images[i]!)])));
    setPhotos(meta);
    setStatus({ kind: "ready" });
  }

  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const moments = useMemo(
    () => groupIntoMoments(photos, { ...DEFAULT_GROUPING, gapMinutes: breakMinutes }),
    [photos, breakMinutes],
  );
  const days = useMemo(() => groupByDay(moments, byId), [moments, byId]);

  const stats = useMemo(() => {
    const withTime = photos.filter((p) => p.timeSource === "exif").length;
    return {
      total: photos.length,
      withTime,
      byFileDate: photos.length - withTime,
      withZone: photos.filter((p) => p.offsetMinutes !== null).length,
      withLocation: photos.filter((p) => p.gps !== null).length,
      heic: Array.from(previews.values()).filter((url) => url === null).length,
    };
  }, [photos, previews]);

  return (
    <section className="photo-step">
      <label className="button">
        {status.kind === "idle" ? "Choose photos" : "Choose again"}
        <input
          className="visually-hidden"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            void onPick(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {status.kind === "reading" && (
        <div className="card" aria-live="polite">
          <p>
            Sorting your photos… {status.done} of {status.total}
          </p>
          <div className="progress">
            <div style={{ width: `${status.total ? (100 * status.done) / status.total : 0}%` }} />
          </div>
        </div>
      )}

      {status.kind === "ready" && stats.total === 0 && (
        <p className="warn">None of those were photos. Inkreel works with photos for now, not videos.</p>
      )}

      {status.kind === "ready" && stats.total > 0 && (
        <>
          <div className="card">
            <p className="summary">
              {plural(moments.length, "moment", "moments")} from {plural(stats.total, "photo", "photos")}
              {days.length > 1 && `, across ${days.length} days`}.
            </p>

            {stats.byFileDate > 0 && (
              <p className="warn">
                {plural(stats.byFileDate, "photo didn’t", "photos didn’t")} save when {stats.byFileDate === 1 ? "it was" : "they were"}{" "}
                taken, so {stats.byFileDate === 1 ? "it’s" : "they’re"} placed by file date and marked “no time”. Check{" "}
                {stats.byFileDate === 1 ? "it’s" : "they’re"} in the right moment.
              </p>
            )}
            {stats.heic > 0 && (
              <p className="warn">
                {plural(stats.heic, "photo is", "photos are")} in HEIC format, which this browser can’t preview.{" "}
                {stats.heic === 1 ? "It’s" : "They’re"} still sorted into moments.
              </p>
            )}
            {skipped > 0 && (
              <p className="muted small">
                {plural(skipped, "video was", "videos were")} left out. Inkreel works with photos for now.
              </p>
            )}

            <div className="row small">
              <label htmlFor="break">Start a new moment after a break of</label>
              <select id="break" value={breakMinutes} onChange={(e) => setBreakMinutes(Number(e.target.value))}>
                {BREAK_CHOICES.map((g) => (
                  <option key={g} value={g}>
                    {g < 60 ? `${g} min` : `${g / 60} hr${g === 60 ? "" : "s"}`}
                  </option>
                ))}
              </select>
            </div>
            <p className="muted small">Shorter breaks give you more, smaller moments.</p>

            <details>
              <summary className="small">Photo details</summary>
              <dl className="stats">
                <Stat label="Time saved in photo" value={stats.withTime} />
                <Stat label="Placed by file date" value={stats.byFileDate} />
                <Stat label="Time zone saved" value={stats.withZone} />
                <Stat label="Location saved" value={stats.withLocation} />
              </dl>
              {stats.withLocation === 0 && (
                <p className="muted small">
                  Phone browsers usually remove location when you upload, so Inkreel sorts by time.
                </p>
              )}
            </details>
          </div>

          {days.map((day, i) => (
            <section key={day.label + i}>
              <h2>
                Day {i + 1} <span className="muted">· {day.label}</span>
              </h2>
              {day.moments.map((m) => {
                const first = byId.get(m.photoIds[0]!)!;
                const last = byId.get(m.photoIds[m.photoIds.length - 1]!)!;
                const shown = m.photoIds.slice(0, THUMBS_PER_MOMENT);
                const when =
                  m.photoIds.length === 1 || formatTime(first) === formatTime(last)
                    ? formatTime(first)
                    : `${formatTime(first)} to ${formatTime(last)}`;
                return (
                  <article key={m.id} className="card">
                    <div className="moment-head">
                      <strong>{when}</strong>
                      <span className="muted small">{plural(m.photoIds.length, "photo", "photos")}</span>
                    </div>
                    <div className="thumbs">
                      {shown.map((id) => {
                        const p = byId.get(id)!;
                        const url = previews.get(id) ?? null;
                        return (
                          <div key={id} className="thumb" title={`${p.fileName} · ${formatTime(p)}`}>
                            {url ? (
                              // Local object URLs: next/image can't optimise these.
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={url} alt="" loading="lazy" decoding="async" />
                            ) : (
                              <span>HEIC</span>
                            )}
                            {p.timeSource === "file" && <span className="flag">no time</span>}
                          </div>
                        );
                      })}
                      {m.photoIds.length > shown.length && (
                        <div className="thumb">+{m.photoIds.length - shown.length}</div>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
          {footer?.(moments.length)}
        </>
      )}
    </section>
  );
}

/** Groups consecutive moments by the day their first photo was taken. */
function groupByDay(moments: Moment[], byId: Map<string, PhotoMeta>) {
  const days: { label: string; moments: Moment[] }[] = [];
  for (const m of moments) {
    const first = byId.get(m.photoIds[0]!);
    if (!first) continue;
    const label = formatDay(first);
    const current = days[days.length - 1];
    if (current && current.label === label) current.moments.push(m);
    else days.push({ label, moments: [m] });
  }
  return days;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
