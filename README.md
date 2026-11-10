# Inkreel

**Your camera roll, your story.**

Inkreel turns the hundreds of photos from your trip into posts worth sharing, without losing what made the trip yours. Add your thoughts, notes or writing, and Inkreel finds the photos in your album that go with them, so what you post carries your voice, not a generic caption.

## How it works

1. **Start with your words.** Paste or type your notes, a poem, anything from the trip. Or answer a few quick questions about how it felt, and Inkreel drafts lines from your answers.
2. **Add your photos.** The whole trip, even hundreds. Near-identical shots are grouped, so a post never repeats one.
3. **See the matches.** Inkreel splits your writing into parts and picks a photo for each, with a short reason why.
4. **Make it yours.** Swap any photo, move lines between parts, or ask for fewer or more photos.
5. **Share.** A carousel and caption, ready to post.

Your words stay exactly as you wrote them. Where AI adds text, it is marked so you always know whose words are whose.

## Status

Early development, testing with invited users. The whole path works for "I have writing": words, photos, matching with reasons, review, and a carousel to share. Your draft is saved on your device. "Help me write" and "Mix" are next.

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
cp .env.example .env   # then add your Gemini API key
npm run dev        # http://localhost:3000
npm run dev:phone  # also reachable from a phone on the same Wi-Fi
npm run check      # type check, lint and tests
```
