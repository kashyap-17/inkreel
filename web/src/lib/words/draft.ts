// Write with Inkreel: the question sections, and the checks run in code on every drafted line,
// so each line shows where it came from and the person's own words can be picked out.
import { SECTION_KEYS, type Answers, type DraftedLine, type SectionKey } from "@/lib/ai/schemas";

export { SECTION_KEYS, type Answers, type SectionKey };

export const SECTIONS: { key: SectionKey; label: string; short: string }[] = [
  { key: "moment", label: "A moment you keep thinking about", short: "a moment" },
  { key: "place", label: "A place or thing that stands out", short: "a place" },
  { key: "felt", label: "How it felt", short: "how it felt" },
  { key: "other", label: "Anything else", short: "anything else" },
];

export const emptyAnswers = (): Answers => ({ moment: "", place: "", felt: "", other: "" });

export const filledSections = (answers: Answers): SectionKey[] => SECTION_KEYS.filter((k) => answers[k]?.trim());

/** A line of the draft, as shown and edited on the draft screen. */
export interface DraftLine {
  id: string;
  text: string;
  /** The answer the line draws on, when its quote was found there. */
  section: SectionKey | null;
  /** The person's exact words the line draws on, as they wrote them; null when not confirmed. */
  quote: string | null;
  /** The answers the line draws on: its reason, shown under it. Empty for a line in Inkreel's own words. */
  from: SectionKey[];
  /** Names someone or something the answers don't have: "check this line". */
  flagged: boolean;
  /** Changed by the person. */
  edited: boolean;
}

const STOPWORDS = new Set(
  (
    "a an the and or but so of to in on at by for with from up down out over into onto off as is am are was were be been " +
    "being it its it's this that these those there here then than i me my mine we us our you your he him his she her they " +
    "them their what which who when where how all just not no very too can could would should will do did does had has have " +
    "if about again some any each one"
  ).split(" "),
);

const plain = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"');

/** Words as matched against the answers: lower case, straight apostrophes, no punctuation. */
function words(text: string): { word: string; start: number; end: number }[] {
  return [...text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)].map((m) => ({
    word: plain(m[0]),
    start: m.index,
    end: m.index + m[0].length,
  }));
}

/** Each answer as " w1 w2 … ", so a run of words can be looked up with a plain search. */
const wordStrings = (answers: Answers) =>
  SECTION_KEYS.map((k) => ({ key: k, joined: ` ${words(answers[k] ?? "").map((w) => w.word).join(" ")} ` }));

/** Where a quote really is in the answers: the named section first, then any other. */
export function findQuote(answers: Answers, quote: string, preferred: string): { section: SectionKey; quote: string } | null {
  const wanted = words(quote);
  if (wanted.length === 0 || wanted.every((w) => STOPWORDS.has(w.word))) return null;
  const needle = ` ${wanted.map((w) => w.word).join(" ")} `;
  const order = [...SECTION_KEYS].sort((a, b) => Number(b === preferred) - Number(a === preferred));
  for (const key of order) {
    const answer = answers[key] ?? "";
    const own = words(answer);
    for (let i = 0; i + wanted.length <= own.length; i++) {
      if (` ${own.slice(i, i + wanted.length).map((w) => w.word).join(" ")} ` === needle) {
        // Shown as the person wrote it, with their capitals and punctuation.
        return { section: key, quote: answer.slice(own[i]!.start, own[i + wanted.length - 1]!.end) };
      }
    }
  }
  return null;
}

/** Capitalised words in a line (not starting a sentence, not "I") that appear nowhere in the answers. */
export function unknownNames(line: string, answers: Answers): string[] {
  const known = new Set(SECTION_KEYS.flatMap((k) => words(answers[k] ?? "").map((w) => w.word)));
  return [...line.matchAll(/[\p{Lu}][\p{L}]*(?:['’][\p{L}]+)*/gu)]
    .filter((m) => {
      const before = line.slice(0, m.index).trimEnd();
      if (before === "" || /[.!?…:"“]$/.test(before)) return false;
      if (/^I(['’].*)?$/.test(m[0])) return false;
      return !known.has(plain(m[0]));
    })
    .map((m) => m[0]);
}

/**
 * A line that only states or sums up the feeling ("It felt dreamy", "everything felt so calm",
 * "What a day"): the prompt forbids these, but small models still write them sometimes.
 */
export function statesFeeling(line: string): boolean {
  return /\b(it|everything|all|this|that)\s+(all\s+)?(felt|feels)\b|\bi\s+felt\b|^\s*what an?\b/i.test(line);
}

/** The longest run of the person's own words in a line, as they wrote it, and which answer it's from. */
export function traceLine(line: string, answers: Answers): { section: SectionKey; quote: string } | null {
  const runs = ownWords(line, answers)
    .filter((p) => p.mine)
    .map((p) => p.text)
    .sort((a, b) => b.length - a.length);
  for (const run of runs) {
    const found = findQuote(answers, run, "");
    if (found) return found;
  }
  return null;
}

/** Turns the model's lines into draft lines: quotes checked against the answers, doubtful lines flagged. */
export function checkLines(
  answers: Answers,
  drafted: (Omit<DraftedLine, "from"> & { from?: SectionKey[] })[],
): DraftLine[] {
  const seen = new Set<string>();
  const lines: DraftLine[] = [];
  for (const line of drafted) {
    const text = line.text.replace(/\s+/g, " ").trim();
    if (!text || seen.has(plain(text))) continue;
    seen.add(plain(text));
    // The model's own quote when it gave one that checks out; otherwise the line's longest run of
    // the person's words. A line in Inkreel's own words has no source, and that's allowed.
    const found = (line.quote && findQuote(answers, line.quote, line.section)) || traceLine(text, answers);
    // The answers the model says the line draws on, if they were really given; else the answer
    // its own words come from.
    const named = SECTION_KEYS.filter((k) => line.from?.includes(k) && answers[k]?.trim());
    lines.push({
      id: `l${lines.length + 1}`,
      text,
      section: found ? found.section : null,
      quote: found ? found.quote : null,
      from: named.length ? named : found ? [found.section] : [],
      flagged: unknownNames(text, answers).length > 0,
      edited: false,
    });
  }
  return lines;
}

/** True when two words are the same but for one letter added, dropped or changed ("skis", "skies"). */
function oneLetterOff(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/**
 * A line split into the person's own words and the rest, found in code: any word from the answers
 * that isn't a small word like "the" or "and" (a word of four or more letters may be one letter off,
 * as with a typo), and any run of two or more words found together in one answer.
 */
export function ownWords(line: string, answers: Answers): { text: string; mine: boolean }[] {
  const tokens = words(line);
  const answerStrings = wordStrings(answers).map((a) => a.joined);
  const answerWords = [...new Set(SECTION_KEYS.flatMap((k) => words(answers[k] ?? "").map((w) => w.word)))].filter(
    (w) => !STOPWORDS.has(w),
  );
  const isMine = (w: string) =>
    !STOPWORDS.has(w) &&
    (answerWords.includes(w) || (w.length >= 4 && answerWords.some((a) => a.length >= 4 && oneLetterOff(a, w))));
  const found = (from: number, to: number) => {
    const needle = ` ${tokens.slice(from, to).map((t) => t.word).join(" ")} `;
    return answerStrings.some((a) => a.includes(needle));
  };
  const mine = tokens.map((t) => isMine(t.word));
  // Runs of the person's words, small words included ("lost in the old market").
  let i = 0;
  while (i < tokens.length) {
    let j = i + 1;
    while (j < tokens.length && found(i, j + 1)) j++;
    if (j - i >= 2 && tokens.slice(i, j).some((t) => !STOPWORDS.has(t.word))) {
      for (let k = i; k < j; k++) mine[k] = true;
      i = j;
    } else i++;
  }
  // Neighbouring own words with only spaces between them are one highlight.
  const spans: [number, number][] = [];
  tokens.forEach((t, k) => {
    if (!mine[k]) return;
    const last = spans[spans.length - 1];
    if (last && mine[k - 1] && /^\s*$/.test(line.slice(last[1], t.start))) last[1] = t.end;
    else spans.push([t.start, t.end]);
  });
  const parts: { text: string; mine: boolean }[] = [];
  let at = 0;
  for (const [start, end] of spans) {
    if (start > at) parts.push({ text: line.slice(at, start), mine: false });
    parts.push({ text: line.slice(start, end), mine: true });
    at = end;
  }
  if (at < line.length) parts.push({ text: line.slice(at), mine: false });
  return parts;
}

/** Hashtags as Instagram needs them: "#", letters and digits only, no repeats, at most four. */
export function cleanHashtags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const body = tag.replace(/[^\p{L}\p{N}_]/gu, "");
    if (!body || seen.has(body.toLowerCase())) continue;
    seen.add(body.toLowerCase());
    out.push(`#${body}`);
  }
  return out.slice(0, 4);
}

/** The writing the rest of the flow uses: one line of the draft per line. */
export const draftText = (lines: Pick<DraftLine, "text">[]): string =>
  lines
    .map((l) => l.text.trim())
    .filter(Boolean)
    .join("\n");
