// Tiny client-side i18n for the tool's own UI chrome (not note content).
// Language choice is picked manually via a `.lang-picker` <select> on each
// page and remembered in localStorage.
(function () {
  const TRANSLATIONS = {
    en: {
      readOnlyNote: "Read-only note",
      poweredBy: "Powered by Life from AWU",
      notFound: "This note doesn't exist.",
      nothingHere: "Nothing to see here.",
      writeNoteLink: "Write a note →",
      writeANote: "Write a note",
      editNote: "Edit note",
      manageNotesLink: "Manage notes →",
      backToWrite: "← Write a new note",
      manageNotesHeading: "Manage notes",
      tabWrite: "Write",
      tabPreview: "Preview",
      boldTitle: "Bold",
      italicTitle: "Italic",
      greenTitle: "Green text",
      yellowTitle: "Yellow text",
      redTitle: "Red text",
      purpleTitle: "Purple text",
      emojiTitle: "Insert emoji",
      imageTitle: "Insert image",
      emojiSearchPlaceholder: "Search emoji…",
      editorPlaceholder: "Write your note here. Drag & drop or paste screenshots directly in.",
      dragDropHint: "Drag & drop images here, or paste a screenshot straight from your clipboard.",
      slugPlaceholder: "custom-link (optional)",
      publishBtn: "Publish",
      saveChangesBtn: "Save changes",
      publishingBtn: "Publishing…",
      savingBtn: "Saving…",
      publishedPrefix: "Published: ",
      savedPrefix: "Saved: ",
      copyBtn: "Copy",
      copiedBtn: "Copied!",
      rebuildNote: "Note: it can take up to a minute to go live while the site rebuilds.",
      randomLinkNote: "A random link will be generated.",
      checkingSlug: "Checking…",
      slugAvailable: "✓ Available",
      slugCheckFailed: "Couldn't check availability — you can still try publishing.",
      slugTakenMessage: "This link already exists — please choose a different one.",
      somethingWrong: "Something went wrong.",
      writeSomethingFirst: "Write something first.",
      previewFailed: "Preview failed.",
      editingNote: "Editing an existing note — its link can't be changed here.",
      couldNotLoadNote: "Couldn't load this note.",
      loadingNote: "Loading…",
      loadingNotes: "Loading…",
      noNotesYet: "No notes published yet.",
      couldNotLoadNotes: "Couldn't load notes.",
      editLink: "Edit",
      deleteBtn: "Delete",
      deletingBtn: "Deleting…",
      deleteFailed: "Delete failed.",
      unknownDate: "unknown date",
      deleteConfirm: 'Delete "/{slug}"? This removes it from the live site (still recoverable from git history if needed).',
    },
    es: {
      readOnlyNote: "Nota de solo lectura",
      poweredBy: "Desarrollado por Life de AWU",
      notFound: "Esta nota no existe.",
      nothingHere: "No hay nada que ver aquí.",
      writeNoteLink: "Escribir una nota →",
      writeANote: "Escribir una nota",
      editNote: "Editar nota",
      manageNotesLink: "Gestionar notas →",
      backToWrite: "← Escribir una nota nueva",
      manageNotesHeading: "Gestionar notas",
      tabWrite: "Escribir",
      tabPreview: "Vista previa",
      boldTitle: "Negrita",
      italicTitle: "Cursiva",
      greenTitle: "Texto verde",
      yellowTitle: "Texto amarillo",
      redTitle: "Texto rojo",
      purpleTitle: "Texto morado",
      emojiTitle: "Insertar emoji",
      imageTitle: "Insertar imagen",
      emojiSearchPlaceholder: "Buscar emoji…",
      editorPlaceholder: "Escribe tu nota aquí. Arrastra o pega capturas de pantalla directamente.",
      dragDropHint: "Arrastra imágenes aquí, o pega una captura de pantalla directamente desde el portapapeles.",
      slugPlaceholder: "enlace personalizado (opcional)",
      publishBtn: "Publicar",
      saveChangesBtn: "Guardar cambios",
      publishingBtn: "Publicando…",
      savingBtn: "Guardando…",
      publishedPrefix: "Publicado: ",
      savedPrefix: "Guardado: ",
      copyBtn: "Copiar",
      copiedBtn: "¡Copiado!",
      rebuildNote: "Nota: puede tardar hasta un minuto en estar disponible mientras el sitio se reconstruye.",
      randomLinkNote: "Se generará un enlace aleatorio.",
      checkingSlug: "Comprobando…",
      slugAvailable: "✓ Disponible",
      slugCheckFailed: "No se pudo comprobar la disponibilidad — aún puedes intentar publicar.",
      slugTakenMessage: "Este enlace ya existe — por favor, elige otro.",
      somethingWrong: "Algo salió mal.",
      writeSomethingFirst: "Escribe algo primero.",
      previewFailed: "Error al generar la vista previa.",
      editingNote: "Editando una nota existente — su enlace no se puede cambiar aquí.",
      couldNotLoadNote: "No se pudo cargar esta nota.",
      loadingNote: "Cargando…",
      loadingNotes: "Cargando…",
      noNotesYet: "Aún no se ha publicado ninguna nota.",
      couldNotLoadNotes: "No se pudieron cargar las notas.",
      editLink: "Editar",
      deleteBtn: "Eliminar",
      deletingBtn: "Eliminando…",
      deleteFailed: "Error al eliminar.",
      unknownDate: "fecha desconocida",
      deleteConfirm: '¿Eliminar "/{slug}"? Esto la quita del sitio en vivo (aún recuperable desde el historial de git si es necesario).',
    },
    fr: {
      readOnlyNote: "Note en lecture seule",
      poweredBy: "Propulsé par Life de AWU",
      notFound: "Cette note n'existe pas.",
      nothingHere: "Rien à voir ici.",
      writeNoteLink: "Écrire une note →",
      writeANote: "Écrire une note",
      editNote: "Modifier la note",
      manageNotesLink: "Gérer les notes →",
      backToWrite: "← Écrire une nouvelle note",
      manageNotesHeading: "Gérer les notes",
      tabWrite: "Écrire",
      tabPreview: "Aperçu",
      boldTitle: "Gras",
      italicTitle: "Italique",
      greenTitle: "Texte vert",
      yellowTitle: "Texte jaune",
      redTitle: "Texte rouge",
      purpleTitle: "Texte violet",
      emojiTitle: "Insérer un emoji",
      imageTitle: "Insérer une image",
      emojiSearchPlaceholder: "Rechercher un emoji…",
      editorPlaceholder: "Écrivez votre note ici. Glissez-déposez ou collez des captures d'écran directement.",
      dragDropHint: "Glissez-déposez des images ici, ou collez une capture d'écran directement depuis le presse-papiers.",
      slugPlaceholder: "lien personnalisé (facultatif)",
      publishBtn: "Publier",
      saveChangesBtn: "Enregistrer les modifications",
      publishingBtn: "Publication…",
      savingBtn: "Enregistrement…",
      publishedPrefix: "Publié : ",
      savedPrefix: "Enregistré : ",
      copyBtn: "Copier",
      copiedBtn: "Copié !",
      rebuildNote: "Remarque : la mise en ligne peut prendre jusqu'à une minute pendant la reconstruction du site.",
      randomLinkNote: "Un lien aléatoire sera généré.",
      checkingSlug: "Vérification…",
      slugAvailable: "✓ Disponible",
      slugCheckFailed: "Impossible de vérifier la disponibilité — vous pouvez toujours essayer de publier.",
      slugTakenMessage: "Ce lien existe déjà — veuillez en choisir un autre.",
      somethingWrong: "Une erreur s'est produite.",
      writeSomethingFirst: "Écrivez d'abord quelque chose.",
      previewFailed: "Échec de l'aperçu.",
      editingNote: "Modification d'une note existante — son lien ne peut pas être changé ici.",
      couldNotLoadNote: "Impossible de charger cette note.",
      loadingNote: "Chargement…",
      loadingNotes: "Chargement…",
      noNotesYet: "Aucune note publiée pour le moment.",
      couldNotLoadNotes: "Impossible de charger les notes.",
      editLink: "Modifier",
      deleteBtn: "Supprimer",
      deletingBtn: "Suppression…",
      deleteFailed: "Échec de la suppression.",
      unknownDate: "date inconnue",
      deleteConfirm: "Supprimer « /{slug} » ? Cela la retire du site en ligne (toujours récupérable depuis l'historique git si besoin).",
    },
    de: {
      readOnlyNote: "Schreibgeschützte Notiz",
      poweredBy: "Bereitgestellt von Life von AWU",
      notFound: "Diese Notiz existiert nicht.",
      nothingHere: "Hier gibt es nichts zu sehen.",
      writeNoteLink: "Notiz schreiben →",
      writeANote: "Notiz schreiben",
      editNote: "Notiz bearbeiten",
      manageNotesLink: "Notizen verwalten →",
      backToWrite: "← Neue Notiz schreiben",
      manageNotesHeading: "Notizen verwalten",
      tabWrite: "Schreiben",
      tabPreview: "Vorschau",
      boldTitle: "Fett",
      italicTitle: "Kursiv",
      greenTitle: "Grüner Text",
      yellowTitle: "Gelber Text",
      redTitle: "Roter Text",
      purpleTitle: "Lila Text",
      emojiTitle: "Emoji einfügen",
      imageTitle: "Bild einfügen",
      emojiSearchPlaceholder: "Emoji suchen…",
      editorPlaceholder: "Schreibe deine Notiz hier. Bilder per Drag & Drop oder direkt einfügen.",
      dragDropHint: "Bilder hierher ziehen oder einen Screenshot direkt aus der Zwischenablage einfügen.",
      slugPlaceholder: "eigener Link (optional)",
      publishBtn: "Veröffentlichen",
      saveChangesBtn: "Änderungen speichern",
      publishingBtn: "Wird veröffentlicht…",
      savingBtn: "Wird gespeichert…",
      publishedPrefix: "Veröffentlicht: ",
      savedPrefix: "Gespeichert: ",
      copyBtn: "Kopieren",
      copiedBtn: "Kopiert!",
      rebuildNote: "Hinweis: Es kann bis zu einer Minute dauern, bis die Seite live ist, während die Website neu gebaut wird.",
      randomLinkNote: "Es wird ein zufälliger Link generiert.",
      checkingSlug: "Wird geprüft…",
      slugAvailable: "✓ Verfügbar",
      slugCheckFailed: "Verfügbarkeit konnte nicht geprüft werden — du kannst trotzdem versuchen zu veröffentlichen.",
      slugTakenMessage: "Dieser Link existiert bereits — bitte wähle einen anderen.",
      somethingWrong: "Etwas ist schiefgelaufen.",
      writeSomethingFirst: "Schreibe zuerst etwas.",
      previewFailed: "Vorschau fehlgeschlagen.",
      editingNote: "Eine bestehende Notiz wird bearbeitet — ihr Link kann hier nicht geändert werden.",
      couldNotLoadNote: "Diese Notiz konnte nicht geladen werden.",
      loadingNote: "Wird geladen…",
      loadingNotes: "Wird geladen…",
      noNotesYet: "Noch keine Notizen veröffentlicht.",
      couldNotLoadNotes: "Notizen konnten nicht geladen werden.",
      editLink: "Bearbeiten",
      deleteBtn: "Löschen",
      deletingBtn: "Wird gelöscht…",
      deleteFailed: "Löschen fehlgeschlagen.",
      unknownDate: "unbekanntes Datum",
      deleteConfirm: 'Notiz "/{slug}" löschen? Sie wird von der Live-Seite entfernt (bei Bedarf aus dem Git-Verlauf wiederherstellbar).',
    },
  };

  const LANG_NAMES = { en: "English", es: "Español", fr: "Français", de: "Deutsch" };
  const STORAGE_KEY = "fuzzy-lang";

  function getLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return TRANSLATIONS[stored] ? stored : "en";
  }

  function setLang(lang) {
    if (TRANSLATIONS[lang]) localStorage.setItem(STORAGE_KEY, lang);
  }

  function t(key) {
    const dict = TRANSLATIONS[getLang()] || TRANSLATIONS.en;
    return dict[key] || TRANSLATIONS.en[key] || key;
  }

  function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    document.querySelectorAll(".lang-picker").forEach((picker) => {
      picker.value = getLang();
    });
  }

  function initLangPickers() {
    document.querySelectorAll(".lang-picker").forEach((picker) => {
      if (!picker.options.length) {
        for (const [code, name] of Object.entries(LANG_NAMES)) {
          const opt = document.createElement("option");
          opt.value = code;
          opt.textContent = name;
          picker.appendChild(opt);
        }
      }
      picker.value = getLang();
      picker.addEventListener("change", () => {
        setLang(picker.value);
        applyTranslations();
        document.dispatchEvent(new Event("fuzzy:langchange"));
      });
    });
  }

  window.FuzzyI18n = { t, getLang, setLang, applyTranslations };

  document.addEventListener("DOMContentLoaded", () => {
    initLangPickers();
    applyTranslations();
  });
})();
