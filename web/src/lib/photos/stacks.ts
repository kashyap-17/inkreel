// Stacks: near-identical shots taken within a couple of minutes (see docs/decisions.md,
// "Each chunk gets a photo"). Plain code, no AI.
import { hammingDistance } from "./pixels";
import type { PhotoRecord, Stack } from "./types";

// Starting values, tuned in Milestone 0.
export const STACKING = {
  /** A photo joins the stack when taken within this long of the stack's previous photo… */
  windowMinutes: 2,
  /** …and its hash is at most this many bits (of 64) from that photo's. */
  maxHashDistance: 12,
};

/** "Around then" on the review screen: photos within this long either side. */
export const AROUND_MINUTES = 15;

/** Sorts by capture time, then file name for photos taken in the same second. */
export function sortByTime<T extends { takenAt: number; fileName: string }>(photos: T[]): T[] {
  return [...photos].sort((a, b) => a.takenAt - b.takenAt || a.fileName.localeCompare(b.fileName));
}

type Stackable = Pick<PhotoRecord, "id" | "takenAt" | "fileName" | "hash" | "sharpness">;

/** Groups near-identical consecutive shots. Stack IDs are "k1", "k2", … in time order. */
export function buildStacks(photos: Stackable[], options = STACKING): Stack[] {
  const windowMs = options.windowMinutes * 60_000;
  const stacks: { members: Stackable[] }[] = [];
  for (const photo of sortByTime(photos)) {
    const current = stacks[stacks.length - 1];
    const previous = current?.members[current.members.length - 1];
    if (
      current &&
      previous &&
      photo.takenAt - previous.takenAt <= windowMs &&
      hammingDistance(photo.hash, previous.hash) <= options.maxHashDistance
    ) {
      current.members.push(photo);
    } else {
      stacks.push({ members: [photo] });
    }
  }
  return stacks.map((s, i) => ({
    id: `k${i + 1}`,
    photoIds: s.members.map((p) => p.id),
    topPick: s.members.reduce((best, p) => (p.sharpness > best.sharpness ? p : best)).id,
  }));
}
