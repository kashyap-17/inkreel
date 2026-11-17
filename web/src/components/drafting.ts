// Asks for a draft (Write with Inkreel) and checks its lines in code before they're shown.
import { AiError, draftLines } from "@/lib/ai/client";
import { logEvent } from "@/lib/store/events";
import { checkLines, cleanHashtags, type Answers, type DraftLine } from "@/lib/words/draft";

export async function requestDraft(answers: Answers): Promise<{ lines: DraftLine[]; hashtags: string[] }> {
  const started = Date.now();
  const { lines, hashtags, model } = await draftLines({ answers });
  const checked = checkLines(answers, lines);
  logEvent({
    at: new Date().toISOString(),
    action: "drafted",
    detail: { model, ms: Date.now() - started, lines: lines.length, kept: checked.length },
  });
  if (!checked.length) throw new AiError("Inkreel couldn’t draft any lines this time. Try again.", 502);
  return { lines: checked, hashtags: cleanHashtags(hashtags) };
}

/** What to show when drafting fails; null when the invite code was turned down (handled elsewhere). */
export function draftError(e: unknown, onInviteRejected: (message: string) => void): string | null {
  if (e instanceof AiError && e.status === 401) {
    onInviteRejected("That invite code isn’t right.");
    return null;
  }
  logEvent({
    at: new Date().toISOString(),
    action: "draftFailed",
    detail: { status: e instanceof AiError ? e.status : null, error: e instanceof Error ? e.message.slice(0, 300) : String(e) },
  });
  if (e instanceof AiError && [429, 502, 503, 504].includes(e.status)) {
    return "The AI is busy right now and didn’t draft the lines. Your answers are kept: try again in a moment.";
  }
  if (e instanceof AiError && e.status === 0) return e.message;
  return "Drafting didn’t work this time. Your answers are kept: try again.";
}
