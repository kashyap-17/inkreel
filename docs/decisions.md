# Decisions

Technical and product decisions for Inkreel, with the reason for each. Newest changes are noted with a date. If a decision changes, update its entry and say why.

## Flow: words first, in every mode (7 Nov 2026)

The user starts with their thoughts, feelings and words, and adds photos after. Inkreel then finds the photos that fit the words. This is what sets it apart: other tools start from the photos and write words for them.

The first screen asks how the user wants to tell the trip:
- **I have writing** (fully yours): paste or type; used exactly as written.
- **Help me write** (AI writes from your input): a few light questions about the whole trip, answered before any photos are added (a word for how it felt, the highlight, who you were with, a moment you didn't photograph). The AI writes from the answers only.
- **Mix** (hybrid): the user's writing stays; the AI suggests extra lines (whole new lines, never edits to the user's lines), each accepted or rejected. MVP version: a list of suggested lines with accept/reject, not inline tracked changes.

All three modes end in the same thing: one write-up, with each part marked as the user's or the AI's. Everything after that is identical for every mode: photos → matches → preview and share. The AI never sees the photos while writing.

- **Not chosen:** per-moment questions shown next to photos. That makes the flow photo-first, like existing AI travel journals.
- **Build order:** fully yours first, then help me write, then mix. Help me write is how people without writing get in; mix has the most UI and the fiddliest rules, so it goes last. The first screen shows all three from the start, unbuilt ones marked "coming soon".
- **Provenance:** AI text always looks different from the user's words, with a toggle in the preview to keep or hide the marking in the final post.

## Inkreel chunks the writing, not the user (7 Nov 2026)

The user writes freely and doesn't split anything. Inkreel decides where the writing breaks between photos, at matching time, because only then does it know the moments. (Updated 8 Nov: chunking is done in code from the photo-search scores, not by an LLM.)

- **How:** plain code splits the text into sentences (a line break also ends one, so each line of a poem is a sentence). Matching then groups consecutive sentences into chunks and picks a moment for each, using how well each sentence fits each moment (see "Photo selection" below). Chunks are built only from whole sentences in order, so they join back into the exact text. Words are never changed, cut or reordered.
- **The user adjusts on the review screen:** move a sentence to the card before or after, split or join cards, or ask for fewer photos, more photos or one photo.
- **Why:** the product is words first, so the user writes before knowing which photos they have. Asking them to split their writing into one piece per photo pushes the hard part onto them.
- **Not chosen:** the user splitting the writing into pieces (by paragraph or line, with join) before photos. It was built first and dropped the same day.

### Photo estimate on the words screen

So the user has an idea of the post's size before adding photos, a live line under the text box: "About 4–6 photos. You can change this after matching."

- **Rule:** count words and sentences. Fewest = the larger of words ÷ 40 and sentences ÷ 4. Most = the largest of words ÷ 25 and sentences ÷ 2. Never more than the number of sentences; at least 1; at most 20 (Instagram's limit). Round up.
- **Examples:** a 20-word, 6-line poem → 2–3; one 50-word sentence → 1; 150 words in 9 sentences → 4–6; 600 words in 40 sentences → 15–20, with a note that Instagram allows 20.
- **After photos are added:** capped at the number of moments. **After matching:** the real count, changed with fewer/more/one photo.
- **Tuning:** 25, 40, 2 and 4 are starting values, adjusted on real trips.
- **Not chosen:** paragraphs or stanzas as the guide (the owner preferred not to depend on layout); words alone (a short poem of many lines came out as one photo).

## Photo selection: an LLM writes search queries, embeddings choose the photos (8 Nov 2026)

Proposed by the owner and checked against research. Replaces "Gemini describes 1–3 photos per moment, then a text call matches writing to the descriptions".

**How it works:**
1. **Index the photos:** one image embedding per kept photo (after blurry shots, duplicates and screenshots are set aside), with Gemini Embedding 2. Embeddings are saved on the phone (IndexedDB), so re-running matching never re-sends photos.
2. **Search queries (text only, Gemini 3.6 Flash):** for each sentence, with the whole write-up as context, the LLM writes a short literal description of a photo that would fit (setting, subjects, time of day, light, weather, activity) and a time hint if the text has one ("morning", "day two"). The queries are internal, never shown as the user's text; the user can see "what Inkreel looked for".
3. **Match and chunk (plain code):** each sentence's query is embedded and scored against every photo; a moment's score is its best photo's score, plus a bonus when the time hint agrees with the moment's time. Code then groups consecutive sentences into chunks within the photo estimate, choosing the breaks and moments that fit best overall, without reusing a moment, and picks the best-fitting photo inside each moment.
4. **Check and explain (small images, Gemini 3.5 Flash Lite):** for each chunk, only the chosen photo and two alternatives are sent. The model confirms or flags the match and writes the one-line reason naming something visible.

**Why:**
- **Scale:** an embedding is computed once per photo and reused for every search; an LLM judging photos costs more with every photo and every query. Works for 23 photos or 500.
- **Quality:** on a hard text-to-image test (25 near-identical candidates per caption), Gemini Embedding 2 was statistically level with GPT-4.1 and Claude Sonnet 4.6 (R@1 0.80, 0.79, 0.80) ([Dutta and Kanungo 2026](https://arxiv.org/abs/2608.11343)).
- **Feelings-text needs rewriting first:** CLIP-type models are trained on short literal captions and have shallow language understanding ([positional bias in multimodal embeddings](https://arxiv.org/pdf/2511.11216); [EMNLP 2025](https://aclanthology.org/anthology-files/pdf/emnlp/2025.emnlp-main.709.pdf)). Having an LLM rewrite the text into visual descriptions measurably improves retrieval ([VisRet](https://arxiv.org/abs/2505.20291); [GRAPE](https://www.arxiv.org/pdf/2509.23370)).
- **Same shape as Google Photos' "Ask Photos":** vector search for candidates, then Gemini reviews only the returned photos ([Google, 2024](https://blog.google/products/photos/ask-photos-google-io-2024/)).
- **Better than describing moments:** that sent 1–3 photos per moment to an LLM, lost detail, didn't scale, and couldn't choose the best photo within a moment.

**Gemini Embedding 2** (`gemini-embedding-2`, stable): text and images in one space; PNG or JPEG; one photo per entry (several images in one entry give one merged vector); dimensions 128–3072 (768 planned). No `task_type` field; text prefixes instead, to be tested. Free-tier limits on the owner's project: 100 requests/min, 30K tokens/min, 1,000 requests/day, so about 100 photos a minute and ~1,000 photos a day. Tokens per image aren't published; measure in Milestone 0. For very large trips, index up to ~5 varied photos per moment.

**Compared in Milestone 0** (owner's 23-photo trip, against the owner's own picks): raw text into an embedding model; LLM queries + an on-phone model (MobileCLIP2 or SigLIP 2 via Transformers.js); LLM queries + Gemini Embedding 2; the old describe-then-match. If the on-phone model is close in quality, switch to it: photos would then never leave the phone to be searched, only the few checked in step 4. Its download size and speed on the owner's phone are unknown.

**Not chosen:** ColPali (built for document pages, not photos); an LLM judging every photo (cost grows with every photo); describe-then-match (above).

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

The app runs on Vercel's free Hobby plan at a `.vercel.app` address: `inkreel-eight.vercel.app` (Vercel added "-eight" because `inkreel.vercel.app` belongs to InkReel.ai). Every push to `main` deploys; the Vercel project's root directory is `web`, where the app lives. HTTPS is included, which the phone's share sheet needs. API keys (Gemini, Langfuse) live in Vercel's environment settings, never in the code.

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
5. Picks 1–3 representative photos per moment for display (sharpest, spread across the moment). Matching uses every kept photo (see "Photo selection").

- **Why:** free and fast. What leaves the device is resized kept photos for indexing (after consent), and later only the few photos checked per chunk. If the on-phone model wins in Milestone 0, only those few.

## AI model: Gemini API free tier, Flash Lite for volume, Flash for judgement (7 Nov 2026; calls updated 8 Nov)

Used to index photos, write search queries, check matches and write reasons, and write lines in "help me write" and "mix".

**Which model for which call** (numbering as in `plan.md`):

| Call | Model | Why |
|---|---|---|
| 1. Index photos (images) | Gemini Embedding 2 | One request per photo; free limits fit ~100 photos a minute. |
| 2. Search queries (text) | Gemini 3.6 Flash | One request per trip; reading the user's writing well is the judgement the product depends on. |
| 3. Check and explain (small images) | Gemini 3.5 Flash Lite | A few requests per trip; confirming and naming a visible detail is the easier task. |
| 4. Help me write (text) | Gemini 3.6 Flash | One request; writing that goes into the user's post. |
| 5. Mix suggestions (text) | Gemini 3.6 Flash | Same reason as call 4. |

Free-tier limits on the owner's project (AI Studio, 7 Nov 2026):

| Model | Requests/min | Tokens/min | Requests/day |
|---|---|---|---|
| Gemini 3.6 Flash | 5 | 250K | ~20 |
| Gemini 3.8 Flash | 5 | 250K | ~20 |
| Gemini 3.5 Flash Lite | 15 | 250K | ~500 |
| Gemma 4 31B | 30 | 16K | 14,400 |
| Gemini Embedding 2 | 100 | 30K | 1,000 |

- **Budget per trip:** one embedding request per kept photo (once; saved on the phone), one or two Flash requests for queries, a few Lite requests for checking, so about 10 full trips a day on Flash. Requests are queued to stay under the per-minute limits and retried on a rate-limit error.
- **If Flash's daily quota runs out:** the call falls back to Lite, and the trace records which model ran.
- **Model per call is a setting,** not hard-coded, behind one small interface.
- **Compared in Milestone 0:** Gemini 3.8 Flash and Gemma 4 31B (`gemma-4-31b-it`) against 3.6 Flash for writing search queries (text only, so Gemma's 16K tokens/min is no obstacle and its daily limit suits prompt tuning; its JSON output is undocumented, so tested first). The embedding comparison is in "Photo selection".
- **Not chosen:** preview models (tighter limits, can be retired on two weeks' notice); Gemini 2.5 models (deprecated, redirected to newer models from 1 Dec 2026).
- **Not available:** Claude Pro doesn't include API access.

**Terms (Gemini API Additional Terms, effective 23 Mar 2026):**
- In the UK, EEA and Switzerland, the paid-service data terms apply to free use too, so prompts and replies aren't used to improve Google's products.
- **Free tier is for the owner's own testing only.** The terms allow only Paid Services for an app made available to users in the UK, EEA or Switzerland. Before anyone else gets the invite link, move to a Cloud project with billing on. Gemma appears to be free-only on the Gemini API, so for outside users it would need another host (its weights are open, Apache 2.0).
- **Users must be 18 or over,** and the app must not be aimed at under-18s.

## Output: carousel + one caption, then text on images (7 Nov 2026)

- **The user chooses where their words go:** in the caption, or on the images. Same matches either way.
- **First:** an ordered set of photos plus one caption made of the cards' text in slide order. Instagram allows one caption per carousel (up to 20 slides).
- **Next:** an optional "text on images" toggle with one fixed style (bottom of the image, soft gradient, one font that shrinks to fit). Slides drawn in the browser with canvas.
- **Rule:** the user's words are never shortened to fit. A card whose text is too long for an image is offered for splitting at a sentence break.
- **Sharing:** the phone's share sheet (Web Share API) or download. Posting to Instagram stays manual.
- **Later:** single photo + caption, reels.

## Open

- **Where photo embeddings run:** Gemini Embedding 2 (chosen to build first) or an on-phone model; decided by the Milestone 0 comparison (see "Photo selection").
- **Scoring weights:** how much the time hint counts against the photo score, and the score below which a match is marked weak; tuned on real trips.
- **Time-gap threshold** for moments.
- **Optional aesthetic score** for choosing the best photo in a moment (LAION aesthetic predictor, NIMA, MUSIQ).
- **License.**
