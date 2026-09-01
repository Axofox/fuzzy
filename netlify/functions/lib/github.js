// Minimal wrapper around the GitHub Contents API used to persist pastes
// straight into the repo (so Netlify's git-based deploy picks them up).

function getConfig() {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error(
      "Missing GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO environment variables. " +
        "Set them in Netlify site settings (Site configuration > Environment variables)."
    );
  }
  return {
    token: GITHUB_TOKEN,
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH || "main",
  };
}

function apiHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "notes-tool-netlify-function",
  };
}

// Returns { exists: false } or { exists: true, sha }
async function getFile(path) {
  const { token, owner, repo, branch } = getConfig();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(
    path
  )}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: apiHeaders(token) });
  if (res.status === 404) return { exists: false };
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub GET ${path} failed: ${res.status} ${body}`);
  }
  const json = await res.json();
  return { exists: true, sha: json.sha };
}

// Creates (or updates, if sha is passed) a file at `path` with base64 content.
async function putFile(path, base64Content, message, sha) {
  const { token, owner, repo, branch } = getConfig();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(
    path
  )}`;
  const body = {
    message,
    content: base64Content,
    branch,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: apiHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GitHub PUT ${path} failed: ${res.status} ${errBody}`);
  }
  return res.json();
}

module.exports = { getConfig, getFile, putFile };
