const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { getConfig, getFile, putFile, getFileContent, listDir, deleteFile } = require("../netlify/functions/lib/github");

const ENV_KEYS = ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO", "GITHUB_BRANCH"];
let savedEnv;
let originalFetch;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  originalFetch = global.fetch;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  global.fetch = originalFetch;
});

test("getConfig throws a clear error when required env vars are missing", () => {
  delete process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_OWNER;
  delete process.env.GITHUB_REPO;
  assert.throws(() => getConfig(), /GITHUB_TOKEN/);
});

test("getConfig defaults GITHUB_BRANCH to 'main'", () => {
  process.env.GITHUB_TOKEN = "t";
  process.env.GITHUB_OWNER = "o";
  process.env.GITHUB_REPO = "r";
  delete process.env.GITHUB_BRANCH;
  assert.equal(getConfig().branch, "main");
});

test("getFile returns exists:false on a 404 without throwing", async () => {
  process.env.GITHUB_TOKEN = "t";
  process.env.GITHUB_OWNER = "o";
  process.env.GITHUB_REPO = "r";
  process.env.GITHUB_BRANCH = "main";
  global.fetch = async () => ({ status: 404, ok: false });

  const result = await getFile("pastes/does-not-exist/meta.json");
  assert.deepEqual(result, { exists: false });
});

test("getFile returns exists:true with sha on a 200", async () => {
  process.env.GITHUB_TOKEN = "t";
  process.env.GITHUB_OWNER = "o";
  process.env.GITHUB_REPO = "r";
  process.env.GITHUB_BRANCH = "main";
  global.fetch = async () => ({
    status: 200,
    ok: true,
    json: async () => ({ sha: "abc123" }),
  });

  const result = await getFile("pastes/exists/meta.json");
  assert.deepEqual(result, { exists: true, sha: "abc123" });
});

test("getFile throws on an unexpected error status", async () => {
  process.env.GITHUB_TOKEN = "t";
  process.env.GITHUB_OWNER = "o";
  process.env.GITHUB_REPO = "r";
  process.env.GITHUB_BRANCH = "main";
  global.fetch = async () => ({
    status: 500,
    ok: false,
    text: async () => "internal error",
  });

  await assert.rejects(() => getFile("pastes/x/meta.json"), /500/);
});

test("putFile sends the branch and base64 content, and rejects on failure", async () => {
  process.env.GITHUB_TOKEN = "t";
  process.env.GITHUB_OWNER = "o";
  process.env.GITHUB_REPO = "r";
  process.env.GITHUB_BRANCH = "main";

  let capturedBody;
  global.fetch = async (url, opts) => {
    capturedBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ content: {} }) };
  };

  await putFile("pastes/x/content.md", "aGVsbG8=", "add content");
  assert.equal(capturedBody.branch, "main");
  assert.equal(capturedBody.content, "aGVsbG8=");
  assert.equal(capturedBody.message, "add content");

  global.fetch = async () => ({ ok: false, text: async () => "conflict" });
  await assert.rejects(() => putFile("pastes/x/content.md", "aGVsbG8=", "add content"), /conflict/);
});

test("getFileContent decodes base64 file content", async () => {
  process.env.GITHUB_TOKEN = "t";
  process.env.GITHUB_OWNER = "o";
  process.env.GITHUB_REPO = "r";
  process.env.GITHUB_BRANCH = "main";
  global.fetch = async () => ({
    status: 200,
    ok: true,
    json: async () => ({ sha: "abc", content: Buffer.from('{"slug":"x"}').toString("base64") }),
  });

  const result = await getFileContent("pastes/x/meta.json");
  assert.equal(result.exists, true);
  assert.equal(result.content, '{"slug":"x"}');
});

test("getFileContent returns exists:false on a 404", async () => {
  process.env.GITHUB_TOKEN = "t";
  process.env.GITHUB_OWNER = "o";
  process.env.GITHUB_REPO = "r";
  process.env.GITHUB_BRANCH = "main";
  global.fetch = async () => ({ status: 404, ok: false });

  assert.deepEqual(await getFileContent("pastes/nope/meta.json"), { exists: false });
});

test("getFileContent throws when the path is a directory", async () => {
  process.env.GITHUB_TOKEN = "t";
  process.env.GITHUB_OWNER = "o";
  process.env.GITHUB_REPO = "r";
  process.env.GITHUB_BRANCH = "main";
  global.fetch = async () => ({ status: 200, ok: true, json: async () => [{ name: "a" }] });

  await assert.rejects(() => getFileContent("pastes"), /directory/);
});

test("listDir returns [] on a 404", async () => {
  process.env.GITHUB_TOKEN = "t";
  process.env.GITHUB_OWNER = "o";
  process.env.GITHUB_REPO = "r";
  process.env.GITHUB_BRANCH = "main";
  global.fetch = async () => ({ status: 404, ok: false });

  assert.deepEqual(await listDir("pastes/nope"), []);
});

test("listDir returns the directory's entries", async () => {
  process.env.GITHUB_TOKEN = "t";
  process.env.GITHUB_OWNER = "o";
  process.env.GITHUB_REPO = "r";
  process.env.GITHUB_BRANCH = "main";
  const entries = [{ name: "content.md", path: "pastes/x/content.md", sha: "s1", type: "file" }];
  global.fetch = async () => ({ status: 200, ok: true, json: async () => entries });

  assert.deepEqual(await listDir("pastes/x"), entries);
});

test("deleteFile sends sha/branch/message and rejects on failure", async () => {
  process.env.GITHUB_TOKEN = "t";
  process.env.GITHUB_OWNER = "o";
  process.env.GITHUB_REPO = "r";
  process.env.GITHUB_BRANCH = "main";

  let capturedBody;
  let capturedMethod;
  global.fetch = async (url, opts) => {
    capturedMethod = opts.method;
    capturedBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({}) };
  };

  await deleteFile("pastes/x/content.md", "sha123", "delete content");
  assert.equal(capturedMethod, "DELETE");
  assert.equal(capturedBody.sha, "sha123");
  assert.equal(capturedBody.branch, "main");
  assert.equal(capturedBody.message, "delete content");

  global.fetch = async () => ({ ok: false, text: async () => "not found" });
  await assert.rejects(() => deleteFile("pastes/x/content.md", "sha123", "delete content"), /not found/);
});
