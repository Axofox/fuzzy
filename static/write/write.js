(function () {
  const editor = document.getElementById("editor");
  const btnBold = document.getElementById("btn-bold");
  const btnItalic = document.getElementById("btn-italic");
  const btnEmoji = document.getElementById("btn-emoji");
  const btnImage = document.getElementById("btn-image");
  const fileInput = document.getElementById("file-input");
  const emojiPanel = document.getElementById("emoji-panel");
  const emojiSearch = document.getElementById("emoji-search");
  const emojiGrid = document.getElementById("emoji-grid");
  const thumbs = document.getElementById("thumbs");
  const slugInput = document.getElementById("slug-input");
  const slugPrefix = document.getElementById("slug-prefix");
  const slugStatus = document.getElementById("slug-status");
  const publishBtn = document.getElementById("btn-publish");
  const resultBox = document.getElementById("result");
  const errorBox = document.getElementById("error");
  const tabWrite = document.getElementById("tab-write");
  const tabPreview = document.getElementById("tab-preview");
  const writePane = document.getElementById("write-pane");
  const previewPane = document.getElementById("preview-pane");
  const heading = document.querySelector("h1");
  const manageLink = document.getElementById("manage-link");
  const charCount = document.getElementById("char-count");

  // A workspace is an optional "/{name}" prefix (e.g. /katy/write) that
  // keeps a separate set of notes, with its own manage page, isolated from
  // the default one. Netlify rewrites /{workspace}/write to this same page
  // without changing the URL bar, so the workspace is read back out of it.
  const workspaceMatch = location.pathname.match(/^\/([a-z0-9-]+)\/write\/?$/);
  const workspace = workspaceMatch ? workspaceMatch[1] : null;

  slugPrefix.textContent = location.host + "/" + (workspace ? workspace + "/" : "");
  if (workspace) {
    manageLink.href = `/${workspace}/write/manage`;
  }

  const state = {
    images: [], // { filename, dataBase64 }
    lastSlugCheck: { slug: null, available: null },
  };

  const editSlug = new URLSearchParams(location.search).get("edit");
  const editMode = !!editSlug;

  // Toolbar buttons (bold/italic/color) act on the textarea's current
  // selection, so they must never actually take focus themselves -- if they
  // did, the editor.focus() call in wrapSelectionTags/insertAtCursor would
  // be re-focusing an element that had just lost it, which makes the browser
  // scroll the page to bring the textarea back into view. Blocking focus at
  // mousedown (before it happens) keeps focus on the textarea the whole
  // time, so there's nothing to scroll back to.
  document.querySelector(".toolbar").addEventListener("mousedown", (e) => {
    if (e.target.closest("button")) e.preventDefault();
  });

  // ---- character counter ---------------------------------------------------
  // Matches MAX_MARKDOWN_CHARS in create-paste.js/preview.js -- just for the
  // on-screen hint, the server is what actually enforces it.
  const MAX_MARKDOWN_CHARS = 200_000;

  function countChars(text) {
    return text
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "")
      .reduce((sum, line) => sum + line.length, 0);
  }

  function updateCharCount() {
    const count = countChars(editor.value);
    charCount.textContent = `${count.toLocaleString()} / ${MAX_MARKDOWN_CHARS.toLocaleString()} characters`;
    charCount.classList.toggle("near-limit", count > MAX_MARKDOWN_CHARS * 0.9);
  }

  editor.addEventListener("input", updateCharCount);
  updateCharCount();

  // ---- selection helpers -------------------------------------------------

  function insertAtCursor(text) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value = editor.value.slice(0, start) + text + editor.value.slice(end);
    const pos = start + text.length;
    editor.setSelectionRange(pos, pos);
    editor.focus();
    updateCharCount();
  }

  function wrapSelectionTags(open, close) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.slice(start, end) || "text";
    const before = editor.value.slice(0, start);
    const after = editor.value.slice(end);
    editor.value = before + open + selected + close + after;
    editor.focus();
    editor.setSelectionRange(start + open.length, start + open.length + selected.length);
    updateCharCount();
  }

  function wrapSelection(marker) {
    wrapSelectionTags(marker, marker);
  }

  btnBold.addEventListener("click", () => wrapSelection("**"));
  btnItalic.addEventListener("click", () => wrapSelection("*"));

  document.querySelectorAll(".color-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const color = btn.dataset.color;
      wrapSelectionTags(`[${color}]`, `[/${color}]`);
    });
  });

  // ---- emoji picker -------------------------------------------------------

  function renderEmojiGrid(filter) {
    emojiGrid.innerHTML = "";
    const q = (filter || "").trim().toLowerCase();
    const list = q
      ? EMOJI_DATA.filter(([, keywords]) => keywords.includes(q))
      : EMOJI_DATA;
    for (const [char] of list) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = char;
      b.addEventListener("click", () => insertAtCursor(char));
      emojiGrid.appendChild(b);
    }
  }

  btnEmoji.addEventListener("click", () => {
    emojiPanel.classList.toggle("hidden");
    if (!emojiPanel.classList.contains("hidden")) {
      renderEmojiGrid("");
      emojiSearch.value = "";
      emojiSearch.focus();
    }
  });
  emojiSearch.addEventListener("input", () => renderEmojiGrid(emojiSearch.value));

  // ---- images: file picker, drag/drop, paste ------------------------------

  function extFromMime(mime) {
    if (mime === "image/png") return "png";
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/gif") return "gif";
    if (mime === "image/webp") return "webp";
    return "png";
  }

  function sanitizeBaseName(name) {
    return name
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "image";
  }

  // ---- image compression ---------------------------------------------------
  // Screenshots (especially retina PNGs) are often several MB. Downscale and
  // re-encode as JPEG before upload so publishing stays fast and small.

  const COMPRESS_MAX_DIMENSION = 1920;
  const COMPRESS_THRESHOLD_BYTES = 300 * 1024;
  const COMPRESS_JPEG_QUALITY = 0.85;

  function loadImageElement(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => resolve({ img, url });
      img.onerror = reject;
      img.src = url;
    });
  }

  async function compressImageFile(file) {
    // Leave GIFs alone (a canvas re-encode would drop animation) and skip
    // files that are already small enough that compressing isn't worth it.
    if (file.type === "image/gif" || file.size <= COMPRESS_THRESHOLD_BYTES) {
      return file;
    }
    let url;
    try {
      const loaded = await loadImageElement(file);
      url = loaded.url;
      const { img } = loaded;
      const scale = Math.min(1, COMPRESS_MAX_DIMENSION / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", COMPRESS_JPEG_QUALITY));
      if (!blob || blob.size >= file.size) return file;
      return blob;
    } catch {
      return file;
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }

  // Reads + compresses one file and works out its final filename, but
  // doesn't touch the textarea/thumbnails yet -- addImageFiles below decides
  // how to lay multiple prepared images out before inserting anything.
  async function prepareImageFile(file) {
    if (!file.type.startsWith("image/")) return null;
    const originalName = file.name;
    const originalIsPlaceholder = !originalName || originalName === "image.png";
    const compressed = await compressImageFile(file);
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(compressed);
    });
    const base64 = dataUrl.split(",")[1];
    const ext = extFromMime(compressed.type);
    const base = !originalIsPlaceholder ? sanitizeBaseName(originalName) : "screenshot-" + Date.now();
    const filename = `${base}.${ext}`;
    return { filename, dataBase64: base64, dataUrl };
  }

  function appendThumb(dataUrl, filename) {
    const thumb = document.createElement("img");
    thumb.src = dataUrl;
    thumb.title = filename;
    thumbs.appendChild(thumb);
  }

  // Two files with the same original name (or two generic "screenshot-..."
  // ones landing in the same millisecond) would otherwise both produce the
  // same images/{filename}, silently colliding in the markdown even though
  // the server would rename the second one on publish to avoid overwriting
  // the first -- leaving one of the two images broken on the published page.
  function uniqueFilename(name, usedNames) {
    if (!usedNames.has(name)) return name;
    const dot = name.lastIndexOf(".");
    const stem = dot >= 0 ? name.slice(0, dot) : name;
    const ext = dot >= 0 ? name.slice(dot) : "";
    let n = 1;
    let candidate = `${stem}-${n}${ext}`;
    while (usedNames.has(candidate)) {
      n++;
      candidate = `${stem}-${n}${ext}`;
    }
    return candidate;
  }

  // Matches main's usable content width (720px max-width, 20px padding each
  // side) on both the reader page and this page's own preview, so a row
  // fits without wrapping on a normal-width screen.
  const ROW_CONTENT_WIDTH = 680;
  const ROW_GAP = 8;

  function rowImageWidth(count) {
    const w = Math.floor((ROW_CONTENT_WIDTH - ROW_GAP * (count - 1)) / count);
    return Math.max(20, Math.min(2000, w));
  }

  async function addImageFile(file) {
    const prepared = await prepareImageFile(file);
    if (!prepared) return;
    const usedNames = new Set(state.images.map((i) => i.filename));
    const filename = uniqueFilename(prepared.filename, usedNames);
    state.images.push({ filename, dataBase64: prepared.dataBase64 });
    insertAtCursor(`\n![](images/${filename})\n`);
    appendThumb(prepared.dataUrl, filename);
  }

  // Selecting/dropping/pasting more than one image at once auto-arranges
  // them side by side at a size that fits, instead of each one stacking on
  // its own line -- the common "compare two screenshots" case needs no
  // manual [alt|width] editing at all this way.
  async function addImageFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    if (files.length === 1) {
      await addImageFile(files[0]);
      return;
    }
    const prepared = (await Promise.all(files.map(prepareImageFile))).filter(Boolean);
    if (!prepared.length) return;
    const usedNames = new Set(state.images.map((i) => i.filename));
    const deduped = prepared.map((p) => {
      const filename = uniqueFilename(p.filename, usedNames);
      usedNames.add(filename);
      return { ...p, filename };
    });
    const width = rowImageWidth(deduped.length);
    for (const p of deduped) state.images.push({ filename: p.filename, dataBase64: p.dataBase64 });
    const line = deduped.map((p) => `![|${width}](images/${p.filename})`).join(" ");
    insertAtCursor(`\n${line}\n`);
    for (const p of deduped) appendThumb(p.dataUrl, p.filename);
  }

  btnImage.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    addImageFiles(fileInput.files);
    fileInput.value = "";
  });

  editor.addEventListener("dragover", (e) => {
    e.preventDefault();
    editor.classList.add("dragover");
  });
  editor.addEventListener("dragleave", () => editor.classList.remove("dragover"));
  editor.addEventListener("drop", (e) => {
    e.preventDefault();
    editor.classList.remove("dragover");
    addImageFiles(e.dataTransfer.files);
  });

  editor.addEventListener("paste", (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    const files = [];
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) {
      addImageFiles(files);
      e.preventDefault();
    }
  });

  // ---- write/preview tabs --------------------------------------------------
  // Preview is rendered server-side (same renderer + sanitizer as the real
  // published pages) so it never drifts from what actually gets published.

  const MIME_BY_EXT = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
  function mimeFromFilename(name) {
    const ext = name.split(".").pop().toLowerCase();
    return MIME_BY_EXT[ext] || "image/png";
  }

  // Not-yet-published images only exist client-side as base64, so swap their
  // src for a data: URL to make the preview show them before they're uploaded.
  function resolvePreviewImages(html) {
    const container = document.createElement("div");
    container.innerHTML = html;
    container.querySelectorAll("img").forEach((img) => {
      const match = (img.getAttribute("src") || "").match(/^images\/(.+)$/);
      const found = match && state.images.find((i) => i.filename === match[1]);
      if (found) {
        img.src = `data:${mimeFromFilename(found.filename)};base64,${found.dataBase64}`;
      }
    });
    return container.innerHTML;
  }

  let previewCache = { markdown: null, html: null };

  async function showPreview() {
    tabWrite.classList.remove("active");
    tabPreview.classList.add("active");
    writePane.classList.add("hidden");
    previewPane.classList.remove("hidden");

    const markdown = editor.value;
    if (!markdown.trim()) {
      previewPane.innerHTML = '<p class="hint">Nothing to preview yet.</p>';
      return;
    }
    if (previewCache.markdown === markdown) {
      previewPane.innerHTML = previewCache.html;
      return;
    }
    previewPane.innerHTML = '<p class="hint">Rendering…</p>';
    try {
      const res = await fetch("/.netlify/functions/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown }),
      });
      const data = await res.json();
      if (!res.ok) {
        previewPane.innerHTML = `<p class="hint">${data.message || "Preview failed."}</p>`;
        return;
      }
      const resolved = resolvePreviewImages(data.html);
      previewCache = { markdown, html: resolved };
      previewPane.innerHTML = resolved;
    } catch (err) {
      previewPane.innerHTML = `<p class="hint">Network error: ${err.message}</p>`;
    }
  }

  function showWrite() {
    tabPreview.classList.remove("active");
    tabWrite.classList.add("active");
    previewPane.classList.add("hidden");
    writePane.classList.remove("hidden");
    editor.focus();
  }

  tabWrite.addEventListener("click", showWrite);
  tabPreview.addEventListener("click", showPreview);

  // ---- slug availability ---------------------------------------------------

  let slugTimer = null;
  slugInput.addEventListener("input", () => {
    clearTimeout(slugTimer);
    const raw = slugInput.value.trim();
    if (!raw) {
      slugStatus.textContent = "A random link will be generated.";
      slugStatus.className = "slug-status";
      state.lastSlugCheck = { slug: null, available: null };
      updatePublishState();
      return;
    }
    slugStatus.textContent = "Checking…";
    slugStatus.className = "slug-status";
    slugTimer = setTimeout(async () => {
      try {
        const wsParam = workspace ? `&workspace=${encodeURIComponent(workspace)}` : "";
        const res = await fetch(`/.netlify/functions/check-slug?slug=${encodeURIComponent(raw)}${wsParam}`);
        const data = await res.json();
        state.lastSlugCheck = { slug: raw, available: data.available };
        if (data.available) {
          slugStatus.textContent = "✓ Available";
          slugStatus.className = "slug-status ok";
        } else {
          slugStatus.textContent = data.message || "This link already exists — please choose a different one.";
          slugStatus.className = "slug-status bad";
        }
      } catch {
        slugStatus.textContent = "Couldn't check availability — you can still try publishing.";
        slugStatus.className = "slug-status";
      }
      updatePublishState();
    }, 400);
  });

  function updatePublishState() {
    const raw = slugInput.value.trim();
    const blocked = raw && state.lastSlugCheck.slug === raw && state.lastSlugCheck.available === false;
    publishBtn.disabled = !!blocked;
  }

  // ---- publish ---------------------------------------------------------

  publishBtn.addEventListener("click", async () => {
    errorBox.classList.add("hidden");
    resultBox.classList.add("hidden");

    const markdown = editor.value;
    if (!markdown.trim()) {
      showError("Write something first.");
      return;
    }
    const rawSlug = slugInput.value.trim();
    if (rawSlug && state.lastSlugCheck.slug === rawSlug && state.lastSlugCheck.available === false) {
      showError("This link already exists — please choose a different one.");
      return;
    }

    publishBtn.disabled = true;
    publishBtn.textContent = editMode ? "Saving…" : "Publishing…";

    // Only upload images still referenced in the text — if a pasted image's
    // markdown line got edited or deleted, don't ship the file anyway.
    const referencedImages = state.images.filter((img) => markdown.includes(img.filename));

    try {
      const res = await fetch("/.netlify/functions/create-paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown,
          slug: rawSlug || undefined,
          workspace: workspace || undefined,
          images: referencedImages,
          overwrite: editMode,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "slug_taken") {
          slugStatus.textContent = data.message;
          slugStatus.className = "slug-status bad";
          state.lastSlugCheck = { slug: rawSlug, available: false };
        }
        showError(data.message || "Something went wrong.");
        return;
      }

      resultBox.innerHTML = "";
      const link = document.createElement("a");
      link.href = data.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = data.url;
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(data.url);
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
      });
      resultBox.appendChild(document.createTextNode(editMode ? "Saved: " : "Published: "));
      resultBox.appendChild(link);
      resultBox.appendChild(copyBtn);
      const note = document.createElement("div");
      note.style.marginTop = "6px";
      note.style.color = "var(--muted)";
      note.style.fontSize = "13px";
      note.textContent = "Note: it can take up to a minute to go live while the site rebuilds.";
      resultBox.appendChild(note);
      resultBox.classList.remove("hidden");
    } catch (err) {
      showError("Network error: " + err.message);
    } finally {
      publishBtn.disabled = false;
      publishBtn.textContent = editMode ? "Save changes" : "Publish";
      updatePublishState();
    }
  });

  // ---- edit mode -------------------------------------------------------

  async function initEditMode(slug) {
    heading.textContent = "Edit note";
    publishBtn.textContent = "Save changes";
    slugInput.value = slug;
    slugInput.disabled = true;
    slugStatus.textContent = "Editing an existing note — its link can't be changed here.";
    slugStatus.className = "slug-status";

    editor.disabled = true;
    editor.value = "Loading…";
    try {
      const wsParam = workspace ? `&workspace=${encodeURIComponent(workspace)}` : "";
      const res = await fetch(`/.netlify/functions/get-paste?slug=${encodeURIComponent(slug)}${wsParam}`);
      const data = await res.json();
      if (!res.ok) {
        editor.value = "";
        showError(data.message || "Couldn't load this note.");
        return;
      }
      editor.value = data.markdown;
      updateCharCount();
    } catch (err) {
      editor.value = "";
      showError("Network error: " + err.message);
    } finally {
      editor.disabled = false;
    }
  }

  if (editMode) {
    initEditMode(editSlug);
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
  }
})();
