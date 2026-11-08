# Inkreel

**Your camera roll, your story.**

Inkreel turns the hundreds of photos from your trip into posts worth sharing, without losing what made the trip yours. Add your thoughts, notes or writing, and Inkreel finds the moments in your album that go with them, so what you post carries your voice, not a generic caption.

## How it works

1. **Start with your words.** Paste or type your notes, a poem, anything from the trip. Or answer a few quick questions about how it felt, and Inkreel drafts lines from your answers.
2. **Add your photos.** Inkreel groups them into the moments of your trip.
3. **See the matches.** Inkreel splits your writing to fit the moments and matches each part to one, with a short reason why.
4. **Make it yours.** Swap any match, and pick the photo you like within each moment.
5. **Share.** Export a carousel, ready to post.

Your words stay exactly as you wrote them. Where AI adds text, it is marked so you always know whose words are whose.

## Status

Early development. Working so far: write or paste your words and see roughly how many photos they make, then add photos and see them grouped into moments, all on your device. Matching is next.

## What's in this repository

```
web/    the app (Next.js, TypeScript)
docs/   how it's planned and built: plan, decisions, market notes, development log
```

## Run it locally

Needs Node 26 (see `web/.nvmrc`).

```sh
cd web
npm ci
npm run dev        # http://localhost:3000
npm run dev:phone  # also reachable from a phone on the same Wi-Fi
npm run check      # type check, lint and tests
```
