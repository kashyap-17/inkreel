# Inkreel

Inkreel turns a trip album with hundreds of photos and videos into shareable posts that still sound like the person who took them. The user adds their own thoughts or writing (or answers light prompts); Inkreel groups the photos into moments, matches each piece of writing to the right moment, explains why, and lets the user swap anything.

**Start here:** `docs/plan.md` (what to build, in milestone order; next up is Milestone 0, the feasibility test) and `docs/decisions.md` (what's decided and why).

Original background, research and open questions: `acad_docs/initial_handover.md`. Where it differs from `docs/`, `docs/` is newer.

## Guiding principle
- Build Inkreel as a real, useful product. Make every decision from a product perspective.
- Any extra context the owner has given (e.g. in `acad_docs/`) stays out of code, comments, README, docs and product copy unless the owner explicitly asks.

## Product rules (agreed direction)
- **The user's own words are never reworded** in "fully yours" mode. Splitting, ordering and choosing which pieces to use are allowed.
- **Provenance is always visible:** AI-written text is marked differently from the user's words.
- Three authorship modes: AI writes from the user's prompts/answers · fully the user's writing · hybrid (AI suggestions accepted or rejected one by one).
- **Match writing to moments, not individual photos.** The user picks the photo within a moment.
- Every match shows a short reason, and every match can be swapped.
- Positioning must lead with the real benefit: from a huge trip album to shareable posts, keeping the user's voice and personality.

## Scope (MVP first)
- Core loop to build first: paste/type own writing → group photos into moments → match with reasons → swap → carousel output.
- Not in the MVP: reels, video, handwriting photos, song suggestions, Google Photos Picker API, MCP connections. (Photos from Google Photos come in through the phone's normal upload.)
- The owner tends to over-scope. Push back on new features that aren't needed for the core loop and suggest deferring them.

## Decided
- Stack, platform, photo input, backend, model and output: see `docs/decisions.md`. Follow it; propose changes there rather than working around it.

## Not decided yet (don't assume)
- Matching approach (feasibility test compares options; see "Open" in `docs/decisions.md`), license.
- Propose options with trade-offs; let the owner decide.

## Privacy
- Never commit personal photos, diary pages, data exports (e.g. Google Takeout) or `.env` files.
- Send the minimum necessary data to external APIs.

## Naming and brand
- Never use "Insta" or "Gram" in names (Instagram brand guidelines). Use "[Name] for Instagram" if needed.
- "Inkreel" is a working name: another AI product uses it (see `docs/market.md`, "Name check"). Keep the name easy to change: no hard-coded domain, name in one config place.

## Where things go
- `README.md`: for people visiting the repo. Brief and explanatory: what Inkreel is, how it works, status, how to run it. No internal decisions or rules.
- `.claude/CLAUDE.md` (this file): rules and conventions for working in the repo.
- `docs/decisions.md`: detailed technical decisions and their reasons, added as each one is made.
- `docs/plan.md`: the build plan: flow, architecture, what the system may do, model calls, milestones. Follow it; update it when the plan changes.
- `docs/market.md`: competitors and how Inkreel is different. Recheck before positioning or launch decisions.
- `docs/devlog.md`: development log of meaningful AI use.

## Working conventions
- Keep a development log of meaningful AI use (prompts, decisions, what changed).
- Commands and folder structure will be added here once the app is set up.
