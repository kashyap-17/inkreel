// Experiment: the real server draft call (current prompt, backup requests, "it felt" retry) on several answers. See README.md here.
import { it } from "vitest";
import { checkLines, emptyAnswers, statesFeeling, type Answers } from "@/lib/words/draft";
import { writeDraft } from "@/server/gemini";

const INPUTS = JSON.parse(process.env.INPUTS ?? "[]") as Partial<Answers>[];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

it("drafts", { timeout: 900_000 }, async () => {
  for (const [i, input] of INPUTS.entries()) {
    const answers = { ...emptyAnswers(), ...input };
    const t = Date.now();
    try {
      const { lines, model } = await writeDraft({ answers });
      console.log(`\n######## ${i + 1}: ${JSON.stringify(input)}\n--- ${model} ${((Date.now() - t) / 1000).toFixed(1)} s`);
      for (const l of checkLines(answers, lines)) {
        console.log(`${statesFeeling(l.text) ? "FLAT " : "     "}${l.flagged ? "⚑ " : "  "}${l.text}${l.quote ? `   [${l.quote}]` : ""}`);
      }
    } catch (e) {
      console.log(`\n######## ${i + 1} ERROR ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`);
    }
    await sleep(6_000);
  }
});
