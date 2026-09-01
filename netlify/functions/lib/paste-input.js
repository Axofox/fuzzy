// Pure input-sanitizing helpers for create-paste.js, split out so they can
// be unit tested without invoking the Netlify handler or the GitHub API.

const ALLOWED_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

function sanitizeFilename(name, index) {
  const lower = String(name || `image-${index}`).toLowerCase();
  const base = lower.split(/[\\/]/).pop();
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot + 1) : "";
  const stem = (dot >= 0 ? base.slice(0, dot) : base)
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || `image-${index}`;
  const safeExt = ALLOWED_EXT.has(ext) ? ext : null;
  return safeExt ? `${stem}.${safeExt}` : null;
}

function base64Size(b64) {
  const clean = b64.replace(/=+$/, "");
  return Math.floor((clean.length * 3) / 4);
}

module.exports = { ALLOWED_EXT, sanitizeFilename, base64Size };
