// The only place that talks to Gemini. Runs on the server, where the API key lives.
import { ApiError, GoogleGenAI, ThinkingLevel, type Part } from "@google/genai";
import { DRAFT_FLASH_FIRST, EMBED_DIMENSIONS, MODELS } from "@/config/ai";
import {
  CheckReply,
  DraftedLine,
  QueriesReply,
  SentenceQuery,
  type CheckRequest,
  type DraftReply,
  type DraftRequest,
  type QueriesRequest,
} from "@/lib/ai/schemas";
import { cleanHashtags, statesFeeling } from "@/lib/words/draft";
import { CHECK_SCHEMA, CHECK_TASK, DRAFT_SCHEMA, draftPrompt, QUERIES_SCHEMA, queriesPrompt } from "./prompts";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs one Gemini call and writes a line to the server log (call, model, outcome, time).
 * When Google answers "busy" (503), which under load happens at random to a share of
 * requests, it tries again after 1 s and 2 s rather than failing the step.
 */
async function call<T>(name: string, model: string, run: () => Promise<T>, busyTries = BUSY_TRIES): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    try {
      const result = await run();
      console.log(`[gemini] ${name} ${model} ok ${Date.now() - started}ms attempt ${attempt}`);
      return result;
    } catch (e) {
      const status = e instanceof ApiError ? e.status : e instanceof TimeoutError ? "timeout" : "error";
      console.log(`[gemini] ${name} ${model} ${status} ${Date.now() - started}ms attempt ${attempt}`);
      if (!(e instanceof ApiError && e.status === 503) || attempt >= busyTries) throw e;
      await sleep(1000 * attempt);
    }
  }
}

/** Attempts per Gemini call when Google answers "busy". */
const BUSY_TRIES = 3;

/** One vector per image. Each image is its own entry, so vectors aren't merged. */
export async function embedImages(images: string[]): Promise<number[][]> {
  try {
    const res = await call("embed-images", MODELS.embed, () =>
      ai().models.embedContent({
        model: MODELS.embed,
        contents: images.map((data) => ({ parts: [{ inlineData: { mimeType: "image/jpeg", data } }] })),
        config: { outputDimensionality: EMBED_DIMENSIONS },
      }),
    );
    return vectorsOf(res.embeddings, images.length);
  } catch (e) {
    rethrow(e);
  }
}

/** One vector per search text, with Gemini Embedding 2's search-query prefix. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  try {
    const res = await call("embed-texts", MODELS.embed, () =>
      ai().models.embedContent({
        model: MODELS.embed,
        contents: texts.map((t) => ({ parts: [{ text: `task: search result | query: ${t}` }] })),
        config: { outputDimensionality: EMBED_DIMENSIONS },
      }),
    );
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

/** Gemini took longer than the call allows. */
class TimeoutError extends Error {}

async function generateJson(
  name: string,
  model: string,
  parts: Part[],
  schema: object,
  thinkingLevel: ThinkingLevel,
  timeoutMs: number,
  busyTries = BUSY_TRIES,
  temperature = 0.4,
): Promise<unknown> {
  const res = await call(name, model, async () => {
    try {
      return await ai().models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          temperature,
          thinkingConfig: { thinkingLevel },
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      });
    } catch (e) {
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
        throw new TimeoutError(`${model} took longer than ${timeoutMs} ms`);
      }
      throw e;
    }
  }, busyTries);
  const text = res.text;
  if (!text) throw new ServerError(502, "Gemini returned an empty reply.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ServerError(502, "Gemini's reply wasn't valid JSON.");
  }
}

/**
 * Backup requests: under load some Gemini requests get "busy" and some hang. The same request is
 * sent again when there's no answer after each `resendAfterMs` (or straight away after a "busy"
 * or invalid answer); the first good answer wins; after `deadlineMs` the call fails.
 */
interface Backups {
  resendAfterMs: number[];
  maxAttempts: number;
  deadlineMs: number;
}

/** `attempt` gets the time left and which attempt it is (0 for the first), e.g. to pick a model. */
function firstAnswer<T>(backups: Backups, attempt: (msLeft: number, index: number) => Promise<T>): Promise<T> {
  const started = Date.now();
  const left = () => backups.deadlineMs - (Date.now() - started);
  return new Promise<T>((resolve, reject) => {
    let launched = 0;
    let running = 0;
    let settled = false;
    let lastError: unknown = null;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      fn();
    };
    const fail = () =>
      finish(() => {
        if (lastError instanceof ValidationError) reject(new ServerError(502, `Gemini's reply was invalid: ${lastError.message}`));
        else if (lastError instanceof TimeoutError || !lastError) reject(new ServerError(504, "Gemini didn't answer in time."));
        else {
          try {
            rethrow(lastError);
          } catch (e) {
            reject(e);
          }
        }
      });
    const exhausted = () => launched >= backups.maxAttempts || left() <= 1_000;
    const launch = () => {
      if (settled || exhausted()) return;
      const index = launched++;
      running++;
      attempt(left(), index).then(
        (reply) => finish(() => resolve(reply)),
        (e: unknown) => {
          running--;
          lastError = e;
          if (e instanceof ApiError || e instanceof ValidationError) launch();
          if (running === 0 && exhausted()) fail();
        },
      );
    };
    for (const after of backups.resendAfterMs) timers.push(setTimeout(launch, after));
    timers.push(setTimeout(fail, backups.deadlineMs));
  });
}

/** Writing the searches: Lite normally answers in 1.5–3.5 s. */
const QUERIES: Backups = { resendAfterMs: [0, 4_000, 8_000], maxAttempts: 4, deadlineMs: 20_000 };
/** Checking a batch of photos (Lite, small images): normally 2–10 s; hangs of 36–40 s seen. */
const CHECK: Backups = { resendAfterMs: [0, 8_000, 16_000], maxAttempts: 4, deadlineMs: 30_000 };

/**
 * Drafting lines (text only). Lite: normally 1–6 s, one 40 s hang seen, so backups at 6 s and 12 s.
 * Flash first (DRAFT_FLASH_FIRST): Flash took 13–43 s in tests, so Lite steps in only at 20 s, or
 * at once if Flash is busy or out of its daily quota.
 */
const DRAFT: Backups = DRAFT_FLASH_FIRST
  ? { resendAfterMs: [0, 20_000, 26_000], maxAttempts: 4, deadlineMs: 40_000 }
  : { resendAfterMs: [0, 6_000, 12_000], maxAttempts: 4, deadlineMs: 25_000 };
const draftModel = (index: number) => (DRAFT_FLASH_FIRST && index === 0 ? MODELS.draftFlash : MODELS.draft);

/** Call 2: up to three photo descriptions and time hints for every sentence. */
export async function searchQueries(req: QueriesRequest): Promise<QueriesReply> {
  const prompt = queriesPrompt(req.sentences, req.tripDays);
  const ids = req.sentences.map((s) => s.id);
  const model = MODELS.queries;
  return firstAnswer(QUERIES, async (msLeft) => {
    const raw = await generateJson("queries", model, [{ text: prompt }], QUERIES_SCHEMA, ThinkingLevel.LOW, msLeft, 1);
    const parsed = SentenceQuery.array().safeParse((raw as { queries?: unknown })?.queries);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "bad shape");
    const byId = new Map(parsed.data.map((q) => [q.id, q]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length) throw new ValidationError(`missing sentences ${missing.join(", ")}`);
    return { queries: ids.map((id) => byId.get(id)!), model };
  });
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

  return firstAnswer(CHECK, async (msLeft) => {
    const raw = await generateJson("check", MODELS.check, parts, CHECK_SCHEMA, ThinkingLevel.MINIMAL, msLeft, 1);
    const parsed = CheckReply.safeParse(raw);
    if (!parsed.success) throw new ValidationError("check reply had the wrong shape");
    return parsed.data;
  });
}

/**
 * Call 4: a short post from the person's answers, taken as hints (prompt draft-v10), and named
 * places as hashtags. Warmer than the other calls, so "Draft again" gives a different draft.
 */
export async function writeDraft(req: DraftRequest): Promise<DraftReply> {
  const prompt = draftPrompt(req.answers);
  const ask = () =>
    firstAnswer(DRAFT, async (msLeft, index) => {
      const model = draftModel(index);
      const raw = (await generateJson("draft", model, [{ text: prompt }], DRAFT_SCHEMA, ThinkingLevel.LOW, msLeft, 1, 1)) as {
        lines?: unknown;
        hashtags?: unknown;
      };
      const texts = Array.isArray(raw?.lines) ? raw.lines.filter((t): t is string => typeof t === "string") : [];
      // Which of the person's words a line uses is found in code (checkLines), not asked of the model.
      const parsed = DraftedLine.array()
        .min(1)
        .max(12)
        .safeParse(
          texts
            .map((t) => t.trim())
            .filter(Boolean)
            .map((text) => ({ text, section: "none", quote: "" })),
        );
      if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "bad shape");
      const tags = Array.isArray(raw?.hashtags) ? raw.hashtags.filter((t): t is string => typeof t === "string") : [];
      return { lines: parsed.data, hashtags: cleanHashtags(tags), model };
    });
  const started = Date.now();
  const first = await ask();
  // A line that just states the feeling ("it felt dreamy") gets one more try, if there's time
  // left before the route's 60 s limit; the cleaner draft wins.
  if (!first.lines.some((l) => statesFeeling(l.text)) || Date.now() - started > 15_000) return first;
  console.log("[gemini] draft states the feeling; asking once more");
  const second = await ask().catch(() => null);
  return second && !second.lines.some((l) => statesFeeling(l.text)) ? second : first;
}
