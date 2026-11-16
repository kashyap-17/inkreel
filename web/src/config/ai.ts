// Model per call (see "AI model" in docs/decisions.md). Change models here, not in the calls.
export const MODELS = {
  embed: "gemini-embedding-2",
  /** Lite: 1.5–3.5 s. Flash took 25 s or more and hung under load (16 Nov tests). */
  queries: "gemini-3.5-flash-lite",
  check: "gemini-3.5-flash-lite",
  /**
   * Write with Inkreel: Lite with backup requests, as for the searches. Compared on 16 Nov with
   * 3.8, 3.6 and 3.5 Flash on short answers: the same lines, but Flash took 15–43 s and 3.8 was busy.
   */
  draft: "gemini-3.5-flash-lite",
  /** Tried first for drafting when DRAFT_FLASH_FIRST is on (Lite then steps in). */
  draftFlash: "gemini-3.6-flash",
} as const;

/**
 * Write with Inkreel: ask Flash first for the draft, with Lite as the fallback. Off until the
 * owner's Flash test (Lite's drafts can invent small details; Flash allows ~20 requests a day free).
 */
export const DRAFT_FLASH_FIRST = false;

/** Prompt versions (prompts in src/server/prompts.ts). Bump on every prompt change. */
export const PROMPT_VERSIONS = { queries: "queries-v3", check: "check-v4", draft: "draft-v8" } as const;

export const EMBED_DIMENSIONS = 768;

/** Gemini Embedding 2 takes at most 6 images per request. */
export const IMAGES_PER_EMBED_REQUEST = 6;

/** Long edge, in pixels, of the copies sent to Gemini. */
export const INDEX_IMAGE_PX = 512;
export const CHECK_IMAGE_PX = 384;

/** Chunks checked per request in call 3 (each with up to 3 photos). */
export const CHUNKS_PER_CHECK_REQUEST = 4;
