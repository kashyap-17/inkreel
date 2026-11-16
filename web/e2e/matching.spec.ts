// Matching with the server calls answered by the test (no Gemini), so slow and failing
// answers can be staged.
import { expect, test, type Page } from "@playwright/test";
import { goodPhotos } from "./photos";

const vector = () => Array.from({ length: 768 }, () => Math.random() - 0.5);

/** Answers every model call; the search call only after `queriesDelayMs`. */
async function fakeServer(page: Page, queriesDelayMs: number) {
  await page.route("**/api/invite", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/embed", async (route) => {
    const body = route.request().postDataJSON() as { images?: string[]; texts?: string[] };
    const count = (body.images ?? body.texts ?? []).length;
    await route.fulfill({ json: { vectors: Array.from({ length: count }, vector) } });
  });
  await page.route("**/api/queries", async (route) => {
    const body = route.request().postDataJSON() as { sentences: { id: string; text: string }[] };
    await new Promise((r) => setTimeout(r, queriesDelayMs));
    await route.fulfill({
      json: {
        model: "test",
        queries: body.sentences.map((s) => ({ id: s.id, readings: [s.text], partOfDay: "none", day: 0 })),
      },
    }).catch(() => {});
  });
  await page.route("**/api/check", (route) => route.fulfill({ json: { results: [] } }));
  await page.route("**/api/record", (route) => route.fulfill({ json: { ok: true } }));
}

async function startMatching(page: Page) {
  await page.goto("/?tester=0");
  await page.getByRole("button", { name: /I have writing/ }).click();
  await page.locator("textarea").fill("Best weekend ever.\nColours everywhere we looked.");
  await page.getByRole("button", { name: "Next: add photos" }).click();
  await page.locator("input[type=file]").first().setInputFiles(await goodPhotos(page, 4, 60));
  await expect(page.locator(".summary")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Next: find matches" }).click();
  await page.getByRole("button", { name: "Send and find matches" }).click();
}

test("quick matching shows the stages and ends on the matches", async ({ page }) => {
  await fakeServer(page, 1500);
  await startMatching(page);
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your matches", exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".match-row")).toHaveCount(4);
});

test("a slow search call still ends on the matches, and the bar keeps moving", async ({ page }) => {
  test.setTimeout(90_000);
  await fakeServer(page, 12_000);
  await startMatching(page);
  const bar = page.getByRole("progressbar");
  await expect(bar).toBeVisible();
  const first = Number(await bar.getAttribute("aria-valuenow"));
  await page.waitForTimeout(3_000);
  expect(Number(await bar.getAttribute("aria-valuenow"))).toBeGreaterThan(first);
  await expect(page.getByText("Reading your writing")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your matches", exact: true })).toBeVisible({ timeout: 30_000 });
});
