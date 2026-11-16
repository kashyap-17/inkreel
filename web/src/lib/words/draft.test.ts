import { describe, expect, it } from "vitest";
import { checkLines, draftText, findQuote, ownWords, statesFeeling, unknownNames, type Answers } from "./draft";

const ANSWERS: Answers = {
  moment: "We got lost in the old market at dusk and didn't mind.",
  place: "The blue door near Rosa's stall.",
  felt: "Slow, warm, like nobody needed us anywhere.",
  other: "",
};

describe("findQuote", () => {
  it("finds the quote in the named answer and gives it as the person wrote it", () => {
    expect(findQuote(ANSWERS, "lost in the old market", "moment")).toEqual({
      section: "moment",
      quote: "lost in the old market",
    });
    expect(findQuote(ANSWERS, "rosa’s stall", "place")).toEqual({ section: "place", quote: "Rosa's stall" });
  });

  it("ignores case and punctuation differences, and looks in the other answers too", () => {
    expect(findQuote(ANSWERS, "Slow warm", "moment")).toEqual({ section: "felt", quote: "Slow, warm" });
  });

  it("rejects quotes that aren't there, or are only small words", () => {
    expect(findQuote(ANSWERS, "the golden hour", "moment")).toBeNull();
    expect(findQuote(ANSWERS, "in the", "moment")).toBeNull();
    expect(findQuote(ANSWERS, "", "felt")).toBeNull();
  });

  it("matches whole words only", () => {
    expect(findQuote(ANSWERS, "old mark", "moment")).toBeNull();
  });
});

describe("unknownNames", () => {
  it("flags capitalised names the answers don't have", () => {
    expect(unknownNames("We walked with Maria past the door", ANSWERS)).toEqual(["Maria"]);
    expect(unknownNames("Then Lisbon went quiet", ANSWERS)).toEqual(["Lisbon"]);
  });

  it("allows names from the answers, sentence starts and I", () => {
    expect(unknownNames("By Rosa's stall, I stopped. Nobody needed us", ANSWERS)).toEqual([]);
    expect(unknownNames("“Slow,” I thought", ANSWERS)).toEqual([]);
  });
});

describe("checkLines", () => {
  it("keeps confirmed sources and flags lines without one or with a new name", () => {
    const lines = checkLines(ANSWERS, [
      { text: "Lost in the old market at dusk", section: "moment", quote: "lost in the old market" },
      { text: "The sea was calling", section: "felt", quote: "the sea was calling" },
      { text: "Rosa and Tom by the blue door", section: "place", quote: "blue door" },
    ]);
    expect(lines.map((l) => [l.id, l.section, l.quote, l.flagged])).toEqual([
      ["l1", "moment", "lost in the old market", false],
      ["l2", null, null, true],
      ["l3", "place", "blue door", true],
    ]);
    expect(lines.every((l) => !l.edited)).toBe(true);
  });

  it("drops empty and repeated lines and tidies spaces", () => {
    const lines = checkLines(ANSWERS, [
      { text: "  Slow,   warm  ", section: "felt", quote: "Slow, warm" },
      { text: "slow, warm", section: "felt", quote: "Slow, warm" },
      { text: " ", section: "none", quote: "" },
    ]);
    expect(lines.map((l) => l.text)).toEqual(["Slow, warm"]);
  });
});

describe("ownWords", () => {
  const mine = (line: string) =>
    ownWords(line, ANSWERS)
      .filter((p) => p.mine)
      .map((p) => p.text);

  it("picks out runs of two or more of the person's words", () => {
    expect(mine("Lost in the old market, and I didn't mind")).toEqual(["Lost in the old market", "didn't mind"]);
    expect(mine("By the blue door, slow and warm")).toEqual(["the blue door"]);
  });

  it("ignores single words and runs of only small words", () => {
    expect(mine("The market was slow")).toEqual([]);
    expect(mine("in the end")).toEqual([]);
  });

  it("gives back the whole line, in order", () => {
    const line = "At dusk we got lost in the old market.";
    expect(
      ownWords(line, ANSWERS)
        .map((p) => p.text)
        .join(""),
    ).toBe(line);
  });
});

describe("draftText", () => {
  it("joins the lines, one per line, leaving out empty ones", () => {
    expect(draftText([{ text: " One. " }, { text: "" }, { text: "Two" }])).toBe("One.\nTwo");
  });
});

describe("statesFeeling", () => {
  it("catches lines that only state the feeling", () => {
    for (const line of ["It felt dreamy", "everything felt dreamy and good,", "it all felt so calm", "I felt small", "What a day"]) {
      expect(statesFeeling(line)).toBe(true);
    }
  });

  it("leaves lines that carry the feeling in a detail", () => {
    for (const line of ["breathing in the calm.", "full and happy.", "feeling small in a good way up there,", "Hyde Park, dreamy in the blue"]) {
      expect(statesFeeling(line)).toBe(false);
    }
  });
});
