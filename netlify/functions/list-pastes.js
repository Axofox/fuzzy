const { listDir, getFileContent } = require("./lib/github");
const { resolveWorkspace } = require("./lib/workspace");

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const ws = resolveWorkspace(event.queryStringParameters && event.queryStringParameters.workspace);
  if (!ws.ok) {
    return json(400, { error: "invalid_workspace", message: ws.message });
  }

  try {
    // A workspace folder itself has no meta.json directly under `pastes/`,
    // only its notes do (at pastes/{workspace}/{slug}/meta.json) -- so
    // listing the default (unscoped) root naturally skips workspace folders
    // without any extra filtering.
    const dirs = (await listDir(ws.pastesRoot)).filter((e) => e.type === "dir");

    const items = await Promise.all(
      dirs.map(async (d) => {
        const meta = await getFileContent(`${ws.pastesRoot}/${d.name}/meta.json`);
        // No meta.json means a publish that never finished (or was deleted
        // mid-way) -- build.js skips these too, so hide them here as well.
        if (!meta.exists) return null;
        let parsed = {};
        try {
          parsed = JSON.parse(meta.content);
        } catch {
          // malformed meta.json; still list it so it can be cleaned up
        }
        return {
          slug: d.name,
          createdAt: parsed.createdAt || null,
          imageCount: typeof parsed.imageCount === "number" ? parsed.imageCount : null,
        };
      })
    );

    const pastes = items
      .filter(Boolean)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    return json(200, { pastes });
  } catch (err) {
    return json(500, { error: "list_failed", message: err.message });
  }
};
