import { describe, expect, it } from "vitest";
import { flowReducer, initialFlow, photoEstimate, type FlowAction, type FlowState } from "./flow";

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

  it("keeps the text exactly as typed and splits it into sentences marked as the user's", () => {
    const text = "The fort at sunrise. Nobody there.\n\nLost in the market.";
    const s = run({ type: "setText", text });
    expect(s.text).toBe(text);
    expect(s.words).toBe(10);
    expect(s.sentences.map((x) => [x.id, x.text, x.source])).toEqual([
      ["s1", "The fort at sunrise.", "user"],
      ["s2", "Nobody there.", "user"],
      ["s3", "Lost in the market.", "user"],
    ]);
  });

  it("won't go to photos without any writing", () => {
    expect(run({ type: "chooseMode", mode: "own" }, { type: "goTo", step: "photos" }).step).toBe("words");
    expect(
      run({ type: "chooseMode", mode: "own" }, { type: "setText", text: "A" }, { type: "goTo", step: "photos" }).step,
    ).toBe("photos");
  });
});

describe("photoEstimate", () => {
  it("estimates from the writing and caps at the number of moments", () => {
    const s = run({ type: "setText", text: "the river\nat dusk\nnothing moved\nnot even us\nthen bells\nthen home" });
    expect(photoEstimate(s)).toMatchObject({ min: 2, max: 3 });
    expect(photoEstimate(s, 1)).toMatchObject({ min: 1, max: 1 });
  });

  it("is empty before anything is written", () => {
    expect(photoEstimate(initialFlow)).toBeNull();
  });
});
