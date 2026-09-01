const { getFile, getFileContent, putFile, listDir } = require("./lib/github");
const { normalizeSlug, isValidSlug, randomToken } = require("./lib/slug");
const { sanitizeFilename, base64Size } = require("./lib/paste-input");

const MAX_MARKDOWN_CHARS = 200_000;
const MAX_IMAGES = 12;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // per image, decoded
const MAX_TOTAL_IMAGE_BYTES = 4 * 1024 * 1024; // combined, decoded

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "invalid_json", message: "Request body must be JSON." });
  }

  const markdown = typeof payload.markdown === "string" ? payload.markdown : "";
  if (!markdown.trim()) {
    return json(400, { error: "empty_markdown", message: "Write something first." });
  }
  if (markdown.length > MAX_MARKDOWN_CHARS) {
    return json(400, {
      error: "markdown_too_long",
      message: `Content is too long (max ${MAX_MARKDOWN_CHARS.toLocaleString()} characters).`,
    });
  }

  const imagesIn = Array.isArray(payload.images) ? payload.images : [];
  if (imagesIn.length > MAX_IMAGES) {
    return json(400, { error: "too_many_images", message: `Max ${MAX_IMAGES} images per paste.` });
  }

  // Validate + sanitize images, dedupe filenames within this paste.
  const usedNames = new Set();
  const images = [];
  let totalImageBytes = 0;
  for (let i = 0; i < imagesIn.length; i++) {
    const img = imagesIn[i] || {};
    const dataBase64 = String(img.dataBase64 || "");
    if (!dataBase64) continue;
    const size = base64Size(dataBase64);
    if (size > MAX_IMAGE_BYTES) {
      return json(400, {
        error: "image_too_large",
        message: `"${img.filename || "image"}" is too large (max ${Math.round(
          MAX_IMAGE_BYTES / 1024 / 1024
        )}MB).`,
      });
    }
    totalImageBytes += size;
    if (totalImageBytes > MAX_TOTAL_IMAGE_BYTES) {
      return json(400, {
        error: "images_too_large",
        message: `Combined image size is too large (max ${Math.round(
          MAX_TOTAL_IMAGE_BYTES / 1024 / 1024
        )}MB total).`,
      });
    }
    let filename = sanitizeFilename(img.filename, i);
    if (!filename) {
      return json(400, {
        error: "unsupported_image_type",
        message: `Unsupported image type for "${img.filename || "image"}". Use png, jpg, gif or webp.`,
      });
    }
    let unique = filename;
    let n = 1;
    while (usedNames.has(unique)) {
      const dot = filename.lastIndexOf(".");
      unique = `${filename.slice(0, dot)}-${n}${filename.slice(dot)}`;
      n++;
    }
    usedNames.add(unique);
    images.push({ filename: unique, dataBase64 });
  }

  // Resolve the slug: either the caller-supplied custom link, or a random token.
  let slug;
  let customSlugRequested = false;
  const rawSlug = normalizeSlug(payload.slug);
  if (rawSlug) {
    customSlugRequested = true;
    if (!isValidSlug(rawSlug)) {
      return json(400, {
        error: "invalid_slug",
        message: "Link can only contain lowercase letters, numbers and hyphens (2-61 characters).",
      });
    }
    slug = rawSlug;
  }

  const overwrite = payload.overwrite === true;
  if (overwrite && !customSlugRequested) {
    return json(400, { error: "invalid_request", message: "Editing requires a link." });
  }

  try {
    let existingMeta = null; // { sha, content } -- set only when editing
    let existingContentSha;

    if (overwrite) {
      existingMeta = await getFileContent(`pastes/${slug}/meta.json`);
      if (!existingMeta.exists) {
        return json(404, { error: "not_found", message: "This note doesn't exist to edit." });
      }
      const contentFile = await getFile(`pastes/${slug}/content.md`);
      existingContentSha = contentFile.sha;
    } else if (customSlugRequested) {
      const existing = await getFile(`pastes/${slug}/meta.json`);
      if (existing.exists) {
        return json(409, {
          error: "slug_taken",
          message: "This link already exists — please choose a different one.",
        });
      }
    } else {
      // Generate a random token, retrying on the (very unlikely) collision.
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = randomToken(8);
        const existing = await getFile(`pastes/${candidate}/meta.json`);
        if (!existing.exists) {
          slug = candidate;
          break;
        }
      }
      if (!slug) {
        return json(500, { error: "token_generation_failed", message: "Could not generate a free link, try again." });
      }
    }

    const commitTag = `[paste ${slug}]`;

    // Commit content + images first; meta.json last, so build.js (which
    // requires meta.json to consider a paste "published") never picks up a
    // partially-written paste if something fails midway.
    await putFile(
      `pastes/${slug}/content.md`,
      Buffer.from(markdown, "utf8").toString("base64"),
      `${commitTag} ${overwrite ? "update" : "add"} content`,
      existingContentSha
    );

    for (const img of images) {
      const existingImg = await getFile(`pastes/${slug}/images/${img.filename}`);
      await putFile(
        `pastes/${slug}/images/${img.filename}`,
        img.dataBase64,
        `${commitTag} add image ${img.filename}`,
        existingImg.exists ? existingImg.sha : undefined
      );
    }

    // Count all images currently in the paste's folder (not just the ones
    // uploaded in this request), so editing and adding one more image
    // doesn't make imageCount regress to just the new upload.
    const allImages = await listDir(`pastes/${slug}/images`);

    let createdAt = new Date().toISOString();
    if (existingMeta) {
      try {
        createdAt = JSON.parse(existingMeta.content).createdAt || createdAt;
      } catch {
        // malformed existing meta.json; fall back to "now"
      }
    }

    const meta = {
      slug,
      createdAt,
      ...(overwrite ? { updatedAt: new Date().toISOString() } : {}),
      imageCount: allImages.length,
    };
    await putFile(
      `pastes/${slug}/meta.json`,
      Buffer.from(JSON.stringify(meta, null, 2), "utf8").toString("base64"),
      `${commitTag} ${overwrite ? "update" : "publish"}`,
      existingMeta ? existingMeta.sha : undefined
    );

    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
    return json(200, {
      slug,
      url: siteUrl ? `${siteUrl.replace(/\/$/, "")}/${slug}` : `/${slug}`,
    });
  } catch (err) {
    return json(500, {
      error: "publish_failed",
      message:
        "Publishing failed: " +
        err.message +
        (customSlugRequested
          ? ""
          : " If files were partially written under this link, it's safe to retry — a fresh link will be generated."),
    });
  }
};
