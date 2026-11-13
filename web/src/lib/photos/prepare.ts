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
  e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : String(e).slice(0, 200);

/**
 * Decodes with the image's own orientation. If that fails, decodes the way an <img> thumbnail
 * does (which phones can show even when the first way fails) and shrinks it straight to the
 * working size, so no second full-size copy is held in memory.
 */
async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (first) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const { width, height } = fit(img.naturalWidth, img.naturalHeight, FULL_PX);
      const c = canvas(width, height);
      context(c).drawImage(img, 0, 0, width, height);
      return await createImageBitmap(c);
    } catch (second) {
      throw new Error(`${describeError(first)} | fallback: ${describeError(second)}`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function preparePhoto(
  file: File,
  id: string,
): Promise<{ ok: true; photo: PreparedPhoto } | { ok: false; failure: PhotoFailure }> {
  const meta = await readPhotoMeta(file, id);
  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file);
  } catch (e) {
    const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    return {
      ok: false,
      failure: {
        fileName: file.name,
        type: file.type || "(none)",
        format: sniffFormat(head),
        sizeMB: Math.round(file.size / 100_000) / 10,
        reason: describeError(e),
      },
    };
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
    const [full, thumb] = [await resizeToJpeg(bitmap, FULL_PX, 0.85), await resizeToJpeg(bitmap, THUMB_PX, 0.75)];
    return { ok: true, photo: { record, full, thumb } };
  } finally {
    bitmap.close();
  }
}
