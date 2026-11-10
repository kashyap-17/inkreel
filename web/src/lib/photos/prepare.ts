// Prepares each picked photo in the browser: decode, working copy, thumbnail, hash, sharpness.
// Loaded only when photos are picked, because the EXIF reader is large.
import { fit, greyAt, resizeToJpeg } from "./canvas";
import { readPhotoMeta } from "./exif";
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

/** Returns null when the browser can't decode the file (for example HEIC in Chrome). */
export async function preparePhoto(file: File, id: string): Promise<PreparedPhoto | null> {
  const meta = await readPhotoMeta(file, id);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
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
    return { record, full, thumb };
  } finally {
    bitmap.close();
  }
}

