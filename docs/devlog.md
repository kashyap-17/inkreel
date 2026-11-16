# Development log

Meaningful AI use during the build: what was asked, what was decided, what changed.

## 7 Nov 2026: stack decisions

- **Asked:** Claude Code to propose an MVP stack and list the questions to settle (Google Photos access, platform, models, budget).
- **Checked:** Google Photos Picker API limits (60-minute download URLs, no location), GPS stripping on iPhone and Android browser uploads, Android's photo picker showing Google Photos, Gemini API free-tier data terms in the UK.
- **Decided:** responsive web app (not native Android); TypeScript + Next.js on Vercel; plain upload; browser-side filtering and moment grouping without AI; one server function only to hold the API key; Gemini free tier; carousel + caption first, text on images next. Details in `decisions.md`.
- **Changed by the owner from the first proposal:** iPhone-first assumptions dropped (owner uses Android); Gemini instead of Claude API (budget); the Picker API dropped after the owner confirmed Google Photos appears in the browser upload on their phone.
- **Pushed back:** sentiment analysis as the matching signal (too coarse for lines like "nothing moved"); CLIP embeddings proposed instead, to be compared with CLIP + LLM.
- **Files:** README rewritten for visitors; `docs/decisions.md` and this log created; CLAUDE.md points to both.

## 7 Nov 2026: flow and authorship modes

- **Proposed by Claude:** for "help me write", show questions per moment next to the photos.
- **Rejected by the owner:** Inkreel is words first; per-moment questions would make it photo-first like existing tools. Claude checked the research behind the product (people tell photo stories either photo-driven or story-driven; existing AI tools are photo-driven only) and agreed.
- **Market re-check:** newer AI travel journals (Pathiary, Momentra, Meci, Triplium, Journiary) and Google Photos still start from photos and write for them. No tool found that matches the user's own writing to their own photos.
- **Decided:** words first in every mode; "help me write" asks trip-level questions before photos are added. Recorded in `decisions.md`.
- **Owner's simplification:** all three modes produce one write-up, then the same matching. Claude had suggested hybrid suggestions on the matches screen for moments without writing; dropped, since that is photo-aware. Hybrid in the MVP suggests whole extra pieces before photos are added.

## 7 Nov 2026: build plan

- **Asked:** Claude to write the build plan, using whatever was useful from the owner's notes on designing intelligent interactive systems.
- **Written:** `plan.md`: interaction contracts for each action, a fixed workflow rather than an agent, a flow graph with failure edges, a table of what happens when each part of the system is wrong, model-call specifications with success criteria and code checks, a per-call trace, consent as one approval per trip, a weak-match state, "re-match the rest" so the user's swaps change the next suggestions, and an end-to-end walkthrough used as the manual test.
- **Owner's corrections:** keep it product-first (no deadlines or submission items); Claude then over-filtered and removed the walkthrough and the parts table, and the owner asked for them back. AGENTS.md left out, since `.claude/CLAUDE.md` does that job.
- **Workflow graph and changes:** the flow drawn as a graph with the user's changes and failure paths; a table of which edits re-run what (MVP vs later), so a workflow still lets the user change photos and words.
- **No LLM framework:** LangChain and LangGraph considered and not used; plain TypeScript, Google's Gen AI SDK, Zod, a typed state machine.
- **Tracing:** Langfuse added at the owner's request, limited to text (never photos), on for the owner's trips and opt-in for anyone else.
- **Market notes:** `market.md` written; Journiary (owner's pick as closest) read from its website and privacy policy and compared.
- **Hosting and name:** Vercel `.vercel.app` address for now. Domain lookups found inkreel.com, .co, .ai and .app taken; inkreel.app is a private-beta AI film and music-video studio with the same name. Name kept as a working name; trademark search before launch.
- **Review pass:** fixed inconsistencies across the docs (matching options, build order, request size limit on the server function, set-aside wording); added missing cases (HEIC photos, caption-only pieces, the 2,200-character caption limit, 4:5 slides); added personal-data patterns to `.gitignore` before any photos are handled.

## 7 Nov 2026: model choice and Gemini terms

- **Asked:** Claude to pick free-tier models using the owner's AI Studio rate-limit page.
- **Checked:** Google's public rate-limit, pricing and model pages (free-tier numbers appear only in AI Studio, so the owner read them off the project page) and the Gemini API Additional Terms.
- **Found in the terms:** UK use of the free tier gets paid-tier data terms, as recorded earlier, but an app offered to other users in the UK must use Paid Services, and users must be 18 or over. `decisions.md` corrected: free tier for the owner's testing only.
- **Decided (owner's split):** Flash Lite (~500 requests/day) for describing photos; 3.6 Flash (~20/day) for matching and writing, the calls where quality matters most. Gemini 3.8 Flash and Gemma 4 31B (14,400/day but 16K tokens/min) compared for matching in Milestone 0.

## 7 Nov 2026: first build slice (photos to moments)

- **Owner's call:** start building now and compare models during the build, rather than a separate no-UI feasibility test first.
- **Built:** Next.js app (TypeScript, exact package versions, lockfile committed, Node 26.13.0 pinned). Photo step: pick photos, read capture time, time-zone offset and GPS from EXIF in the browser, fall back to the file date (flagged), group into moments by time gap with a gap control for tuning, show moments with thumbnails. Unit tests for date parsing, grouping and the EXIF reader (a tiny JPEG is built in the test, so no photos in the repo).
- **Fixed along the way:** EXIF is read from the first 512 KB of each file (whole file only for HEIC without a date), which also works in tests where the browser's file reader isn't available; the EXIF library loads only when photos are picked; Next.js's dev server needed the Mac's network address allowed so a phone can load it.
- **Setup note:** Homebrew builds Node from source on Intel Macs now, so Node was installed from the official, checksum-verified archive instead.

## 7 Nov 2026: first deploy and copy pass

- **Deployed:** Vercel, connected to the GitHub repo; every push to `main` deploys (install command `npm ci`). Live at `inkreel-eight.vercel.app` (`inkreel.vercel.app` belongs to InkReel.ai). Tested on the owner's phone: picking photos from Google Photos works.
- **Bug:** the personal-data ignore rule `photos/` also hid the code folder `src/lib/photos/`, so the first deploy failed. Personal-data folders are now ignored only at the repo root; image files are still ignored everywhere. Before committing new folders or ignore rules, check `git status --ignored`.
- **Copy:** the photo step read like a diagnostics panel. Rewritten: what the step is for, what a moment is, plain warnings that say what to do, moments grouped by day; test counts moved into a collapsed "Photo details" section.
- **AGENTS.md:** Next.js's dev server writes it; git-ignored, and its one rule (check Next's bundled docs) moved into `.claude/CLAUDE.md`.

## 7 Nov 2026: flow rebuilt words first

- **Owner's correction:** the first page described only the photo feature, which broke the agreed flow. Rebuilt to the plan: a start screen that says what Inkreel is (headline "Your camera roll, your story.", kept at the owner's request), how it works, the two promises, and the three modes with two marked "coming soon"; then "Your words"; then photos as step 2. A step bar shows Words, Photos, Matches, Share.
- **Built:** "I have writing": paste or type, split by paragraph or line (suggested automatically), join pieces, each labelled "Yours". The flow is a typed reducer (`src/lib/flow`). Tests for splitting and the reducer.
- **Owner's note:** the landing page wording gets a proper edit once more of the product works.

## 8 Nov 2026: Inkreel does the chunking

- **Owner's correction:** asking the user to split their writing into one piece per photo makes no sense in a words-first product, since they write before knowing the photos. Inkreel should chunk the writing, at matching time.
- **Decided:** the user writes freely; plain code splits sentences (each poem line is one); the matching call groups consecutive sentences into chunks and picks a moment for each; code checks the chunks rebuild the exact text. Review gets move-a-sentence and fewer/more/one photo. Recorded in `decisions.md` and `plan.md` (call 2 is now "chunk and match").
- **Photo estimate:** the owner asked for a rough count before photos. First proposal used paragraphs; the owner preferred word count; word count alone gave a short poem one photo, so the rule mixes words and sentences (examples in `decisions.md`).
- **Built:** words screen is now a free text box with a live "About 4–6 photos" line; split/join removed; sentence splitter and estimate with tests; checked in Chrome.

## 8 Nov 2026: photo selection by search, not description

- **Owner's proposal:** an LLM rewrites the writing into the right form for an image-embedding model, which then picks the photos; sending dozens or hundreds of photos to an LLM is too much. The owner suggested ColPali or CLIP.
- **Checked:** research and company material. Embeddings were level with frontier LLMs on hard text-to-image retrieval and far cheaper per photo; CLIP-type models handle feelings-text poorly, and LLM query rewriting helps; Google Photos' Ask Photos uses vector search then Gemini on the shortlist; ColPali is for document pages, not photos. Sources in `decisions.md`.
- **Decided:** index every kept photo with Gemini Embedding 2 (owner's free limits: 100/min, 1,000/day); 3.6 Flash writes a literal photo description per sentence; plain code scores, chunks and picks photos; Flash Lite checks the chosen photo and two alternatives per chunk and writes the reason. On-phone embedding (MobileCLIP2 or SigLIP 2) compared in Milestone 0; if close, it wins on privacy. The user chooses words in the caption or on the images.
- **Changed in the docs:** `decisions.md` new "Photo selection" entry, model table and open items; `plan.md` flow graph, failure edges, parts table, contracts, calls 1–5 renumbered, data, walkthrough and Milestone 0 four-way comparison.

## 8 Nov 2026: repo tidy-up

- **Owner's request:** the root was cluttered with config and generated files. The app and all its config moved into `web/` (the tools need their config next to `package.json`, so the folder moves as a whole). Root now: `README.md`, `docs/`, `web/`, `acad_docs/`, `.claude/`. Vercel's root directory set to `web`.

## 10 Nov 2026: real-trip photo check

- **Owner's result:** 30 trip photos picked on the owner's Android phone (Chrome, system photo picker): capture time 30, time zone 30, file date 0, location 0. Capture time survives the Google Photos route; location never arrives, as expected. Recorded in `decisions.md`.
- **Picker albums:** the owner's Google Photos albums didn't show in the picker's Collections tab. Researched: the system photo picker shows cloud albums only when Google Photos is set as its "cloud media app" (picker settings), on Android 12+ with a current Google System Update; albums made in other apps (Samsung Gallery, Snapseed) never show. Inkreel can't change what the system picker lists. Not yet confirmed on the owner's phone.

## 10 Nov 2026: moments replaced by stacks

- **Owner's challenge:** with moments as the matching unit, how does a 30-photo trip become 3–4 photos for a poem, and what does a moment give the user? On a real trip the owner saw several good, different shots within 15 minutes, so "one photo per moment" would block good pairs, and long groups meant nothing to a user.
- **Agreed:** the writing sets the count; each chunk gets the best photo from the whole trip; the only rule is no near-identical slides. Before deciding, the owner asked how Google Photos does it: its stacks hold near-identical shots taken within a short time, with an AI top pick the user can change, and Memories filter with rules and image models. Album-summary research balances quality, variety and coverage; Inkreel doesn't need coverage because the words decide what is relevant.
- **Decided:** stacks (within 2 minutes and a close perceptual hash; sharpest is the top pick; duplicates stacked, not set aside); only top picks are indexed; at most one photo per stack in a post; swap offers next picks, other shots of this, around then (±15 min), elsewhere. No groups shown on the photos screen. Recorded in `decisions.md` ("Each chunk gets a photo"), `plan.md` and `CLAUDE.md`.

## 10 Nov 2026: the core loop, end to end

- **Owner's request:** only the first two screens existed; build the whole flow with the draft saved, so it can be tested end to end, then check copy and flow against the agreed principles before calling it done.
- **Built:**
  - Server: four routes (`embed`, `queries`, `check`, `invite`); Gemini through `@google/genai` 2.31.0 with structured JSON output; Zod checks on every request and reply; invite code (`INVITE_CODE`, required in production); rate-limit and overload errors passed back with a wait time.
  - Browser: each photo decoded once into a 2048 px working copy and a thumbnail (EXIF dropped), with a difference hash and a sharpness score; stacks; IndexedDB for the draft, photos, photo vectors and saved searches; the phone's back button moves between steps; "Start over" deletes everything.
  - Matching: index top picks (6 per request, 2 requests at a time), search queries, scores with a time bonus, chunking by dynamic programming over sentence breaks, at most one photo per stack, check and explain for the chosen photo and two alternatives. Failure paths from the plan: partial index, searches falling back to the sentences, unchecked matches showing what Inkreel looked for, a photo the check rejects replaced by an alternative it accepts, match by hand.
  - Screens: photos (summary, stacked count, warnings, details), consent (what is sent, to whom, invite code, match by hand), matching progress with the first-run note, review (photo, words, reason, labels, weak marker, swap sheet, move a line, caption only, fewer/more photos, undo), preview (4:5 slides, caption with count, share sheet, copy caption, download).
  - Card text is an exact slice of the writing, so a poem's line breaks survive in the caption.
- **Tested:** 61 unit tests; production build; the whole flow clicked through in Chrome with stock macOS wallpapers as photos (no personal photos), including reload on every step, back and forward, swap, fewer and undo, move a line, preview, download, start over, and match by hand (no requests sent).
- **Found while testing:**
  - Flash's search-query call took 3 to 42 seconds for the same four lines; thinking level set to low. One "high demand" 503 from Flash in the first hour; the call now falls back to Lite on 503 as well as 429.
  - A photo set spanning more than a year failed the request check; the trip length sent is now capped.
  - The EXIF reader was being pulled into the server render through the matching code; canvas helpers split out so it loads only when photos are picked.
  - Reasons read "The image shows…"; check prompt v2 asks for a plain phrase about the scene.

## 10 Nov 2026: test record

- **Owner's question:** can sessions be reviewed? The draft is saved on the device, but nothing reaches a server, so the developer can't see what happened on a trip.
- **Checked:** AI Studio's Logs feature records Gemini calls, but needs a billing-enabled project, doesn't log embedding calls, can't see the scores, chunking or user changes (all on the phone), and would store the small photo copies sent to the check call for up to 55 days.
- **Built:** "Download test record" under the review and preview screens: one JSON file with the writing, each sentence's search, models and prompt versions, photo details (name, time, size, hash, sharpness, stack; no photos, no coordinates), scores, verdicts, cards, caption and a log of the user's actions. The owner sends it with feedback. Langfuse stays the plan for testers other than the owner.

## 13 Nov 2026: photos that couldn't be opened

- **Found in the owner's first phone test:** 24 of 30 photos were left out as "couldn't be opened". The old moments flow showed real thumbnails for the same 30, so Chrome on the phone can read them; the new flow is the first to decode every photo in full (for the working copy, hash and sharpness), and the version tested didn't record why each one failed.
- **Changed:** if direct decoding fails, the photo is decoded the way an `<img>` thumbnail is and shrunk straight to working size (no second full-size copy in memory); two photos decode at a time instead of three. The photos screen lists each failure (format read from the file's first bytes, size, browser errors), and the failures go into the test record, which the photos screen now offers when anything fails.
- **Second phone test:** "Something went wrong reading those photos" for the whole batch. The new failure path read each failed file's first bytes outside any error handling, so one unreadable file stopped everything. Now every step for a photo (opening, making copies, saving) is handled per photo and named in the failure; opening tries a third way (reading the file into memory first); and the catch-all shows the browser's error under Details and saves it in the test record.
- **Error reports:** testing by screenshot was too slow, and the server never sees photo problems (photos are opened on the phone). When photos fail, the photos screen now sends a short report to `/api/report` (browser, file types, sizes, which step failed and the errors; no photos or file names), written to Vercel's runtime log as `[photo-report]`. The screen says it was sent. Sent before consent, so revisit before testers other than the owner (opt-in, or fold into Langfuse).
- **Not done:** a HEIC converter. Only needed if failures still show HEIC; the owner won't change camera settings, so a converter in the browser would be the fix (library licence to decide).

## 13 Nov 2026: first full phone test, and what changed

- **The test:** a 6-line poem in three couplets and 30 London photos on the owner's phone. All 30 photos went in (the memory fix above was the cause, not HEIC); 28 distinct shots; matching took 9 seconds; 3 photos picked, none swapped. No location on any photo: Android's photo picker removes it, so on the web matching uses time and content only. The test record and screenshots were reviewed with the owner.
- **Found:** the split ignored the couplets (cut after line 5); the caption added a blank line inside a couplet; the search invented details ("punk concert … stage", "ferris wheel") and read "days of delight" as morning; reasons described the photo without saying why it fits; user-facing copy carried engineering details (512 px, near-identical shots, photo details, error text); the share screen had three equal buttons and didn't say the caption was copied; the change-photo sheet could put the same photo in two slides.
- **Owner's calls:** several readings per line rather than one stricter search (owner's idea); "Share" rather than "Share to Instagram", since WhatsApp and other apps are real uses; captions only for the MVP, saying so in the app, with text on images reconsidered after real posts; no "choose a new photo from the phone" in the change-photo sheet (scope); measuring quality is open, for now the rate of photo changes and feedback.
- **Changed:** chunks prefer the writer's blank lines and default to one photo per stanza; every photo is used when the user adds no more than the estimate; the caption is the writing exactly as written; up to three readings per sentence with the best match counting (queries-v2) and reasons tied to a quoted phrase (check-v3); Flash gets 35 s for the searches, then Lite; tester mode (`?tester=1`) holds the engineering details and sends the test record to the server log; new copy on the photos, consent, review and preview screens; one "Share" button with a paste guide, Copy on the caption, "Save the photos instead" as a link; tapping a slide on the preview changes its photo; choosing a photo that's in another slide makes the two trade places.
- **Checked:** 74 tests; the full flow in Chrome with a three-stanza poem through matching, the check, the preview, Copy (clipboard matches the caption), changing a slide (slides trade places, no repeat), and the test record arriving in the server log. A prompt example taken from the owner's poem was copied back by Gemini word for word, so the examples were replaced with ones not in any test writing.

## 16 Nov 2026: copy after the owner's read-through

- **Owner's points:** "Your writing fits about 2–3 photos" makes no sense while the words go in the caption; "add the whole trip" should be "add more and Inkreel picks the ones that fit your writing"; no "hundreds"; don't say "trip" in the app at all (trips are the internal positioning, hinted at most); two choices on the start screen, not three. The owner also asked to discuss changes before they're built; the copy edits had been started and were put to the owner as a list before going further.
- **Changed:** "trip" and "hundreds" removed from every screen and the README; the photo estimate no longer shown on the words or photos screens; a "How many photos in your post?" control on the photos screen (the estimate only sets its starting number); start screen shows "I have writing" and "Write with Inkreel" (coming soon); the prompts sent to Gemini no longer say "trip" (queries-v3, check-v4), so non-trip posts aren't pulled towards travel scenes.
- **Checked:** 75 tests; start, words and photos screens and the count control in Chrome, through matching by hand. The new prompt versions were not run against Gemini in this round.

## 16 Nov 2026: more photos than lines

- **Gap found in the copy review:** a post couldn't have more photos than the writing had lines, so a one-line caption with five photos gave one photo. That contradicted "add just the photos you want".
- **Discussed with the owner first:** break by words, or let a line hold several photos? Lines stay the smallest unit (reasons in `decisions.md`); a part can hold several photos; per line rather than per stanza; photos inside a part in the order taken.
- **Built:** extra photos assigned to the part they fit best, spread across parts; the count control goes up to the number of distinct shots; up to 10 shots the post starts with all of them; on the matches screen each photo has its own reason, "Change photo" and "Remove", and each part has "Add a photo"; joining two parts keeps both parts' photos; the check call covers every photo of a part, three at a time.
- **Checked:** 81 tests; a two-line caption with five photos in Chrome through matching (five photos, each with a reason, one marked "No strong match"), remove, add, fewer photos, the preview and changing a slide. That live run fell back to the sentences (Gemini busy), so queries-v3 was first seen working on 16 Nov in the evening.

## 16 Nov 2026: weak photos set aside

- **Owner's question:** are poor photos filtered out before matching? They weren't: sharpness only chose between near-identical shots, so a blurry photo could be picked if its content fitted.
- **Built:** blurry, nearly black, washed-out and screenshot photos are set aside when photos are added, before stacking and matching; the photos screen lists them with the reason and a tap brings one back. Nothing is set aside when 10 photos or fewer are added. Rules and values in `decisions.md`.
- **Checked:** 90 tests; in Chrome with 14 files (a blurred copy, a black frame and a screenshot among good photos): the three were set aside with the right reasons, and bringing one back worked. Not yet tried on real weak photos, so the cut-offs are untested on a real album.

## 16 Nov 2026: browser tests saved in the repo

- **Owner's question:** are the browser run-throughs saved, so testing can be repeated once things settle? They weren't: throwaway scripts and sample photos in a temporary folder, wiped once already.
- **Built:** `npm run test:browser` (Playwright with the installed Chrome, tests in `web/e2e/`), sample photos drawn by the test so no real photos are stored, a by-hand run that sends nothing to Gemini, an optional live run (`E2E_LIVE=1`), and `docs/testing.md`.
- **Caught on its first run:** "Add a photo" on the matches screen opened an empty list when the part's photo was taken within 15 minutes of the others (those photos were filed under "Around then", which isn't shown when adding). Fixed; this was live for a short while in the previous deploy.
- **Checked:** 5 browser tests and the live one pass; 90 unit tests.

## 16 Nov 2026: photos withdrawn by the phone mid-read

- **Owner's phone test:** 28 of 32 photos left out again. The error report in the server log gave the cause for the first time: `NotReadableError` ("permission problems that have occurred after a reference to a file was acquired") on plain 2–6 MB JPEGs. Not HEIC and not memory, which the 13 Nov changes had assumed. Why all 30 went in on 13 Nov is not established (possibly different photos or where they were picked from).
- **Suspected cause (weak):** the file picker was cleared straight after a pick (so the same photos could be picked again), and was disabled while reading. On Android either can withdraw access to files not yet read; only the first four were read in time.
- **Changed:** the picker is cleared only after every file has been read, and is no longer disabled during reading (the button blocks taps instead). Both suspects are changed together, so the test won't say which one it was.
- **Not verified:** this can't be reproduced in desktop Chrome; only the owner's phone shows whether it holds.

## 16 Nov 2026: second phone test, and slow matching

- **The test:** the London poem and 30 photos; all 30 went in (the picker change, or different luck: not established). The post went all the way to Instagram; Share and Copy worked; five of six photos were Inkreel's picks.
- **Found:** matching took almost 10 minutes. The search call failed (Google's "high demand" on Flash and Lite), the browser retried with long waits, and the owner turned the phone's screen off, which pauses the page. The change-photo list stopped at 18 of 29 shots. Odd text on the matching screen, which the owner put down to the failure.
- **Checked directly:** Flash failed or hung 60 s; about 4 in 10 Lite requests got "high demand" within 2 s, the rest answered in 1–2 s, whatever the request settings.
- **Changed:** Lite writes the searches, Flash once as fallback; "busy" retried on the server after 1 s and 2 s; time limits on every request and model call; photos and searches run together; the screen stays on while matching; a new matching screen (stages with a spinner, seconds counter, "Google's AI is busy… trying again in 3 s", "Match by hand instead" after 15 s); every call logged on the server and each stage's time in the test record; the change-photo list shows every shot, best first; the live browser test fails when the searches fall back. Found by review before the owner tested: "Match by hand instead" mid-run would have had its picks overwritten when the run finished; fixed, with a browser test. Near-identical shots from other groups still show only when changing that group's own photo. Details in `decisions.md` ("Waiting and failures in matching").
- **Checked:** 90 unit tests, 5 browser tests, and the live test against Gemini under the same load: matching took about 3 s (searches 1.3 s on Lite). Screenshots of the matching screen at 3 s and 17 s with the search call held back on purpose.

## 16 Nov 2026: third phone test

- **Result:** matching took 8 s (was almost 10 minutes). Then the check that writes the reasons took about 40 s more, because Lite answered "busy" five times; the review screen said "Checking the matches…" all that while, which the owner found awkward. The owner didn't find the matches better than before.
- **Found in the record:** the phone ran the previous version of the page (the two matching steps ran one after the other, and the new stage-time entry was missing); the server was new. A page left open keeps its old code, so the new matching screen and the full change-photo list weren't tested.
- **Why the matches weren't better:** Lite often wrote one reading per line, or put two scenes in one ("many birds flying over a park, a person riding a ferris wheel"), and picked e.g. "Bright moon in the sky" for "trippy lights". Flash or Lite for the searches stays open for the owner, with this as evidence; a clearer instruction to Lite (one scene per reading) is a cheap thing to try.
- **Changed (must-haves before a pause):** the page checks which build the server runs when it opens or comes back on screen, and reloads itself once when there's a newer one (not during matching; the draft is saved first). Reasons now appear part by part as they arrive, two requests at a time, with "Adding why it fits…" on each waiting photo instead of a banner.

## 16 Nov 2026: search call hanging; progress bar

- **Owner's test:** the search call failed again; the owner noticed the matches (from the plain sentences) still looked good, and asked for a progress bar instead of "taking longer than usual", and no "Match by hand" during matching.
- **Server log:** a Lite request hung for 12 s, then Flash for 20 s; only quick "busy" answers were being retried.
- **Changed:** backup requests for the search call (resent at 4 s and 8 s or at once after "busy", first answer wins, 20 s limit, no Flash); the sentence itself is always searched alongside the AI's readings; one progress bar with the current step and time left. Five timed calls afterwards: all answered, 1.8–3.5 s, one after a "busy" answer and an immediate resend.

## 16 Nov 2026: Write with Inkreel designed; reasons still slow

- **Research for the writing mode:** read the review's papers on co-writing and ownership (Draxler 2024, Jakesch 2023; Biermann 2022 via the university's summary) and new ones (Dhillon 2024, Zhang et al. 2026, Hwang et al. 2025, Jeung et al. 2024, Jakesch 2019, Burt 1992, Wagenaar 1986). The new ones were imported into the owner's Zotero from doi.org and arXiv records, tagged `inkreel-litreview`.
- **Design agreed with the owner** (in `decisions.md`, "Write with Inkreel"): one writing surface with four labelled sections; one nudge if only one is filled; "Next: draft it with Inkreel"; each drafted line shows the answer it came from with the person's words highlighted, instead of styling every line as AI; edit or drop lines; "Change my answers" and "Draft again". The owner's ideas: the prompts as a guide (first as boxes), linking lines to the answers, editing and redrafting.
- **Owner's test of the progress bar:** matching was quick (7 s, the search call recovered from two "busy" answers), but two reason calls hung 36–40 s, so "Adding why it fits…" stayed for over a minute. Agreed fix, not built yet: move the reason check into matching as the last stage of the progress bar, with backup requests (first resend at about 6–8 s), capped at about 15 s; the matches screen then opens with reasons and with rejected photos already replaced; late reasons appear without a placeholder.

## 16 Nov 2026: reasons checked inside matching

- **Built:** the check and its reasons run as the last stage of matching, with backup requests shared with the search call (one helper on the server); the matches screen opens complete, or after 15 s with late reasons following; no "Adding why it fits…" placeholder; the progress bar keeps moving between steps (it sat at 70% for 4 s during checking in the first try).
- **Checked:** 90 unit tests, 8 browser tests (new: reasons present on opening; a 25 s check opens the matches at 15 s and the reasons arrive later with no placeholder), and a live run against Gemini: matching 9.8 s in all, checking 4.2 s of it, every photo with its reason when the screen opened, no fallback.

## 16 Nov 2026: picked photos copied before decoding

- **Owner's phone test:** 24 of 30 photos left out with the same `NotReadableError` as before; on a second try a few minutes later, all 30 went in. Earlier tries: 32 → 4, 30 → 30, 30 → 6, 30 → 30. The phone withdraws access to picked photos partway through, at a point that varies; the 16 Nov picker change didn't stop it.
- **Reproduced in desktop Chrome:** Chrome refuses a picked file the same way (same three errors, word for word) once it changes on disk. A browser test picks 30 photos from disk and changes them once the first is ready: 4 of 30 went in before the fix.
- **Changed:** every picked photo's bytes are copied into a file the page owns as soon as they're picked (8 at a time, before the slow decoding); decoding reads the copies, and each copy is let go once its photo is ready. A photo that can't be copied still gets the usual attempts to open it. The photo report now also says how many were copied, how long that took, when the first failure came, and whether the page went to the background.
- **Checked:** 92 unit tests (new: copying keeps name, type and date; unreadable files are handed back and the rest still copied), 9 browser tests (the new one: 30 of 30 after the fix). Whether the copies finish before the phone withdraws access only a phone test shows; the report will say either way.

## 16 Nov 2026: Write with Inkreel built; invite code on the start screen

- **Agreed with the owner before building:** the invite code moves to the start screen (the owner's call: without one the app is only "match by hand"); the start screen loses its four how-it-works steps (they repeated each other and the step bar), with what mattered in them (add as many photos as you like, Inkreel picks and orders them with reasons, a carousel and caption ready to post) moved into the one paragraph.
- **Proposed while building, not taken:** dropping "Anything else"; the owner kept all four sections.
- **Built:** the draft call (`/api/draft`, Lite with backup requests, prompt `draft-v1`, temperature 0.9); the questions screen (one surface, four labelled sections, the one-time nudge, the Gemini note); the draft screen (each line with "From your answer: '…'", the person's own words highlighted, "Check this line" for an untraced line or a new name, edit in place, drop, "Draft again", "Change my answers"); "Written with Inkreel" on the draft and on matches made of its lines; each mode keeps its own writing; the answers and draft in the test record. The consent screen no longer asks for the code; a turned-down code goes back to the start screen.
- **Found while testing:** the name check skips the first word of a line, so an invented name there isn't flagged (recorded in `decisions.md`).
- **After review:** a busy or failed draft says so in plain words and keeps the answers; a draft taking over 8 s says Google's AI is slow and that it keeps trying; answers are capped at the server's 3,000 characters; the consent screen says "Before your photos are sent" in this mode (the answers were already sent to draft); "Draft again" asks first when lines were edited; "Start over" shows once answers are typed.
- **Owner's review of the wording and prompt:** "Anything else" stays (four sections); prompts move to `web/src/server/prompts/`, one file per call; status messages say "the AI" rather than Google; tapping Next with every section empty explains itself; prompt `draft-v2` keeps as many of the person's words as possible and every specific thing, with the line count following what they gave. The owner asked to try Flash first, then an older Flash, before Lite: compared on three short answers (see `decisions.md`), Flash wrote the same lines 15–40 s slower and 3.8 Flash was busy, so Lite stays.
- **Checked:** 109 unit tests (quote checking, own-word highlighting, name flags, the reducer's new actions and mode switching), 15 browser tests (5 new for Write with Inkreel: the whole path, modes kept apart, a turned-down code, a busy then slow draft, a reload; 1 for the invite code), and one live draft with Gemini: 4 lines in about 7 s, all traced to the answers, nothing invented, staying very close to the answers' own words.

## Where things stand (16 Nov 2026)

**Done:** the core loop for "I have writing", end to end and deployed: words with a live photo estimate → photos (working copies, stacks) → consent → matching with reasons → review (swap, move a line, caption only, fewer/more, undo) → preview (change a photo, share, copy). The draft is saved on the device. Tested once on the owner's phone with a real trip. Write with Inkreel (answers → draft traced to them → the same flow) built 16 Nov, not yet tested by the owner.

**Next:** the owner's test of Write with Inkreel (built 16 Nov). Each commit needs the owner's approval.

**Waiting on the owner:** a second phone test of the 13 and 16 Nov changes (same poem and photos is fine, with `?tester=1` once so the record reaches the log); whether the caption pasted in Instagram after Share; the owner's own picks for the London poem, if a fuller comparison is wanted later.

**Not built yet (in the plan):**
- HEIC conversion when the browser can't decode it.
- Reordering and dropping cards (caption only covers dropping a photo); "one photo" as a single tap; keeping swapped cards when photos are added after matching (adding photos currently re-matches everything).
- Langfuse tracing and the consent opt-in for it (no Langfuse account yet). Until then, tester mode and the server log cover the owner's own tests.
- Milestone 0 comparison with the owner's picks recorded first; tuning the stack window, hash threshold, time bonus, balance, blank-line cost and weak-match margin.
- Mix (Milestone 2); text on images (to reconsider after real posts).

**Known limits:** Google's models are sometimes overloaded ("high demand"); matching then retries briefly and may search with the user's lines as written; consent is asked again when the writing or photos change after matching; the product name appears as plain text in the screens' copy (rename by search and replace in `web/src/components`); Vercel keeps runtime logs for about 30 minutes.

**Also open:** landing page wording (owner will edit; keep "Your camera roll, your story."); tests for photos from two phones with and without time zones and many photos at once; optional shorter address such as `inkreel-app.vercel.app`; the site has no icon (favicon 404).
