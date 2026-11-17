# Prompt experiments

Scripts that try prompts against Gemini for real, kept with their results so no run is lost. They are not tests: `npm run check` never runs them (they have their own config, `vitest.experiments.mts`).

Run one from `web/` (needs `GEMINI_API_KEY` in `web/.env`; each run uses some of the free daily quota, and Flash allows only about 20 requests a day):

```
INPUTS="$(cat experiments/drafts/answers.json)" MODELS=gemini-3.5-flash-lite npm run experiment -- experiments/drafts/v9-hints-hashtags.exp.ts
```

- `INPUTS`: a JSON list of answers (`moment`, `place`, `felt`, `other`).
- `MODELS`: comma-separated model IDs. Test on Lite first; try Flash only once Lite gives something half decent.
- Requests go one at a time, a few seconds apart, to stay under the per-minute limits.

Save what a run printed in `results/`, one file per run, named by date and what was tried.

## drafts/ (Write with Inkreel)

- `answers.json`: the owner's three test answer sets and two short ones.
- `v9-hints-hashtags.exp.ts`: answers as hints, not words to reuse; named places as hashtags.
- `v8-vs-hints.exp.ts`: the live prompt (v8) against the "hints" prompt (whole caption, sources found in code).
- `server-draft.exp.ts`: the real server call as built (`writeDraft`), with the live prompt.
