import { describe, expect, it } from "vitest";
import { differenceHash, hammingDistance, laplacianVariance, toGrey } from "./pixels";

describe("differenceHash", () => {
  it("gives 16 hex characters, all ones for a left-to-right falling gradient", () => {
    const grey = new Float32Array(72).map((_, i) => 255 - (i % 9) * 20);
    expect(differenceHash(grey)).toBe("ffffffffffffffff");
  });

  it("gives all zeros for a flat image", () => {
    expect(differenceHash(new Float32Array(72).fill(100))).toBe("0000000000000000");
  });
});

describe("hammingDistance", () => {
  it("counts differing bits", () => {
    expect(hammingDistance("0000", "0000")).toBe(0);
    expect(hammingDistance("000f", "0000")).toBe(4);
    expect(hammingDistance("ffff", "0000")).toBe(16);
  });
});

describe("laplacianVariance", () => {
  it("is zero for a flat image and higher for a sharp edge than a soft one", () => {
    const w = 10;
    const flat = new Float32Array(w * w).fill(128);
    const sharp = new Float32Array(w * w).map((_, i) => (i % w < 5 ? 0 : 255));
    const soft = new Float32Array(w * w).map((_, i) => (i % w) * 25);
    expect(laplacianVariance(flat, w, w)).toBe(0);
    expect(laplacianVariance(sharp, w, w)).toBeGreaterThan(laplacianVariance(soft, w, w));
  });
});

describe("toGrey", () => {
  it("weights the channels", () => {
    expect(Array.from(toGrey(new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255])))).toEqual([255, 0].map((v) => expect.closeTo(v, 3)));
  });
});
