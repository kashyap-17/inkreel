// Splitting the writing into sentences, the smallest units Inkreel works with.
// Chunks shown with one photo are made of whole sentences, so the words are never changed.

// A sentence ends at ., !, ? or … (optionally followed by closing quotes or brackets),
// when whitespace follows.
const SENTENCE_END = /(?<=[.!?…]["'”’)\]]*)\s+(?=\S)/u;

/** Splits text into sentences. A line break also ends a sentence, so each line of a poem is one. */
export function splitSentences(text: string): string[] {
  return text
    .split("\n")
    .flatMap((line) => line.trim().split(SENTENCE_END))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
