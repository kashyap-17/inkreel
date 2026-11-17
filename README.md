# Inkreel

**Your camera roll, your story.**

Inkreel turns a camera roll full of photos into posts worth sharing, without losing what made them yours. Add your thoughts, notes or writing, and Inkreel finds the photos in your album that go with them, so what you post carries your voice, not a generic caption.

## How it works

1. **Start with your words.** Paste or type your notes, a poem, anything you want to say. Or jot down a few thoughts (a moment, a place, how it felt) and Inkreel drafts a short post from them, with the places you named as hashtags.
2. **Add your photos.** Just the ones you want, or more and Inkreel picks the ones that best fit your writing. Near-identical shots are grouped, so a post never repeats one.
3. **See the matches.** Inkreel splits your writing into parts and picks a photo for each, with a short reason why.
4. **Make it yours.** Swap any photo, move lines between parts, or ask for fewer or more photos.
5. **Share.** A carousel and caption, ready to post.

When you bring your own writing, your words stay exactly as you wrote them. Where Inkreel writes for you, it's marked, so you always know whose words are whose, and you can change any line.

## Status

Early development, testing with invited users. The whole path works: start from your own writing, or jot down a few thoughts and let Inkreel draft a post from them; then photos, matching with reasons, review, and a carousel to share. Your draft is saved on your device. Suggested lines inside your own writing ("Mix") are next.

## What's in this repository

```
web/              the app (Next.js, TypeScript)
web/e2e/          browser tests (Playwright)
web/experiments/  prompt experiments against Gemini, with their results
docs/             how it's planned and built: plan, decisions, market notes, testing, development log
```

## Run it locally

Needs Node 26 (see `web/.nvmrc`).

```sh
cd web
npm ci
cp .env.example .env   # then add your Gemini API key
npm run dev           # http://localhost:3000
npm run dev:phone     # also reachable from a phone on the same Wi-Fi
npm run check         # type check, lint and unit tests
npm run test:browser  # the whole flow in Chrome (see docs/testing.md)
```
