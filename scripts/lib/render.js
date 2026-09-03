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

// Small custom syntax for colored text: [green]text[/green]. Not part of
// Markdown, so it's expanded to <span class="text-green"> before marked
// runs, and sanitize-html only allows the exact known class names through.
const COLOR_NAMES = ["green", "yellow", "red", "purple", "blue"];

function applyColorTags(markdown) {
  let out = markdown;
  for (const color of COLOR_NAMES) {
    const re = new RegExp(`\\[${color}\\]([\\s\\S]*?)\\[/${color}\\]`, "g");
    out = out.replace(re, (_, inner) => `<span class="text-${color}">${inner}</span>`);
  }
  return out;
}

// Optional sizing on an image: ![alt|300](images/x.png) -> a 300px-wide
// <img>. Not standard Markdown, so images with a size are expanded to raw
// <img> tags (bypassing marked's own image handling) before marked runs.
// Images stay `display: inline-block` in CSS, so two of these side by side
// on the same source line (just separated by a space) sit next to each
// other; one alone still fills its line as before.
const MIN_IMAGE_WIDTH = 20;
const MAX_IMAGE_WIDTH = 2000;

function applySizedImages(markdown) {
  return markdown.replace(/!\[([^\]]*)\|(\d{1,4})\]\(([^)\s]+)\)/g, (_, alt, width, src) => {
    const w = Math.min(MAX_IMAGE_WIDTH, Math.max(MIN_IMAGE_WIDTH, parseInt(width, 10)));
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="${w}">`;
  });
}

function renderMarkdown(markdown) {
  const rawHtml = marked.parse(applyColorTags(applySizedImages(markdown)));
  return sanitizeHtml(rawHtml, {
    allowedTags: [
      "p", "br", "hr", "b", "strong", "i", "em", "u", "s", "del", "ins",
      "blockquote", "code", "pre", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "a", "img", "table", "thead", "tbody", "tr", "th", "td", "span",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width"],
      td: ["align"],
      th: ["align"],
      span: ["class"],
    },
    allowedClasses: {
      span: COLOR_NAMES.map((c) => `text-${c}`),
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
    },
  });
}

module.exports = { escapeHtml, deriveTitle, renderMarkdown, COLOR_NAMES, applySizedImages };
