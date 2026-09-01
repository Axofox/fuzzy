const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,60}$/;
const RESERVED = new Set([
  "write",
  "api",
  "admin",
  "static",
  "assets",
  "images",
  "pastes",
  "_redirects",
  "_headers",
  "404",
  "index",
  "favicon.ico",
]);

function normalizeSlug(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function isValidSlug(slug) {
  return SLUG_RE.test(slug) && !RESERVED.has(slug);
}

function randomToken(length = 8) {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz"; // no 0/1/l/o/i to avoid ambiguity
  const bytes = require("crypto").randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

module.exports = { normalizeSlug, isValidSlug, randomToken, RESERVED };
