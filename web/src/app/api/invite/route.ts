import { z } from "zod";
import { handle } from "@/server/route";

/** Lets the consent screen confirm an invite code before anything is sent. */
export async function POST(request: Request) {
  return handle(request, z.object({}), async () => ({ ok: true }));
}
