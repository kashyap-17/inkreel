// File checks that don't need the EXIF library, so they can run before it loads.

export function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

export function isPhoto(file: File): boolean {
  return file.type.startsWith("image/") || isHeic(file);
}
