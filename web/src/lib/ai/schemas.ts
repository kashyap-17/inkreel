// Request and reply shapes for the server's model calls, shared by the browser and the server.
// Every reply from a model is checked against these before it is used.
import { z } from "zod";

const base64Jpeg = z.string().min(100).max(1_500_000);

export const EmbedRequest = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("images"), images: z.array(base64Jpeg).min(1).max(6) }),
  z.object({ kind: z.literal("texts"), texts: z.array(z.string().min(1).max(2000)).min(1).max(100) }),
]);
export type EmbedRequest = z.infer<typeof EmbedRequest>;

export const EmbedReply = z.object({ vectors: z.array(z.array(z.number())) });
export type EmbedReply = z.infer<typeof EmbedReply>;

export const PART_OF_DAY = ["morning", "afternoon", "evening", "night", "none"] as const;
export type PartOfDay = (typeof PART_OF_DAY)[number];

export const QueriesRequest = z.object({
  sentences: z.array(z.object({ id: z.string().max(20), text: z.string().min(1).max(2000) })).min(1).max(200),
  /** How many days the photos span, so "day two" can be read. */
  tripDays: z.number().int().min(1).max(100_000),
});
export type QueriesRequest = z.infer<typeof QueriesRequest>;

/**
 * Searches for one sentence: up to three readings of it as a photo (the first close to the
 * words, the others different scenes it could mean), and time hints.
 */
export const SentenceQuery = z.object({
  id: z.string(),
  readings: z
    .array(z.string().min(1).max(400))
    .min(1)
    .transform((r) => r.slice(0, 3)),
  partOfDay: z.enum(PART_OF_DAY),
  /** Day of the trip the sentence names (1 = first day), or 0 when it doesn't say. */
  day: z.number().int().min(0),
});
export type SentenceQuery = z.infer<typeof SentenceQuery>;

export const QueriesReply = z.object({ queries: z.array(SentenceQuery), model: z.string() });
export type QueriesReply = z.infer<typeof QueriesReply>;

export const CheckRequest = z.object({
  chunks: z
    .array(
      z.object({
        id: z.string().max(20),
        text: z.string().min(1).max(4000),
        lookedFor: z.string().max(2000),
        photos: z.array(z.object({ id: z.string().max(20), image: base64Jpeg })).min(1).max(3),
      }),
    )
    .min(1)
    .max(6),
});
export type CheckRequest = z.infer<typeof CheckRequest>;

export const PhotoVerdict = z.object({ id: z.string(), fits: z.boolean(), reason: z.string().max(300) });
export type PhotoVerdict = z.infer<typeof PhotoVerdict>;

export const CheckReply = z.object({
  results: z.array(z.object({ chunkId: z.string(), photos: z.array(PhotoVerdict) })),
});
export type CheckReply = z.infer<typeof CheckReply>;

export const ErrorReply = z.object({ error: z.string(), retryAfterSeconds: z.number().optional() });
