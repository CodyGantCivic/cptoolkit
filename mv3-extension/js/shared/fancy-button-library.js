(function(root) {
  "use strict";

  // Shared normalization and view helpers for both Fancy Button library surfaces.
  // Keep CMS payload fields (for example categoryID) separate from cpToolkit
  // metadata, which is only used to organize saved buttons inside the extension.
  var DEFAULT_CATEGORY = "Uncategorized";
  var BUILTIN_CATEGORY = "Built-in Templates";

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeLower(value) {
    return normalizeText(value).toLowerCase();
  }

  function sanitizeStyleText(value) {
    return String(value || "")
      .replace(/\u0000/g, "")
      .replace(/<\/style/gi, "<\\/style");
  }

  function sanitizeFontWeight(value) {
    var normalized = normalizeLower(value);
    if (normalized === "normal") return "400";
    if (normalized === "bold") return "700";
    return /^\d{1,4}$/.test(normalized) ? normalized : "400";
  }

  function sanitizeButtonTextHtml(value) {
    var source = String(value == null ? "" : value);
    if (!source) return "";
    if (!root.document) return normalizeText(source);

    var template = root.document.createElement("template");
    template.innerHTML = source;

    var output = root.document.createElement("div");
    var allowedTags = {
      B: true,
      BR: true,
      EM: true,
      I: true,
      SPAN: true,
      STRONG: true,
      SUB: true,
      SUP: true,
      U: true
    };
    var blockedTags = {
      EMBED: true,
      IFRAME: true,
      LINK: true,
      META: true,
      OBJECT: true,
      SCRIPT: true,
      STYLE: true
    };

    function copySafeNode(node, parent) {
      if (node.nodeType === Node.TEXT_NODE) {
        parent.appendChild(root.document.createTextNode(node.nodeValue || ""));
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      var tagName = node.tagName.toUpperCase();
      if (blockedTags[tagName]) return;

      var target = parent;
      if (allowedTags[tagName]) {
        target = root.document.createElement(tagName.toLowerCase());
        if (tagName === "SPAN" && node.classList) {
          var safeClasses = Array.prototype.slice.call(node.classList).filter(function(className) {
            return /^textStyle\d+$/.test(className);
          });
          if (safeClasses.length) target.setAttribute("class", safeClasses.join(" "));
        }
        parent.appendChild(target);
      }

      if (tagName === "BR") return;
      Array.prototype.slice.call(node.childNodes).forEach(function(child) {
        copySafeNode(child, target);
      });
    }

    Array.prototype.slice.call(template.content.childNodes).forEach(function(child) {
      copySafeNode(child, output);
    });

    return output.innerHTML;
  }

  function formatName(key) {
    return normalizeText(key).replace(/_/g, " ");
  }

  function makeStorageKey(name) {
    return normalizeText(name).replace(/\s+/g, "_");
  }

  function getMetadata(template) {
    if (!isPlainObject(template)) return {};
    return isPlainObject(template.cpToolkit) ? template.cpToolkit : {};
  }

  function getCategory(template, isCustom) {
    var meta = getMetadata(template);
    var flat = isPlainObject(template) ? template : {};
    var category = normalizeText(
      meta.category ||
      flat.libraryCategory ||
      flat.category
    );

    if (category) return category;
    return isCustom ? DEFAULT_CATEGORY : BUILTIN_CATEGORY;
  }

  function getSourceSite(template) {
    var meta = getMetadata(template);
    var flat = isPlainObject(template) ? template : {};
    return normalizeText(
      meta.sourceSite ||
      flat.sourceSite ||
      flat.site ||
      ""
    );
  }

  function getSavedAt(template) {
    var meta = getMetadata(template);
    var flat = isPlainObject(template) ? template : {};
    return normalizeText(meta.savedAt || flat.savedAt || "");
  }

  function getUpdatedAt(template) {
    var meta = getMetadata(template);
    var flat = isPlainObject(template) ? template : {};
    return normalizeText(meta.updatedAt || flat.updatedAt || "");
  }

  function setMetadata(template, metadata) {
    var target = isPlainObject(template) ? template : {};
    var existing = getMetadata(target);
    var next = Object.assign({}, existing);
    var now = new Date().toISOString();

    if (metadata && Object.prototype.hasOwnProperty.call(metadata, "category")) {
      next.category = normalizeText(metadata.category) || DEFAULT_CATEGORY;
    } else if (!normalizeText(next.category)) {
      next.category = DEFAULT_CATEGORY;
    }

    if (metadata && Object.prototype.hasOwnProperty.call(metadata, "sourceSite")) {
      next.sourceSite = normalizeText(metadata.sourceSite);
    } else if (!Object.prototype.hasOwnProperty.call(next, "sourceSite")) {
      next.sourceSite = getSourceSite(target);
    }

    if (metadata && metadata.savedAt) {
      next.savedAt = metadata.savedAt;
    } else if (!next.savedAt) {
      next.savedAt = getSavedAt(target) || now;
    }

    next.updatedAt = now;
    target.cpToolkit = next;
    return target;
  }

  function cloneTemplate(template) {
    if (!isPlainObject(template)) return {};
    try {
      return JSON.parse(JSON.stringify(template));
    } catch (err) {
      return Object.assign({}, template);
    }
  }

  function stripLibraryMetadata(template) {
    var clean = cloneTemplate(template);

    delete clean.cpToolkit;
    delete clean.libraryCategory;
    delete clean.category;
    delete clean.sourceSite;
    delete clean.site;
    delete clean.savedAt;
    delete clean.updatedAt;
    delete clean.previewImage;
    delete clean.previewText;
    delete clean.savedImages;

    return clean;
  }

  function buildHaystack(entry) {
    var template = entry.template || {};
    var styleText = "";
    if (Array.isArray(template.styles)) {
      styleText = template.styles.map(function(style) {
        return [style.Key, style.Value].join(" ");
      }).join(" ");
    }

    return [
      entry.key,
      entry.name,
      entry.category,
      entry.sourceSite,
      entry.typeLabel,
      template.buttonText,
      template.previewText,
      template.linkUrl,
      styleText
    ].join(" ").toLowerCase();
  }

  function normalizeEntry(key, template, isCustom) {
    var category = getCategory(template, isCustom);
    var sourceSite = getSourceSite(template);
    return {
      key: key,
      fullKey: (isCustom ? "custom:" : "builtin:") + key,
      template: template || {},
      isCustom: !!isCustom,
      type: isCustom ? "custom" : "builtin",
      typeLabel: isCustom ? "Saved" : "Built-in",
      name: formatName(key),
      category: category,
      sourceSite: sourceSite,
      savedAt: getSavedAt(template),
      updatedAt: getUpdatedAt(template)
    };
  }

  function typeMatches(typeFilter, entry) {
    if (!typeFilter || typeFilter === "all") return true;
    return entry.type === typeFilter;
  }

  function categoryMatches(categoryFilter, entry) {
    if (!categoryFilter) return true;
    return normalizeLower(entry.category || DEFAULT_CATEGORY) === normalizeLower(categoryFilter);
  }

  function sourceMatches(sourceFilter, entry) {
    if (!sourceFilter) return true;
    return normalizeLower(entry.sourceSite) === normalizeLower(sourceFilter);
  }

  function queryMatches(query, entry) {
    var normalized = normalizeLower(query);
    if (!normalized) return true;

    var haystack = buildHaystack(entry);
    return normalized.split(/\s+/).every(function(part) {
      return haystack.indexOf(part) !== -1;
    });
  }

  function filterEntries(entries, state) {
    var source = Array.isArray(entries) ? entries : [];
    var filters = state || {};

    return source.filter(function(entry) {
      return typeMatches(filters.type, entry) &&
        categoryMatches(filters.category, entry) &&
        sourceMatches(filters.sourceSite, entry) &&
        queryMatches(filters.query, entry);
    });
  }

  function compareText(a, b) {
    return normalizeLower(a).localeCompare(normalizeLower(b));
  }

  function compareDateDesc(a, b) {
    var aTime = Date.parse(a || "") || 0;
    var bTime = Date.parse(b || "") || 0;
    return bTime - aTime;
  }

  function sortEntries(entries, sortBy) {
    var sorted = (Array.isArray(entries) ? entries : []).slice();
    var mode = sortBy || "name";

    sorted.sort(function(a, b) {
      if (mode === "category") {
        return compareText(a.category, b.category) || compareText(a.name, b.name);
      }
      if (mode === "type") {
        return compareText(a.typeLabel, b.typeLabel) || compareText(a.name, b.name);
      }
      if (mode === "newest") {
        return compareDateDesc(a.savedAt, b.savedAt) || compareText(a.name, b.name);
      }
      if (mode === "updated") {
        return compareDateDesc(a.updatedAt || a.savedAt, b.updatedAt || b.savedAt) ||
          compareText(a.name, b.name);
      }
      return compareText(a.name, b.name);
    });

    return sorted;
  }

  function uniqueSorted(values) {
    var seen = {};
    var result = [];

    values.forEach(function(value) {
      var label = normalizeText(value);
      var key = normalizeLower(label);
      if (!label || seen[key]) return;
      seen[key] = true;
      result.push(label);
    });

    result.sort(compareText);
    return result;
  }

  function getCategoryOptions(entries) {
    return uniqueSorted((entries || []).map(function(entry) {
      return entry.category || DEFAULT_CATEGORY;
    }));
  }

  function getSourceOptions(entries) {
    return uniqueSorted((entries || []).map(function(entry) {
      return entry.sourceSite;
    }));
  }

  function groupEntriesByCategory(entries) {
    var groupsByKey = {};

    (entries || []).forEach(function(entry) {
      var category = entry.category || DEFAULT_CATEGORY;
      var key = normalizeLower(category) || normalizeLower(DEFAULT_CATEGORY);
      if (!groupsByKey[key]) {
        groupsByKey[key] = {
          key: key,
          category: category,
          entries: []
        };
      }
      groupsByKey[key].entries.push(entry);
    });

    return Object.keys(groupsByKey).map(function(key) {
      return groupsByKey[key];
    }).sort(function(a, b) {
      return compareText(a.category, b.category);
    });
  }

  function getCollapsedKey(category) {
    return normalizeLower(category || DEFAULT_CATEGORY) || "uncategorized";
  }

  var api = {
    DEFAULT_CATEGORY: DEFAULT_CATEGORY,
    BUILTIN_CATEGORY: BUILTIN_CATEGORY,
    formatName: formatName,
    makeStorageKey: makeStorageKey,
    normalizeText: normalizeText,
    sanitizeButtonTextHtml: sanitizeButtonTextHtml,
    sanitizeFontWeight: sanitizeFontWeight,
    sanitizeStyleText: sanitizeStyleText,
    getCategory: getCategory,
    getSourceSite: getSourceSite,
    getSavedAt: getSavedAt,
    getUpdatedAt: getUpdatedAt,
    setMetadata: setMetadata,
    cloneTemplate: cloneTemplate,
    stripLibraryMetadata: stripLibraryMetadata,
    normalizeEntry: normalizeEntry,
    filterEntries: filterEntries,
    sortEntries: sortEntries,
    getCategoryOptions: getCategoryOptions,
    getSourceOptions: getSourceOptions,
    groupEntriesByCategory: groupEntriesByCategory,
    getCollapsedKey: getCollapsedKey
  };

  root.CPToolkit = root.CPToolkit || {};
  root.CPToolkit.fancyButtonLibrary = api;
  root.CPToolkitFancyButtonLibrary = api;
})(typeof window !== "undefined" ? window : this);
