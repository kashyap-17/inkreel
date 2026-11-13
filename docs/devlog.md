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

## Where things stand (10 Nov 2026)

**Done:** the core loop for "I have writing", end to end: words with a live photo estimate → photos (working copies, stacks) → consent → matching with reasons → review (swap, move a line, caption only, fewer/more, undo) → preview and share. The draft is saved on the device and survives a reload; the back button moves between steps. Not yet deployed with the new code.

**Before the next deploy (owner):** in Vercel's project settings, add `GEMINI_API_KEY` and `INVITE_CODE` (any phrase you'll type on the consent screen). Without `INVITE_CODE` the deployed server refuses every model call. Locally `INVITE_CODE` is optional; `web/.env.example` lists the names.

**Waiting on the owner:** a real-trip test on the phone (does the chunking and choice of photos make sense; are the reasons right; is anything confusing); the owner's review of the app and its copy; whether Google Photos albums appear after choosing Google Photos as the picker's cloud media app.

**Not built yet (in the plan):**
- Setting aside blurry, badly exposed and screenshot photos ("view set-aside photos"); HEIC conversion when the browser can't decode it.
- Reordering and dropping cards (caption only covers dropping a photo); "one photo" as a single tap; keeping swapped cards when photos are added after matching (adding photos currently re-matches everything).
- Langfuse tracing and the consent opt-in for it (no Langfuse account yet). Until then, the test record covers the owner's own tests.
- Milestone 0 comparison (four ways of choosing photos) with the owner's picks recorded first; tuning the stack window, hash threshold, time bonus, balance and weak-match margin.
- Help me write and Mix (Milestone 2); text on images (Milestone 3).

**Known limits:** the search-query call on Flash can take up to ~40 seconds; consent is asked again when the writing or photos change after matching; the product name appears as plain text in the screens' copy (rename by search and replace in `web/src/components`).

**Also open:** landing page wording (owner will edit; keep "Your camera roll, your story."); tests for photos from two phones with and without time zones, the HEIC full-file read, and many photos at once; optional shorter address such as `inkreel-app.vercel.app`.
