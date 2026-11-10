// Shared handling for the API routes: invite code, input validation, errors as JSON.
import { createHash, timingSafeEqual } from "node:crypto";
import type { z } from "zod";
import { ServerError } from "./gemini";

export const INVITE_HEADER = "x-invite-code";

/**
 * The invite code keeps the public address from using up the Gemini quota.
 * In production a missing INVITE_CODE refuses every request; in local development it's optional.
 */
export function checkInvite(request: Request): void {
  const expected = process.env.INVITE_CODE?.trim();
  if (!expected) {
    if (process.env.NODE_ENV === "production") throw new ServerError(503, "Invite codes aren't set up on the server.");
    return;
  }
  const given = request.headers.get(INVITE_HEADER)?.trim() ?? "";
  const digest = (s: string) => createHash("sha256").update(s).digest();
  if (!timingSafeEqual(digest(given), digest(expected))) throw new ServerError(401, "That invite code isn't right.");
}

export async function handle<S extends z.ZodType>(
  request: Request,
  schema: S,
  run: (input: z.infer<S>) => Promise<unknown>,
): Promise<Response> {
  try {
    checkInvite(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ServerError(400, "The request wasn't valid JSON.");
    }
    const input = schema.safeParse(body);
    if (!input.success) throw new ServerError(400, `Bad request: ${input.error.issues[0]?.message ?? "invalid"}`);
    return Response.json(await run(input.data));
  } catch (e) {
    if (e instanceof ServerError) {
      return Response.json({ error: e.message, retryAfterSeconds: e.retryAfterSeconds }, { status: e.status });
    }
    console.error(e);
    return Response.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
