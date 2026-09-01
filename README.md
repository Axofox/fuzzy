# fuzzy

A tiny, self-hosted rentry.co-style tool: write a Markdown note (bold, italic,
images, emoji), publish it, and get a read-only link. Built to run entirely
on Netlify with no database — every paste is a folder of files committed
straight into this git repo.

## How it works

- `/write` — the editor. No login (see "Security" below).
- `/write/manage` — lists every published note with a delete button. Deleting
  removes the paste's files from the repo (same commit-then-rebuild flow as
  publishing), so it disappears from the live site on the next rebuild.
- Publishing calls a Netlify Function which commits `pastes/{slug}/content.md`,
  any images, and `pastes/{slug}/meta.json` to this repo via the GitHub API.
- That commit triggers a normal Netlify build: `scripts/build.js` reads every
  folder under `pastes/` and renders it to a static page in `public/{slug}/`.
- Readers just hit `https://yoursite.netlify.app/{slug}` — a plain static
  page, no function involved.
- A link is either a random 8-character token, or a custom slug you type in
  (rejected up front, with a message, if that slug is already taken —
  nothing is ever silently overwritten).

Because publishing goes through a real git commit + rebuild, a new note takes
roughly 30–90 seconds to go live, not instant.

## One-time setup

1. **Push this to GitHub.**
   ```bash
   git add -A
   git commit -m "Initial scaffold"
   gh repo create <your-repo-name> --private --source=. --remote=origin --push
   ```
   (Or create the repo on github.com and `git push` manually.)

2. **Create a GitHub token** the function can use to commit files:
   Settings → Developer settings → Fine-grained personal access tokens →
   scope it to *this one repo* only, with **Contents: Read and write**
   permission. Nothing else.

3. **Create the Netlify site**: Add new site → Import an existing project →
   pick this repo. Build command and publish directory are already set via
   `netlify.toml`.

4. **Set environment variables** in Netlify (Site configuration →
   Environment variables):
   | Key | Value |
   |---|---|
   | `GITHUB_TOKEN` | the token from step 2 |
   | `GITHUB_OWNER` | your GitHub username/org |
   | `GITHUB_REPO` | this repo's name |
   | `GITHUB_BRANCH` | `main` (or whatever branch Netlify deploys) |

5. Deploy. Visit `https://<your-site>.netlify.app/write`.

## Security note

The write page has **no password**, by design (per your call — low blast
radius since it only ever creates new notes, it can't edit or delete
existing ones or touch anything else in the repo). Two things worth knowing:

- Anyone who finds the `/write` URL can publish a note under your GitHub
  token's identity. Keep the URL out of anything public if that matters to
  you.
- If you ever want to lock it down without much effort, Netlify's
  **Visitor access** password-protects the *whole* site, or you can add an
  [Edge Function](https://docs.netlify.com/edge-functions/overview/) that
  gates just `/write` behind a shared secret.

## Limits

- ~200,000 characters of Markdown per note.
- Up to 12 images per note, 3MB each, 4MB combined (keeps requests under
  Netlify's function payload limit). PNG, JPG, GIF, WEBP only.
- Emoji: the picker inserts real Unicode emoji characters — they render in
  each reader's own system font (Apple's artwork on Mac/iPhone/iPad, each
  other platform's own style elsewhere), the same way iMessage or Mail does.
  No emoji images are stored or shipped.

## Local development

```bash
npm install
npm run build   # renders pastes/ -> public/
npm test        # unit tests (Node's built-in test runner, no extra deps)
```

Tests cover the pure logic: slug validation/generation, Markdown rendering +
HTML sanitization (including XSS attempts), image filename sanitization, and
the GitHub API wrapper (mocked, no real network calls). They don't cover the
Netlify Function handlers end-to-end or the browser-side `write.js` — those
are exercised manually via `/write`.

There's no local dev server for the write flow since it depends on the
GitHub API + a real Netlify Function environment — use `netlify dev` (from
the Netlify CLI) if you want to test `/write` locally; it reads the same
environment variables from a `.env` file.
