// The only place that talks to Gemini. Runs on the server, where the API key lives.
import { ApiError, GoogleGenAI, ThinkingLevel, type Part } from "@google/genai";
import { EMBED_DIMENSIONS, MODELS } from "@/config/ai";
import {
  CheckReply,
  QueriesReply,
  SentenceQuery,
  type CheckRequest,
  type QueriesRequest,
} from "@/lib/ai/schemas";
import { CHECK_SCHEMA, CHECK_TASK, QUERIES_SCHEMA, queriesPrompt } from "./prompts";

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ServerError(500, "The Gemini API key isn't set on the server.");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export class ServerError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

/** Turns SDK errors into a status the browser can act on (429 means wait and retry). */
function rethrow(e: unknown): never {
  if (e instanceof ServerError) throw e;
  if (e instanceof ApiError) {
    if (e.status === 429) throw new ServerError(429, "Gemini's rate limit was hit.", retryAfter(e.message));
    if (e.status === 503) throw new ServerError(503, "Gemini is busy right now.", 5);
    throw new ServerError(e.status >= 500 ? 502 : e.status, `Gemini said: ${e.message.slice(0, 300)}`);
  }
  throw new ServerError(502, e instanceof Error ? e.message.slice(0, 300) : "Gemini request failed.");
}

function retryAfter(message: string): number | undefined {
  const m = /retry in (\d+(?:\.\d+)?)s/i.exec(message) ?? /"retryDelay":\s*"(\d+)s"/.exec(message);
  return m ? Math.ceil(Number(m[1])) : undefined;
}

/** One vector per image. Each image is its own entry, so vectors aren't merged. */
export async function embedImages(images: string[]): Promise<number[][]> {
  try {
    const res = await ai().models.embedContent({
      model: MODELS.embed,
      contents: images.map((data) => ({ parts: [{ inlineData: { mimeType: "image/jpeg", data } }] })),
      config: { outputDimensionality: EMBED_DIMENSIONS },
    });
    return vectorsOf(res.embeddings, images.length);
  } catch (e) {
    rethrow(e);
  }
}

/** One vector per search text, with Gemini Embedding 2's search-query prefix. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  try {
    const res = await ai().models.embedContent({
      model: MODELS.embed,
      contents: texts.map((t) => ({ parts: [{ text: `task: search result | query: ${t}` }] })),
      config: { outputDimensionality: EMBED_DIMENSIONS },
    });
    return vectorsOf(res.embeddings, texts.length);
  } catch (e) {
    rethrow(e);
  }
}

function vectorsOf(embeddings: { values?: number[] }[] | undefined, expected: number): number[][] {
  const vectors = (embeddings ?? []).map((e) => e.values ?? []);
  if (vectors.length !== expected || vectors.some((v) => v.length !== EMBED_DIMENSIONS)) {
    throw new ServerError(502, `Expected ${expected} vectors of ${EMBED_DIMENSIONS} numbers from Gemini.`);
  }
  return vectors;
}

async function generateJson(
  model: string,
  parts: Part[],
  schema: object,
  thinkingLevel: ThinkingLevel,
): Promise<unknown> {
  const res = await ai().models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      temperature: 0.4,
      thinkingConfig: { thinkingLevel },
    },
  });
  const text = res.text;
  if (!text) throw new ServerError(502, "Gemini returned an empty reply.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ServerError(502, "Gemini's reply wasn't valid JSON.");
  }
}

/** Call 2: a literal photo description and a time hint for every sentence. */
export async function searchQueries(req: QueriesRequest): Promise<QueriesReply> {
  const prompt = queriesPrompt(req.sentences, req.tripDays);
  const ids = req.sentences.map((s) => s.id);

  const attempt = async (model: string, extra = ""): Promise<QueriesReply> => {
    const raw = await generateJson(model, [{ text: prompt + extra }], QUERIES_SCHEMA, ThinkingLevel.LOW);
    const parsed = SentenceQuery.array().safeParse((raw as { queries?: unknown })?.queries);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "bad shape");
    const byId = new Map(parsed.data.map((q) => [q.id, q]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length) throw new ValidationError(`missing sentences ${missing.join(", ")}`);
    return { queries: ids.map((id) => byId.get(id)!), model };
  };

  const run = async (model: string) => {
    try {
      return await attempt(model);
    } catch (e) {
      if (!(e instanceof ValidationError)) throw e;
      // One retry that tells the model what was wrong.
      return await attempt(model, `\n\nYour previous reply was invalid (${e.message}). Return every sentence ID.`);
    }
  };

  try {
    return await run(MODELS.queries);
  } catch (e) {
    // Flash's free daily quota is small and it is sometimes overloaded (503); fall back to Lite
    // rather than fail the trip. The reply says which model ran.
    if (e instanceof ApiError && (e.status === 429 || e.status === 503)) {
      try {
        return await run(MODELS.queriesFallback);
      } catch (e2) {
        rethrow(e2);
      }
    }
    if (e instanceof ValidationError) throw new ServerError(502, `Gemini's reply was invalid: ${e.message}`);
    rethrow(e);
  }
}

class ValidationError extends Error {}

/** Call 3: does each candidate photo fit its chunk, and why (naming something visible). */
export async function checkMatches(req: CheckRequest): Promise<CheckReply> {
  const parts: Part[] = [{ text: CHECK_TASK }];
  for (const chunk of req.chunks) {
    parts.push({
      text: `\n<piece id="${chunk.id}">\n<text>${chunk.text}</text>\n<looked_for>${chunk.lookedFor}</looked_for>\n</piece>\nPhotos for piece ${chunk.id}:`,
    });
    for (const photo of chunk.photos) {
      parts.push({ text: `Photo ${photo.id}:` }, { inlineData: { mimeType: "image/jpeg", data: photo.image } });
    }
  }
  parts.push({
    text: `\nFor every piece (${req.chunks.map((c) => c.id).join(", ")}), return chunkId and a verdict for each of its photos by ID: fits and reason.`,
  });

  try {
    const raw = await generateJson(MODELS.check, parts, CHECK_SCHEMA, ThinkingLevel.MINIMAL);
    const parsed = CheckReply.safeParse(raw);
    if (!parsed.success) throw new ServerError(502, "Gemini's check reply was invalid.");
    return parsed.data;
  } catch (e) {
    rethrow(e);
  }
}
