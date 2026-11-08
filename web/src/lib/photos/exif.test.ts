import { describe, expect, it } from "vitest";
import { readPhotoMeta } from "./exif";

// Builds a tiny JPEG holding only an EXIF block, so no real photo is needed in the repo.
type Entry = { tag: number; type: 2 | 4 | 5; values: string | number[] };

function exifJpeg(opts: { dateTimeOriginal?: string; offset?: string; gps?: { lat: number; lon: number } }): Uint8Array<ArrayBuffer> {
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat(0);
  const dms = (deg: number) => {
    const a = Math.abs(deg);
    const d = Math.floor(a);
    const m = Math.floor((a - d) * 60);
    const s = Math.round(((a - d) * 60 - m) * 60 * 100);
    return [d, 1, m, 1, s, 100];
  };

  const exifEntries: Entry[] = [];
  if (opts.dateTimeOriginal) exifEntries.push({ tag: 0x9003, type: 2, values: opts.dateTimeOriginal });
  if (opts.offset) exifEntries.push({ tag: 0x9011, type: 2, values: opts.offset });
  const gpsEntries: Entry[] = opts.gps
    ? [
        { tag: 1, type: 2, values: opts.gps.lat >= 0 ? "N" : "S" },
        { tag: 2, type: 5, values: dms(opts.gps.lat) },
        { tag: 3, type: 2, values: opts.gps.lon >= 0 ? "E" : "W" },
        { tag: 4, type: 5, values: dms(opts.gps.lon) },
      ]
    : [];

  // TIFF body, little-endian. Layout: header, IFD0, Exif IFD, GPS IFD, then out-of-line data.
  const ifdSize = (n: number) => 2 + n * 12 + 4;
  const ifd0Entries = 2;
  const ifd0At = 8;
  const exifAt = ifd0At + ifdSize(ifd0Entries);
  const gpsAt = exifAt + ifdSize(exifEntries.length);
  let dataAt = gpsAt + ifdSize(gpsEntries.length);

  const bytes: number[] = [];
  const u16 = (v: number) => bytes.push(v & 0xff, (v >> 8) & 0xff);
  const u32 = (v: number) => bytes.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
  const extra: number[] = [];

  const writeIfd = (entries: Entry[]) => {
    u16(entries.length);
    for (const e of entries) {
      const raw = typeof e.values === "string" ? ascii(e.values) : e.values;
      const count = e.type === 5 ? raw.length / 2 : raw.length;
      const size = e.type === 5 ? count * 8 : e.type === 4 ? count * 4 : count;
      u16(e.tag);
      u16(e.type);
      u32(count);
      const payload: number[] = [];
      for (const v of raw) {
        if (e.type === 2) payload.push(v);
        else payload.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
      }
      if (size <= 4) {
        while (payload.length < 4) payload.push(0);
        bytes.push(...payload);
      } else {
        u32(dataAt);
        extra.push(...payload);
        dataAt += payload.length;
      }
    }
    u32(0);
  };

  bytes.push(0x49, 0x49, 0x2a, 0x00); // "II*\0"
  u32(ifd0At);
  u16(ifd0Entries);
  u16(0x8769); // Exif IFD pointer
  u16(4);
  u32(1);
  u32(exifAt);
  u16(0x8825); // GPS IFD pointer
  u16(4);
  u32(1);
  u32(gpsAt);
  u32(0);
  writeIfd(exifEntries);
  writeIfd(gpsEntries);
  const tiff = [...bytes, ...extra];

  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]; // "Exif\0\0"
  const len = app1.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...app1, 0xff, 0xd9]);
}

const file = (bytes: Uint8Array<ArrayBuffer>, lastModified = 0) =>
  new File([bytes], "photo.jpg", { type: "image/jpeg", lastModified });

describe("readPhotoMeta", () => {
  it("reads capture time, time-zone offset and GPS", async () => {
    const meta = await readPhotoMeta(
      file(exifJpeg({ dateTimeOriginal: "2024:05:03 10:20:30", offset: "+05:30", gps: { lat: 26.9855, lon: 75.8513 } })),
      "p1",
    );
    expect(meta.timeSource).toBe("exif");
    expect(meta.localTime).toBe("2024-05-03T10:20:30");
    expect(meta.offsetMinutes).toBe(330);
    expect(new Date(meta.takenAt).toISOString()).toBe("2024-05-03T04:50:30.000Z");
    expect(meta.gps?.lat).toBeCloseTo(26.9855, 3);
    expect(meta.gps?.lon).toBeCloseTo(75.8513, 3);
  });

  it("works without offset or GPS", async () => {
    const meta = await readPhotoMeta(file(exifJpeg({ dateTimeOriginal: "2024:05:03 10:20:30" })), "p1");
    expect(meta.localTime).toBe("2024-05-03T10:20:30");
    expect(meta.offsetMinutes).toBeNull();
    expect(meta.gps).toBeNull();
  });

  it("falls back to the file date when EXIF has no capture time", async () => {
    const lastModified = Date.UTC(2024, 4, 3, 12, 0, 0);
    const meta = await readPhotoMeta(file(exifJpeg({}), lastModified), "p1");
    expect(meta.timeSource).toBe("file");
    expect(meta.takenAt).toBe(lastModified);
    expect(meta.localTime).toBeNull();
  });

  it("falls back to the file date for a file with no EXIF at all", async () => {
    const meta = await readPhotoMeta(file(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 1234), "p1");
    expect(meta.timeSource).toBe("file");
    expect(meta.takenAt).toBe(1234);
  });
});
