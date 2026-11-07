// Splitting the user's writing into pieces. Plain code: the words themselves are never
// changed, only where one piece ends and the next begins.

export type SplitBy = "paragraph" | "line";

/** Splits writing into pieces by blank lines (paragraphs) or by single lines. */
export function splitText(text: string, by: SplitBy): string[] {
  const parts = by === "paragraph" ? text.split(/\n[ \t]*\n/) : text.split("\n");
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Paragraphs if there is more than one; otherwise one piece per line. */
export function suggestSplit(text: string): SplitBy {
  return splitText(text, "paragraph").length > 1 ? "paragraph" : "line";
}

/** The separator used when two pieces are joined, so the original layout is kept. */
export function joiner(by: SplitBy): string {
  return by === "paragraph" ? "\n\n" : "\n";
}
