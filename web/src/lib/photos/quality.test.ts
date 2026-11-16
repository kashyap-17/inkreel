import { describe, expect, it } from "vitest";
import { exposure, looksLikeScreenshot, photoIssue, setAsideWeak } from "./quality";
import type { PhotoRecord } from "./types";

const photo = (id: string, over: Partial<PhotoRecord> = {}): PhotoRecord => ({
  id,
  fileName: `${id}.jpg`,
  mimeType: "image/jpeg",
  takenAt: 0,
  timeSource: "exif",
  localTime: null,
  offsetMinutes: null,
  gps: null,
  width: 4000,
  height: 3000,
  hash: "0000000000000000",
  sharpness: 900,
  dark: 0.1,
  bright: 0.1,
  screenshot: false,
  ...over,
});

describe("exposure", () => {
  it("measures the very dark and very bright shares", () => {
    expect(exposure(Float32Array.from([0, 10, 120, 250]))).toEqual({ dark: 0.5, bright: 0.25 });
  });
});

describe("looksLikeScreenshot", () => {
  it("goes by the name, or a PNG with no camera time", () => {
    expect(looksLikeScreenshot("Screenshot_2026-09-25.jpg", "image/jpeg", false)).toBe(true);
    expect(looksLikeScreenshot("image.png", "image/png", false)).toBe(true);
    expect(looksLikeScreenshot("IMG_1.png", "image/png", true)).toBe(false);
    expect(looksLikeScreenshot("IMG_1.jpg", "image/jpeg", false)).toBe(false);
  });
});

describe("photoIssue", () => {
  it("names what is wrong, or nothing", () => {
    expect(photoIssue(photo("a"))).toBeNull();
    expect(photoIssue(photo("a", { sharpness: 12 }))).toBe("blurry");
    expect(photoIssue(photo("a", { dark: 0.97 }))).toBe("dark");
    expect(photoIssue(photo("a", { bright: 0.93 }))).toBe("bright");
    expect(photoIssue(photo("a", { screenshot: true }))).toBe("screenshot");
  });

  it("keeps a night photo with a lit area, and anything the user brought back", () => {
    expect(photoIssue(photo("a", { dark: 0.8 }))).toBeNull();
    expect(photoIssue(photo("a", { sharpness: 12, kept: true }))).toBeNull();
  });

  it("treats photos saved before these measures existed as fine", () => {
    expect(photoIssue(photo("a", { dark: undefined, bright: undefined, screenshot: undefined }))).toBeNull();
  });
});

describe("setAsideWeak", () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => photo(`p${i}`));

  it("sets aside weak photos when there are many", () => {
    const { use, setAside } = setAsideWeak([...many(11), photo("blur", { sharpness: 5 })]);
    expect(use).toHaveLength(11);
    expect(setAside.map((p) => p.id)).toEqual(["blur"]);
  });

  it("sets nothing aside when only a few were added", () => {
    const { setAside } = setAsideWeak([...many(3), photo("blur", { sharpness: 5 })]);
    expect(setAside).toEqual([]);
  });

  it("never sets everything aside", () => {
    const all = Array.from({ length: 12 }, (_, i) => photo(`p${i}`, { sharpness: 5 }));
    expect(setAsideWeak(all).use).toHaveLength(12);
  });
});
