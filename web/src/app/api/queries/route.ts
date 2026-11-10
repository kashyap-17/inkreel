import { QueriesRequest } from "@/lib/ai/schemas";
import { searchQueries } from "@/server/gemini";
import { handle } from "@/server/route";

export const maxDuration = 60;

/** Call 2: a photo search for every sentence (text only). */
export async function POST(request: Request) {
  return handle(request, QueriesRequest, searchQueries);
}
