import { describe, expect, it } from "vitest";
import { countWords, splitSentences } from "./sentences";

describe("splitSentences", () => {
  it("splits prose at sentence ends", () => {
    expect(splitSentences("The fort at sunrise. Nobody else there! Was it cold? Yes…")).toEqual([
      "The fort at sunrise.",
      "Nobody else there!",
      "Was it cold?",
      "Yes…",
    ]);
  });

  it("treats each line of a poem as a sentence", () => {
    expect(splitSentences("the river\nat dusk\n\nnothing moved")).toEqual(["the river", "at dusk", "nothing moved"]);
  });

  it("keeps closing quotes with their sentence", () => {
    expect(splitSentences("She said “stay.” We stayed.")).toEqual(["She said “stay.”", "We stayed."]);
  });

  it("doesn't split inside numbers or without a following space", () => {
    expect(splitSentences("It cost 2.50 each.It rained.")).toEqual(["It cost 2.50 each.It rained."]);
  });

  it("never changes the words, only trims around sentences", () => {
    const text = "  nothing moved,  not even us.   Then the bells.  ";
    expect(splitSentences(text)).toEqual(["nothing moved,  not even us.", "Then the bells."]);
  });

  it("returns nothing for blank text", () => {
    expect(splitSentences(" \n \n")).toEqual([]);
  });
});

describe("countWords", () => {
  it("counts words across lines and extra spaces", () => {
    expect(countWords("  one two\nthree   four ")).toBe(4);
    expect(countWords("   ")).toBe(0);
  });
});
