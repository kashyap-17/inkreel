import { describe, expect, it } from "vitest";
import { parseExifDateTime, parseExifOffset, toInstant } from "./time";

describe("parseExifDateTime", () => {
  it("parses the EXIF format", () => {
    expect(parseExifDateTime("2024:05:03 10:20:30")?.wall).toBe("2024-05-03T10:20:30");
  });

  it("rejects missing, zeroed and malformed dates", () => {
    expect(parseExifDateTime(undefined)).toBeNull();
    expect(parseExifDateTime("0000:00:00 00:00:00")).toBeNull();
    expect(parseExifDateTime("    :  :     :  :  ")).toBeNull();
    expect(parseExifDateTime("2024-05-03")).toBeNull();
    expect(parseExifDateTime("2024:13:03 10:20:30")).toBeNull();
  });
});

describe("parseExifOffset", () => {
  it("parses positive, negative and half-hour offsets", () => {
    expect(parseExifOffset("+05:30")).toBe(330);
    expect(parseExifOffset("-04:00")).toBe(-240);
    expect(parseExifOffset("+00:00")).toBe(0);
  });

  it("rejects missing or impossible offsets", () => {
    expect(parseExifOffset(undefined)).toBeNull();
    expect(parseExifOffset("+25:00")).toBeNull();
    expect(parseExifOffset("05:30")).toBeNull();
  });
});

describe("toInstant", () => {
  it("uses the offset when present", () => {
    const wall = parseExifDateTime("2024:05:03 10:00:00")!;
    expect(new Date(toInstant(wall, 330)).toISOString()).toBe("2024-05-03T04:30:00.000Z");
  });

  it("orders photos across a time-zone change by real time", () => {
    // 09:00 in London (UTC+1) is after 12:00 in Delhi (UTC+5:30) on the same day.
    const delhi = toInstant(parseExifDateTime("2024:05:03 12:00:00")!, 330);
    const london = toInstant(parseExifDateTime("2024:05:03 09:00:00")!, 60);
    expect(london).toBeGreaterThan(delhi);
  });
});
