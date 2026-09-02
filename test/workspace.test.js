const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolveWorkspace } = require("../netlify/functions/lib/workspace");

test("resolveWorkspace with no input resolves to the default (unscoped) root", () => {
  const r = resolveWorkspace(undefined);
  assert.equal(r.ok, true);
  assert.equal(r.workspace, undefined);
  assert.equal(r.pastesRoot, "pastes");
});

test("resolveWorkspace with empty string resolves to the default root", () => {
  const r = resolveWorkspace("   ");
  assert.equal(r.ok, true);
  assert.equal(r.workspace, undefined);
  assert.equal(r.pastesRoot, "pastes");
});

test("resolveWorkspace normalizes and scopes a valid workspace name", () => {
  const r = resolveWorkspace("  Katy  ");
  assert.equal(r.ok, true);
  assert.equal(r.workspace, "katy");
  assert.equal(r.pastesRoot, "pastes/katy");
});

test("resolveWorkspace rejects a workspace name that's too short", () => {
  const r = resolveWorkspace("a");
  assert.equal(r.ok, false);
  assert.match(r.message, /lowercase letters/);
});

test("resolveWorkspace rejects a reserved name (would collide with app routes)", () => {
  const r = resolveWorkspace("write");
  assert.equal(r.ok, false);
});

test("resolveWorkspace rejects a name longer than 61 characters", () => {
  const r = resolveWorkspace("a".repeat(62));
  assert.equal(r.ok, false);
});
