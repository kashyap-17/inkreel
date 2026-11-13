// Prepares each picked photo in the browser: decode, working copy, thumbnail, hash, sharpness.
// Loaded only when photos are picked, because the EXIF reader is large.
import { canvas, context, fit, greyAt, resizeToJpeg } from "./canvas";
import { readPhotoMeta } from "./exif";
import { sniffFormat, type ImageFormat } from "./files";
import { differenceHash, laplacianVariance } from "./pixels";
import type { PhotoRecord } from "./types";

export const FULL_PX = 2048;
export const THUMB_PX = 360;
const SHARPNESS_PX = 256;

export interface PreparedPhoto {
  record: PhotoRecord;
  full: Blob;
  thumb: Blob;
}

/** Why a photo couldn't be used, shown on the photos screen so the cause is visible. */
export interface PhotoFailure {
  fileName: string;
  /** What the phone said the file was. */
  type: string;
  /** What the file's first bytes say it is. */
  format: ImageFormat;
  sizeMB: number;
  reason: string;
}

const describeError = (e: unknown) =>
  (e instanceof Error ? (e.name === "Error" ? e.message : `${e.name}: ${e.message}`) : String(e)).slice(0, 400);

/** Draws a decoded <img> shrunk to working size, so no second full-size copy is held. */
function shrink(img: HTMLImageElement): Promise<ImageBitmap> {
  const { width, height } = fit(img.naturalWidth, img.naturalHeight, FULL_PX);
  const c = canvas(width, height);
  context(c).drawImage(img, 0, 0, width, height);
  return createImageBitmap(c);
}

async function viaImg(blob: Blob): Promise<ImageBitmap> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await shrink(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Tries three ways to open a photo: directly with its own orientation; the way an <img>
 * thumbnail does (phones can show some photos the first way can't); and from a copy read
 * into memory first (for files the phone hands over in a form that can only be read once in full).
 */
async function decode(file: File): Promise<ImageBitmap> {
  const errors: string[] = [];
  const attempts: [string, () => Promise<ImageBitmap>][] = [
    ["direct", () => createImageBitmap(file, { imageOrientation: "from-image" })],
    ["thumbnail", () => viaImg(file)],
    ["in memory", async () => viaImg(new Blob([await file.arrayBuffer()], { type: file.type || "image/jpeg" }))],
  ];
  for (const [name, attempt] of attempts) {
    try {
      return await attempt();
    } catch (e) {
      errors.push(`${name}: ${describeError(e)}`);
    }
  }
  throw new Error(errors.join(" | "));
}

async function formatOf(file: File): Promise<ImageFormat> {
  try {
    return sniffFormat(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
  } catch {
    return "unknown";
  }
}

/** Never throws: anything that goes wrong becomes a failure saying which step it was. */
export async function preparePhoto(
  file: File,
  id: string,
): Promise<{ ok: true; photo: PreparedPhoto } | { ok: false; failure: PhotoFailure }> {
  const fail = async (step: string, e: unknown) => ({
    ok: false as const,
    failure: {
      fileName: file.name,
      type: file.type || "(none)",
      format: await formatOf(file),
      sizeMB: Math.round(file.size / 100_000) / 10,
      reason: `${step} · ${describeError(e)}`,
    },
  });

  const meta = await readPhotoMeta(file, id);
  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file);
  } catch (e) {
    return fail("opening", e);
  }
  try {
    const small = fit(bitmap.width, bitmap.height, SHARPNESS_PX);
    const record: PhotoRecord = {
      ...meta,
      mimeType: "image/jpeg",
      width: bitmap.width,
      height: bitmap.height,
      hash: differenceHash(greyAt(bitmap, 9, 8)),
      sharpness: laplacianVariance(greyAt(bitmap, small.width, small.height), small.width, small.height),
    };
    const full = await resizeToJpeg(bitmap, FULL_PX, 0.85);
    const thumb = await resizeToJpeg(bitmap, THUMB_PX, 0.75);
    return { ok: true, photo: { record, full, thumb } };
  } catch (e) {
    return fail("making copies", e);
  } finally {
    bitmap.close();
  }
}
