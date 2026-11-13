// File checks that don't need the EXIF library, so they can run before it loads.

export function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

export function isPhoto(file: File): boolean {
  return file.type.startsWith("image/") || isHeic(file);
}

export type ImageFormat = "jpeg" | "png" | "heic" | "avif" | "webp" | "gif" | "unknown";

/**
 * The real format from a file's first bytes. Phones don't always label files correctly,
 * so this is what explains a photo the browser can't open.
 */
export function sniffFormat(head: Uint8Array): ImageFormat {
  const at = (i: number) => head[i] ?? -1;
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "jpeg";
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return "png";
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46) return "gif";
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand === "avif" || brand === "avis") return "avif";
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) return "heic";
  }
  return "unknown";
}
