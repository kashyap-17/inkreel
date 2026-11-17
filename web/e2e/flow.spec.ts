// The flow from the start screen to the post, in real Chrome. The default tests match by hand,
// so they send nothing to Gemini and need no key. The last test runs real matching and only
// runs with E2E_LIVE=1 (needs GEMINI_API_KEY in web/.env; uses a little of the daily quota).
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { goodPhotos, weakPhotos, type SamplePhoto } from "./photos";

const WRITING = "Best weekend ever.\nColours everywhere we looked.\n\nHome late, shoes ruined.";

async function writeAndAddPhotos(page: Page, photos: (page: Page) => Promise<SamplePhoto[]>) {
  await page.goto("/?tester=0");
  await page.getByRole("button", { name: /I have writing/ }).click();
  await page.locator("textarea").fill(WRITING);
  await page.getByRole("button", { name: "Next: add photos" }).click();
  await page.locator("input[type=file]").first().setInputFiles(await photos(page));
  await expect(page.locator(".summary")).toBeVisible({ timeout: 60_000 });
}

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  // Any invite code is accepted, so these tests also run against the live site (E2E_URL).
  await page.route("**/api/invite", (route) => route.fulfill({ json: { ok: true } }));
});

test("start screen: two choices, and no mention of trips or hundreds", async ({ page }) => {
  await page.goto("/?tester=0");
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/trip|hundreds/i);
  await expect(page.getByRole("button", { name: /I have writing/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Write with Inkreel/ })).toBeEnabled();
  await expect(page.getByText("Coming soon")).toHaveCount(0);
});

test("start screen: the invite code is asked for once, before either choice", async ({ page }) => {
  await page.unroute("**/api/invite");
  await page.route("**/api/invite", (route) =>
    route.request().headers()["x-invite-code"] === "right"
      ? route.fulfill({ json: { ok: true } })
      : route.fulfill({ status: 401, json: { error: "That invite code isn't right." } }),
  );
  await page.goto("/?tester=0");
  await page.getByLabel("Invite code").fill("wrong");
  await page.getByRole("button", { name: /I have writing/ }).click();
  await expect(page.getByText("That invite code isn’t right.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your words" })).toHaveCount(0);

  await page.getByLabel("Invite code").fill("right");
  await page.getByRole("button", { name: /I have writing/ }).click();
  await expect(page.getByRole("heading", { name: "Your words" })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Invite code")).toHaveCount(0);

  // The consent screen no longer asks for it.
  await page.getByRole("button", { name: /I have writing/ }).click();
  await page.locator("textarea").fill(WRITING);
  await page.getByRole("button", { name: "Next: add photos" }).click();
  await page.locator("input[type=file]").first().setInputFiles(await goodPhotos(page, 2));
  await page.getByRole("button", { name: "Next: find matches" }).click();
  await expect(page.getByRole("heading", { name: "Before anything is sent" })).toBeVisible();
  await expect(page.getByLabel("Invite code")).toHaveCount(0);
});

test("photos stay readable when the phone withdraws access partway through", async ({ page }, testInfo) => {
  // Some Android phones stop handing over picked photos a few seconds in (NotReadableError on
  // every later read). Chrome does the same to a picked file that changes on disk, so: pick 30
  // photos from disk, change them all once the first one is ready, and expect all 30 to open.
  const photos = await goodPhotos(page, 30, 200);
  const dir = testInfo.outputPath("picked");
  await mkdir(dir, { recursive: true });
  const paths = await Promise.all(
    photos.map(async (p) => {
      const path = join(dir, p.name);
      await writeFile(path, p.buffer);
      return path;
    }),
  );
  await page.goto("/?tester=1");
  await page.getByRole("button", { name: /I have writing/ }).click();
  await page.locator("textarea").fill(WRITING);
  await page.getByRole("button", { name: "Next: add photos" }).click();
  await page.locator("input[type=file]").first().setInputFiles(paths);
  await expect(page.getByText(/Getting your photos ready… [1-9]\d* of 30/)).toBeVisible();
  await Promise.all(paths.map((path) => appendFile(path, Buffer.from([0]))));
  await expect(page.locator(".summary")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".summary")).toContainText("30 photos");
  await expect(page.getByText(/couldn’t be opened/)).toHaveCount(0);
});

test("by hand: from writing to a post, with the caption exactly as written", async ({ page }) => {
  await writeAndAddPhotos(page, (p) => goodPhotos(p, 4));
  await expect(page.locator(".summary")).toContainText("4 photos");

  // With a few photos the post starts with all of them, and the count can be changed.
  const count = page.locator(".stepper .count");
  await expect(count).toHaveText("4");
  await page.getByRole("button", { name: "Fewer photos" }).click();
  await expect(count).toHaveText("3");

  await page.getByRole("button", { name: "Next: find matches" }).click();
  await expect(page.getByRole("heading", { name: "Before anything is sent" })).toBeVisible();
  await page.getByRole("button", { name: "Match by hand instead" }).click();
  await expect(page.getByRole("heading", { name: "Your matches", exact: true })).toBeVisible();

  // Three lines give three parts; each gets a photo, and the first part gets a second one.
  const parts = page.locator("ol.cards > li");
  await expect(parts).toHaveCount(3);
  const sheet = page.locator("dialog.sheet");
  for (let i = 0; i < 3; i++) {
    await parts.nth(i).getByRole("button", { name: "Choose a photo" }).click();
    await sheet.locator("button.thumb").first().click();
  }
  await parts.first().getByRole("button", { name: "Add a photo" }).click();
  await sheet.locator("button.thumb").first().click();
  await expect(page.locator(".match-row")).toHaveCount(4);
  await expect(page.getByText("Chosen by you")).toHaveCount(4);

  // Removing one and undoing.
  await parts.first().getByRole("button", { name: "Remove" }).first().click();
  await expect(page.locator(".match-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".match-row")).toHaveCount(4);

  await page.getByRole("button", { name: "Next: preview" }).click();
  await expect(page.getByRole("button", { name: "Share", exact: true })).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator(".slide")).toHaveCount(4);
  await expect(page.locator("p.caption")).toHaveText(WRITING, { useInnerText: true });

  await page.getByRole("button", { name: "Copy", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(WRITING);

  // Changing a slide to a photo that's in another slide trades the two: no shot repeats.
  await page.getByRole("button", { name: "Change photo 1" }).click();
  await sheet.locator("button.thumb").first().click();
  await expect(sheet).toHaveCount(0);
  const sources = await page.locator(".slide img").evaluateAll((imgs) => imgs.map((img) => img.getAttribute("src")));
  expect(new Set(sources).size).toBe(4);
});

test("the draft survives a reload", async ({ page }) => {
  await writeAndAddPhotos(page, (p) => goodPhotos(p, 3));
  await page.waitForTimeout(600); // the draft is saved shortly after each change
  await page.reload();
  await expect(page.getByRole("heading", { name: "Now, the photos" })).toBeVisible();
  await expect(page.locator(".summary")).toContainText("3 photos");
});

test("weak photos are set aside, and one can be brought back", async ({ page }) => {
  await writeAndAddPhotos(page, async (p) => [...(await goodPhotos(p, 12)), ...(await weakPhotos(p))]);
  await expect(page.locator(".summary")).toContainText("12 photos");

  const setAside = page.locator(".set-aside");
  await expect(setAside.locator("summary")).toContainText("3 photos set aside");
  await setAside.locator("summary").click();
  const reasons = await setAside.locator(".thumb .flag").allInnerTexts();
  expect(reasons.sort()).toEqual(["blurry", "screenshot", "too dark"]);

  await setAside.locator(".thumb").first().click();
  await expect(page.locator(".summary")).toContainText("13 photos");
  await expect(setAside.locator("summary")).toContainText("2 photos set aside");
});

test("with a few photos, nothing is set aside", async ({ page }) => {
  await writeAndAddPhotos(page, async (p) => [...(await goodPhotos(p, 3)), ...(await weakPhotos(p))]);
  await expect(page.locator(".summary")).toContainText("6 photos");
  await expect(page.locator(".set-aside")).toHaveCount(0);
});

test("live: real matching gives every photo a reason", async ({ page }) => {
  test.skip(process.env.E2E_LIVE !== "1", "Set E2E_LIVE=1 to run real matching with Gemini.");
  test.setTimeout(300_000);
  await writeAndAddPhotos(page, (p) => goodPhotos(p, 5));
  await page.waitForTimeout(600); // the draft is saved shortly after each change
  // Tester mode, so a failed search call shows on the matches screen and fails this test.
  await page.goto("/?tester=1");
  await page.getByRole("button", { name: "Next: find matches" }).click();
  await page.getByRole("button", { name: "Send and find matches" }).click();
  await expect(page.getByRole("heading", { name: "Your matches", exact: true })).toBeVisible({ timeout: 180_000 });
  await expect(page.getByText("Checking the matches and writing reasons…")).toHaveCount(0, { timeout: 120_000 });
  await expect(page.locator(".match-row")).toHaveCount(5);
  await expect(page.locator(".match-row .why p")).toHaveCount(5);
  await expect(page.getByText("the search call failed")).toHaveCount(0);
});
