// Plain pixel maths on greyscale arrays, kept apart from canvas code so it can be unit tested.

/** Greyscale (0–255) from RGBA bytes, using Rec. 601 luma weights. */
export function toGrey(rgba: Uint8ClampedArray | Uint8Array): Float32Array {
  const grey = new Float32Array(rgba.length / 4);
  for (let i = 0; i < grey.length; i++) {
    grey[i] = 0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!;
  }
  return grey;
}

/**
 * Difference hash of a 9×8 greyscale image: one bit per pixel, set when it is brighter than
 * its right-hand neighbour. Near-identical photos give hashes a few bits apart.
 */
export function differenceHash(grey9x8: Float32Array): string {
  if (grey9x8.length !== 72) throw new Error("differenceHash needs a 9×8 image");
  let hex = "";
  let nibble = 0;
  let bits = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      nibble = (nibble << 1) | (grey9x8[y * 9 + x]! > grey9x8[y * 9 + x + 1]! ? 1 : 0);
      if (++bits === 4) {
        hex += nibble.toString(16);
        nibble = 0;
        bits = 0;
      }
    }
  }
  return hex;
}

/** Number of differing bits between two hex hashes of the same length. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/** Variance of the 4-neighbour Laplacian: a standard sharpness measure (blur lowers it). */
export function laplacianVariance(grey: Float32Array, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = grey[i - width]! + grey[i + width]! + grey[i - 1]! + grey[i + 1]! - 4 * grey[i]!;
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}
