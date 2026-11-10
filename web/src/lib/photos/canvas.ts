// Canvas helpers for photos in the browser: resizing, small copies for Gemini, carousel slides.
// Re-encoding through a canvas drops EXIF, so copies carry no location or camera details.
import { toGrey } from "./pixels";

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

export function canvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

export function context(c: AnyCanvas) {
  const ctx = c.getContext("2d", { willReadFrequently: false }) as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("Canvas isn't available.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

function toBlob(c: AnyCanvas, quality: number): Promise<Blob> {
  if ("convertToBlob" in c) return c.convertToBlob({ type: "image/jpeg", quality });
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the image."))), "image/jpeg", quality),
  );
}

export const fit = (w: number, h: number, max: number) => {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
};

/** Draws a source scaled to fit within `max` px and returns it as a JPEG. */
export async function resizeToJpeg(source: ImageBitmap, max: number, quality: number): Promise<Blob> {
  const { width, height } = fit(source.width, source.height, max);
  const c = canvas(width, height);
  context(c).drawImage(source, 0, 0, width, height);
  return toBlob(c, quality);
}

export function greyAt(source: ImageBitmap, width: number, height: number): Float32Array {
  const c = canvas(width, height);
  const ctx = context(c);
  ctx.drawImage(source, 0, 0, width, height);
  return toGrey(ctx.getImageData(0, 0, width, height).data);
}

/** A small JPEG of a stored copy, as base64, for sending to Gemini. */
export async function base64Jpeg(blob: Blob, max: number): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  try {
    const jpeg = await resizeToJpeg(bitmap, max, 0.8);
    const bytes = new Uint8Array(await jpeg.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  } finally {
    bitmap.close();
  }
}

/** A 4:5 slide (1080×1350), centre-cropped, as Instagram shows every carousel slide. */
export async function renderSlide(blob: Blob): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.max(W / bitmap.width, H / bitmap.height);
    const sw = W / scale;
    const sh = H / scale;
    const c = canvas(W, H);
    context(c).drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, W, H);
    return toBlob(c, 0.92);
  } finally {
    bitmap.close();
  }
}
