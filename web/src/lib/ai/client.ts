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

/** Told whenever a request waits before trying again, so the screen can say why. */
export interface Wait {
  seconds: number;
  reason: "busy" | "limit" | "connection";
}
let waitListener: ((wait: Wait) => void) | null = null;
export function onWait(listener: ((wait: Wait) => void) | null): void {
  waitListener = listener;
}

/** No request may hang: the server stops at 60 s, so anything longer is a lost connection. */
const REQUEST_TIMEOUT_MS = 65_000;
/** The longest a request waits before trying again. */
const MAX_WAIT_S = 20;

async function post<S extends z.ZodType>(path: string, body: unknown, schema: S, tries: number): Promise<z.infer<S>> {
  let lastError: AiError | null = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    const last = attempt === tries - 1;
    let res: Response;
    try {
      res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json", "x-invite-code": savedInvite() },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      lastError = new AiError("Couldn't reach Inkreel's server. Check your connection.", 0);
      if (!last) {
        waitListener?.({ seconds: 2 * (attempt + 1), reason: "connection" });
        await sleep(2000 * (attempt + 1));
      }
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
    if (last) break;
    const seconds = Math.min(MAX_WAIT_S, retryAfterSeconds ?? 2 * (attempt + 1));
    waitListener?.({ seconds, reason: res.status === 429 ? "limit" : "busy" });
    await sleep(seconds * 1000);
  }
  throw lastError ?? new AiError("Request failed.", 0);
}

export const embed = (req: EmbedRequest) => post("/api/embed", req, EmbedReply, 4);
/** One try: the server already retries a busy model and falls back; after that, the sentences are searched. */
export const searchQueries = (req: QueriesRequest) => post("/api/queries", req, QueriesReply, 1);
export const checkMatches = (req: CheckRequest) => post("/api/check", req, CheckReply, 2);

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
