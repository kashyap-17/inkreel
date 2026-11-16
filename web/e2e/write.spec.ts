// Write with Inkreel in real Chrome. The draft call is answered by the test (no Gemini), except
// the last test, which drafts with Gemini and only runs with E2E_LIVE=1 (needs GEMINI_API_KEY).
import { expect, test, type Page } from "@playwright/test";
import { goodPhotos } from "./photos";

const MOMENT = "We got lost in the old market at dusk and didn't mind.";
const PLACE = "The blue door near the spice stall.";

/** What the test's stand-in for Gemini drafts: a traced line, an untraced one, and one with a new name. */
const DRAFTED = [
  { text: "Lost in the old market at dusk", section: "moment", quote: "lost in the old market" },
  { text: "The sea was calling", section: "felt", quote: "the sea was calling" },
  { text: "We waited for Maria by the blue door", section: "place", quote: "blue door" },
  { text: "And we didn't mind at all", section: "moment", quote: "didn't mind" },
];

/** Answers the draft call; records what was sent. `status` other than 200 answers with that error. */
async function fakeDraft(page: Page, sent: unknown[], status = 200) {
  await page.route("**/api/draft", async (route) => {
    sent.push(route.request().postDataJSON());
    if (status !== 200) {
      await route.fulfill({ status, json: { error: "That invite code isn't right." } });
      return;
    }
    await new Promise((r) => setTimeout(r, 300));
    await route.fulfill({ json: { model: "test", lines: DRAFTED } });
  });
}

async function startWriting(page: Page) {
  await page.goto("/?tester=0");
  await page.getByRole("button", { name: /Write with Inkreel/ }).click();
  await expect(page.getByRole("heading", { name: "A few thoughts for your caption" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.route("**/api/invite", (route) => route.fulfill({ json: { ok: true } }));
});

test("from answers to a draft traced to them, then on to a post by hand", async ({ page }) => {
  const sent: unknown[] = [];
  await fakeDraft(page, sent);
  await startWriting(page);

  // Three labelled sections; nothing to draft until one has words.
  await expect(page.locator(".answer label")).toHaveText([
    "A moment you keep thinking about",
    "A place or thing that stands out",
    "How it felt",
    "Anything else",
  ]);
  const next = page.getByRole("button", { name: "Next: draft it with Inkreel" });
  await next.click();
  await expect(page.getByText("Write something in at least one section first.")).toBeVisible();
  expect(sent).toHaveLength(0);
  await expect(page.getByText("Your answers go to Google’s Gemini AI")).toBeVisible();

  // With one answer, one nudge for a second detail; "Add one" goes to the next empty section.
  await page.getByLabel("A moment you keep thinking about").fill(MOMENT);
  await next.click();
  await expect(page.getByText("A second detail makes the lines more yours. Add a place or how it felt?")).toBeVisible();
  await page.getByRole("button", { name: "Add one" }).click();
  await expect(page.getByLabel("A place or thing that stands out")).toBeFocused();
  await page.getByLabel("A place or thing that stands out").fill(PLACE);
  await next.click();

  // Only the answers are sent, empty ones included as empty.
  await expect(page.getByRole("heading", { name: "Your lines" })).toBeVisible();
  expect(sent).toEqual([{ answers: { moment: MOMENT, place: PLACE, felt: "", other: "" } }]);

  // Each line shows the words it came from; the person's own words are highlighted.
  const lines = page.locator(".draft-line");
  await expect(lines).toHaveCount(4);
  await expect(page.locator(".label.ai", { hasText: "Written with Inkreel" })).toBeVisible();
  await expect(lines.nth(0)).toContainText("From your answer: “lost in the old market”");
  await expect(lines.nth(0).locator("mark.mine")).toHaveText(["Lost in the old market at dusk"]);
  await expect(page.getByText("words are yours.")).toBeVisible();
  await expect(lines.nth(0).getByText("Check this line")).toHaveCount(0);
  // A quote that isn't in the answers is dropped.
  // A line in Inkreel's own words says so.
  await expect(lines.nth(1)).toContainText("In Inkreel’s words");
  await expect(lines.nth(1)).not.toContainText("Check this line");
  await expect(lines.nth(1)).not.toContainText("From your answer");
  // A name the person never gave is flagged.
  await expect(lines.nth(2)).toContainText("“Maria” isn’t in your answers.");

  // Edit a line in place, drop another.
  await lines.nth(2).getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Edit this line").fill("Someone waited by the blue door");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(lines.nth(2)).toContainText("Edited by you");
  await expect(lines.nth(2)).not.toContainText("Check this line");
  await lines.nth(1).getByRole("button", { name: "Drop" }).click();
  await expect(lines).toHaveCount(3);

  // Changing the answers keeps them, and the lines can be come back to without a new draft.
  await page.getByRole("button", { name: "Change my answers" }).click();
  await expect(page.getByLabel("A moment you keep thinking about")).toHaveValue(MOMENT);
  await page.getByRole("button", { name: "Back to your lines" }).click();
  await expect(lines).toHaveCount(3);
  expect(sent).toHaveLength(1);

  // The rest of the flow is the same: photos, then matching by hand.
  await page.getByRole("button", { name: "Next: add photos" }).click();
  await page.locator("input[type=file]").first().setInputFiles(await goodPhotos(page, 3));
  await expect(page.locator(".summary")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Next: find matches" }).click();
  await expect(page.getByRole("heading", { name: "Before your photos are sent" })).toBeVisible();
  await expect(page.getByText("Your lines", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Match by hand instead" }).click();
  await expect(page.getByRole("heading", { name: "Your matches", exact: true })).toBeVisible();
  const parts = page.locator("ol.cards > li");
  await expect(parts).toHaveCount(3);
  await expect(parts.locator(".label.ai", { hasText: "Written with Inkreel" })).toHaveCount(3);
  const sheet = page.locator("dialog.sheet");
  for (let i = 0; i < 3; i++) {
    await parts.nth(i).getByRole("button", { name: "Choose a photo" }).click();
    await sheet.locator("button.thumb").first().click();
  }
  await page.getByRole("button", { name: "Next: preview" }).click();
  await expect(page.locator("p.caption")).toHaveText(
    "Lost in the old market at dusk\nSomeone waited by the blue door\nAnd we didn't mind at all",
    { useInnerText: true },
  );
});

test("own writing and Inkreel's lines are kept apart", async ({ page }) => {
  await fakeDraft(page, []);
  await page.goto("/?tester=0");
  await page.getByRole("button", { name: /I have writing/ }).click();
  await page.locator("textarea").fill("My own words.");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: /Write with Inkreel/ }).click();
  await page.getByLabel("How it felt").fill("Slow and warm, nobody needed us anywhere.");
  await page.getByRole("button", { name: "Next: draft it with Inkreel" }).click();
  await page.getByRole("button", { name: "Draft anyway" }).click();
  await expect(page.locator(".draft-line")).toHaveCount(4);

  await page.getByRole("button", { name: "Change my answers" }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: /I have writing/ }).click();
  await expect(page.locator("textarea")).toHaveValue("My own words.");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: /Write with Inkreel/ }).click();
  await expect(page.getByRole("heading", { name: "Your lines" })).toBeVisible();
  await expect(page.locator(".draft-line")).toHaveCount(4);
});

test("a turned-down invite code goes back to the start, keeping the answers", async ({ page }) => {
  const sent: unknown[] = [];
  await fakeDraft(page, sent, 401);
  await startWriting(page);
  await page.getByLabel("How it felt").fill("Slow and warm.");
  await page.getByLabel("A moment you keep thinking about").fill(MOMENT);
  await page.getByRole("button", { name: "Next: draft it with Inkreel" }).click();
  await expect(page.getByText("That invite code isn’t right.")).toBeVisible();
  await expect(page.getByLabel("Invite code")).toBeVisible();

  await page.getByLabel("Invite code").fill("another");
  await page.getByRole("button", { name: /Write with Inkreel/ }).click();
  await expect(page.getByLabel("How it felt")).toHaveValue("Slow and warm.");
});

test("a busy or slow draft says so, keeps the answers, and trying again works", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/draft", async (route) => {
    calls++;
    if (calls === 1) {
      await route.fulfill({ status: 504, json: { error: "Gemini didn't answer in time." } });
      return;
    }
    // The second try is slow: the note says why it's taking longer.
    await new Promise((r) => setTimeout(r, 9_500));
    await route.fulfill({ json: { model: "test", lines: DRAFTED } });
  });
  await startWriting(page);
  await page.getByLabel("A moment you keep thinking about").fill(MOMENT);
  await page.getByLabel("How it felt").fill("Slow and warm.");
  const next = page.getByRole("button", { name: "Next: draft it with Inkreel" });
  await next.click();
  await expect(page.getByText("The AI is busy right now and didn’t draft the lines. Your answers are kept")).toBeVisible();
  await expect(page.getByLabel("How it felt")).toHaveValue("Slow and warm.");
  await expect(next).toBeEnabled();

  await next.click();
  await expect(page.getByRole("status")).toHaveText("Drafting your lines from your answers…");
  await expect(page.getByRole("status")).toContainText("The AI is slow right now. Still trying…", { timeout: 9_000 });
  await expect(page.getByRole("heading", { name: "Your lines" })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".draft-line")).toHaveCount(4);
});

test("the draft and answers survive a reload", async ({ page }) => {
  await fakeDraft(page, []);
  await startWriting(page);
  await page.getByLabel("A moment you keep thinking about").fill(MOMENT);
  await page.getByLabel("A place or thing that stands out").fill(PLACE);
  await page.getByRole("button", { name: "Next: draft it with Inkreel" }).click();
  const lines = page.locator(".draft-line");
  await expect(lines).toHaveCount(4);
  await lines.nth(3).getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Edit this line").fill("And nobody minded");
  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(600); // the draft is saved shortly after each change
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your lines" })).toBeVisible();
  await expect(lines).toHaveCount(4);
  await expect(lines.nth(0).locator("mark.mine")).toHaveText(["Lost in the old market at dusk"]);
  await expect(lines.nth(3)).toContainText("And nobody minded");
  await expect(lines.nth(3)).toContainText("Edited by you");
  await page.getByRole("button", { name: "Change my answers" }).click();
  await expect(page.getByLabel("A place or thing that stands out")).toHaveValue(PLACE);
});

test("live: Gemini drafts lines traced to the answers", async ({ page }) => {
  test.skip(process.env.E2E_LIVE !== "1", "Set E2E_LIVE=1 to draft with Gemini.");
  test.setTimeout(120_000);
  await startWriting(page);
  await page.getByLabel("A moment you keep thinking about").fill(MOMENT);
  await page.getByLabel("A place or thing that stands out").fill(PLACE);
  await page.getByLabel("How it felt").fill("Slow, warm, like nobody needed us anywhere.");
  await page.getByRole("button", { name: "Next: draft it with Inkreel" }).click();
  await expect(page.getByRole("heading", { name: "Your lines" })).toBeVisible({ timeout: 60_000 });
  const lines = page.locator(".draft-line");
  const count = await lines.count();
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThanOrEqual(8);
  // Most lines should trace back to the answers.
  expect(await lines.filter({ hasText: "From your answer" }).count()).toBeGreaterThanOrEqual(Math.ceil(count / 2));
  console.log("LIVE DRAFT\n" + (await lines.locator(".line-text").allInnerTexts()).join("\n"));
  console.log("SOURCES\n" + (await lines.locator(".source").allInnerTexts()).join("\n"));
});
