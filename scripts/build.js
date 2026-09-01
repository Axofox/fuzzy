// Static site generator: reads /pastes/*/content.md + meta.json and renders
// each one into /public/{slug}/index.html, alongside the static write page,
// landing page and 404. This runs as Netlify's build command.

const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const sanitizeHtml = require("sanitize-html");

const ROOT = path.join(__dirname, "..");
const PASTES_DIR = path.join(ROOT, "pastes");
const STATIC_DIR = path.join(ROOT, "static");
const PUBLIC_DIR = path.join(ROOT, "public");
const TEMPLATE_PATH = path.join(ROOT, "src", "templates", "paste.html");

marked.setOptions({ gfm: true, breaks: true });

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

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function deriveTitle(markdown) {
  const heading = markdown.match(/^#{1,6}\s+(.+)$/m);
  if (heading) return heading[1].trim().slice(0, 120);
  const firstLine = markdown.split(/\r?\n/).find((l) => l.trim());
  return (firstLine || "Note").trim().slice(0, 120);
}

function renderMarkdown(markdown) {
  const rawHtml = marked.parse(markdown);
  return sanitizeHtml(rawHtml, {
    allowedTags: [
      "p", "br", "hr", "b", "strong", "i", "em", "u", "s", "del", "ins",
      "blockquote", "code", "pre", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "a", "img", "table", "thead", "tbody", "tr", "th", "td",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title"],
      td: ["align"],
      th: ["align"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
    },
  });
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
      const slug = entry.name;
      const dir = path.join(PASTES_DIR, slug);
      const metaPath = path.join(dir, "meta.json");
      const contentPath = path.join(dir, "content.md");

      // A paste only counts as published once meta.json has landed, so a
      // publish that failed partway (e.g. GitHub API error after the
      // content commit) never surfaces a broken page.
      if (!fs.existsSync(metaPath) || !fs.existsSync(contentPath)) continue;

      const markdown = fs.readFileSync(contentPath, "utf8");
      const html = renderMarkdown(markdown);
      const title = deriveTitle(markdown);

      const page = template
        .replace(/{{TITLE}}/g, escapeHtml(title))
        .replace(/{{CONTENT}}/g, html)
        .replace(/{{SLUG}}/g, escapeHtml(slug));

      const outDir = path.join(PUBLIC_DIR, slug);
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, "index.html"), page);

      const imagesDir = path.join(dir, "images");
      if (fs.existsSync(imagesDir)) {
        copyDir(imagesDir, path.join(outDir, "images"));
      }

      count++;
    }
  }

  console.log(`Built ${count} paste(s) into /public`);
}

main();
