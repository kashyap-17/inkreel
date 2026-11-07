import { describe, expect, it } from "vitest";
import { flowReducer, initialFlow, type FlowAction, type FlowState } from "./flow";

const run = (...actions: FlowAction[]): FlowState => actions.reduce(flowReducer, initialFlow);

describe("flowReducer", () => {
  it("starts on the start screen", () => {
    expect(initialFlow.step).toBe("start");
  });

  it("opens the words step for 'I have writing'", () => {
    expect(run({ type: "chooseMode", mode: "own" }).step).toBe("words");
  });

  it("ignores modes that aren't built yet", () => {
    expect(run({ type: "chooseMode", mode: "help" }).step).toBe("start");
    expect(run({ type: "chooseMode", mode: "mix" }).step).toBe("start");
  });

  it("splits text into pieces marked as the user's", () => {
    const s = run({ type: "chooseMode", mode: "own" }, { type: "setText", text: "A\n\nB" });
    expect(s.pieces.map((p) => [p.id, p.text, p.source])).toEqual([
      ["w1", "A", "user"],
      ["w2", "B", "user"],
    ]);
  });

  it("splits a single block by line, like a poem", () => {
    const s = run({ type: "setText", text: "one\ntwo" });
    expect(s.splitBy).toBe("line");
    expect(s.pieces.length).toBe(2);
  });

  it("keeps the user's split choice while they keep typing", () => {
    const s = run({ type: "setText", text: "one\ntwo" }, { type: "setSplit", splitBy: "paragraph" }, {
      type: "setText",
      text: "one\ntwo\nthree",
    });
    expect(s.splitBy).toBe("paragraph");
    expect(s.pieces.length).toBe(1);
  });

  it("joins a piece with the next without changing the words", () => {
    const s = run({ type: "setText", text: "A\n\nB\n\nC" }, { type: "joinWithNext", index: 0 });
    expect(s.pieces.map((p) => p.text)).toEqual(["A\n\nB", "C"]);
    expect(s.pieces.map((p) => p.id)).toEqual(["w1", "w2"]);
  });

  it("does nothing when joining the last piece", () => {
    const before = run({ type: "setText", text: "A\n\nB" });
    expect(flowReducer(before, { type: "joinWithNext", index: 1 })).toBe(before);
  });

  it("won't go to photos without any writing", () => {
    expect(run({ type: "chooseMode", mode: "own" }, { type: "goTo", step: "photos" }).step).toBe("words");
    expect(
      run({ type: "chooseMode", mode: "own" }, { type: "setText", text: "A" }, { type: "goTo", step: "photos" }).step,
    ).toBe("photos");
  });
});
