// Puts a password gate in front of /write/manage (the note history --
// list, edit, delete). The password is only ever compared here, server-side
// at Netlify's edge -- it's never sent to a visitor's browser in any JS
// file. /write itself (writing a new note) and every workspace's pages
// (/{name}/write, /{name}/write/manage) are untouched by this and stay open.
//
// A custom-styled login page (matching the rest of the site) replaces the
// browser's native Basic Auth popup. On correct password it sets an
// HttpOnly session cookie valid for 24 hours; after that it asks again.

const PASSWORD = "Life'sStories";
const AUTH_TOKEN = "fuzzy-manage-session-9f21a";
const COOKIE_NAME = "fuzzy_manage_auth";
const SESSION_SECONDS = 24 * 60 * 60;

function parseCookies(header) {
  const out = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

function loginPage({ error = false, redirectTo = "/write/manage" } = {}) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Note history</title>
<style>
  :root { color-scheme: light dark; --bg:#ffffff; --fg:#1b1b1f; --muted:#6b7280; --border:#e5e7eb; --panel:#f9fafb; --bad:#dc2626; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#14151a; --fg:#e7e7ea; --muted:#9aa0aa; --border:#2a2b32; --panel:#1b1c22; --bad:#f87171; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    color: var(--fg);
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  main { width: 100%; max-width: 300px; padding: 20px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.hint { color: var(--muted); font-size: 13px; margin: 0 0 20px; }
  p.error { color: var(--bad); font-size: 13px; margin: 0 0 12px; }
  input[type="password"] {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel);
    color: var(--fg);
    font-size: 14px;
    margin-bottom: 12px;
    outline: none;
  }
  input[type="password"]:focus { border-color: var(--fg); }
  button {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--fg);
    border-radius: 8px;
    background: var(--fg);
    color: var(--bg);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  button:hover { opacity: 0.85; }
</style>
</head>
<body>
<main>
  <h1>Note history</h1>
  <p class="hint">This area is password-protected.</p>
  ${error ? '<p class="error">Wrong password — try again.</p>' : ""}
  <form method="POST" action="${redirectTo}">
    <input type="password" name="password" placeholder="Password" autofocus required>
    <button type="submit">Unlock</button>
  </form>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 401,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export default async (request, context) => {
  const url = new URL(request.url);
  const cookies = parseCookies(request.headers.get("cookie") || "");

  if (request.method === "POST") {
    const form = await request.formData();
    const submitted = String(form.get("password") || "");
    if (submitted === PASSWORD) {
      const headers = new Headers({ Location: url.pathname });
      headers.append(
        "Set-Cookie",
        `${COOKIE_NAME}=${AUTH_TOKEN}; Path=/write/manage; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`
      );
      return new Response(null, { status: 303, headers });
    }
    return loginPage({ error: true, redirectTo: url.pathname });
  }

  if (cookies[COOKIE_NAME] === AUTH_TOKEN) {
    return context.next();
  }

  return loginPage({ redirectTo: url.pathname });
};

export const config = { path: ["/write/manage", "/write/manage/*"] };
