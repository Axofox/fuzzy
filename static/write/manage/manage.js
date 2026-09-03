(function () {
  const statusEl = document.getElementById("status");
  const listEl = document.getElementById("list");
  const writeLink = document.getElementById("write-link");
  const searchInput = document.getElementById("search-input");

  let allPastes = [];

  const COPY_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/></svg>';
  const CHECK_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>';

  // Same workspace-detection as write.js: /{workspace}/write/manage is
  // rewritten to this page without changing the URL bar.
  const workspaceMatch = location.pathname.match(/^\/([a-z0-9-]+)\/write\/manage\/?$/);
  const workspace = workspaceMatch ? workspaceMatch[1] : null;
  const prefix = workspace ? `/${workspace}` : "";
  if (workspace) {
    writeLink.href = `${prefix}/write`;
  }

  function formatDate(iso) {
    if (!iso) return "unknown date";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  function renderRow(paste) {
    const li = document.createElement("li");
    li.className = "paste-row";
    li.dataset.slug = paste.slug;

    const info = document.createElement("div");
    info.className = "paste-info";

    const link = document.createElement("a");
    link.href = `${prefix}/${paste.slug}`;
    link.target = "_blank";
    link.rel = "noopener";
    link.className = "paste-slug";
    link.textContent = `${prefix}/${paste.slug}`;
    info.appendChild(link);

    const meta = document.createElement("div");
    meta.className = "paste-meta";
    const imgLabel = paste.imageCount ? ` · ${paste.imageCount} image${paste.imageCount === 1 ? "" : "s"}` : "";
    meta.textContent = `${formatDate(paste.createdAt)}${imgLabel}`;
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "paste-actions";
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "copy-link-btn";
    copyBtn.title = "Copy link";
    copyBtn.innerHTML = COPY_ICON;
    copyBtn.addEventListener("click", () => {
      const url = `${location.origin}${prefix}/${paste.slug}`;
      navigator.clipboard.writeText(url);
      copyBtn.innerHTML = CHECK_ICON;
      setTimeout(() => (copyBtn.innerHTML = COPY_ICON), 1500);
    });
    actions.appendChild(copyBtn);
    const editLink = document.createElement("a");
    editLink.href = `${prefix}/write?edit=${encodeURIComponent(paste.slug)}`;
    editLink.className = "edit-link";
    editLink.textContent = "Edit";
    actions.appendChild(editLink);
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "delete-btn";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => onDelete(paste.slug, li, delBtn));
    actions.appendChild(delBtn);

    li.appendChild(info);
    li.appendChild(actions);
    return li;
  }

  async function onDelete(slug, row, btn) {
    if (!confirm(`Delete "/${slug}"? This removes it from the live site (still recoverable from git history if needed).`)) {
      return;
    }
    btn.disabled = true;
    btn.textContent = "Deleting…";
    row.classList.add("removing");

    try {
      const res = await fetch("/.netlify/functions/delete-paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, workspace: workspace || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Delete failed.");
        btn.disabled = false;
        btn.textContent = "Delete";
        row.classList.remove("removing");
        return;
      }
      row.remove();
      allPastes = allPastes.filter((p) => p.slug !== slug);
      if (!listEl.children.length) {
        statusEl.textContent = searchInput.value.trim() ? "No notes match your search." : "No notes published yet.";
        statusEl.classList.remove("hidden");
      }
    } catch (err) {
      alert("Network error: " + err.message);
      btn.disabled = false;
      btn.textContent = "Delete";
      row.classList.remove("removing");
    }
  }

  function renderList(pastes) {
    listEl.innerHTML = "";
    for (const paste of pastes) {
      listEl.appendChild(renderRow(paste));
    }
  }

  function applySearch() {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = q ? allPastes.filter((p) => p.slug.toLowerCase().includes(q)) : allPastes;
    renderList(filtered);
    if (!filtered.length) {
      statusEl.textContent = q ? "No notes match your search." : "No notes published yet.";
      statusEl.classList.remove("hidden");
    } else {
      statusEl.classList.add("hidden");
    }
  }

  searchInput.addEventListener("input", applySearch);

  async function load() {
    try {
      const wsParam = workspace ? `?workspace=${encodeURIComponent(workspace)}` : "";
      const res = await fetch(`/.netlify/functions/list-pastes${wsParam}`);
      const data = await res.json();
      if (!res.ok) {
        statusEl.textContent = data.message || "Couldn't load notes.";
        return;
      }
      if (!data.pastes.length) {
        statusEl.textContent = "No notes published yet.";
        return;
      }
      allPastes = data.pastes;
      searchInput.hidden = false;
      statusEl.classList.add("hidden");
      renderList(allPastes);
    } catch (err) {
      statusEl.textContent = "Network error: " + err.message;
    }
  }

  load();
})();
