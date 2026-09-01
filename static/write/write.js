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

  slugPrefix.textContent = location.host + "/";

  const state = {
    images: [], // { filename, dataBase64 }
    lastSlugCheck: { slug: null, available: null },
  };

  // ---- selection helpers -------------------------------------------------

  function insertAtCursor(text) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value = editor.value.slice(0, start) + text + editor.value.slice(end);
    const pos = start + text.length;
    editor.setSelectionRange(pos, pos);
    editor.focus();
  }

  function wrapSelection(marker) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.slice(start, end) || "text";
    const before = editor.value.slice(0, start);
    const after = editor.value.slice(end);
    editor.value = before + marker + selected + marker + after;
    editor.focus();
    editor.setSelectionRange(start + marker.length, start + marker.length + selected.length);
  }

  btnBold.addEventListener("click", () => wrapSelection("**"));
  btnItalic.addEventListener("click", () => wrapSelection("*"));

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

  function addImageFile(file) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(",")[1];
      const ext = extFromMime(file.type);
      const base = file.name && file.name !== "image.png"
        ? sanitizeBaseName(file.name)
        : "screenshot-" + Date.now();
      const filename = `${base}.${ext}`;

      state.images.push({ filename, dataBase64: base64 });
      insertAtCursor(`\n![](images/${filename})\n`);

      const thumb = document.createElement("img");
      thumb.src = dataUrl;
      thumb.title = filename;
      thumbs.appendChild(thumb);
    };
    reader.readAsDataURL(file);
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
        const res = await fetch(`/.netlify/functions/check-slug?slug=${encodeURIComponent(raw)}`);
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
    publishBtn.textContent = "Publishing…";

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
      resultBox.appendChild(document.createTextNode("Published: "));
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
      publishBtn.textContent = "Publish";
      updatePublishState();
    }
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
  }
})();
