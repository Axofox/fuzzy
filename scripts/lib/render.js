// Pure Markdown -> sanitized HTML rendering, split out from build.js so it
// can be unit tested without touching the filesystem.

const { marked } = require("marked");
const sanitizeHtml = require("sanitize-html");

marked.setOptions({ gfm: true, breaks: true });

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

module.exports = { escapeHtml, deriveTitle, renderMarkdown };
