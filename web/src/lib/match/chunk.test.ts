import { describe, expect, it } from "vitest";
import { chunkAndMatch, type Candidate } from "./chunk";

const cands = (...stacks: string[]): Candidate[] => stacks.map((stackId, i) => ({ photoId: `p${i + 1}`, stackId }));

describe("chunkAndMatch", () => {
  it("covers every sentence once, in order, as consecutive chunks", () => {
    const scores = Array.from({ length: 7 }, (_, s) => [s / 10, 0.5 - s / 20, 0.3]);
    const chunks = chunkAndMatch(scores, cands("a", "b", "c"), 3);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]!.start).toBe(0);
    expect(chunks[chunks.length - 1]!.end).toBe(7);
    chunks.slice(1).forEach((c, i) => expect(c.start).toBe(chunks[i]!.end));
  });

  it("keeps stanzas whole when the photo count allows it", () => {
    // Three couplets. Line 5 fits photo b slightly better, but a blank line ends line 4.
    const scores = [
      [0.6, 0.2, 0.2],
      [0.6, 0.2, 0.2],
      [0.2, 0.6, 0.2],
      [0.2, 0.6, 0.2],
      [0.2, 0.58, 0.5],
      [0.2, 0.2, 0.6],
    ];
    const breaks = [false, true, false, true, false];
    const ranges = (chunks: ReturnType<typeof chunkAndMatch>) => chunks.map((c) => [c.start, c.end]);
    expect(ranges(chunkAndMatch(scores, cands("a", "b", "c"), 3))).toEqual([[0, 2], [2, 5], [5, 6]]);
    expect(ranges(chunkAndMatch(scores, cands("a", "b", "c"), 3, breaks))).toEqual([[0, 2], [2, 4], [4, 6]]);
  });

  it("breaks where the writing moves to another photo", () => {
    // Sentences 0–1 fit photo 1, sentences 2–3 fit photo 2.
    const scores = [
      [0.6, 0.2],
      [0.6, 0.2],
      [0.2, 0.6],
      [0.2, 0.6],
    ];
    const chunks = chunkAndMatch(scores, cands("a", "b"), 2);
    expect(chunks.map((c) => [c.start, c.end, c.photoId])).toEqual([
      [0, 2, "p1"],
      [2, 4, "p2"],
    ]);
  });

  it("never uses two photos from the same stack", () => {
    // p1 and p2 are one stack and both fit everything best.
    const scores = [
      [0.9, 0.85, 0.3],
      [0.9, 0.85, 0.2],
    ];
    const chunks = chunkAndMatch(scores, cands("a", "a", "b"), 2);
    const stacks = chunks.map((c) => (c.photoId === "p3" ? "b" : "a"));
    expect(new Set(stacks).size).toBe(2);
  });

  it("makes no more chunks than there are sentences or stacks", () => {
    expect(chunkAndMatch([[0.1, 0.2]], cands("a", "b"), 5)).toHaveLength(1);
    expect(chunkAndMatch([[0.1], [0.2], [0.3]], cands("a"), 3)).toHaveLength(1);
  });

  it("offers alternatives from stacks no other chunk uses", () => {
    const scores = [[0.9, 0.8, 0.7, 0.6]];
    const [chunk] = chunkAndMatch(scores, cands("a", "a", "b", "c"), 1);
    expect(chunk!.photoId).toBe("p1");
    expect(chunk!.alternatives).toEqual(["p3", "p4"]);
  });

  it("marks a match weak when it barely beats a typical photo", () => {
    const [weak] = chunkAndMatch([[0.31, 0.3, 0.3, 0.3]], cands("a", "b", "c", "d"), 1);
    const [strong] = chunkAndMatch([[0.5, 0.3, 0.3, 0.3]], cands("a", "b", "c", "d"), 1);
    expect(weak!.strength).toBe("weak");
    expect(strong!.strength).toBe("strong");
  });

  it("still splits into the target when there are no photos (matching by hand)", () => {
    const chunks = chunkAndMatch([[], [], []], [], 2);
    expect(chunks.map((c) => c.photoId)).toEqual([null, null]);
  });
});
