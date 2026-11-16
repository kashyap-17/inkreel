// Browser tests: the whole flow in real Chrome at phone width. See docs/testing.md.
import { defineConfig } from "@playwright/test";

const PORT = 3210;
// E2E_URL=https://… runs the tests against a deployed site instead of a local dev server.
const SITE = process.env.E2E_URL;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: SITE ?? `http://localhost:${PORT}`,
    // The Chrome already on this machine, so no browser download is needed.
    channel: "chrome",
    viewport: { width: 400, height: 850 },
    permissions: ["clipboard-read", "clipboard-write"],
  },
  webServer: SITE
    ? undefined
    : {
        command: `npm run dev -- -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
