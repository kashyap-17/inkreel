// Browser side of the model calls: posts to the server routes with the invite code,
// waits and retries when Gemini is rate-limited or busy, and checks every reply's shape.
import type { z } from "zod";
import {
  CheckReply,
  EmbedReply,
  QueriesReply,
  type CheckRequest,
  type EmbedRequest,
  type QueriesRequest,
} from "./schemas";

export class AiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const INVITE_KEY = "inkreel.invite";

export function savedInvite(): string {
  try {
    return localStorage.getItem(INVITE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveInvite(code: string): void {
  try {
    localStorage.setItem(INVITE_KEY, code);
  } catch {
    // Private mode: the code is asked for again next time.
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post<S extends z.ZodType>(path: string, body: unknown, schema: S, tries = 5): Promise<z.infer<S>> {
  let lastError: AiError | null = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    let res: Response;
    try {
      res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json", "x-invite-code": savedInvite() },
        body: JSON.stringify(body),
      });
    } catch {
      lastError = new AiError("Couldn't reach Inkreel's server. Check your connection.", 0);
      await sleep(2000 * (attempt + 1));
      continue;
    }
    const data: unknown = await res.json().catch(() => ({}));
    if (res.ok) {
      const parsed = schema.safeParse(data);
      if (parsed.success) return parsed.data;
      throw new AiError("The server's reply had an unexpected shape.", 502);
    }
    const { error, retryAfterSeconds } = data as { error?: string; retryAfterSeconds?: number };
    lastError = new AiError(error ?? `Request failed (${res.status}).`, res.status);
    // Rate limit, busy model or a passing server error: wait and try again. Anything else is final.
    if (![429, 502, 503, 504].includes(res.status)) throw lastError;
    await sleep(Math.min(60, retryAfterSeconds ?? 4 * (attempt + 1)) * 1000);
  }
  throw lastError ?? new AiError("Request failed.", 0);
}

export const embed = (req: EmbedRequest) => post("/api/embed", req, EmbedReply);
export const searchQueries = (req: QueriesRequest) => post("/api/queries", req, QueriesReply, 3);
export const checkMatches = (req: CheckRequest) => post("/api/check", req, CheckReply, 3);

/** Confirms the invite code with the server before anything is sent. */
export async function verifyInvite(code: string): Promise<boolean> {
  const res = await fetch("/api/invite", {
    method: "POST",
    headers: { "content-type": "application/json", "x-invite-code": code },
    body: "{}",
  });
  if (res.status === 401) return false;
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AiError(error ?? `The server answered ${res.status}.`, res.status);
  }
  return true;
}

/** Tester mode: sends the test record to the server log. Failures are ignored. */
export function sendTestRecord(record: object): void {
  void fetch("/api/record", {
    method: "POST",
    headers: { "content-type": "application/json", "x-invite-code": savedInvite() },
    body: JSON.stringify({ record }),
    keepalive: false,
  }).catch(() => {});
}
