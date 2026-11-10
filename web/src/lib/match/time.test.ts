import { describe, expect, it } from "vitest";
import type { PhotoMeta } from "@/lib/photos/types";
import { partOfDay, timeBonus, tripDays, TIME_BONUS } from "./time";

const at = (localTime: string): PhotoMeta => ({
  id: localTime,
  fileName: "x.jpg",
  mimeType: "image/jpeg",
  takenAt: Date.parse(`${localTime}Z`),
  timeSource: "exif",
  localTime,
  offsetMinutes: 330,
  gps: null,
});

describe("time hints", () => {
  it("reads the part of day from the time where the photo was taken", () => {
    expect(partOfDay(at("2026-03-12T06:30:00"))).toBe("morning");
    expect(partOfDay(at("2026-03-12T14:00:00"))).toBe("afternoon");
    expect(partOfDay(at("2026-03-12T19:15:00"))).toBe("evening");
    expect(partOfDay(at("2026-03-12T23:50:00"))).toBe("night");
  });

  it("numbers trip days from the first photo's day", () => {
    const photos = [at("2026-03-12T23:00:00"), at("2026-03-13T08:00:00"), at("2026-03-14T08:00:00")];
    const { dayOf, count } = tripDays(photos);
    expect(photos.map(dayOf)).toEqual([1, 2, 3]);
    expect(count).toBe(3);
  });

  it("adds a bonus for each hint the photo agrees with", () => {
    const photo = at("2026-03-13T07:00:00");
    const { dayOf } = tripDays([at("2026-03-12T10:00:00"), photo]);
    expect(timeBonus({ partOfDay: "morning", day: 2 }, photo, dayOf)).toBeCloseTo(2 * TIME_BONUS);
    expect(timeBonus({ partOfDay: "evening", day: 0 }, photo, dayOf)).toBe(0);
  });
});
