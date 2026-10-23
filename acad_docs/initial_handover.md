# Handover: Inkreel

Everything decided so far, what is still open, and the research behind it, so work can continue in a new Claude Code project.

**Status (23 Oct 2026):** idea, name and positioning chosen. Nothing built yet. Next step is a one-day feasibility test (see section 10).

---

## 0. Guiding principle

**Inkreel is being built as a useful, valuable product.** Every decision is made primarily from a product perspective: what makes it genuinely worth using and sharing.

There is also a secondary academic evaluation lens (the work doubles as a university project). The owner may occasionally ask questions from that lens. **That lens should not appear in the repo's docs, README, code comments or product copy unless the owner explicitly asks.** It is mentioned only in this handover (section 9) for context.

---

## 1. The product

**Name:** Inkreel
**Title line:** Your camera roll, your story
**Tagline:** Bring your camera roll to life with your own stories.

**Core benefit (this must come through in all positioning):** going from a trip album with hundreds of photos and videos to shareable posts, while keeping your own thoughts, voice and personality, rather than generic AI captions.

**GitHub description:**
> Inkreel: turn a trip album with hundreds of photos into shareable posts that still sound like you.

**README intro:**
> **Inkreel** turns the hundreds of photos from your trip into posts worth sharing, without losing what made the trip yours. Add your thoughts, notes or writing, and Inkreel finds the moments in your album that go with them, so what you post carries your voice, not a generic caption.

(When reels are built, change "posts" to "posts and reels".)

**Full product description (vision, not all in MVP):**
> You come back from a trip with hundreds of photos and a head full of moments. Inkreel turns them into posts that sound like you. Write as much or as little as you like: answer a few quick prompts about how the trip felt and let the AI write the story, bring your own writing (a poem, notes from your phone, a snapped diary page) and keep every word, or mix the two, with the AI suggesting lines you can accept or reject. Either way, it's clear which words are yours and which are the AI's. Inkreel groups your photos into the moments of your trip and matches each line to the one that fits, by time, mood and feeling, telling you why it chose each. Post a single photo with the perfect caption, a carousel or a full reel, ready for Instagram, with song suggestions from what you were listening to on that trip.

---

## 2. AGREED DIRECTION

This is the current plan, not a final set of decisions: the feasibility test, building and user feedback can all change it. Items marked **(proposed)** came up in discussion but were not explicitly agreed by the owner.

### Product behaviour
- **Domain:** personal trip photos/videos + the person's own thoughts/writing → shareable posts.
- **Three authorship modes (a spectrum):**
  1. **AI writes from your input:** feelings, nudges and some free text via a light form → AI writes the story. Always grounded in the user's answers, never photos alone.
  2. **Fully yours:** uploaded/pasted/typed writing used exactly as written. Splitting and ordering allowed; rewording never.
  3. **Hybrid:** the user's writing stays; AI suggests additions/polish, accepted or rejected one by one (like tracked changes).
- **Provenance is always visible:** the editor marks AI-written text differently from the user's own words, with the option to keep or hide the marking in the final post.
- **Input options (side by side):** write now · paste/upload existing writing (.txt, .docx, PDF, notes export) · photo of handwritten pages (VLM reads it; original page image kept).
- **(proposed)** **Optional "need a nudge?" prompts** for writing now: feeling word / mood slider, highlight, who you were with, "a moment you didn't photograph".
- **Long existing writing is split** into pieces (stanzas / paragraphs / sentences); the user can merge/split and mark pieces as "text only".
- **Match writing to *moments*, not individual photos.** Photos are grouped into moments; the user picks the specific photo within a matched moment.
- **Every match shows a short reason** ("same evening; the still water matches 'nothing moved'"). The user can swap any match.
- **Outputs:** single photo + caption (matching reversed: photo → best line), carousel (one photo per line), reel (whole piece).
- **Songs are a minor extra:** suggestions of songs to add *inside Instagram* (via Instagram's own music library) from what the user listened to on the trip. Never export copyrighted audio; never show lyrics.

### Memory (system memory) — (proposed)
- **Session memory:** the aligned timeline, prompts already asked + answers, so prompts build on earlier answers and don't repeat.
- **Long-term memory:** people/places entities mentioned by the user; corrections to matches ("that's the palace, not the fort") reused later; prompt preferences (which question types the user answers vs skips); optional cross-trip retrieval (later).
- MVP: session memory + stored corrections + people/places.

### Build priority (MVP-first; avoid over-scoping)
MVP-first is agreed; the specific order below is **(proposed)**.
1. **Core:** mode 2 (own writing, paste/type) → moment grouping → matching with reasons → swap → carousel output. *If only this works, there is still a complete, usable product.*
2. Modes 3 and 1 (mostly prompting on the same engine).
3. Single-photo captions (reverse matching, cheap).
4. Later: reel output, handwriting photos, song suggestions, video.

### Naming (Inkreel chosen; availability checks pending)
- **Never use "Insta" or "Gram" in the product name.** Instagram's brand guidelines (since 2013) ban them for apps that work with Instagram. The approved format is "[Name] for Instagram".
- "Inkroll" is taken (an App Store notebook-indexing app). "Inkreel" showed no exact match in web searches; one adjacent app exists: "Ink: Text on Photo" (handwritten fonts for Stories/Reels). Before any launch, check UK IPO trademarks, domains, app stores and social handles.

### Repo setup — (proposed, owner to confirm)
- **.gitignore:** Node template (or Python if the backend is Python), plus:
  ```
  .env
  .env.*
  !.env.example
  photos/
  uploads/
  data/
  *.zip
  watch-history.json
  Takeout/
  .DS_Store
  Thumbs.db
  ```
  Personal photos, diary pages and data exports must never be committed.
- **License:** recommendation is **no license for now** (public but all rights reserved; keeps the option to productise). If open source is wanted later, AGPL-3.0 protects against competitors running it as a service while allowing dual-licensing (only while all code is owned). Avoid MIT if productising. Check the university's IP policy for student work.

---

## 3. OPEN QUESTIONS (not decided)

### 3.1 Matching algorithm — OPEN
Current *leaning* (simplest workable version, not final):
1. **Group photos into moments with plain code:** new moment on a 30–60 min time gap or a location jump. Drop screenshots, near-duplicates (bursts), very blurry shots. ~500 photos → ~30–60 moments.
2. **Describe each moment once:** a VLM captions 1–3 representative photos per moment: what, where, time of day, light/weather, energy (busy/empty, active/still). Mood comes from these words; no separate emotion model.
3. **One LLM call does the matching:** all moment descriptions + all writing pieces (+ optional mood hints from the form) → assign a moment per piece with a one-line reason.
4. **User picks the photo within the moment.**

Alternatives explored (possible experiments or comparisons):
| Option | Idea |
|---|---|
| A. Direct embedding (CLIP/SigLIP) | Baseline; weak on abstract lines |
| B. LLM rewrites the line into concrete visual cues | Cheap; helps abstract lines |
| C. Visualise-then-retrieve (VisRet) | Generate an image from the line, retrieve by image similarity |
| D. Caption-first, then text matching | Easy to inspect |
| E. Time filter first | Reliable when writing references days/sequence |
| F. VLM reranks a shortlist with a reason | Gives the explanation feature |
| G. Learn from user swaps (relevance feedback) | The interactive intelligence |

Open sub-questions: time-gap threshold; how many photos to caption per moment; how to use form mood hints; how swaps update later suggestions; whether embeddings are needed at all.

### 3.2 Data connection — OPEN (owner hopes MCP could handle this)
Not decided how photos, writing and listening history get into the system. Options and known constraints:
- **Plain upload from phone/computer:** simplest; recommended for the MVP regardless.
- **Google Photos:** since **31 Mar 2025** the Library API can only list/search/retrieve media *created by the app*. Access to an existing library must use the **Google Photos Picker API** (user selects photos/albums). Any MCP server built on the old Library API will not see the user's library. Verify that picked items include timestamps.
- **MCP:** investigate whether an existing MCP server (or one built for this) can wrap the Picker API / file access. Unverified. Using MCP as a *data layer behind Inkreel's own app* is fine; running Inkreel *inside* Claude/ChatGPT as a connector would hand the interface to the host, which is bad for the product.
- **Notes/writing:** paste, file upload, or photo of a handwritten page. Connectors to notes apps not explored.
- **Listening history (for song suggestions only):**
  - **YouTube Music** (owner's service): Google Takeout → "YouTube and YouTube Music" → History → JSON gives `watch-history.json` with timestamps, incl. music.youtube.com plays. Some report the JSON can be incomplete vs the HTML export; one tool author reports Takeout timestamps can be inaccurate. Filter music vs ordinary videos; times likely UTC.
  - **YouTube Data API: no** — watch history was removed in Sept 2016.
  - **ytmusicapi (unofficial):** browser-cookie auth, OAuth listed as broken; not suitable to build on.
  - **Google Data Portability API:** official OAuth route to the same data; available in the EU/UK; not for under-18s; app verification needed to publish (test-user mode probably fine early on — verify).
  - **Spotify:** Extended Streaming History export has timestamps per play.
  - Fallback: user tags a song per day manually.
- **Users' Claude/ChatGPT subscriptions can't be used** from Inkreel; consumer plans don't include API access.

### 3.3 Platform & stack — OPEN
Previous suggestion: mobile web app (PWA) + an LLM/VLM API + small DB (Supabase or SQLite). No native Android needed initially.

### 3.4 Output rendering — OPEN
How to render carousels/reels (client-side canvas? server-side video? export images for manual posting?). Posting to Instagram is manual; music is added inside Instagram.

### 3.5 Other open items
- Which VLM/LLM(s) to use.
- Exact form questions for mode 1.
- How hybrid suggestions are presented (inline diff? side panel?).
- Provenance styling in the final post.
- License and .gitignore final choice (recommendations in section 2).

---

## 4. Why it's differentiated (market gap)
Existing tools either **write for you from your photos** (AI travel journals) or **match text to stock/generated visuals** (text-to-video tools). None let people choose how much the AI writes, keep the story grounded in their own feelings and writing, match it to *their own* photos by meaning (time, mood, content), and show clearly whose words are whose.

---

## 5. Prior art & research

**Product landscape**
- AI travel journals that write *for* you from photos: Keep Travel, Triplium, Wander Bot, Journiary.
- Photo books / magazine layout from photos + text: Journi, BookletAI, MagGen.
- Text-to-video matched to stock/generated visuals: Pictory, VEED (own media swapped in manually), Medeo / FlexClip poetry videos.
- Apple Journal (suggests entries from photos, places, music); Rosebud (AI follow-up questions).
- Photos → AI-written stories: Storify.
- "Ink: Text on Photo" — handwritten fonts/captions for Stories and Reels (adjacent; not AI matching).

**Research**
- Draxler et al. 2024, *The AI Ghostwriter Effect*, ACM TOCHI — ownership high for self-written text, low for fully AI-generated; more influence → more ownership. https://arxiv.org/abs/2303.03283
- Sellen & Whittaker 2010, *Beyond Total Capture: A Constructive Critique of Lifelogging*, CACM — design around how human memory works; data as retrieval cues.
- Whittaker et al. 2012, *Socio-technical lifelogging*, HCI journal — principles: Selectivity, Embodiment, Synergy, Reminiscence. https://shura.shu.ac.uk/5415/
- *From Memory to Meaning: A Systematic Review of Reminiscence Technologies in HCI*, CHI 2026. https://dl.acm.org/doi/full/10.1145/3772318.3791453
- Slide2Remember (DIS 2022) — wall frame pairing photos with music heard in the same period. https://dl.acm.org/doi/10.1145/3532106.3533456
- Jin et al., *Generative AI in Supporting Music-based Reminiscence for Older Adults*, CHI 2024. https://dl.acm.org/doi/10.1145/3613904.3642800
- Baur et al. 2010, *LastHistory* (listening history + photos + calendar), IEEE TVCG.
- Retrieval methods: VisRet (visualise-then-retrieve); LLM/VLM query rewriting for interactive image retrieval (ICMR 2024, https://arxiv.org/abs/2404.18746); multimodal LLM query paraphrasing for video search (https://arxiv.org/abs/2407.12341).
- Lifelog retrieval: Lifelog Search Challenge review 2022–24 (https://arxiv.org/abs/2506.06743); captioning-enhanced lifelog retrieval (https://arxiv.org/abs/2510.04010); T-EAGLE temporal sequence matching (LSC'25).

---

## 6. User testing plan (product validation)
- Testers bring 30–60 photos from one recent trip.
- If they have existing writing from the trip, use it; otherwise they write ~10 minutes. Record which group each person is in.
- **Testers write (or bring writing) *before* uploading photos**, so the text isn't just descriptions of the pictures.
- Testers try two or three authorship modes on the same trip and compare.
- Measures: how meaningful the matches feel, sense of ownership, satisfaction, willingness to post.
- **Never ask testers to tag each photo** (that would do the matching for the system).
- Consent for personal photos; minimise what's sent to APIs.

**Key questions to validate:**
1. How meaningful do people find Inkreel's matches compared with ones they'd choose themselves?
2. How do ownership, satisfaction and willingness to post differ across the three authorship modes?

---

## 7. Risks
1. **Scope creep** (biggest): 3 modes × 3 outputs + songs + handwriting. Follow the build priority strictly.
2. **Matching quality on abstract lines** ("I didn't want the day to end"). Test early.
3. **Mode 1 alone overlaps existing AI travel journals** — distinctive only as part of the spectrum.
4. **Privacy:** personal photos; consent; minimise data sent to APIs.

---

## 8. Owner preferences
- Tends to over-scope; wants an MVP mindset and small, clear scope.
- Wants something fun/creative and genuinely useful, good for a portfolio, potentially a real product.
- Travels a lot (lots of photos); loves writing.
- Uses YouTube Music, not Spotify.

---

## 9. Secondary context: academic evaluation lens (handover only)
The work also serves as an individual university project. From that lens:
- The owner may occasionally ask questions about framing, literature, evaluation or study design.
- Useful framing: **problem** (photos and writing live apart; AI writing loses your voice) → **literature** (section 5) → **gap** (section 4) → **interaction requirement** (mixed-initiative: AI proposes matches with reasons and optional writing help; the user decides; authorship level is user-controlled and transparent) → **contribution** (product, matching approach with actionable explanations, and the validation in section 6).
- Meaningful AI use in the build should be documented (Git history, prompts, development log), so **keep a dev log from day one**.
- Do not let this lens drive product decisions or appear in repo docs unless explicitly asked.

---

## 10. Next steps
1. **One-day feasibility test:** take one trip; write ~8 lines (or use existing notes); group photos into moments by time gap; caption representative photos with a VLM; run one LLM matching call. If at least half the matches feel right or nearly right, commit.
2. Create the repo (name: inkreel) with the .gitignore above; start a dev log.
3. Decide the data connection for the MVP (recommend plain upload; investigate MCP / Picker API in parallel).
4. Decide the stack and build the core loop (section 2, build priority step 1).
5. (Optional) Request a Google Takeout YouTube history export to check song-suggestion feasibility later.

## Glossary
- **Moment:** a group of photos close in time/place; the unit of matching.
- **Piece:** a unit of writing (line, stanza, paragraph) matched to a moment.
- **Provenance:** marking which text is the user's vs AI-written.
