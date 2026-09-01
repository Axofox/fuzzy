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
  const heading = document.getElementById("page-heading");
  const t = window.FuzzyI18n.t;

  slugPrefix.textContent = location.host + "/";

  const state = {
    images: [], // { filename, dataBase64 }
    lastSlugCheck: { slug: null, available: null },
  };

  const editSlug = new URLSearchParams(location.search).get("edit");
  const editMode = !!editSlug;

  // These two are also mutated dynamically during publish/save, so they're
  // deliberately not driven by [data-i18n] -- that would fight with the
  // in-flight state text ("Publishing…" etc).
  function renderStaticI18nText() {
    heading.textContent = editMode ? t("editNote") : t("writeANote");
    if (!publishBtn.disabled) {
      publishBtn.textContent = editMode ? t("saveChangesBtn") : t("publishBtn");
    }
  }
  renderStaticI18nText();
  document.addEventListener("fuzzy:langchange", renderStaticI18nText);

  // ---- selection helpers -------------------------------------------------

  function insertAtCursor(text) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value = editor.value.slice(0, start) + text + editor.value.slice(end);
    const pos = start + text.length;
    editor.setSelectionRange(pos, pos);
    editor.focus();
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

  async function addImageFile(file) {
    if (!file.type.startsWith("image/")) return;
    const originalName = file.name;
    const originalIsPlaceholder = !originalName || originalName === "image.png";
    const compressed = await compressImageFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(",")[1];
      const ext = extFromMime(compressed.type);
      const base = !originalIsPlaceholder
        ? sanitizeBaseName(originalName)
        : "screenshot-" + Date.now();
      const filename = `${base}.${ext}`;

      state.images.push({ filename, dataBase64: base64 });
      insertAtCursor(`\n![](images/${filename})\n`);

      const thumb = document.createElement("img");
      thumb.src = dataUrl;
      thumb.title = filename;
      thumbs.appendChild(thumb);
    };
    reader.readAsDataURL(compressed);
  }

  btnImage.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    for (const f of fileInput.files) addImageFile(f);
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
    for (const f of e.dataTransfer.files) addImageFile(f);
  });

  editor.addEventListener("paste", (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    let handled = false;
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          addImageFile(file);
          handled = true;
        }
      }
    }
    if (handled) e.preventDefault();
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
        previewPane.innerHTML = `<p class="hint">${data.message || t("previewFailed")}</p>`;
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
      slugStatus.textContent = t("randomLinkNote");
      slugStatus.className = "slug-status";
      state.lastSlugCheck = { slug: null, available: null };
      updatePublishState();
      return;
    }
    slugStatus.textContent = t("checkingSlug");
    slugStatus.className = "slug-status";
    slugTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/.netlify/functions/check-slug?slug=${encodeURIComponent(raw)}`);
        const data = await res.json();
        state.lastSlugCheck = { slug: raw, available: data.available };
        if (data.available) {
          slugStatus.textContent = t("slugAvailable");
          slugStatus.className = "slug-status ok";
        } else {
          slugStatus.textContent = data.message || t("slugTakenMessage");
          slugStatus.className = "slug-status bad";
        }
      } catch {
        slugStatus.textContent = t("slugCheckFailed");
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
      showError(t("writeSomethingFirst"));
      return;
    }
    const rawSlug = slugInput.value.trim();
    if (rawSlug && state.lastSlugCheck.slug === rawSlug && state.lastSlugCheck.available === false) {
      showError(t("slugTakenMessage"));
      return;
    }

    publishBtn.disabled = true;
    publishBtn.textContent = editMode ? t("savingBtn") : t("publishingBtn");

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
        showError(data.message || t("somethingWrong"));
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
      copyBtn.textContent = t("copyBtn");
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(data.url);
        copyBtn.textContent = t("copiedBtn");
        setTimeout(() => (copyBtn.textContent = t("copyBtn")), 1500);
      });
      resultBox.appendChild(document.createTextNode(editMode ? t("savedPrefix") : t("publishedPrefix")));
      resultBox.appendChild(link);
      resultBox.appendChild(copyBtn);
      const note = document.createElement("div");
      note.style.marginTop = "6px";
      note.style.color = "var(--muted)";
      note.style.fontSize = "13px";
      note.textContent = t("rebuildNote");
      resultBox.appendChild(note);
      resultBox.classList.remove("hidden");
    } catch (err) {
      showError("Network error: " + err.message);
    } finally {
      publishBtn.disabled = false;
      publishBtn.textContent = editMode ? t("saveChangesBtn") : t("publishBtn");
      updatePublishState();
    }
  });

  // ---- edit mode -------------------------------------------------------

  async function initEditMode(slug) {
    heading.textContent = t("editNote");
    publishBtn.textContent = t("saveChangesBtn");
    slugInput.value = slug;
    slugInput.disabled = true;
    slugStatus.textContent = t("editingNote");
    slugStatus.className = "slug-status";

    editor.disabled = true;
    editor.value = t("loadingNote");
    try {
      const res = await fetch(`/.netlify/functions/get-paste?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!res.ok) {
        editor.value = "";
        showError(data.message || t("couldNotLoadNote"));
        return;
      }
      editor.value = data.markdown;
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
