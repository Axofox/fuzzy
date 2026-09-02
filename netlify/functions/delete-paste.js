const { listDir, deleteFile } = require("./lib/github");
const { normalizeSlug, isValidSlug } = require("./lib/slug");
const { resolveWorkspace } = require("./lib/workspace");

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

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

  const slug = normalizeSlug(payload.slug);
  if (!slug || !isValidSlug(slug)) {
    return json(400, { error: "invalid_slug", message: "Invalid link." });
  }
  const ws = resolveWorkspace(payload.workspace);
  if (!ws.ok) {
    return json(400, { error: "invalid_workspace", message: ws.message });
  }

  try {
    const topLevel = await listDir(`${ws.pastesRoot}/${slug}`);
    if (topLevel.length === 0) {
      return json(404, { error: "not_found", message: "This note doesn't exist." });
    }

    // Delete meta.json first: build.js only treats a paste as "published"
    // once meta.json exists, so this makes the note disappear on the next
    // rebuild even if a later delete in this batch fails partway through.
    const metaEntry = topLevel.find((e) => e.name === "meta.json");
    if (metaEntry) {
      await deleteFile(metaEntry.path, metaEntry.sha, `[paste ${slug}] delete meta`);
    }

    for (const entry of topLevel) {
      if (entry.name === "meta.json") continue;
      if (entry.type === "dir") {
        const subEntries = await listDir(entry.path);
        for (const sub of subEntries) {
          await deleteFile(sub.path, sub.sha, `[paste ${slug}] delete ${sub.path}`);
        }
      } else {
        await deleteFile(entry.path, entry.sha, `[paste ${slug}] delete ${entry.path}`);
      }
    }

    return json(200, { slug, deleted: true });
  } catch (err) {
    return json(500, {
      error: "delete_failed",
      message:
        "Delete failed partway through: " +
        err.message +
        ". The note is already unpublished (its meta.json is gone), but some files may still remain in the repo -- safe to retry.",
    });
  }
};
