const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { handler } = require("../netlify/functions/create-paste");

const ENV_KEYS = ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO", "GITHUB_BRANCH", "URL"];
let savedEnv;
let originalFetch;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.GITHUB_TOKEN = "t";
  process.env.GITHUB_OWNER = "o";
  process.env.GITHUB_REPO = "r";
  process.env.GITHUB_BRANCH = "main";
  originalFetch = global.fetch;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  global.fetch = originalFetch;
});

function post(body) {
  return handler({ httpMethod: "POST", body: JSON.stringify(body) });
}

test("rejects a slug that's still invalid after normalization, without calling GitHub", async () => {
  global.fetch = async () => {
    throw new Error("fetch should not be called");
  };
  // "x" normalizes to itself but fails isValidSlug's minimum-length check.
  const res = await post({ markdown: "hello", slug: "x" });
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error, "invalid_slug");
});

test("rejects overwrite=true without a slug", async () => {
  global.fetch = async () => {
    throw new Error("fetch should not be called");
  };
  const res = await post({ markdown: "hello", overwrite: true });
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error, "invalid_request");
});

test("returns 409 slug_taken when creating (not editing) an existing slug", async () => {
  global.fetch = async () => ({ status: 200, ok: true, json: async () => ({ sha: "x" }) });
  const res = await post({ markdown: "hello", slug: "already-here" });
  assert.equal(res.statusCode, 409);
  assert.equal(JSON.parse(res.body).error, "slug_taken");
});

test("returns 404 not_found when overwrite=true but the note doesn't exist", async () => {
  global.fetch = async () => ({ status: 404, ok: false });
  const res = await post({ markdown: "hello", slug: "ghost", overwrite: true });
  assert.equal(res.statusCode, 404);
  assert.equal(JSON.parse(res.body).error, "not_found");
});

test("overwrite=true updates existing files with their sha and preserves createdAt", async () => {
  const puts = [];
  global.fetch = async (url, opts) => {
    const method = (opts && opts.method) || "GET";
    if (method === "GET" && url.includes("/meta.json")) {
      const meta = { slug: "edit-me", createdAt: "2020-01-01T00:00:00.000Z", imageCount: 1 };
      return {
        status: 200,
        ok: true,
        json: async () => ({ sha: "meta-sha", content: Buffer.from(JSON.stringify(meta)).toString("base64") }),
      };
    }
    if (method === "GET" && url.includes("/content.md")) {
      return { status: 200, ok: true, json: async () => ({ sha: "content-sha" }) };
    }
    if (method === "GET" && url.includes("/images")) {
      // listDir: one pre-existing image still in the folder
      return {
        status: 200,
        ok: true,
        json: async () => [{ name: "old.png", path: "pastes/edit-me/images/old.png", sha: "img-sha", type: "file" }],
      };
    }
    if (method === "PUT") {
      puts.push({ url, body: JSON.parse(opts.body) });
      return { ok: true, json: async () => ({}) };
    }
    throw new Error("unexpected fetch: " + method + " " + url);
  };

  const res = await post({ markdown: "updated text", slug: "edit-me", images: [], overwrite: true });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.slug, "edit-me");

  const contentPut = puts.find((p) => p.url.includes("/content.md"));
  assert.equal(contentPut.body.sha, "content-sha");
  assert.equal(Buffer.from(contentPut.body.content, "base64").toString("utf8"), "updated text");

  const metaPut = puts.find((p) => p.url.includes("/meta.json"));
  assert.equal(metaPut.body.sha, "meta-sha");
  const savedMeta = JSON.parse(Buffer.from(metaPut.body.content, "base64").toString("utf8"));
  assert.equal(savedMeta.createdAt, "2020-01-01T00:00:00.000Z");
  assert.ok(savedMeta.updatedAt);
  assert.equal(savedMeta.imageCount, 1);
});

test("create (non-overwrite) does not send a sha for content.md or meta.json", async () => {
  const puts = [];
  global.fetch = async (url, opts) => {
    const method = (opts && opts.method) || "GET";
    if (method === "GET" && url.includes("/meta.json")) {
      return { status: 404, ok: false };
    }
    if (method === "GET" && url.includes("/images")) {
      return { status: 404, ok: false }; // listDir -> []
    }
    if (method === "PUT") {
      puts.push({ url, body: JSON.parse(opts.body) });
      return { ok: true, json: async () => ({}) };
    }
    throw new Error("unexpected fetch: " + method + " " + url);
  };

  const res = await post({ markdown: "brand new", slug: "fresh-note", images: [] });
  assert.equal(res.statusCode, 200);

  const contentPut = puts.find((p) => p.url.includes("/content.md"));
  assert.equal(contentPut.body.sha, undefined);
  const metaPut = puts.find((p) => p.url.includes("/meta.json"));
  assert.equal(metaPut.body.sha, undefined);
  const savedMeta = JSON.parse(Buffer.from(metaPut.body.content, "base64").toString("utf8"));
  assert.equal(savedMeta.updatedAt, undefined);
  assert.equal(savedMeta.imageCount, 0);
});
