const { normalizeSlug, isValidSlug } = require("./slug");

// A workspace is an optional top-level path segment (e.g. "katy") that
// keeps a whole set of notes -- and the write/manage pages for them --
// separate from the default, unscoped one. Same character rules as a slug.
// Returns { ok: true, workspace, pastesRoot } or { ok: false, message }.
function resolveWorkspace(raw) {
  const normalized = normalizeSlug(raw);
  if (!normalized) {
    return { ok: true, workspace: undefined, pastesRoot: "pastes" };
  }
  if (!isValidSlug(normalized)) {
    return {
      ok: false,
      message: "Workspace name can only contain lowercase letters, numbers and hyphens (2-61 characters).",
    };
  }
  return { ok: true, workspace: normalized, pastesRoot: `pastes/${normalized}` };
}

module.exports = { resolveWorkspace };
