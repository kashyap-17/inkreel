import { describe, expect, it } from "vitest";
import { estimatePhotos, formatEstimate } from "./estimate";

const range = (words: number, sentences: number, photos?: number) => {
  const e = estimatePhotos(words, sentences, photos);
  return e && [e.min, e.max];
};

describe("estimatePhotos (examples from docs/decisions.md)", () => {
  it("short poem: 20 words, 6 lines → 2–3", () => expect(range(20, 6)).toEqual([2, 3]));
  it("one long sentence: 50 words → 1", () => expect(range(50, 1)).toEqual([1, 1]));
  it("short note: 60 words, 3 sentences → 2–3", () => expect(range(60, 3)).toEqual([2, 3]));
  it("a few paragraphs: 150 words, 9 sentences → 4–6", () => expect(range(150, 9)).toEqual([4, 6]));
  it("long write-up: 600 words, 40 sentences → 15–20", () => expect(range(600, 40)).toEqual([15, 20]));
});

describe("estimatePhotos limits", () => {
  it("returns nothing for empty writing", () => {
    expect(estimatePhotos(0, 0)).toBeNull();
  });

  it("never exceeds the number of sentences", () => {
    expect(range(200, 2)).toEqual([2, 2]);
  });

  it("is capped at the number of distinct photos once photos are added", () => {
    expect(range(150, 9, 3)).toEqual([3, 3]);
  });

  it("flags writing that needs more than Instagram's 20", () => {
    expect(estimatePhotos(600, 40)?.overLimit).toBe(true);
    expect(estimatePhotos(150, 9)?.overLimit).toBe(false);
  });
});

describe("formatEstimate", () => {
  it("reads naturally", () => {
    expect(formatEstimate({ min: 1, max: 1, overLimit: false })).toBe("About 1 photo");
    expect(formatEstimate({ min: 4, max: 6, overLimit: false })).toBe("About 4–6 photos");
  });
});
