"use client";

import { useEffect, useMemo, useState } from "react";
import { isHeic, isPhoto } from "@/lib/photos/files";
import { formatDay, formatTime } from "@/lib/photos/format";
import { DEFAULT_GROUPING, groupIntoMoments } from "@/lib/photos/moments";
import type { PhotoMeta } from "@/lib/photos/types";

const GAP_CHOICES = [15, 30, 45, 60, 90, 120];
const THUMBS_PER_MOMENT = 8;

type Status = { kind: "idle" } | { kind: "reading"; done: number; total: number } | { kind: "ready" };

export function PhotoStep() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [gapMinutes, setGapMinutes] = useState(DEFAULT_GROUPING.gapMinutes);
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
    () => groupIntoMoments(photos, { ...DEFAULT_GROUPING, gapMinutes }),
    [photos, gapMinutes],
  );

  const stats = useMemo(() => {
    const fromExif = photos.filter((p) => p.timeSource === "exif").length;
    return {
      total: photos.length,
      fromExif,
      fromFile: photos.length - fromExif,
      withOffset: photos.filter((p) => p.offsetMinutes !== null).length,
      withGps: photos.filter((p) => p.gps !== null).length,
      heic: Array.from(previews.values()).filter((url) => url === null).length,
    };
  }, [photos, previews]);

  return (
    <section>
      <div className="row">
        <label className="button">
          {status.kind === "idle" ? "Add photos" : "Choose different photos"}
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
      </div>

      {status.kind === "reading" && (
        <div className="card" aria-live="polite">
          <p>
            Reading photos… {status.done} / {status.total}
          </p>
          <div className="progress">
            <div style={{ width: `${status.total ? (100 * status.done) / status.total : 0}%` }} />
          </div>
        </div>
      )}

      {status.kind === "ready" && (
        <>
          <div className="card">
            <dl className="stats">
              <Stat label="Photos" value={stats.total} />
              <Stat label="Moments" value={moments.length} />
              <Stat label="Time from photo" value={stats.fromExif} />
              <Stat label="Time from file date" value={stats.fromFile} />
              <Stat label="Time zone recorded" value={stats.withOffset} />
              <Stat label="Location" value={stats.withGps} />
            </dl>
            {stats.fromFile > 0 && (
              <p className="warn">
                {stats.fromFile} photo{stats.fromFile === 1 ? " has" : "s have"} no capture time, so the file date is
                used. Check that they sit in the right moment (marked “file date”).
              </p>
            )}
            {stats.heic > 0 && (
              <p className="warn">
                {stats.heic} HEIC photo{stats.heic === 1 ? "" : "s"}: grouped, but no preview yet in this browser.
              </p>
            )}
            {skipped > 0 && (
              <p className="muted small">
                {skipped} video{skipped === 1 ? "" : "s"} or other file{skipped === 1 ? "" : "s"} skipped. Inkreel uses
                photos only.
              </p>
            )}
            {stats.withGps === 0 && stats.total > 0 && (
              <p className="muted small">
                No location data. Phone browsers usually remove it on upload, so moments are grouped by time.
              </p>
            )}
            <div className="row small">
              <label htmlFor="gap">New moment after a gap of</label>
              <select id="gap" value={gapMinutes} onChange={(e) => setGapMinutes(Number(e.target.value))}>
                {GAP_CHOICES.map((g) => (
                  <option key={g} value={g}>
                    {g} min
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h2>Moments</h2>
          {moments.map((m) => {
            const first = byId.get(m.photoIds[0]!)!;
            const last = byId.get(m.photoIds[m.photoIds.length - 1]!)!;
            const shown = m.photoIds.slice(0, THUMBS_PER_MOMENT);
            const range = m.photoIds.length === 1 ? formatTime(first) : `${formatTime(first)}–${formatTime(last)}`;
            return (
              <article key={m.id} className="card">
                <div className="moment-head">
                  <strong>
                    {formatDay(first)} · {range}
                  </strong>
                  <span className="muted small">
                    {m.photoIds.length} photo{m.photoIds.length === 1 ? "" : "s"}
                  </span>
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
                        {p.timeSource === "file" && <span className="flag">file date</span>}
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
        </>
      )}
    </section>
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
