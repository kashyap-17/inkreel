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

export interface CopiedFile {
  /** The page's own copy, or the picked file itself if it couldn't be copied. */
  file: File;
  copied: boolean;
  error?: string;
}

/**
 * Copies every picked file's bytes into a file the page owns, as soon as they're picked. Some
 * phones withdraw access to picked photos a few seconds in, before the slower decoding reaches
 * them; the copies stay readable. Name, type and date are kept (the screenshot check and the
 * time fallback read them). A file that can't be copied is returned as it was, so it still gets
 * the usual attempts to open it.
 */
export async function copyFiles(files: File[], parallel = 8): Promise<CopiedFile[]> {
  const out: CopiedFile[] = new Array(files.length);
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const i = next++;
      const file = files[i]!;
      try {
        const bytes = await file.arrayBuffer();
        out[i] = { file: new File([bytes], file.name, { type: file.type, lastModified: file.lastModified }), copied: true };
      } catch (e) {
        const error = (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).slice(0, 300);
        out[i] = { file, copied: false, error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, files.length) }, worker));
  return out;
}
