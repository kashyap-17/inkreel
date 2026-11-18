# Inkreel

**Your camera roll, your story.**

Inkreel turns a camera roll full of photos into posts worth sharing, without losing what made them yours. You write first, in your own words or as a few rough thoughts, and Inkreel finds the photos in your album that go with them, with a short reason for each, then gives you a carousel and caption ready to post.

*README prose: about 1,930 words, tables included (code, setup commands and commit links not counted).*

## Project status

**Works, and is deployed** (tested on an Android phone with real photos):

- **I have writing:** paste or type anything. Your words are never changed: Inkreel splits them into parts in code, and the caption is your writing exactly as typed.
- **Write with Inkreel:** jot a few words under four labels (a moment, a place or thing, how it felt, anything else). Gemini drafts 2–4 lines from them, with named places as hashtags. Each line shows which thoughts it came from, your own words are highlighted, and you can edit, drop or redraft any line.
- **Matching:** an LLM turns each line into photo searches, image embeddings score your photos, code splits the writing and picks a photo for each part, and the LLM checks each pick and writes a short reason.
- **Review and share:** swap, add or remove photos, move a line, change the number of photos, undo; then a 4:5 carousel and caption, shared through the phone's share sheet.
- **On the phone:** photos are read, copied, checked for blur and exposure, and near-identical shots stacked, all in the browser. Nothing leaves the phone until you consent, and then only small copies without location.
- **Failure paths:** backup requests when the AI hangs or is busy, a progress bar that always moves, "match by hand" when you decline consent, and weak matches flagged.

**Simulated:** the browser tests answer for the server with staged replies (busy, slow, rejected), so failure paths can be replayed without Gemini.

**Not finished:**

- Text on the images, rather than only in the caption.
- Keeping your swapped photos when you add more photos after matching (everything is matched again now).
- Converting HEIC photos that the browser can't open.
- Testing so far is qualitative, on my own photos and writing; there are no metrics yet. A study of match quality and ownership with other people is planned.
- Not planned for now: a third mode with AI lines suggested inside your own writing. Write with Inkreel, with every line editable, covers most of that need.
- Known limits: Google's models are sometimes overloaded, and the drafting model still invents small details in some drafts.

## Technology stack

| Part | Technology | What it does |
|---|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript, plain CSS | The screens, and the small server routes that call the AI |
| Hosting | Vercel | Builds every push to `main`; holds the API key |
| Flow | A typed reducer | Steps, edits and undo, saved on the device (IndexedDB) |
| Photos | exifr, canvas | Capture times; working copies, sharpness, exposure, perceptual hashes |
| Checks | Zod | Every request and reply validated, in the browser and on the server |
| AI SDK | `@google/genai` | Calls to Gemini with structured (JSON) output |
| Embeddings | Gemini Embedding 2 | Photos and search phrases into vectors, compared in code |
| LLM | Gemini 3.5 Flash-Lite | Search phrases per line; checking each match and writing its reason; drafting lines |
| LLM (off) | Gemini 3.6 Flash | Drafting, behind one switch in `web/src/config/ai.ts`; slower and often busy in tests |
| Tests | Vitest, Playwright | 119 unit tests; 17 browser tests in real Chrome (2 of them call Gemini) |

Still undecided: whether photo embeddings move to an on-phone model, for privacy; the scoring weights; Flash or Lite for the photo searches; tracing for testers (Langfuse is planned).

## Running or inspecting the work

**Live app:** [inkreel-eight.vercel.app](https://inkreel-eight.vercel.app). It asks for an invite code, which isn't published, so the deployed app can't be used up by visitors. To try Inkreel, run your own copy with your own key (below).

**Inspect without any key.** The browser tests run the whole flow in Chrome with staged server answers; nothing is sent to Gemini.

```sh
cd web
npm ci                  # Node 26 (see web/.nvmrc)
npm run check           # type check, lint, 119 unit tests
npm run test:browser    # the whole flow in Chrome; see docs/testing.md
```

**Run it on your computer.** You need your own Gemini API key, from [Google AI Studio](https://aistudio.google.com/apikey). Never commit it.

```sh
cd web
cp .env.example .env    # then set GEMINI_API_KEY in .env
npm run dev             # http://localhost:3000
npm run dev:phone       # also reachable from a phone on the same Wi-Fi
```

**Run your own copy on Vercel.**

1. Fork this repository.
2. In Vercel, add a new project from your fork and set its **Root Directory** to `web`.
3. Add two environment variables: `GEMINI_API_KEY` (your key) and `INVITE_CODE` (a long code you choose). Without `INVITE_CODE`, the deployed server refuses every AI call, so a public address can't use up your key.
4. Deploy, open the address, and enter your invite code on the start screen.

Which model each call uses is set in `web/src/config/ai.ts`.

**Replay a prompt experiment** (uses your key): `npm run experiment -- experiments/drafts/v11-line-sources.exp.ts`. See `web/experiments/README.md`.

## Development record

The significant changes, why they were made, and what was checked. The full log is `docs/devlog.md`; each decision and its reasons are in `docs/decisions.md`.

| Date | Change | Why, and whose call | Checked | Commits |
|---|---|---|---|---|
| 7 Nov | Plan, decisions, first build | A words-first flow; most work on the phone; one small server only to hold the key. Claude proposed the stack; I changed it to Android and Gemini | Stack and model terms against Google's documentation | [9b43eb8](https://github.com/kashyap-17/inkreel/commit/9b43eb8), [0ef58ff](https://github.com/kashyap-17/inkreel/commit/0ef58ff) |
| 7 Nov | Rebuilt words first | My correction: the first screen described only photos, against the plan | Clicked through in Chrome | [1c400e1](https://github.com/kashyap-17/inkreel/commit/1c400e1) |
| 8 Nov | Inkreel splits the writing, not the person | My correction: people write before they know which photos they have | Unit tests for sentence splitting; checked in Chrome | [d890f0c](https://github.com/kashyap-17/inkreel/commit/d890f0c) |
| 8 Nov | Photo search instead of photo descriptions | My proposal: embeddings scale to any number of photos; an LLM rewrites feelings into what a camera would see | Research on text-to-image retrieval (sources in `docs/decisions.md`) | [f6cbf9c](https://github.com/kashyap-17/inkreel/commit/f6cbf9c) |
| 10 Nov | Core loop end to end; "moments" replaced by stacks of near-identical shots | My call, from my own album: good, different shots fell within minutes of each other | 61 unit tests; the whole flow in Chrome | [0f4976b](https://github.com/kashyap-17/inkreel/commit/0f4976b) |
| 13 Nov | Photo errors reported; stanzas kept; several readings per line | My first phone test: photos failed to open, a couplet was split, searches invented details; several readings per line was my idea | Error reports in the server log; 74 unit tests; the full flow in Chrome | [904e60b](https://github.com/kashyap-17/inkreel/commit/904e60b), [9b932e2](https://github.com/kashyap-17/inkreel/commit/9b932e2), [3f96e7f](https://github.com/kashyap-17/inkreel/commit/3f96e7f) |
| 16 Nov | Photo count control; more photos than lines; weak photos set aside | My review of the copy: "add just the photos you want" didn't hold for short captions; I asked for blurry photos to be set aside | 90 unit tests; Chrome runs with drawn test photos | [35cca94](https://github.com/kashyap-17/inkreel/commit/35cca94), [81e3a8d](https://github.com/kashyap-17/inkreel/commit/81e3a8d), [6f8157a](https://github.com/kashyap-17/inkreel/commit/6f8157a) |
| 16 Nov | Browser tests saved in the repo | I asked for tests that can be repeated; earlier run-throughs were throwaway scripts | Caught an empty "Add a photo" list on the first run | [d3e26c6](https://github.com/kashyap-17/inkreel/commit/d3e26c6) |
| 16 Nov | Matching that never gets stuck | My phone test: matching took about 10 minutes while Gemini was busy; I asked for a progress bar | Server log per call; next phone test matched in 8 s | [8f688ba](https://github.com/kashyap-17/inkreel/commit/8f688ba), [e19ca20](https://github.com/kashyap-17/inkreel/commit/e19ca20), [8425050](https://github.com/kashyap-17/inkreel/commit/8425050) |
| 16 Nov | Picked photos copied before decoding | Android withdrew access partway through (up to 28 of 32 photos failed) | Reproduced in Chrome: 4 of 30 before, 30 of 30 after | [9bf8ede](https://github.com/kashyap-17/inkreel/commit/9bf8ede) |
| 16 Nov | Write with Inkreel; invite code on the start screen | A way in for people without writing; moving the invite code to the start was my call | 15 browser tests; one live draft | [3ecc9e3](https://github.com/kashyap-17/inkreel/commit/3ecc9e3) |
| 16–17 Nov | Draft prompt, versions 2 to 11 | I rejected drafts that listed my answers back and set the new direction: thoughts as hints, places as hashtags, sources on every line | Each version run on the same answer sets; outputs in `web/experiments/` | [ed8ba69](https://github.com/kashyap-17/inkreel/commit/ed8ba69), [12b245d](https://github.com/kashyap-17/inkreel/commit/12b245d), [bcd2136](https://github.com/kashyap-17/inkreel/commit/bcd2136), [4ea2457](https://github.com/kashyap-17/inkreel/commit/4ea2457) |
| 17 Nov | Backup requests for photo indexing | My phone test: matching stalled at "23 of 29" on one hung request | Unit tests for backups; real matching in 23 s | [ab2f3bc](https://github.com/kashyap-17/inkreel/commit/ab2f3bc) |
| 17 Nov | Flow and architecture diagrams as built | The plan's diagrams were out of date | Checked against the code | [df1b5a9](https://github.com/kashyap-17/inkreel/commit/df1b5a9) |

## AI assistance

**Tools.** I built Inkreel with the assistance of [Claude Code](https://claude.com/claude-code) (Anthropic's coding agent, Claude Opus models). I set the direction, made the design decisions and tested on my phone; Claude Code generated code, tests, prompt experiments and documentation from my instructions, which I reviewed and changed. It also helped draft this README and my project report. Gemini is not an assistant here: it is the model inside the app.

**What I asked for, and what I changed.** A few examples (more in `docs/devlog.md`):

- Asked for an MVP stack. It assumed an iPhone and the Claude API; I chose Android, which I use, and Gemini, for cost.
- It proposed asking questions next to each group of photos. I rejected that because it makes the flow photo-first; we checked the research on story-led photo telling and kept words first.
- I proposed matching by search: an LLM rewrites each line for an image-embedding model, instead of describing every photo. Claude checked the research and built it.
- It drafted captions that listed my answers back. I rejected prompt versions 2 to 8 and set the direction for 9 to 11: thoughts as hints, places as hashtags.
- It deleted finished experiment scripts. I asked that every experiment be kept; they are now in `web/experiments/`.

**How I checked the results.**

- Every change runs the unit tests (`npm run check`); screen changes also run the browser tests in Chrome.
- I tested each significant change on my phone with my own photos, with tester mode sending a record of the session to the server log, which I read with Claude.
- It made mistakes that these checks caught: a `.gitignore` rule that hid a code folder from the first deploy; agreeing with my description of a draft before seeing my inputs (each draft is now logged); misreading a Gemini quota error (corrected in the experiment results).
- Every reference in my reports was imported into Zotero from its DOI or ISBN record and checked against the paper. Every number in the report was checked against the development log and the test output.

## Original, reused and assisted work

- **Original (mine):** the idea and positioning, every design decision recorded in `docs/decisions.md`, the direction for each prompt and the verdict on its output, the phone tests, the screenshots, and the literature review.
- **Reused:** open-source libraries under their own licences (Next.js, React, Zod, exifr, `@google/genai`, Vitest, Playwright); Google's Gemini models through their API. No code was copied from other projects.
- **Assisted:** code, tests, prompt experiments, documentation and report drafts, produced with the assistance of Claude Code from my instructions and reviewed by me, as described above.

## Additional files

- `docs/`: the build plan with the flow and architecture diagrams (`plan.md`), decisions and their reasons (`decisions.md`), the development log (`devlog.md`), how it's tested (`testing.md`), and market notes (`market.md`).
- `web/experiments/`: prompt experiments with their outputs.
- `acad_docs/`: my literature review (Assignment 1, `lit_review/`, PDF and LaTeX) and the project report (`project_report/`, PDF and LaTeX).
- **Not in the repository:** the report's figure images and the phone screenshots, kept on my computer; the report PDF, which includes them, is in `acad_docs/project_report/`. No ZIP file is needed.

## Licence

MIT with the Commons Clause (see `LICENSE`). You may use, copy and modify Inkreel if you keep the copyright and licence notice, but you may not sell it, or a paid product or service whose value comes entirely or mainly from it. This makes it source-available, not open source.
