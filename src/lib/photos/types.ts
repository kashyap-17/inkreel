/** Where a photo's time came from. "file" is the fallback when EXIF has no capture time. */
export type TimeSource = "exif" | "file";

export interface PhotoMeta {
  id: string;
  fileName: string;
  mimeType: string;
  /** Instant used for ordering and grouping, in ms since the epoch. */
  takenAt: number;
  timeSource: TimeSource;
  /** Wall-clock time where the photo was taken ("YYYY-MM-DDTHH:mm:ss"), when EXIF has it. */
  localTime: string | null;
  /** Minutes east of UTC from EXIF, when the camera recorded it. */
  offsetMinutes: number | null;
  gps: { lat: number; lon: number } | null;
}

export interface Moment {
  id: string;
  /** Photo IDs in capture order. */
  photoIds: string[];
  start: number;
  end: number;
}
