(function () {
  const statusEl = document.getElementById("status");
  const listEl = document.getElementById("list");

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
    link.href = `/${paste.slug}`;
    link.target = "_blank";
    link.rel = "noopener";
    link.className = "paste-slug";
    link.textContent = `/${paste.slug}`;
    info.appendChild(link);

    const meta = document.createElement("div");
    meta.className = "paste-meta";
    const imgLabel = paste.imageCount ? ` · ${paste.imageCount} image${paste.imageCount === 1 ? "" : "s"}` : "";
    meta.textContent = `${formatDate(paste.createdAt)}${imgLabel}`;
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "paste-actions";
    const editLink = document.createElement("a");
    editLink.href = `/write?edit=${encodeURIComponent(paste.slug)}`;
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
        body: JSON.stringify({ slug }),
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
      if (!listEl.children.length) {
        statusEl.textContent = "No notes published yet.";
        statusEl.classList.remove("hidden");
      }
    } catch (err) {
      alert("Network error: " + err.message);
      btn.disabled = false;
      btn.textContent = "Delete";
      row.classList.remove("removing");
    }
  }

  async function load() {
    try {
      const res = await fetch("/.netlify/functions/list-pastes");
      const data = await res.json();
      if (!res.ok) {
        statusEl.textContent = data.message || "Couldn't load notes.";
        return;
      }
      if (!data.pastes.length) {
        statusEl.textContent = "No notes published yet.";
        return;
      }
      statusEl.classList.add("hidden");
      for (const paste of data.pastes) {
        listEl.appendChild(renderRow(paste));
      }
    } catch (err) {
      statusEl.textContent = "Network error: " + err.message;
    }
  }

  load();
})();
