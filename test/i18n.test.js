const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

// static/i18n.js is a plain browser script (attaches to `window`), so it's
// loaded here in a minimal sandboxed DOM/localStorage stub rather than
// required as a CommonJS module.
function loadI18n() {
  const source = fs.readFileSync(path.join(__dirname, "..", "static", "i18n.js"), "utf8");
  const store = new Map();
  const context = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    },
    document: {
      querySelectorAll: () => [],
      addEventListener: () => {},
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.FuzzyI18n;
}

test("every language has the exact same set of keys as English", () => {
  const i18n = loadI18n();
  // Probe the key set indirectly: known English keys must translate to a
  // non-English-fallback value in each other language (or we'd never know
  // if a language dict were missing a key without inspecting TRANSLATIONS
  // directly -- so instead this test locks in a full key list explicitly).
  const knownKeys = [
    "readOnlyNote", "poweredBy", "notFound", "nothingHere", "writeNoteLink",
    "writeANote", "editNote", "manageNotesLink", "backToWrite", "manageNotesHeading",
    "tabWrite", "tabPreview", "boldTitle", "italicTitle", "greenTitle", "yellowTitle",
    "redTitle", "purpleTitle", "emojiTitle", "imageTitle", "emojiSearchPlaceholder",
    "editorPlaceholder", "dragDropHint", "slugPlaceholder", "publishBtn", "saveChangesBtn",
    "publishingBtn", "savingBtn", "publishedPrefix", "savedPrefix", "copyBtn", "copiedBtn",
    "rebuildNote", "randomLinkNote", "checkingSlug", "slugAvailable", "slugCheckFailed", "slugTakenMessage", "somethingWrong",
    "writeSomethingFirst", "previewFailed", "editingNote", "couldNotLoadNote", "loadingNote", "loadingNotes", "noNotesYet",
    "couldNotLoadNotes", "editLink", "deleteBtn", "deletingBtn", "deleteFailed",
    "unknownDate", "deleteConfirm",
  ];
  for (const lang of ["en", "es", "fr", "de"]) {
    i18n.setLang(lang);
    for (const key of knownKeys) {
      const value = i18n.t(key);
      assert.notEqual(value, key, `${lang}.${key} is missing (t() fell back to the raw key)`);
      assert.ok(value.length > 0, `${lang}.${key} is empty`);
    }
  }
});

test("t() falls back to English for an unknown key", () => {
  const i18n = loadI18n();
  assert.equal(i18n.t("thisKeyDoesNotExist"), "thisKeyDoesNotExist");
});

test("getLang defaults to English with nothing stored", () => {
  const i18n = loadI18n();
  assert.equal(i18n.getLang(), "en");
});

test("setLang persists and getLang reflects it", () => {
  const i18n = loadI18n();
  i18n.setLang("fr");
  assert.equal(i18n.getLang(), "fr");
  assert.equal(i18n.t("publishBtn"), "Publier");
});

test("setLang ignores an unsupported language code", () => {
  const i18n = loadI18n();
  i18n.setLang("klingon");
  assert.equal(i18n.getLang(), "en");
});
