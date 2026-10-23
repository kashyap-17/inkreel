# Inkreel

Inkreel turns a trip album with hundreds of photos and videos into shareable posts that still sound like the person who took them. The user adds their own thoughts or writing (or answers light prompts); Inkreel groups the photos into moments, matches each piece of writing to the right moment, explains why, and lets the user swap anything.

Full background, research and open questions: `acad_docs/initial_handover.md`. Read it before making product or architecture decisions.

## Guiding principle
- Build Inkreel as a real, useful product. Make every decision from a product perspective.
- Any extra context the owner has given (e.g. in `docs/HANDOVER.md`) stays out of code, comments, README, docs and product copy unless the owner explicitly asks.

## Product rules (agreed direction)
- **The user's own words are never reworded** in "fully yours" mode. Splitting, ordering and choosing which pieces to use are allowed.
- **Provenance is always visible:** AI-written text is marked differently from the user's words.
- Three authorship modes: AI writes from the user's prompts/answers · fully the user's writing · hybrid (AI suggestions accepted or rejected one by one).
- **Match writing to moments, not individual photos.** The user picks the photo within a moment.
- Every match shows a short reason, and every match can be swapped.
- Positioning must lead with the real benefit: from a huge trip album to shareable posts, keeping the user's voice and personality.

## Scope (MVP first)
- Core loop to build first: paste/type own writing → group photos into moments → match with reasons → swap → carousel output.
- Not in the MVP: reels, video, handwriting photos, song suggestions, Google Photos/MCP connections.
- The owner tends to over-scope. Push back on new features that aren't needed for the core loop and suggest deferring them.

## Not decided yet (don't assume)
- Matching algorithm, stack/platform, data connection (upload vs Google Photos Picker API vs MCP), output rendering, models, license.
- Propose options with trade-offs; let the owner decide.

## Privacy
- Never commit personal photos, diary pages, data exports (e.g. Google Takeout) or `.env` files.
- Send the minimum necessary data to external APIs.

## Naming and brand
- Never use "Insta" or "Gram" in names (Instagram brand guidelines). Use "[Name] for Instagram" if needed.

## Working conventions
- Keep a development log of meaningful AI use (prompts, decisions, what changed).
- Stack-specific commands and structure will be added here once chosen.
