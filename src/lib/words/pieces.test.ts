import { describe, expect, it } from "vitest";
import { joiner, splitText, suggestSplit } from "./pieces";

describe("splitText", () => {
  it("splits by blank lines into paragraphs", () => {
    expect(splitText("The fort at sunrise.\n\nLost in the market.", "paragraph")).toEqual([
      "The fort at sunrise.",
      "Lost in the market.",
    ]);
  });

  it("keeps line breaks inside a paragraph", () => {
    expect(splitText("Line one\nline two\n\nNext", "paragraph")).toEqual(["Line one\nline two", "Next"]);
  });

  it("treats a line with only spaces as a blank line", () => {
    expect(splitText("One\n   \nTwo", "paragraph")).toEqual(["One", "Two"]);
  });

  it("splits by single lines and drops empty ones", () => {
    expect(splitText("One\n\nTwo\nThree\n", "line")).toEqual(["One", "Two", "Three"]);
  });

  it("never changes the words, only trims the ends of each piece", () => {
    const text = "  nothing moved,  not even us  \n\nok";
    expect(splitText(text, "paragraph")[0]).toBe("nothing moved,  not even us");
  });

  it("returns nothing for empty or blank text", () => {
    expect(splitText("", "paragraph")).toEqual([]);
    expect(splitText(" \n \n ", "line")).toEqual([]);
  });
});

describe("suggestSplit", () => {
  it("suggests paragraphs when there are several", () => {
    expect(suggestSplit("A\n\nB")).toBe("paragraph");
  });

  it("suggests lines for a single block of lines, like a poem", () => {
    expect(suggestSplit("the river\nat dusk\nnothing moved")).toBe("line");
  });
});

describe("joiner", () => {
  it("keeps the original layout when pieces are joined", () => {
    expect(joiner("paragraph")).toBe("\n\n");
    expect(joiner("line")).toBe("\n");
  });
});
