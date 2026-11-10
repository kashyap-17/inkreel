import { EmbedRequest } from "@/lib/ai/schemas";
import { embedImages, embedTexts } from "@/server/gemini";
import { handle } from "@/server/route";

export const maxDuration = 60;

/** Call 1 (images) and query embedding (texts), with Gemini Embedding 2. */
export async function POST(request: Request) {
  return handle(request, EmbedRequest, async (input) => ({
    vectors: input.kind === "images" ? await embedImages(input.images) : await embedTexts(input.texts),
  }));
}
