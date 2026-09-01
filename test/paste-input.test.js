const { test } = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeFilename, base64Size } = require("../netlify/functions/lib/paste-input");

test("sanitizeFilename lowercases and keeps a valid extension", () => {
  assert.equal(sanitizeFilename("Screenshot.PNG", 0), "screenshot.png");
});

test("sanitizeFilename strips directory components (path traversal)", () => {
  // Only the last path segment survives, so a traversal attempt like
  // ../../etc/passwd.png can never escape the paste's images/ folder.
  assert.equal(sanitizeFilename("../../etc/passwd.png", 0), "passwd.png");
  assert.equal(sanitizeFilename("C:\\Users\\me\\shot.png", 0), "shot.png");
});

test("sanitizeFilename replaces unsafe characters and collapses hyphens", () => {
  assert.equal(sanitizeFilename("my photo!! (final).png", 0), "my-photo-final.png");
});

test("sanitizeFilename trims leading/trailing hyphens left by sanitizing", () => {
  assert.equal(sanitizeFilename("-- weird name --.png", 0), "weird-name.png");
});

test("sanitizeFilename rejects unsupported extensions", () => {
  assert.equal(sanitizeFilename("payload.svg", 0), null);
  assert.equal(sanitizeFilename("script.js", 0), null);
  assert.equal(sanitizeFilename("noextension", 0), null);
});

test("sanitizeFilename accepts all allowed extensions", () => {
  for (const ext of ["png", "jpg", "jpeg", "gif", "webp"]) {
    assert.equal(sanitizeFilename(`shot.${ext}`, 0), `shot.${ext}`);
  }
});

test("sanitizeFilename falls back to a generated name when sanitizing empties the stem", () => {
  assert.equal(sanitizeFilename("!!!.png", 3), "image-3.png");
});

test("sanitizeFilename returns null for missing input (no extension to fall back to)", () => {
  assert.equal(sanitizeFilename(undefined, 2), null);
});

test("base64Size computes the decoded byte length", () => {
  // "hello" -> "aGVsbG8=" (5 bytes)
  assert.equal(base64Size(Buffer.from("hello").toString("base64")), 5);
});

test("base64Size handles padding correctly", () => {
  const oneByte = Buffer.from([0x41]).toString("base64"); // "QQ=="
  assert.equal(base64Size(oneByte), 1);
});

test("base64Size handles empty input", () => {
  assert.equal(base64Size(""), 0);
});
