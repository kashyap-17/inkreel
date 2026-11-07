# Inkreel

**Your camera roll, your story.**

Inkreel turns the hundreds of photos from your trip into posts worth sharing, without losing what made the trip yours. Add your thoughts, notes or writing, and Inkreel finds the moments in your album that go with them, so what you post carries your voice, not a generic caption.

## How it works

1. **Start with your words.** Paste or type your notes, a poem, anything from the trip. Or answer a few quick questions about how it felt, and Inkreel drafts lines from your answers.
2. **Add your photos.** Inkreel groups them into the moments of your trip.
3. **See the matches.** Each piece of writing is matched to a moment, with a short reason why.
4. **Make it yours.** Swap any match, and pick the photo you like within each moment.
5. **Share.** Export a carousel, ready to post.

Your words stay exactly as you wrote them. Where AI adds text, it is marked so you always know whose words are whose.

## Status

Early development. Working so far: paste your writing and split it into pieces, then add photos and see them grouped into moments, all on your device. Matching is next.

## Run it locally

Needs Node 26 (see `.nvmrc`).

```sh
npm ci
npm run dev        # http://localhost:3000
npm run dev:phone  # also reachable from a phone on the same Wi-Fi
npm run check      # type check, lint and tests
```
