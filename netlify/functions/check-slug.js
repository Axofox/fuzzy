const { getFile } = require("./lib/github");
const { normalizeSlug, isValidSlug } = require("./lib/slug");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const raw = event.queryStringParameters && event.queryStringParameters.slug;
  const slug = normalizeSlug(raw);

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

  try {
    const result = await getFile(`pastes/${slug}/meta.json`);
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
