import { describe, expect, it } from "vitest";
import type { PhotoRecord } from "@/lib/photos/types";
import {
  captionOf,
  cardText,
  defaultTarget,
  flowReducer,
  initialFlow,
  photoEstimate,
  proposeCards,
  stanzaBreaks,
  usesEveryPhoto,
  verdictKey,
  type FlowAction,
  type FlowState,
  type MatchData,
} from "./flow";

const run = (...actions: FlowAction[]): FlowState => actions.reduce(flowReducer, initialFlow);

const POEM = "the river\nat dusk\nnothing moved\n\nnot even us. Then bells.";

const photo = (id: string): PhotoRecord => ({
  id,
  fileName: `${id}.jpg`,
  mimeType: "image/jpeg",
  takenAt: 0,
  timeSource: "exif",
  localTime: "2026-03-12T09:00:00",
  offsetMinutes: 0,
  gps: null,
  width: 4000,
  height: 3000,
  hash: "0000000000000000",
  sharpness: 1,
});

/** Writing, three photos in three stacks, and a match where s1–s3 fit p1 and s4–s5 fit p2. */
function matchedState(): FlowState {
  const s = run(
    { type: "chooseMode", mode: "own" },
    { type: "setText", text: POEM },
    {
      type: "setPhotos",
      photos: [photo("p1"), photo("p2"), photo("p3")],
      stacks: ["p1", "p2", "p3"].map((id, i) => ({ id: `k${i + 1}`, photoIds: [id], topPick: id })),
    },
  );
  const match: MatchData = {
    sentenceIds: s.sentences.map((x) => x.id),
    candidates: ["p1", "p2", "p3"].map((photoId, i) => ({ photoId, stackId: `k${i + 1}` })),
    scores: [
      [0.6, 0.2, 0.1],
      [0.6, 0.2, 0.1],
      [0.6, 0.2, 0.1],
      [0.2, 0.6, 0.1],
      [0.2, 0.6, 0.1],
    ],
    lookedFor: {},
    verdicts: {},
    byHand: false,
    fixed: {},
    notes: [],
  };
  return flowReducer(s, { type: "matched", match, cards: proposeCards(match, 2), target: 2 });
}

describe("words", () => {
  it("starts on the start screen and opens the words step for 'I have writing'", () => {
    expect(initialFlow.step).toBe("start");
    expect(run({ type: "chooseMode", mode: "own" }).step).toBe("words");
  });

  it("ignores modes that aren't built yet", () => {
    expect(run({ type: "chooseMode", mode: "help" }).step).toBe("start");
    expect(run({ type: "chooseMode", mode: "mix" }).step).toBe("start");
  });

  it("keeps the text exactly as typed and records where each sentence sits in it", () => {
    const text = "The fort at sunrise. Nobody there.\n\nLost in the market.";
    const s = run({ type: "setText", text });
    expect(s.text).toBe(text);
    expect(s.words).toBe(10);
    expect(s.sentences.map((x) => [x.id, x.text, x.source])).toEqual([
      ["s1", "The fort at sunrise.", "user"],
      ["s2", "Nobody there.", "user"],
      ["s3", "Lost in the market.", "user"],
    ]);
    for (const x of s.sentences) expect(text.slice(x.start, x.end)).toBe(x.text);
  });

  it("won't go to photos without any writing, or to matching without photos", () => {
    expect(run({ type: "chooseMode", mode: "own" }, { type: "goTo", step: "photos" }).step).toBe("words");
    const written = run({ type: "chooseMode", mode: "own" }, { type: "setText", text: "A" });
    expect(flowReducer(written, { type: "goTo", step: "photos" }).step).toBe("photos");
    expect(flowReducer(written, { type: "goTo", step: "consent" }).step).toBe("words");
  });
});

describe("photo estimate", () => {
  it("estimates from the writing and caps at the number of stacks", () => {
    const s = run({ type: "setText", text: "the river\nat dusk\nnothing moved\nnot even us\nthen bells\nthen home" });
    expect(photoEstimate(s)).toMatchObject({ min: 2, max: 3 });
    const one = flowReducer(s, { type: "setPhotos", photos: [photo("p1")], stacks: [{ id: "k1", photoIds: ["p1"], topPick: "p1" }] });
    expect(photoEstimate(one)).toMatchObject({ min: 1, max: 1 });
  });

  it("is empty before anything is written", () => {
    expect(photoEstimate(initialFlow)).toBeNull();
  });
});

describe("matching and review", () => {
  it("opens the review with chunks that give back the exact words, line breaks included", () => {
    const s = matchedState();
    expect(s.step).toBe("review");
    expect(s.cards.map((c) => c.photoId)).toEqual(["p1", "p2"]);
    expect(cardText(s, s.cards[0]!)).toBe("the river\nat dusk\nnothing moved");
    expect(cardText(s, s.cards[1]!)).toBe("not even us. Then bells.");
    expect(captionOf(s)).toBe("the river\nat dusk\nnothing moved\n\nnot even us. Then bells.");
  });

  it("swaps a photo, marks it as the user's choice, and undoes", () => {
    const s = flowReducer(matchedState(), { type: "swap", cardId: "c1", photoId: "p3" });
    expect(s.cards[0]).toMatchObject({ photoId: "p3", status: "swapped" });
    expect(s.cards[0]!.alternatives[0]).toBe("p1");
    expect(flowReducer(s, { type: "undo" }).cards[0]).toMatchObject({ photoId: "p1", status: "suggested" });
  });

  it("trades photos when the chosen one is already in another slide, so no shot repeats", () => {
    const s = flowReducer(matchedState(), { type: "swap", cardId: "c1", photoId: "p2" });
    expect(s.cards.map((c) => c.photoId)).toEqual(["p2", "p1"]);
    expect(s.cards.every((c) => c.status === "swapped")).toBe(true);
    expect(flowReducer(s, { type: "undo" }).cards.map((c) => c.photoId)).toEqual(["p1", "p2"]);
  });

  it("moves a sentence to the next card and marks both to check", () => {
    const s = flowReducer(matchedState(), { type: "moveSentence", cardId: "c1", to: "next" });
    expect(s.cards.map((c) => c.sentenceIds)).toEqual([
      ["s1", "s2"],
      ["s3", "s4", "s5"],
    ]);
    expect(s.cards.every((c) => c.textChanged)).toBe(true);
  });

  it("removes a card whose last sentence moves away", () => {
    let s = matchedState();
    s = flowReducer(s, { type: "moveSentence", cardId: "c2", to: "previous" });
    s = flowReducer(s, { type: "moveSentence", cardId: "c2", to: "previous" });
    expect(s.cards).toHaveLength(1);
    expect(captionOf(s)).toBe(POEM);
  });

  it("re-chunks for fewer or more photos, keeping a swapped card with the same sentences", () => {
    let s = flowReducer(matchedState(), { type: "swap", cardId: "c2", photoId: "p3" });
    s = flowReducer(s, { type: "setTarget", target: 1 });
    expect(s.cards).toHaveLength(1);
    s = flowReducer(s, { type: "setTarget", target: 2 });
    expect(s.cards[1]).toMatchObject({ photoId: "p3", status: "swapped" });
  });

  it("replaces a suggested photo the check says doesn't fit with an alternative that does", () => {
    const s = matchedState();
    const card = s.cards[0]!;
    const alt = card.alternatives[0]!;
    const next = flowReducer(s, {
      type: "verdicts",
      verdicts: {
        [verdictKey(card.sentenceIds, card.photoId!)]: { fits: false, reason: "a busy market" },
        [verdictKey(card.sentenceIds, alt)]: { fits: true, reason: "still water at dusk" },
      },
    });
    expect(next.cards[0]!.photoId).toBe(alt);
  });

  it("clears the matches when the writing changes, but not when it's the same", () => {
    const s = matchedState();
    expect(flowReducer(s, { type: "setText", text: POEM }).cards).toHaveLength(2);
    expect(flowReducer(s, { type: "setText", text: POEM + " More." }).cards).toHaveLength(0);
  });
});

describe("stanzas and the photo count", () => {
  const withPhotos = (n: number) =>
    run(
      { type: "chooseMode", mode: "own" },
      { type: "setText", text: POEM },
      {
        type: "setPhotos",
        photos: Array.from({ length: n }, (_, i) => photo(`p${i + 1}`)),
        stacks: Array.from({ length: n }, (_, i) => ({ id: `k${i + 1}`, photoIds: [`p${i + 1}`], topPick: `p${i + 1}` })),
      },
    );

  it("finds the blank lines between stanzas", () => {
    expect(stanzaBreaks(withPhotos(1))).toEqual([false, false, true, false]);
  });

  it("uses every photo when there are no more than the writing needs", () => {
    // The poem fits 2–3 photos.
    expect(usesEveryPhoto(withPhotos(3))).toBe(true);
    expect(defaultTarget(withPhotos(3))).toBe(3);
  });

  it("otherwise aims for one photo per stanza", () => {
    expect(usesEveryPhoto(withPhotos(10))).toBe(false);
    expect(defaultTarget(withPhotos(10))).toBe(2);
  });

  it("keeps the caption exactly as written, whatever the parts", () => {
    const s = flowReducer(matchedState(), { type: "moveSentence", cardId: "c1", to: "next" });
    expect(captionOf(s)).toBe(POEM);
  });
});
