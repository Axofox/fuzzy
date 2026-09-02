// Static site generator: reads /pastes/*/content.md + meta.json and renders
// each one into /public/{slug}/index.html, alongside the static write page,
// landing page and 404. This runs as Netlify's build command.

const fs = require("fs");
const path = require("path");
const { escapeHtml, deriveTitle, renderMarkdown } = require("./lib/render");

const ROOT = path.join(__dirname, "..");
const PASTES_DIR = path.join(ROOT, "pastes");
const STATIC_DIR = path.join(ROOT, "static");
const PUBLIC_DIR = path.join(ROOT, "public");
const TEMPLATE_PATH = path.join(ROOT, "src", "templates", "paste.html");

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// Renders one paste dir if it's actually published (has both meta.json and
// content.md -- a publish that failed partway never surfaces a broken
// page). `urlPath` is what the page's footer shows, e.g. "katy/hello" for a
// workspace-scoped note. Returns true if it rendered something.
function renderPasteIfPublished(dir, slug, outParentDir, urlPath, template) {
  const metaPath = path.join(dir, "meta.json");
  const contentPath = path.join(dir, "content.md");
  if (!fs.existsSync(metaPath) || !fs.existsSync(contentPath)) return false;

  const markdown = fs.readFileSync(contentPath, "utf8");
  const html = renderMarkdown(markdown);
  const title = deriveTitle(markdown);

  const page = template
    .replace(/{{TITLE}}/g, escapeHtml(title))
    .replace(/{{CONTENT}}/g, html)
    .replace(/{{SLUG}}/g, escapeHtml(urlPath));

  const outDir = path.join(outParentDir, slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), page);

  const imagesDir = path.join(dir, "images");
  if (fs.existsSync(imagesDir)) {
    copyDir(imagesDir, path.join(outDir, "images"));
  }
  return true;
}

function main() {
  rmrf(PUBLIC_DIR);
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  if (fs.existsSync(STATIC_DIR)) {
    copyDir(STATIC_DIR, PUBLIC_DIR);
  }

  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");

  let count = 0;
  if (fs.existsSync(PASTES_DIR)) {
    for (const entry of fs.readdirSync(PASTES_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const topDir = path.join(PASTES_DIR, entry.name);

      if (fs.existsSync(path.join(topDir, "meta.json"))) {
        // A default (unscoped) note: pastes/{slug}/meta.json directly.
        if (renderPasteIfPublished(topDir, entry.name, PUBLIC_DIR, entry.name, template)) {
          count++;
        }
      } else {
        // No meta.json directly under this dir means it's a workspace
        // folder (e.g. pastes/katy/), whose own notes are one level deeper:
        // pastes/{workspace}/{slug}/meta.json.
        const workspace = entry.name;
        const workspaceOutDir = path.join(PUBLIC_DIR, workspace);
        for (const subEntry of fs.readdirSync(topDir, { withFileTypes: true })) {
          if (!subEntry.isDirectory()) continue;
          const subDir = path.join(topDir, subEntry.name);
          const urlPath = `${workspace}/${subEntry.name}`;
          if (renderPasteIfPublished(subDir, subEntry.name, workspaceOutDir, urlPath, template)) {
            count++;
          }
        }
      }
    }
  }

  console.log(`Built ${count} paste(s) into /public`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
