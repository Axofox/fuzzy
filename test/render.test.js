const { test } = require("node:test");
const assert = require("node:assert/strict");
const { escapeHtml, deriveTitle, renderMarkdown } = require("../scripts/lib/render");

test("escapeHtml escapes the five reserved HTML characters", () => {
  assert.equal(escapeHtml(`<b>&"'</b>`), "&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;");
});

test("deriveTitle uses the first heading when present", () => {
  assert.equal(deriveTitle("Some text\n# Hello World\nmore text"), "Hello World");
});

test("deriveTitle falls back to the first non-empty line", () => {
  assert.equal(deriveTitle("\n\n  Just a line of text  \nsecond line"), "Just a line of text");
});

test("deriveTitle falls back to 'Note' for blank content", () => {
  assert.equal(deriveTitle("   \n   \n"), "Note");
});

test("deriveTitle truncates very long titles to 120 characters", () => {
  const long = "a".repeat(200);
  const title = deriveTitle(long);
  assert.equal(title.length, 120);
});

test("renderMarkdown turns **bold** and *italic* into strong/em tags", () => {
  const html = renderMarkdown("This is **bold** and *italic*.");
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
});

test("renderMarkdown keeps emoji characters as plain text", () => {
  const html = renderMarkdown("Great work 🔥🙌");
  assert.match(html, /Great work 🔥🙌/);
});

test("renderMarkdown allows images with src/alt only", () => {
  const html = renderMarkdown("![a screenshot](images/shot.png)");
  assert.match(html, /<img src="images\/shot\.png" alt="a screenshot"\s*\/?>/);
});

test("renderMarkdown strips <script> tags entirely", () => {
  const html = renderMarkdown("Hello\n\n<script>alert('xss')</script>\n\nWorld");
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /alert\(/);
});

test("renderMarkdown strips inline event handler attributes", () => {
  const html = renderMarkdown('<img src="x.png" onerror="alert(1)">');
  assert.doesNotMatch(html, /onerror/i);
});

test("renderMarkdown drops disallowed tags like <iframe>", () => {
  const html = renderMarkdown('<iframe src="https://evil.example"></iframe>');
  assert.doesNotMatch(html, /<iframe/i);
});

test("renderMarkdown adds rel/target to links", () => {
  const html = renderMarkdown("[a link](https://example.com)");
  assert.match(html, /rel="noopener noreferrer nofollow"/);
  assert.match(html, /target="_blank"/);
});

test("renderMarkdown turns [color]...[/color] into a colored span for all 5 colors", () => {
  for (const color of ["green", "yellow", "red", "purple", "blue"]) {
    const html = renderMarkdown(`[${color}]hi[/${color}]`);
    assert.match(html, new RegExp(`<span class="text-${color}">hi</span>`));
  }
});

test("renderMarkdown supports markdown nested inside a color tag", () => {
  const html = renderMarkdown("[red]**bold red**[/red]");
  assert.match(html, /<span class="text-red"><strong>bold red<\/strong><\/span>/);
});

test("renderMarkdown leaves an unclosed color tag as literal text", () => {
  const html = renderMarkdown("[purple]unclosed");
  assert.match(html, /\[purple\]unclosed/);
  assert.doesNotMatch(html, /<span/);
});

test("renderMarkdown strips disallowed classes/attributes from a raw <span>", () => {
  const html = renderMarkdown('<span class="evil" onclick="alert(1)">x</span>');
  assert.doesNotMatch(html, /evil/);
  assert.doesNotMatch(html, /onclick/);
});

test("renderMarkdown does not recognize an unknown color name as a tag", () => {
  const html = renderMarkdown("[orange]not a real color[/orange]");
  assert.doesNotMatch(html, /<span/);
  assert.match(html, /\[orange\]not a real color\[\/orange\]/);
});
