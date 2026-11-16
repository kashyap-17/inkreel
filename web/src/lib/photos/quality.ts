// Sets aside photos that are clearly not worth posting, before matching: blurry, nearly black,
// washed out, or screenshots. Plain rules on numbers measured when the photo is prepared.
// Nothing is deleted: the photos screen lists what was set aside and lets the user bring any back.
import type { PhotoRecord } from "./types";

// Cautious starting values: only the obviously bad. Tuned on real photos.
export const QUALITY = {
  /** Sharpness (variance of the Laplacian at 256 px) below this is blurry. Sharp photos score in the hundreds or more. */
  minSharpness: 30,
  /** Nearly black: at least this share of the photo is very dark. Night photos with any lit area stay. */
  maxDarkShare: 0.95,
  /** Washed out: at least this share of the photo is nearly white. */
  maxBrightShare: 0.9,
  /** With this many photos or fewer, nothing is set aside: the user picked them on purpose. */
  keepAllUpTo: 10,
};

export type PhotoIssue = "blurry" | "dark" | "bright" | "screenshot";

export const ISSUE_LABEL: Record<PhotoIssue, string> = {
  blurry: "blurry",
  dark: "too dark",
  bright: "washed out",
  screenshot: "screenshot",
};

/** Share of pixels that are very dark and very bright, from a greyscale (0–255) copy. */
export function exposure(grey: Float32Array): { dark: number; bright: number } {
  if (grey.length === 0) return { dark: 0, bright: 0 };
  let dark = 0;
  let bright = 0;
  for (const v of grey) {
    if (v < 30) dark++;
    else if (v > 235) bright++;
  }
  return { dark: dark / grey.length, bright: bright / grey.length };
}

/** Screenshots have no camera details; phones name them "Screenshot…" and usually save them as PNG. */
export function looksLikeScreenshot(fileName: string, fileType: string, hasCameraTime: boolean): boolean {
  return /screen ?shot/i.test(fileName) || (fileType === "image/png" && !hasCameraTime);
}

/** Why a photo should be set aside, or null. Photos the user brought back are never set aside again. */
export function photoIssue(photo: PhotoRecord): PhotoIssue | null {
  if (photo.kept) return null;
  if (photo.screenshot) return "screenshot";
  if ((photo.dark ?? 0) >= QUALITY.maxDarkShare) return "dark";
  if ((photo.bright ?? 0) >= QUALITY.maxBrightShare) return "bright";
  if (photo.sharpness < QUALITY.minSharpness) return "blurry";
  return null;
}

/** Splits photos into those used for matching and those set aside. */
export function setAsideWeak(photos: PhotoRecord[]): { use: PhotoRecord[]; setAside: PhotoRecord[] } {
  if (photos.length <= QUALITY.keepAllUpTo) return { use: photos, setAside: [] };
  const use = photos.filter((p) => photoIssue(p) === null);
  // Never set everything aside.
  if (use.length === 0) return { use: photos, setAside: [] };
  return { use, setAside: photos.filter((p) => photoIssue(p) !== null) };
}
