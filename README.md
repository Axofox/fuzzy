# fuzzy

A tiny, self-hosted rentry.co-style tool: write a Markdown note (bold, italic,
images, emoji), publish it, and get a read-only link. Built to run entirely
on Netlify with no database — every paste is a folder of files committed
straight into this git repo.

## How it works

- `/write` — the editor. No login (see "Security" below).
- `/write/manage` — lists every published note with **Edit** and **Delete**
  buttons. Both go through the same commit-then-rebuild flow as publishing,
  so changes take ~30-90s to show up live.
- Publishing calls a Netlify Function which commits `pastes/{slug}/content.md`,
  any images, and `pastes/{slug}/meta.json` to this repo via the GitHub API.
  Editing an existing note updates those same files in place (preserving the
  original `createdAt`, adding `updatedAt`) instead of creating new ones.
- That commit triggers a normal Netlify build: `scripts/build.js` reads every
  folder under `pastes/` and renders it to a static page in `public/{slug}/`.
- Readers just hit `https://yoursite.netlify.app/{slug}` — a plain static
  page, no function involved.
- A link is either a random 8-character token, or a custom slug you type in
  (rejected up front, with a message, if that slug is already taken —
  nothing is ever silently overwritten).
- **Preview** tab on `/write` renders through the exact same Markdown
  renderer + sanitizer used for the real published page (via a small
  `/preview` function), so what you see is what you get — including
  pasted-but-not-yet-uploaded images, shown from local data URLs.
- Screenshots are downscaled and re-encoded as JPEG client-side before
  upload if they're over ~300KB, so retina screenshots don't bloat the repo
  or slow down publishing.

## Workspaces

`/write` and `/write/manage` are the default, unscoped workspace. You can
also give someone a link like `/katy/write` — any `/{name}/write` URL works,
with no setup step. It behaves like a separate instance of the tool:

- Its notes live at `pastes/{name}/` in the repo instead of bare `pastes/`,
  and publish to `/{name}/{slug}` instead of `/{slug}`.
- `/{name}/write/manage` only ever lists and can only ever edit/delete that
  workspace's own notes.
- Someone using only the `/{name}/write` link has no way, through the tool
  itself, to discover or reach the default workspace or any other named one.

**What this isn't**: real secrecy from you. Every workspace's notes still
land in the same GitHub repo under your account — anyone with access to that
repo (starting with you) can see all of them by browsing `pastes/` directly.
The isolation is at the tool's UI level, keeping workspaces separate from
*each other*, not from the repo owner. If you need a workspace hidden even
from yourself, that needs a fully separate GitHub repo + Netlify site.

## Formatting

Besides standard Markdown (headings, lists, links, code blocks, `**bold**`,
`*italic*`), there's one custom bit of syntax for colored text, available via
the 5 colored dots in the toolbar or by typing it directly:

```
[green]this is green[/green]
[yellow]this is yellow[/yellow]
[red]this is red[/red]
[purple]this is purple[/purple]
[blue]this is blue[/blue]
```

Only those 5 color names are recognized; anything else (`[orange]...[/orange]`)
is left as literal text. Markdown inside a color tag still works, e.g.
`[red]**bold and red**[/red]`.

There's also a size suffix for images: `![alt|300](images/x.png)` renders it
300px wide (any number 20-2000; out of range gets clamped, not rejected).
Put two of these on the same line, separated by a space, and they sit side
by side, wrapping onto a new line on narrow screens:

```
![cat|200](images/cat.png) ![dog|200](images/dog.png)
```

A lone, unsized image (`![alt](images/x.png)`) still fills its line exactly
as before.

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

- `/write/manage` (the note history — list, edit, delete) requires a
  password: `netlify/edge-functions/manage-auth.js` shows a custom login
  page (styled to match the rest of the site) in front of it. The password
  is only ever compared server-side at Netlify's edge, never sent to a
  visitor's browser in any JS file. On success it sets an HttpOnly cookie
  good for 24 hours, after which it asks again. Change the password by
  editing the `PASSWORD` constant in that file and pushing.
- `/write` itself (writing a *new* note) has **no password**, by design (per
  your call) — anyone who finds that URL can publish a note under your
  GitHub token's identity. Keep it out of anything public if that matters.
- Workspace pages (`/{name}/write`, `/{name}/write/manage`) are **not**
  covered by the password above — that's deliberate, so you can hand
  someone a workspace link without also giving them your password. Anyone
  with a workspace link can publish, edit, or delete *that workspace's*
  notes.
- This protects the pages themselves; the Netlify Functions they call
  (`list-pastes`, `delete-paste`, etc.) aren't separately gated, so someone
  who already knows a function's exact URL and shape could still call it
  directly without going through `/write/manage`. Low risk in practice —
  it's the same "a link is the access control" model the rest of this tool
  already relies on — but worth knowing.

## Limits

- ~200,000 characters of Markdown per note.
- Up to 12 images per note, 3MB each, 4MB combined (keeps requests under
  Netlify's function payload limit) — measured *after* client-side
  compression, so most screenshots have a lot of headroom. PNG, JPG, GIF,
  WEBP only.
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

Tests cover the pure logic: slug validation/generation, workspace name
resolution, Markdown rendering + HTML sanitization (including XSS attempts,
the `[color]` tag syntax, and the `![alt|width](src)` image sizing syntax),
image filename sanitization, the GitHub API wrapper (mocked, no real network
calls), and the `create-paste` handler's
create vs. edit (overwrite) logic and workspace scoping (also mocked). They
don't cover image compression or the rest of the browser-side
`write.js`/`manage.js` — those are exercised manually via `/write` and
`/write/manage`.

There's no local dev server for the write flow since it depends on the
GitHub API + a real Netlify Function environment — use `netlify dev` (from
the Netlify CLI) if you want to test `/write` locally; it reads the same
environment variables from a `.env` file.
