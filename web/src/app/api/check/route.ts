import { CheckRequest } from "@/lib/ai/schemas";
import { checkMatches } from "@/server/gemini";
import { handle } from "@/server/route";

export const maxDuration = 60;

/** Call 3: check the chosen photos and write the reasons (small images). */
export async function POST(request: Request) {
  return handle(request, CheckRequest, checkMatches);
}
