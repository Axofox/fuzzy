// Puts real HTTP Basic Auth in front of /write/manage (the note history --
// list, edit, delete). The password is only ever compared here, server-side
// at Netlify's edge -- it's never sent to a visitor's browser in any JS
// file. /write itself (writing a new note) and every workspace's pages
// (/{name}/write, /{name}/write/manage) are untouched by this and stay open.
//
// Deliberately simple, per request: a single hardcoded password, no
// username check (Basic Auth still asks for one, it's just ignored), no
// session/cookie -- the browser itself remembers the credential for the
// session once entered.

const PASSWORD = "Life'sStories";

export default async (request, context) => {
  const authHeader = request.headers.get("authorization") || "";
  const match = authHeader.match(/^Basic\s+(.+)$/i);

  let authorized = false;
  if (match) {
    try {
      const decoded = atob(match[1]);
      const sep = decoded.indexOf(":");
      const password = sep >= 0 ? decoded.slice(sep + 1) : decoded;
      authorized = password === PASSWORD;
    } catch {
      authorized = false;
    }
  }

  if (authorized) {
    return context.next();
  }

  return new Response("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Note history"' },
  });
};

export const config = { path: ["/write/manage", "/write/manage/*"] };
