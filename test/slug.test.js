const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeSlug, isValidSlug, randomToken } = require("../netlify/functions/lib/slug");

test("normalizeSlug lowercases, trims and turns spaces into hyphens", () => {
  assert.equal(normalizeSlug("  My Cool Note  "), "my-cool-note");
});

test("normalizeSlug strips characters outside a-z0-9-", () => {
  assert.equal(normalizeSlug("Hello_World! 123"), "helloworld-123");
});

test("normalizeSlug handles undefined/empty input", () => {
  assert.equal(normalizeSlug(undefined), "");
  assert.equal(normalizeSlug(""), "");
  assert.equal(normalizeSlug("   "), "");
});

test("isValidSlug accepts normal slugs", () => {
  assert.equal(isValidSlug("my-note"), true);
  assert.equal(isValidSlug("note123"), true);
  assert.equal(isValidSlug("ab"), true);
});

test("isValidSlug rejects slugs that are too short", () => {
  assert.equal(isValidSlug("a"), false);
  assert.equal(isValidSlug(""), false);
});

test("isValidSlug rejects slugs starting with a hyphen", () => {
  assert.equal(isValidSlug("-note"), false);
});

test("isValidSlug rejects uppercase or invalid characters", () => {
  assert.equal(isValidSlug("My-Note"), false);
  assert.equal(isValidSlug("note_1"), false);
  assert.equal(isValidSlug("note!"), false);
});

test("isValidSlug rejects reserved names", () => {
  assert.equal(isValidSlug("write"), false);
  assert.equal(isValidSlug("api"), false);
  assert.equal(isValidSlug("pastes"), false);
});

test("isValidSlug rejects slugs longer than 61 characters", () => {
  assert.equal(isValidSlug("a".repeat(62)), false);
  assert.equal(isValidSlug("a".repeat(61)), true);
});

test("randomToken returns the requested length from the safe alphabet", () => {
  const token = randomToken(8);
  assert.equal(token.length, 8);
  assert.match(token, /^[23456789abcdefghjkmnpqrstuvwxyz]+$/);
});

test("randomToken is not obviously deterministic across calls", () => {
  const a = randomToken(12);
  const b = randomToken(12);
  assert.notEqual(a, b);
});
