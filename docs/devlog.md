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

## Where things stand (end of 8 Nov 2026)

**Done:** start screen with the three modes; "I have writing" words step (free text, live photo estimate); photo step (EXIF time, time zone, GPS, file-date fallback, grouping into moments by time, day view). Deployed and tested on the phone (photo upload).

**Waiting on the owner:** the "Photo details" counts from a real trip ("Time saved in photo" vs "Placed by file date"), which answer whether capture time survives a Google Photos upload; and which break setting splits the trip sensibly.

**Next, in order:**
1. In the browser: set aside blurry, duplicate and screenshot photos; resize copies to send.
2. Consent screen (one approval per trip).
3. Server function with the Gemini key, invite code and Zod-checked replies. Call 1 (index photos, Gemini Embedding 2, saved on the phone), call 2 (search queries, 3.6 Flash), matching and chunking in code, call 3 (check and explain, Flash Lite). Needs `GEMINI_API_KEY` in `.env` and in Vercel's environment settings.
4. Milestone 0 comparison on the owner's 23 photos (four ways of choosing photos), with the owner's picks recorded first.
5. Review screen (swap, pick photo, move a sentence, fewer/more photos, weak matches), then preview and share (caption or text on images).
6. Langfuse tracing once calls exist (no Langfuse account yet).

**Also open:** landing page wording (owner will edit once more works; keep the headline "Your camera roll, your story."); keep the draft (words, photos) when the page reloads; tests for photos from two phones with and without time zones, the HEIC full-file read, and reading many photos at once; optional shorter address such as `inkreel-app.vercel.app`.
