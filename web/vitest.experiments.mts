// Prompt experiments: real Gemini calls, so never part of `npm run check`. See experiments/README.md.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["experiments/**/*.exp.ts"],
  },
});
