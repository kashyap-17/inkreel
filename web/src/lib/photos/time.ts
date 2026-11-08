// Parsing of EXIF date fields. Pure functions, so they can be tested without files.

export interface ExifWallTime {
  /** "YYYY-MM-DDTHH:mm:ss", the clock time where the photo was taken. */
  wall: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const EXIF_DATE = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;

/** Parses an EXIF date like "2024:05:03 10:20:30". Returns null for missing or zeroed dates. */
export function parseExifDateTime(value: unknown): ExifWallTime | null {
  if (typeof value !== "string") return null;
  const m = EXIF_DATE.exec(value.trim());
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  if (year < 1971 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    wall: `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`,
    year,
    month,
    day,
    hour,
    minute,
    second,
  };
}

const EXIF_OFFSET = /^([+-])(\d{2}):?(\d{2})$/;

/** Parses an EXIF offset like "+05:30" into minutes east of UTC. */
export function parseExifOffset(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = EXIF_OFFSET.exec(value.trim());
  if (!m) return null;
  const minutes = Number(m[2]) * 60 + Number(m[3]);
  if (minutes > 14 * 60) return null;
  return m[1] === "-" ? -minutes : minutes;
}

/**
 * The instant a photo was taken. With an offset this is exact. Without one, the clock
 * time is read in the browser's time zone: consistent across one camera's photos, which
 * is what grouping needs.
 */
export function toInstant(t: ExifWallTime, offsetMinutes: number | null): number {
  if (offsetMinutes !== null) {
    const asUtc = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
    return asUtc - offsetMinutes * 60_000;
  }
  return new Date(t.year, t.month - 1, t.day, t.hour, t.minute, t.second).getTime();
}
