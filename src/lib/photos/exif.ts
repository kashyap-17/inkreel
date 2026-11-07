import exifr from "exifr";
import { isHeic } from "./files";
import { parseExifDateTime, parseExifOffset, toInstant } from "./time";
import type { PhotoMeta } from "./types";

const EXIF_OPTIONS = {
  tiff: true,
  exif: true,
  gps: true,
  ifd1: false,
  xmp: false,
  icc: false,
  iptc: false,
  jfif: false,
  ihdr: false,
  reviveValues: false,
  translateValues: false,
  mergeOutput: true,
};

interface RawExif {
  DateTimeOriginal?: unknown;
  CreateDate?: unknown;
  DateTime?: unknown;
  OffsetTimeOriginal?: unknown;
  OffsetTime?: unknown;
  latitude?: unknown;
  longitude?: unknown;
}

// A JPEG keeps EXIF in its first 64 KB. HEIC can store it further in, so HEIC files
// without a date in the first chunk are read in full.
const HEAD_BYTES = 512 * 1024;

async function parseExif(blob: Blob): Promise<RawExif> {
  try {
    const data = new Uint8Array(await blob.arrayBuffer());
    return ((await exifr.parse(data, EXIF_OPTIONS)) as RawExif | undefined) ?? {};
  } catch {
    return {};
  }
}

/** Reads capture time, time-zone offset and GPS from one photo. Never throws. */
export async function readPhotoMeta(file: File, id: string): Promise<PhotoMeta> {
  let raw = await parseExif(file.slice(0, HEAD_BYTES));
  if (!raw.DateTimeOriginal && isHeic(file) && file.size > HEAD_BYTES) raw = await parseExif(file);

  const wall =
    parseExifDateTime(raw.DateTimeOriginal) ??
    parseExifDateTime(raw.CreateDate) ??
    parseExifDateTime(raw.DateTime);
  const offsetMinutes = parseExifOffset(raw.OffsetTimeOriginal) ?? parseExifOffset(raw.OffsetTime);

  const lat = typeof raw.latitude === "number" ? raw.latitude : NaN;
  const lon = typeof raw.longitude === "number" ? raw.longitude : NaN;
  const gps =
    Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0) ? { lat, lon } : null;

  const base = { id, fileName: file.name, mimeType: file.type, gps };
  if (wall) {
    return {
      ...base,
      takenAt: toInstant(wall, offsetMinutes),
      timeSource: "exif",
      localTime: wall.wall,
      offsetMinutes,
    };
  }
  return {
    ...base,
    takenAt: file.lastModified,
    timeSource: "file",
    localTime: null,
    offsetMinutes: null,
  };
}

/** Reads all photos a few at a time, reporting progress. Results keep the input order. */
export async function readAllPhotoMeta(
  files: File[],
  onProgress?: (done: number, total: number) => void,
  concurrency = 6,
): Promise<PhotoMeta[]> {
  const results = new Array<PhotoMeta>(files.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < files.length) {
      const i = next++;
      results[i] = await readPhotoMeta(files[i]!, `p${i + 1}`);
      done++;
      onProgress?.(done, files.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  return results;
}
