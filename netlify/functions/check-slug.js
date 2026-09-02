const { getFile } = require("./lib/github");
const { normalizeSlug, isValidSlug } = require("./lib/slug");
const { resolveWorkspace } = require("./lib/workspace");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const params = event.queryStringParameters || {};
  const slug = normalizeSlug(params.slug);

  if (!slug || !isValidSlug(slug)) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        available: false,
        reason: "invalid",
        message:
          "Use lowercase letters, numbers and hyphens only (2-61 characters).",
      }),
    };
  }
  const ws = resolveWorkspace(params.workspace);
  if (!ws.ok) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: false, reason: "invalid", message: ws.message }),
    };
  }

  try {
    const result = await getFile(`${ws.pastesRoot}/${slug}/meta.json`);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        available: !result.exists,
        reason: result.exists ? "taken" : null,
        message: result.exists
          ? "This link already exists — please choose a different one."
          : null,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: false, reason: "error", message: err.message }),
    };
  }
};
