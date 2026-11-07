# Decisions

Technical and product decisions for Inkreel, with the reason for each. Newest changes are noted with a date. If a decision changes, update its entry and say why.

## Flow: words first, in every mode (7 Nov 2026)

The user starts with their thoughts, feelings and words, and adds photos after. Inkreel then finds the photos that fit the words. This is what sets it apart: other tools start from the photos and write words for them.

The first screen asks how the user wants to tell the trip:
- **I have writing** (fully yours): paste or type; used exactly as written.
- **Help me write** (AI writes from your input): a few light questions about the whole trip, answered before any photos are added (a word for how it felt, the highlight, who you were with, a moment you didn't photograph). The AI writes from the answers only.
- **Mix** (hybrid): the user's writing stays; the AI suggests extra pieces (whole new lines, never edits to the user's lines), each accepted or rejected. MVP version: a list of suggested pieces with accept/reject, not inline tracked changes.

All three modes end in the same thing: one write-up, as a list of pieces, each marked as the user's or the AI's. Everything after that is identical for every mode: photos → matches → preview and share. The AI never sees the photos while writing.

- **Not chosen:** per-moment questions shown next to photos. That makes the flow photo-first, like existing AI travel journals.
- **Build order:** fully yours first, then help me write, then mix. Help me write is how people without writing get in; mix has the most UI and the fiddliest rules, so it goes last. The first screen shows all three from the start, unbuilt ones marked "coming soon".
- **Provenance:** AI text always looks different from the user's words, with a toggle in the preview to keep or hide the marking in the final post.

## Platform: responsive web app (7 Nov 2026)

Inkreel runs in the browser on phone and desktop. Nothing to install.

- **Why:** one codebase for Android, iPhone and desktop; testers only need a link; no app store.
- **Not chosen:** native Android. Its only real advantage is reading photo location, which grouping doesn't depend on.
- **Later, if needed:** adding to the home screen (PWA) so Inkreel appears in Google Photos' Share menu.

## Stack: TypeScript + Next.js on Vercel (7 Nov 2026)

One TypeScript project for the interface and a small server part.

- **Why:** the photo processing has to run in the browser, which means JavaScript, so one language covers everything. Vercel's free tier hosts it.
- **Not chosen:** a separate Python backend. Only worth it if embedding experiments outgrow the browser.

## Hosting: Vercel address, no custom domain yet (7 Nov 2026)

The app runs on Vercel's free Hobby plan at a `.vercel.app` address (for example `inkreel.vercel.app`, if free). HTTPS is included, which the phone's share sheet needs. API keys (Gemini, Langfuse) live in Vercel's environment settings, never in the code.

- **Why:** free, enough for building and testing with an invite link.
- **Revisit before a public launch:** Vercel's Hobby plan is for personal, non-commercial use, so charging or running Inkreel as a business means Vercel Pro or another host such as Cloudflare. Buy a domain at the same time.
- **Name:** "Inkreel" is a working name. Another AI product already uses it (see "Name check" in `market.md`). Run a UK and US trademark search before launch, then decide on the name and the domain together.

## No LLM framework (7 Nov 2026)

No LangChain or LangGraph. Plain TypeScript, with:
- Google's Gen AI SDK (`@google/genai`) for the model calls, using its structured-output option.
- Zod for the output schemas and the checks on every reply.
- The flow as a typed state machine in the browser (a reducer). XState if it grows; it implements statecharts, the same idea as the flow graph in `plan.md`.

- **Why:** the workflow is about ten steps with two to four model calls, and most of it runs in the browser. LangGraph is built for long-running, server-side agent graphs with saved checkpoints; LangChain wraps model calls in its own layer. Both would add a large dependency and hide the exact prompt sent, which we need to see to tune it.
- **Revisit if:** we add an agent for free-form edits (see "Changes the user makes" in `plan.md`).

## Tracing: Langfuse (7 Nov 2026)

Every model call is traced in Langfuse from the server function: prompt version, input, reply, validation result, retries, time and tokens, plus what the user did with each match.

- **Why:** prompt tuning needs to see exactly what was sent and what came back, and to compare prompt versions on the same test set. Seeing which matches users swap shows where matching fails in real use.
- **Limits, because the content is personal:** text only, never photos. On for the owner's own trips; for anyone else only with a separate opt-in on the consent screen. EU data region.
- **Prompts stay in the code,** versioned in git; Langfuse records which version ran. Its prompt management isn't needed.
- **Trade-off:** traces sit with a third party. Self-hosting Langfuse is possible if that becomes a problem.

## Backend: one small server function, nothing stored (7 Nov 2026)

Almost everything runs in the browser. The server only holds the AI API key and passes requests to the model.

- **Why:** an API key in browser code can be copied by anyone who opens the page.
- **No database, no file storage, no accounts in the MVP.** Drafts are saved in the browser (IndexedDB). The server keeps nothing.
- **Trade-off:** a draft can't be resumed on another device. Long-term memory (corrections, people and places) will need a database later.
- **Access:** an invite code for testers, so the public URL can't use up the AI quota. Outside testers need the paid Gemini tier first (see "AI model").

## Photo input: plain upload from the browser (7 Nov 2026)

The user picks photos with the browser's upload button. On Android 12 and later the system photo picker shows the Google Photos library, including albums.

- **Why:** no Google sign-in, works on every device.
- **Not chosen for now:** the Google Photos Picker API. It needs OAuth, and its downloads have no location data either.
- **Images only.** Videos are skipped.
- **To verify:** that capture time survives when picking from Google Photos (first check in the feasibility test).

## Location data is a bonus, not a requirement (7 Nov 2026)

Phone browsers usually strip GPS from uploaded photos (iPhone since iOS 16.4; Android removes it unless an app has a special permission). Google Photos' API strips it too.

- **So:** moments are grouped by capture time. Location is used only when present.

## Processing in the browser (7 Nov 2026)

Before anything is sent anywhere, the browser:

1. Reads EXIF (capture time, time-zone offset, GPS if present).
2. Sets aside screenshots, near-duplicates (perceptual hash) and very blurry or badly exposed photos (Laplacian variance, histogram). Set-aside photos can be viewed and restored; the only photo of a moment is never set aside.
3. Resizes the rest to a ~1080px working copy. Originals stay on the device.
4. Groups photos into moments: a new moment after a time gap (start at ~45 min, tune in testing) or a location jump when GPS exists; very long moments are split.
5. Picks 1–3 representative photos per moment: sharpest, spread across the moment.

- **Why:** free, fast, and only a few resized photos per moment ever leave the device.

## AI model: Gemini API free tier, Flash Lite for volume, Flash for judgement (7 Nov 2026)

Used to describe each moment (from its representative photos), to match writing to moments with a reason, and to write lines in "help me write" and "mix".

**Which model for which call:**

| Call | Model | Why |
|---|---|---|
| 1. Describe moments (images) | Gemini 3.5 Flash Lite | Several requests per trip; needs the higher limits. Descriptions are factual, the easier task. |
| 2. Match (text) | Gemini 3.6 Flash | One request per trip; the judgement the product depends on. |
| 3. Help me write (text) | Gemini 3.6 Flash | One request; writing that goes into the user's post. |
| 4. Mix suggestions (text) | Gemini 3.6 Flash | Same reason as call 3. |

Free-tier limits on the owner's project (AI Studio, 7 Nov 2026):

| Model | Requests/min | Tokens/min | Requests/day |
|---|---|---|---|
| Gemini 3.6 Flash | 5 | 250K | ~20 |
| Gemini 3.8 Flash | 5 | 250K | ~20 |
| Gemini 3.5 Flash Lite | 15 | 250K | ~500 |
| Gemma 4 31B | 30 | 16K | 14,400 |

- **Budget per trip:** a few Lite requests for describing, two or three Flash requests at most, so about 7 full trips a day on Flash. Requests are queued to stay under the per-minute limits and retried on a rate-limit error.
- **If Flash's daily quota runs out:** the call falls back to Lite, and the trace records which model ran.
- **Model per call is a setting,** not hard-coded, behind one small interface.
- **Compared in Milestone 0:** whether Lite's descriptions are good enough (spot-checked against Flash on one trip); Gemini 3.8 Flash and Gemma 4 31B (`gemma-4-31b-it`) against 3.6 Flash for matching. Gemma's daily limit suits repeated prompt tuning, but its 16K tokens/min makes describing photos slow, and its JSON output is undocumented, so it is tested first.
- **Not chosen:** preview models (tighter limits, can be retired on two weeks' notice); Gemini 2.5 models (deprecated, redirected to newer models from 1 Dec 2026).
- **Not available:** Claude Pro doesn't include API access.

**Terms (Gemini API Additional Terms, effective 23 Mar 2026):**
- In the UK, EEA and Switzerland, the paid-service data terms apply to free use too, so prompts and replies aren't used to improve Google's products.
- **Free tier is for the owner's own testing only.** The terms allow only Paid Services for an app made available to users in the UK, EEA or Switzerland. Before anyone else gets the invite link, move to a Cloud project with billing on. Gemma appears to be free-only on the Gemini API, so for outside users it would need another host (its weights are open, Apache 2.0).
- **Users must be 18 or over,** and the app must not be aimed at under-18s.

## Output: carousel + one caption, then text on images (7 Nov 2026)

- **First:** an ordered set of photos plus one caption made of the user's pieces in slide order. Instagram allows one caption per carousel (up to 20 slides).
- **Next:** an optional "text on images" toggle with one fixed style (bottom of the image, soft gradient, one font that shrinks to fit). Slides drawn in the browser with canvas.
- **Rule:** the user's words are never shortened to fit. A piece that's too long is offered for splitting.
- **Sharing:** the phone's share sheet (Web Share API) or download. Posting to Instagram stays manual.
- **Later:** single photo + caption, reels.

## Open

- **Matching approach.** The feasibility test compares, on the same trip:
  - A: CLIP/SigLIP embeddings + time cues, with template reasons. Free, no AI call.
  - B: Gemini describes each moment, then one text-only call matches all pieces to the descriptions and writes the reasons (the approach in `plan.md`).
  - An embedding shortlist before B is only needed if a trip has too many moments to fit in one call, which ~50 moments do not.
- **Time-gap threshold** for moments.
- **Optional aesthetic score** for choosing the best photo in a moment (LAION aesthetic predictor, NIMA, MUSIQ).
- **License.**
