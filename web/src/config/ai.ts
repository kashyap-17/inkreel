// Model per call (see "AI model" in docs/decisions.md). Change models here, not in the calls.
export const MODELS = {
  embed: "gemini-embedding-2",
  queries: "gemini-3.6-flash",
  /** Used for the search-query call when Flash's daily quota has run out. */
  queriesFallback: "gemini-3.5-flash-lite",
  check: "gemini-3.5-flash-lite",
} as const;

/** Prompt versions (prompts in src/server/prompts.ts). Bump on every prompt change. */
export const PROMPT_VERSIONS = { queries: "queries-v1", check: "check-v2" } as const;

export const EMBED_DIMENSIONS = 768;

/** Gemini Embedding 2 takes at most 6 images per request. */
export const IMAGES_PER_EMBED_REQUEST = 6;

/** Long edge, in pixels, of the copies sent to Gemini. */
export const INDEX_IMAGE_PX = 512;
export const CHECK_IMAGE_PX = 384;

/** Chunks checked per request in call 3 (each with up to 3 photos). */
export const CHUNKS_PER_CHECK_REQUEST = 4;
