import type { Moment, PhotoMeta } from "./types";

export interface GroupingOptions {
  /** A gap longer than this starts a new moment. */
  gapMinutes: number;
  /** A moment longer than this is split. */
  maxMomentMinutes: number;
  /** A move further than this between photos with GPS starts a new moment. */
  jumpKm: number;
}

// Starting values from the plan; tuned in testing.
export const DEFAULT_GROUPING: GroupingOptions = {
  gapMinutes: 45,
  maxMomentMinutes: 180,
  jumpKm: 2,
};

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Sorts photos by capture time, then file name for photos taken in the same second. */
export function sortByTime(photos: PhotoMeta[]): PhotoMeta[] {
  return [...photos].sort((a, b) => a.takenAt - b.takenAt || a.fileName.localeCompare(b.fileName));
}

/**
 * Groups photos into moments by time, using location only when GPS is present.
 * Plain code, no AI. Moment IDs are "m1", "m2", ... in time order.
 */
export function groupIntoMoments(photos: PhotoMeta[], options: GroupingOptions = DEFAULT_GROUPING): Moment[] {
  const gapMs = options.gapMinutes * 60_000;
  const maxMs = options.maxMomentMinutes * 60_000;
  const moments: Moment[] = [];
  let current: Moment | null = null;
  let lastGps: { lat: number; lon: number } | null = null;

  for (const photo of sortByTime(photos)) {
    const startsNew =
      current === null ||
      photo.takenAt - current.end > gapMs ||
      photo.takenAt - current.start > maxMs ||
      (photo.gps !== null && lastGps !== null && distanceKm(lastGps, photo.gps) > options.jumpKm);

    if (startsNew || current === null) {
      current = { id: `m${moments.length + 1}`, photoIds: [], start: photo.takenAt, end: photo.takenAt };
      moments.push(current);
      lastGps = null;
    }
    current.photoIds.push(photo.id);
    current.end = photo.takenAt;
    if (photo.gps) lastGps = photo.gps;
  }
  return moments;
}
