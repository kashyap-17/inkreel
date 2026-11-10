/** Where a photo's time came from. "file" is the fallback when EXIF has no capture time. */
export type TimeSource = "exif" | "file";

export interface PhotoMeta {
  id: string;
  fileName: string;
  mimeType: string;
  /** Instant used for ordering and stacking, in ms since the epoch. */
  takenAt: number;
  timeSource: TimeSource;
  /** Wall-clock time where the photo was taken ("YYYY-MM-DDTHH:mm:ss"), when EXIF has it. */
  localTime: string | null;
  /** Minutes east of UTC from EXIF, when the camera recorded it. */
  offsetMinutes: number | null;
  gps: { lat: number; lon: number } | null;
}

/** A photo after it has been prepared in the browser (working copy, thumbnail, hash, sharpness). */
export interface PhotoRecord extends PhotoMeta {
  width: number;
  height: number;
  /** 64-bit difference hash as 16 hex characters; close hashes mean near-identical shots. */
  hash: string;
  /** Variance of the Laplacian on a small greyscale copy; higher is sharper. */
  sharpness: number;
}

/** Near-identical shots taken within a couple of minutes. A post uses at most one photo per stack. */
export interface Stack {
  id: string;
  /** Photo IDs in capture order. */
  photoIds: string[];
  /** The sharpest photo; the one indexed and suggested first. */
  topPick: string;
}
