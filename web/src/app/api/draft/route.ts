import { DraftRequest } from "@/lib/ai/schemas";
import { writeDraft } from "@/server/gemini";
import { handle } from "@/server/route";

export const maxDuration = 60;

/** Call 4 (Write with Inkreel): a few lines from the person's answers (text only). */
export async function POST(request: Request) {
  return handle(request, DraftRequest, writeDraft);
}
