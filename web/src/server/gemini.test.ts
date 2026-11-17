// Backup requests (firstAnswer), the protection every model call now has, including photo indexing.
import { describe, expect, it } from "vitest";
import { firstAnswer, ServerError, type Backups } from "./gemini";

const never = () => new Promise<string>(() => {});
const after = (ms: number, value: string) => new Promise<string>((r) => setTimeout(() => r(value), ms));

describe("firstAnswer", () => {
  // No request starts in the last second before the deadline, so deadlines here are over a second.
  const backups: Backups = { resendAfterMs: [0, 50, 100], maxAttempts: 4, deadlineMs: 1_500 };

  it("sends a backup when the first request never answers, and uses its answer", async () => {
    const started = Date.now();
    const answer = await firstAnswer(backups, (_left, index) => (index === 0 ? never() : after(10, `answer ${index}`)));
    expect(answer).toBe("answer 1");
    // Well before the deadline: the hang cost only the wait before the backup.
    expect(Date.now() - started).toBeLessThan(200);
  });

  it("uses whichever answers first", async () => {
    const answer = await firstAnswer(backups, (_left, index) => (index === 0 ? after(120, "slow first") : after(10, "quick backup")));
    expect(answer).toBe("quick backup");
  });

  it("gives up at the deadline when nothing answers, as a timeout", async () => {
    const started = Date.now();
    const error = await firstAnswer(backups, () => never()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServerError);
    expect((error as ServerError).status).toBe(504);
    expect(Date.now() - started).toBeGreaterThanOrEqual(1_490);
    expect(Date.now() - started).toBeLessThan(2_500);
  });

  it("sends no more than the allowed number of requests", async () => {
    let sent = 0;
    await firstAnswer({ resendAfterMs: [0, 10, 20, 30, 40], maxAttempts: 3, deadlineMs: 1_200 }, () => {
      sent++;
      return never();
    }).catch(() => {});
    expect(sent).toBe(3);
  });
});
