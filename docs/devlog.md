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
