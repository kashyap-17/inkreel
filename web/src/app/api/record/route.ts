import { z } from "zod";
import { handle } from "@/server/route";

const MAX_CHARS = 400_000;
const PIECE = 3_500;

/**
 * Writes a tester's test record to the server log (Vercel's runtime logs), in numbered pieces so
 * no log line is cut. Sent only in tester mode, after consent, with the invite code.
 */
export async function POST(request: Request) {
  return handle(request, z.object({ record: z.record(z.string(), z.unknown()) }), async ({ record }) => {
    const text = JSON.stringify(record);
    if (text.length > MAX_CHARS) return { ok: false };
    const id = crypto.randomUUID().slice(0, 8);
    const count = Math.ceil(text.length / PIECE);
    for (let i = 0; i < count; i++) {
      console.log(`[test-record ${id} ${i + 1}/${count}] ${text.slice(i * PIECE, (i + 1) * PIECE)}`);
    }
    return { ok: true, id };
  });
}
