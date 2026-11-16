# Testing

How Inkreel is tested, and how to repeat it. Run every command from `web/`.

## Before every commit

- `npm run check`: typecheck, lint and the unit tests (plain logic: sentence splitting, the photo estimate, EXIF times, hashes and sharpness, stacks, setting weak photos aside, chunking and matching, the flow's state changes, the test record). Tests sit next to the code as `*.test.ts`.
- `npm run test:browser`: the whole flow in real Chrome at phone width (Playwright, tests in `web/e2e/`). It starts the dev server itself, on port 3210. Run it after any change to a screen or to the flow.
- `npm run build`: the production build.

## What the browser tests cover

They use the Chrome installed on the machine, so there is no browser download. Sample photos are drawn by the test in the page (`e2e/photos.ts`): different sharp patterns for good photos, plus a blurry one, a black frame and a screenshot. No real photos are stored in the repo.

- **Start screen:** the two choices, and no "trip" or "hundreds" in the copy.
- **By hand, start to post:** writing, adding photos, the photo count, matching by hand, choosing a photo for each part, adding a second photo to a part, remove and undo, the preview, the caption exactly as written, Copy, and changing a slide without repeating a shot. Nothing is sent to Gemini.
- **The draft** survives a reload.
- **Matching with staged server answers** (`e2e/matching.spec.ts`, no Gemini): quick matching shows the stages and ends on the matches; a slow search call offers "Match by hand instead", and a by-hand post isn't replaced when the abandoned run finishes.
- **Weak photos** are set aside with the right reasons, and one can be brought back; with a few photos nothing is set aside.
- **Live matching** (skipped by default): `E2E_LIVE=1 npm run test:browser` runs real matching with Gemini and checks every photo gets a reason and the search call didn't fail (a silent fallback to the sentences fails the test). It needs `GEMINI_API_KEY` in `web/.env` (and `INVITE_CODE` in the environment if one is set locally), takes about a minute and uses a little of the daily quota.

Any page error fails a test.

## What only a phone test shows

The browser tests can't cover these; check them by hand on a phone after changes to photos or sharing:

- Opening real camera photos (large files, memory limits, HEIC) from the phone's picker.
- The share sheet, and pasting the caption in Instagram.
- Whether the matches and reasons are good for real writing and real photos.
- Whether the right photos are set aside from a real album.

For a phone test, open the app once with `?tester=1`: the test record then goes to the server log when the post reaches the preview. Read it from `web/` with `npx vercel@65.15.0 logs` within about 30 minutes (Vercel's free plan keeps no more). Photo errors are logged the same way, as `[photo-report]`; every Gemini call as `[gemini] <call> <model> <outcome> <ms>`, and every request as `[api] <path> <status> <ms>`. Ask the tester whether the screen went off or they left the browser during a slow step: phones pause the page then.

## When a test fails

A failed browser test leaves the page's state in `web/test-results/` (git-ignored). Fix the cause, not the test, unless the behaviour was changed on purpose; then update the test and say so in the devlog.
