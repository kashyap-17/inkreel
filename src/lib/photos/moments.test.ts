import { describe, expect, it } from "vitest";
import { distanceKm, groupIntoMoments } from "./moments";
import type { PhotoMeta } from "./types";

const T0 = Date.UTC(2024, 4, 3, 9, 0, 0);
const min = (m: number) => T0 + m * 60_000;

function photo(id: string, takenAt: number, gps: PhotoMeta["gps"] = null): PhotoMeta {
  return {
    id,
    fileName: `${id}.jpg`,
    mimeType: "image/jpeg",
    takenAt,
    timeSource: "exif",
    localTime: null,
    offsetMinutes: null,
    gps,
  };
}

const ids = (photos: ReturnType<typeof groupIntoMoments>) => photos.map((m) => m.photoIds);

describe("groupIntoMoments", () => {
  it("returns no moments for no photos", () => {
    expect(groupIntoMoments([])).toEqual([]);
  });

  it("starts a new moment after a gap longer than 45 minutes", () => {
    const moments = groupIntoMoments([photo("a", min(0)), photo("b", min(30)), photo("c", min(76))]);
    expect(ids(moments)).toEqual([["a", "b"], ["c"]]);
    expect(moments.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("keeps a 45-minute gap in the same moment", () => {
    expect(ids(groupIntoMoments([photo("a", min(0)), photo("b", min(45))]))).toEqual([["a", "b"]]);
  });

  it("sorts photos by time before grouping", () => {
    const moments = groupIntoMoments([photo("c", min(200)), photo("a", min(0)), photo("b", min(10))]);
    expect(ids(moments)).toEqual([["a", "b"], ["c"]]);
  });

  it("splits a moment longer than three hours", () => {
    const steady = Array.from({ length: 25 }, (_, i) => photo(`p${i}`, min(i * 10)));
    const moments = groupIntoMoments(steady);
    expect(moments.length).toBe(2);
    expect(moments[0]!.end - moments[0]!.start).toBeLessThanOrEqual(180 * 60_000);
  });

  it("starts a new moment on a location jump when GPS exists", () => {
    const fort = { lat: 26.9855, lon: 75.8513 };
    const cityPalace = { lat: 26.9258, lon: 75.8237 };
    const moments = groupIntoMoments([photo("a", min(0), fort), photo("b", min(20), cityPalace)]);
    expect(ids(moments)).toEqual([["a"], ["b"]]);
  });

  it("ignores location when a photo has no GPS", () => {
    const fort = { lat: 26.9855, lon: 75.8513 };
    const moments = groupIntoMoments([photo("a", min(0), fort), photo("b", min(20))]);
    expect(ids(moments)).toEqual([["a", "b"]]);
  });
});

describe("distanceKm", () => {
  it("is about 111 km per degree of latitude", () => {
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111.2, 0);
  });
});
