import { describe, expect, it } from "vitest";
import { buildStacks } from "./stacks";

const MIN = 60_000;
const photo = (id: string, minute: number, hash: string, sharpness = 10) => ({
  id,
  takenAt: Date.UTC(2026, 9, 1, 9) + minute * MIN,
  fileName: `${id}.jpg`,
  hash,
  sharpness,
});
const A = "0000000000000000";
const A2 = "000000000000000f"; // 4 bits from A
const B = "ffffffffffffffff"; // 64 bits from A

describe("buildStacks", () => {
  it("returns nothing for no photos", () => {
    expect(buildStacks([])).toEqual([]);
  });

  it("stacks near-identical shots taken a minute apart, with the sharpest as top pick", () => {
    const stacks = buildStacks([photo("a", 0, A, 5), photo("b", 1, A2, 20), photo("c", 2, A, 8)]);
    expect(stacks).toEqual([{ id: "k1", photoIds: ["a", "b", "c"], topPick: "b" }]);
  });

  it("keeps different-looking shots apart even within the window", () => {
    const stacks = buildStacks([photo("a", 0, A), photo("b", 1, B)]);
    expect(stacks.map((s) => s.photoIds)).toEqual([["a"], ["b"]]);
  });

  it("keeps similar-looking shots apart when taken further apart than the window", () => {
    const stacks = buildStacks([photo("a", 0, A), photo("b", 10, A)]);
    expect(stacks.map((s) => s.photoIds)).toEqual([["a"], ["b"]]);
  });

  it("sorts by capture time first", () => {
    const stacks = buildStacks([photo("late", 30, B), photo("early", 0, A)]);
    expect(stacks.map((s) => s.photoIds)).toEqual([["early"], ["late"]]);
  });

  it("compares each photo with the stack's previous one, so a slow pan stays one stack", () => {
    const step1 = "000000000000ffff"; // 16 bits from A, 12 from step2
    const step2 = "0000000000000fff";
    const stacks = buildStacks([photo("a", 0, A), photo("b", 1, step2), photo("c", 2, step1)], {
      windowMinutes: 2,
      maxHashDistance: 12,
    });
    expect(stacks.map((s) => s.photoIds)).toEqual([["a", "b", "c"]]);
  });
});
