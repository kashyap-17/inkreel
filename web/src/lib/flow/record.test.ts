import { describe, expect, it } from "vitest";
import type { PhotoRecord } from "@/lib/photos/types";
import { flowReducer, initialFlow, proposeCards, type FlowAction, type MatchData } from "./flow";
import { buildTestRecord, describeAction } from "./record";

const photo = (id: string): PhotoRecord => ({
  id,
  fileName: `IMG_${id}.jpg`,
  mimeType: "image/jpeg",
  takenAt: Date.UTC(2026, 2, 12, 9),
  timeSource: "exif",
  localTime: "2026-03-12T14:30:00",
  offsetMinutes: 330,
  gps: { lat: 1, lon: 2 },
  width: 4000,
  height: 3000,
  hash: "0f0f0f0f0f0f0f0f",
  sharpness: 123.456789,
});

function matched() {
  let s = [
    { type: "chooseMode", mode: "own" },
    { type: "setText", text: "The river at dusk.\nNothing moved." },
    {
      type: "setPhotos",
      photos: [photo("p1"), photo("p2")],
      stacks: [
        { id: "k1", photoIds: ["p1"], topPick: "p1" },
        { id: "k2", photoIds: ["p2"], topPick: "p2" },
      ],
    },
  ].reduce((acc, a) => flowReducer(acc, a as FlowAction), initialFlow);
  const match: MatchData = {
    sentenceIds: ["s1", "s2"],
    candidates: [
      { photoId: "p1", stackId: "k1" },
      { photoId: "p2", stackId: "k2" },
    ],
    scores: [
      [0.123456789, 0.2],
      [0.3, 0.4],
    ],
    lookedFor: { s1: "a river at dusk", s2: "still water" },
    verdicts: {},
    byHand: false,
    fixed: {},
    queriesModel: "gemini-3.6-flash",
    notes: [],
  };
  s = flowReducer(s, { type: "matched", match, cards: proposeCards(match, 1), target: 1 });
  return s;
}

describe("buildTestRecord", () => {
  it("records the writing, searches, scores, cards and caption", () => {
    const record = buildTestRecord(matched(), {
      searches: [{ readings: ["a river at dusk", "still water"], partOfDay: "evening", day: 0 }, null],
      events: [],
      now: new Date("2026-11-10T12:00:00Z"),
    });
    expect(record.writing.sentences[0]!.search?.readings).toEqual(["a river at dusk", "still water"]);
    expect(record.matching?.scores[0]![0]).toBe(0.1235);
    expect(record.cards[0]!.text).toBe("The river at dusk.\nNothing moved.");
    expect(record.caption).toBe("The river at dusk.\nNothing moved.");
    expect(record.photos[0]).toMatchObject({ takenLocal: "2026-03-12T14:30:00", hasLocation: true, stack: "k1" });
  });

  it("never includes photo data or exact location", () => {
    const json = JSON.stringify(
      buildTestRecord(matched(), { searches: [], events: [], now: new Date() }),
    );
    expect(json).not.toContain("blob:");
    expect(json).not.toContain("base64");
    expect(json).not.toContain('"lat"');
  });
});

describe("describeAction", () => {
  const at = new Date("2026-11-10T12:00:00Z");
  it("logs review actions with their details", () => {
    expect(describeAction({ type: "swap", cardId: "c1", photoId: "p2" }, at)).toEqual({
      at: "2026-11-10T12:00:00.000Z",
      action: "swap",
      detail: { cardId: "c1", photoId: "p2" },
    });
  });

  it("reduces large payloads to counts and skips internal actions", () => {
    expect(describeAction({ type: "setText", text: "abc" }, at)?.detail).toEqual({ characters: 3 });
    expect(describeAction({ type: "verdicts", verdicts: {} }, at)).toBeNull();
  });
});
