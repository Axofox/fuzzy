const { renderMarkdown } = require("../../scripts/lib/render");

const MAX_MARKDOWN_CHARS = 200_000;

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

// Renders Markdown with the exact same renderer + sanitizer used for the
// real published pages, so the write page's preview never drifts from what
// actually gets published.
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "invalid_json", message: "Request body must be JSON." });
  }

  const markdown = typeof payload.markdown === "string" ? payload.markdown : "";
  if (markdown.length > MAX_MARKDOWN_CHARS) {
    return json(400, {
      error: "markdown_too_long",
      message: `Content is too long (max ${MAX_MARKDOWN_CHARS.toLocaleString()} characters).`,
    });
  }

  try {
    return json(200, { html: renderMarkdown(markdown) });
  } catch (err) {
    return json(500, { error: "render_failed", message: err.message });
  }
};
