const { getFileContent } = require("./lib/github");
const { normalizeSlug, isValidSlug } = require("./lib/slug");
const { resolveWorkspace } = require("./lib/workspace");

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

// Fetches a paste's raw Markdown so /write can load it for editing.
exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const params = event.queryStringParameters || {};
  const slug = normalizeSlug(params.slug);
  if (!slug || !isValidSlug(slug)) {
    return json(400, { error: "invalid_slug", message: "Invalid link." });
  }
  const ws = resolveWorkspace(params.workspace);
  if (!ws.ok) {
    return json(400, { error: "invalid_workspace", message: ws.message });
  }

  try {
    const content = await getFileContent(`${ws.pastesRoot}/${slug}/content.md`);
    if (!content.exists) {
      return json(404, { error: "not_found", message: "This note doesn't exist." });
    }
    return json(200, { slug, markdown: content.content });
  } catch (err) {
    return json(500, { error: "fetch_failed", message: err.message });
  }
};
