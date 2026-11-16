// Browser tests: the whole flow in real Chrome at phone width. See docs/testing.md.
import { defineConfig } from "@playwright/test";

const PORT = 3210;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // The Chrome already on this machine, so no browser download is needed.
    channel: "chrome",
    viewport: { width: 400, height: 850 },
    permissions: ["clipboard-read", "clipboard-write"],
  },
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
