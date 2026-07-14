(function(root) {
  "use strict";

  // Shared storage contract for the CMS sidebar and full Snippet Library page.
  // Update this normalizer first when adding snippet/skin fields so older
  // chrome.storage.local data and exported JSON continue to load safely.
  var USER_SNIPPETS_KEY = "cp-toolkit-user-snippets";
  var COPIED_SKINS_KEY = "cp-toolkit-copied-skins";
  var SNIPPET_ORDER_KEY = "cp-toolkit-snippet-order";
  var EXPORT_VERSION = 2;

  var COMPONENT_TYPES = [
    { id: 0, name: "Wrapper", description: "Outer container styles" },
    { id: 1, name: "Header", description: "Widget header styles" },
    { id: 2, name: "Item List", description: "Container for all items" },
    { id: 3, name: "Item", description: "Individual item styles" },
    { id: 4, name: "Item Title", description: "Title text within items" },
    { id: 5, name: "Item Secondary Text", description: "Secondary/description text" },
    { id: 6, name: "Item Bullets", description: "Bullet point styles" },
    { id: 7, name: "Item Link", description: "Links within items" },
    { id: 8, name: '"Read on" Link', description: "Read more link styles" },
    { id: 9, name: '"View all" Link', description: "View all link styles" },
    { id: 10, name: '"RSS" Link', description: "RSS feed link styles" },
    { id: 11, name: "Footer", description: "Widget footer styles" },
    { id: 12, name: "Tab List", description: "Tabbed widget tab list" },
    { id: 13, name: "Tab", description: "Tabbed widget tab" },
    { id: 14, name: "Tab Panel", description: "Tabbed widget panel" },
    { id: 15, name: "Column Separator", description: "Column separator styles" },
    { id: 16, name: "Calendar Header", description: "Calendar header styles" },
    { id: 17, name: "Cal Grid", description: "Calendar grid styles" },
    { id: 18, name: "Cal Day Headers", description: "Calendar day header styles" },
    { id: 19, name: "Cal Day", description: "Calendar day styles" },
    { id: 20, name: "Cal Event Link", description: "Calendar event link styles" },
    { id: 21, name: "Cal Today", description: "Calendar today styles" },
    { id: 22, name: "Cal Day Not In Month", description: "Calendar out-of-month day styles" },
    { id: 23, name: "Cal Wrapper", description: "Calendar wrapper styles" }
  ];

  function hasChromeStorage() {
    return !!(root.chrome && chrome.storage && chrome.storage.local);
  }

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function storageGet(key) {
    return new Promise(function(resolve) {
      if (!hasChromeStorage()) {
        resolve(undefined);
        return;
      }

      chrome.storage.local.get(key, function(result) {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn("[CP Toolkit](snippet-library-store) Failed to load " + key + ":", chrome.runtime.lastError);
          resolve(undefined);
          return;
        }

        resolve(result ? result[key] : undefined);
      });
    });
  }

  function storageSet(key, value) {
    return new Promise(function(resolve, reject) {
      if (!hasChromeStorage()) {
        resolve();
        return;
      }

      var payload = {};
      payload[key] = value;
      chrome.storage.local.set(payload, function() {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.error("[CP Toolkit](snippet-library-store) Failed to save " + key + ":", chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }

        resolve();
      });
    });
  }

  function slugify(value, fallback) {
    var slug = String(value || fallback || "item")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return slug || String(fallback || "item");
  }

  function createId(prefix, name) {
    return [
      prefix || "item",
      slugify(name, prefix || "item"),
      Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    ].join("-");
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeTags(value) {
    if (Array.isArray(value)) {
      return value
        .map(function(item) { return normalizeText(item); })
        .filter(Boolean)
        .filter(function(item, index, list) {
          return list.indexOf(item) === index;
        });
    }

    if (typeof value === "string") {
      return normalizeTags(value.split(","));
    }

    return [];
  }

  function getComponentType(componentId) {
    var id = parseInt(componentId, 10);
    for (var i = 0; i < COMPONENT_TYPES.length; i++) {
      if (COMPONENT_TYPES[i].id === id) {
        return COMPONENT_TYPES[i];
      }
    }
    return null;
  }

  function getComponentCode(component) {
    if (typeof component === "string") {
      return component;
    }

    if (isPlainObject(component)) {
      if (typeof component.code === "string") return component.code;
      if (typeof component.css === "string") return component.css;
      if (typeof component.value === "string") return component.value;
    }

    return "";
  }

  function getComponentLabel(componentId, component, snippet) {
    if (isPlainObject(component) && component.label) {
      return String(component.label);
    }

    if (snippet && snippet.componentLabels && snippet.componentLabels[componentId]) {
      return String(snippet.componentLabels[componentId]);
    }

    var componentType = getComponentType(componentId);
    return componentType ? componentType.name : "Component " + componentId;
  }

  function normalizeSnippetComponents(rawComponents) {
    var result = {
      components: undefined,
      componentLabels: undefined
    };

    if (!rawComponents) return result;

    var components = {};
    var labels = {};

    if (Array.isArray(rawComponents)) {
      rawComponents.forEach(function(component) {
        if (!component) return;
        var id = component.id;
        if (id === undefined) id = component.idx;
        if (id === undefined) id = component.componentId;
        if (id === undefined) return;

        var key = String(id);
        var code = getComponentCode(component);
        if (!code.trim()) return;

        components[key] = code;
        if (component.label) labels[key] = String(component.label);
      });
    } else if (isPlainObject(rawComponents)) {
      Object.keys(rawComponents).forEach(function(key) {
        var component = rawComponents[key];
        var code = getComponentCode(component);
        if (!code.trim()) return;

        components[String(key)] = code;
        if (isPlainObject(component) && component.label) {
          labels[String(key)] = String(component.label);
        }
      });
    }

    if (Object.keys(components).length > 0) {
      result.components = components;
    }
    if (Object.keys(labels).length > 0) {
      result.componentLabels = labels;
    }

    return result;
  }

  function normalizeSnippet(rawSnippet, fallbackKey) {
    var source = isPlainObject(rawSnippet) ? rawSnippet : {};
    var componentData = normalizeSnippetComponents(source.components);
    var normalized = {};

    Object.keys(source).forEach(function(key) {
      normalized[key] = source[key];
    });

    normalized.name = normalizeText(source.name) || normalizeText(fallbackKey) || "Untitled Snippet";
    normalized.category = normalizeText(source.category) || "Custom";
    normalized.tags = normalizeTags(source.tags);
    normalized.description = normalizeText(source.description);
    normalized.dynamicSelector = source.dynamicSelector === true;
    normalized.alwaysInQuickList = source.alwaysInQuickList === true || source.alwaysShow === true;
    normalized.isUserSnippet = source.isUserSnippet === false ? false : true;

    if (componentData.components) {
      normalized.components = componentData.components;
      normalized.code = "";
    } else {
      normalized.code = typeof source.code === "string" ? source.code : "";
      delete normalized.components;
    }

    if (componentData.componentLabels) {
      normalized.componentLabels = componentData.componentLabels;
    } else if (isPlainObject(source.componentLabels)) {
      normalized.componentLabels = source.componentLabels;
    } else {
      delete normalized.componentLabels;
    }

    if (source.createdAt) normalized.createdAt = source.createdAt;
    if (source.updatedAt) normalized.updatedAt = source.updatedAt;

    delete normalized.alwaysShow;
    return normalized;
  }

  function normalizeSnippetCollection(rawSnippets, options) {
    var source = isPlainObject(rawSnippets) ? rawSnippets : {};
    var normalized = {};
    var forceUserSnippet = !options || options.forceUserSnippet !== false;

    Object.keys(source).forEach(function(key) {
      var snippet = normalizeSnippet(source[key], key);
      if (!forceUserSnippet && source[key] && source[key].isUserSnippet === false) {
        snippet.isUserSnippet = false;
      }
      normalized[key] = snippet;
    });

    return normalized;
  }

  function normalizeSourceSite(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";

    try {
      return new URL(raw).hostname || raw.replace(/^https?:\/\//, "");
    } catch (err) {
      return raw.replace(/^https?:\/\//, "");
    }
  }

  function normalizeSourceUrl(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";

    try {
      var parsed = new URL(raw);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
    } catch (err) {
      return "";
    }
  }

  function normalizeSavedSkin(rawSkin, fallbackKey) {
    var source = isPlainObject(rawSkin) ? rawSkin : {};
    var normalized = {};

    Object.keys(source).forEach(function(key) {
      normalized[key] = source[key];
    });

    normalized.type = "savedSkin";
    normalized.name = normalizeText(source.name) || normalizeText(source.sourceSkinName) || normalizeText(fallbackKey) || "Saved Skin";
    normalized.category = normalizeText(source.category);
    normalized.tags = normalizeTags(source.tags);
    normalized.description = normalizeText(source.description);
    normalized.sourceSkinName = normalizeText(source.sourceSkinName);
    normalized.sourceSkinID = source.sourceSkinID;
    normalized.sourceUrl = normalizeSourceUrl(source.sourceUrl);
    normalized.sourceSite = normalizeText(source.sourceSite) || normalizeSourceSite(normalized.sourceUrl);
    normalized.savedAt = source.savedAt || source.createdAt || "";
    normalized.updatedAt = source.updatedAt || "";
    normalized.version = source.version || "1.1";
    normalized.componentIndexes = Array.isArray(source.componentIndexes) ? source.componentIndexes.slice() : [];
    normalized.components = Array.isArray(source.components) ? source.components.slice() : [];

    return normalized;
  }

  function normalizeSkinCollection(rawSkins) {
    var source = isPlainObject(rawSkins) ? rawSkins : {};
    var normalized = {};

    Object.keys(source).forEach(function(key) {
      normalized[key] = normalizeSavedSkin(source[key], key);
    });

    return normalized;
  }

  function isSavedSkinRecord(key, item) {
    if (!isPlainObject(item)) return false;
    if (item.type === "savedSkin") return true;
    if (String(key || "").indexOf("skin-") === 0 && Array.isArray(item.components)) return true;
    return Array.isArray(item.components) && (item.sourceSkinID !== undefined || item.sourceSkinName);
  }

  function parseImportPayload(payload) {
    var snippets = {};
    var skins = {};

    if (!isPlainObject(payload)) {
      return { snippets: snippets, skins: skins };
    }

    if (payload.version >= 2 && (isPlainObject(payload.snippets) || isPlainObject(payload.skins))) {
      snippets = normalizeSnippetCollection(payload.snippets || {});
      skins = normalizeSkinCollection(payload.skins || {});
      return { snippets: snippets, skins: skins };
    }

    Object.keys(payload).forEach(function(key) {
      var item = payload[key];
      if (isSavedSkinRecord(key, item)) {
        skins[key] = normalizeSavedSkin(item, key);
      } else if (isPlainObject(item)) {
        snippets[key] = normalizeSnippet(item, key);
      }
    });

    return { snippets: snippets, skins: skins };
  }

  function buildExportPayload(userSnippets, copiedSkins) {
    var snippets = normalizeSnippetCollection(userSnippets || {});
    var skins = normalizeSkinCollection(copiedSkins || {});

    Object.keys(snippets).forEach(function(key) {
      snippets[key].type = "snippet";
      delete snippets[key].isUserSnippet;
    });

    return {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      snippets: snippets,
      skins: skins
    };
  }

  function loadUserSnippets() {
    return storageGet(USER_SNIPPETS_KEY).then(function(raw) {
      return normalizeSnippetCollection(raw || {});
    });
  }

  function saveUserSnippets(snippets) {
    return storageSet(USER_SNIPPETS_KEY, normalizeSnippetCollection(snippets || {}));
  }

  function loadCopiedSkins() {
    return storageGet(COPIED_SKINS_KEY).then(function(raw) {
      return normalizeSkinCollection(raw || {});
    });
  }

  function saveCopiedSkins(skins) {
    return storageSet(COPIED_SKINS_KEY, normalizeSkinCollection(skins || {}));
  }

  function loadSnippetOrder() {
    return storageGet(SNIPPET_ORDER_KEY).then(function(raw) {
      return Array.isArray(raw) ? raw.slice() : [];
    });
  }

  function saveSnippetOrder(order) {
    return storageSet(SNIPPET_ORDER_KEY, Array.isArray(order) ? order.slice() : []);
  }

  function loadLibrary() {
    return Promise.all([loadUserSnippets(), loadCopiedSkins(), loadSnippetOrder()]).then(function(results) {
      return {
        snippets: results[0],
        skins: results[1],
        snippetOrder: results[2]
      };
    });
  }

  var api = {
    keys: {
      userSnippets: USER_SNIPPETS_KEY,
      copiedSkins: COPIED_SKINS_KEY,
      snippetOrder: SNIPPET_ORDER_KEY
    },
    exportVersion: EXPORT_VERSION,
    componentTypes: COMPONENT_TYPES,
    createId: createId,
    getComponentCode: getComponentCode,
    getComponentLabel: getComponentLabel,
    normalizeSnippet: normalizeSnippet,
    normalizeSnippetCollection: normalizeSnippetCollection,
    normalizeSavedSkin: normalizeSavedSkin,
    normalizeSkinCollection: normalizeSkinCollection,
    parseImportPayload: parseImportPayload,
    buildExportPayload: buildExportPayload,
    loadUserSnippets: loadUserSnippets,
    saveUserSnippets: saveUserSnippets,
    loadCopiedSkins: loadCopiedSkins,
    saveCopiedSkins: saveCopiedSkins,
    loadSnippetOrder: loadSnippetOrder,
    saveSnippetOrder: saveSnippetOrder,
    loadLibrary: loadLibrary
  };

  root.CPToolkit = root.CPToolkit || {};
  root.CPToolkit.snippetLibraryStore = api;
  root.CPToolkitSnippetLibraryStore = api;
})(typeof window !== "undefined" ? window : this);
