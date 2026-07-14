(function(root) {
  "use strict";

  // Shared query/filter/sort/group behavior for snippets and saved skins.
  // Sidebar and full-page UIs should call this instead of maintaining separate
  // filtering logic.
  var DEFAULT_STATE = {
    query: "",
    category: "",
    groupByCategory: false,
    includeSnippets: true,
    includeSkins: true,
    sortBy: "manual",
    userOnly: false,
    dynamicOnly: false,
    multiOnly: false,
    quickOnly: false,
    collapsedCategories: {}
  };

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function cloneState(state) {
    var source = Object.assign({}, DEFAULT_STATE, state || {});
    source.collapsedCategories = Object.assign({}, source.collapsedCategories || {});
    return source;
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeLower(value) {
    return normalizeText(value).toLowerCase();
  }

  function getSnippetComponentText(snippet) {
    if (!snippet || !snippet.components) return "";

    var store = root.CPToolkitSnippetLibraryStore || (root.CPToolkit && root.CPToolkit.snippetLibraryStore);
    return Object.keys(snippet.components).map(function(componentId) {
      var component = snippet.components[componentId];
      if (store) return store.getComponentCode(component);
      if (typeof component === "string") return component;
      if (isPlainObject(component) && typeof component.code === "string") return component.code;
      return "";
    }).join("\n");
  }

  function snippetHasComponents(snippet) {
    return !!(snippet && snippet.components && Object.keys(snippet.components).length > 0);
  }

  function buildSnippetHaystack(key, snippet) {
    var tags = Array.isArray(snippet.tags) ? snippet.tags.join(" ") : "";
    return [
      key,
      snippet.name,
      snippet.category,
      snippet.description,
      tags,
      snippet.code,
      getSnippetComponentText(snippet)
    ].join(" ").toLowerCase();
  }

  function buildSkinHaystack(key, skin) {
    var tags = Array.isArray(skin.tags) ? skin.tags.join(" ") : "";
    var components = Array.isArray(skin.components)
      ? skin.components.map(function(component) {
          return [component.type, component.view, component.idx].join(" ");
        }).join(" ")
      : "";

    return [
      key,
      skin.name,
      skin.category,
      skin.description,
      tags,
      skin.sourceSite,
      skin.sourceUrl,
      skin.sourceSkinName,
      skin.sourceSkinID,
      components
    ].join(" ").toLowerCase();
  }

  function categoryMatches(selectedCategory, itemCategory) {
    if (!selectedCategory) return true;
    var selected = normalizeLower(selectedCategory);
    var item = normalizeLower(itemCategory) || "uncategorized";
    return item === selected;
  }

  function queryMatches(query, haystack) {
    var normalized = normalizeLower(query);
    if (!normalized) return true;

    return normalized.split(/\s+/).every(function(part) {
      return haystack.indexOf(part) !== -1;
    });
  }

  function snippetMatches(key, snippet, state) {
    if (!state.includeSnippets) return false;
    if (!snippet) return false;

    var hasComponents = snippetHasComponents(snippet);
    if (state.userOnly && snippet.isUserSnippet !== true) return false;
    if (state.dynamicOnly && snippet.dynamicSelector !== true) return false;
    if (state.multiOnly && !hasComponents) return false;
    if (state.quickOnly && snippet.alwaysInQuickList !== true) return false;
    if (!categoryMatches(state.category, snippet.category)) return false;

    return queryMatches(state.query, buildSnippetHaystack(key, snippet));
  }

  function skinMatches(key, skin, state) {
    if (!state.includeSkins) return false;
    if (!skin) return false;
    if (state.dynamicOnly || state.multiOnly || state.quickOnly || state.userOnly) return false;
    if (!categoryMatches(state.category, skin.category)) return false;

    return queryMatches(state.query, buildSkinHaystack(key, skin));
  }

  function getEntrySortValue(entry, sortBy, orderMap) {
    var item = entry[1] || {};
    if (sortBy === "name") return normalizeLower(item.name || entry[0]);
    if (sortBy === "category") return normalizeLower(item.category || "uncategorized") + "\u0000" + normalizeLower(item.name || entry[0]);
    if (sortBy === "newest") return -(new Date(item.updatedAt || item.savedAt || item.createdAt || 0).getTime() || 0);
    if (sortBy === "manual") return orderMap && orderMap[entry[0]] !== undefined ? orderMap[entry[0]] : Number.MAX_SAFE_INTEGER;
    return normalizeLower(item.name || entry[0]);
  }

  function sortEntries(entries, sortBy, order) {
    var orderMap = {};
    if (Array.isArray(order)) {
      order.forEach(function(key, index) {
        orderMap[key] = index;
      });
    }

    return entries.slice().sort(function(a, b) {
      var aValue = getEntrySortValue(a, sortBy, orderMap);
      var bValue = getEntrySortValue(b, sortBy, orderMap);

      if (typeof aValue === "number" && typeof bValue === "number") {
        if (aValue !== bValue) return aValue - bValue;
      } else {
        var compared = String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: "base" });
        if (compared !== 0) return compared;
      }

      return normalizeLower((a[1] && a[1].name) || a[0]).localeCompare(
        normalizeLower((b[1] && b[1].name) || b[0]),
        undefined,
        { numeric: true, sensitivity: "base" }
      );
    });
  }

  function getSnippetEntries(snippets, state, order) {
    var viewState = cloneState(state);
    var source = isPlainObject(snippets) ? snippets : {};
    var entries = Object.keys(source)
      .filter(function(key) { return snippetMatches(key, source[key], viewState); })
      .map(function(key) { return [key, source[key]]; });

    return sortEntries(entries, viewState.sortBy, order);
  }

  function getSkinEntries(skins, state) {
    var viewState = cloneState(state);
    var source = isPlainObject(skins) ? skins : {};
    var entries = Object.keys(source)
      .filter(function(key) { return skinMatches(key, source[key], viewState); })
      .map(function(key) { return [key, source[key]]; });

    return sortEntries(entries, viewState.sortBy === "manual" ? "newest" : viewState.sortBy);
  }

  function getCategoryLabel(value) {
    return normalizeText(value) || "Uncategorized";
  }

  function groupEntriesByCategory(entries) {
    var groups = {};

    entries.forEach(function(entry) {
      var label = getCategoryLabel(entry[1] && entry[1].category);
      if (!groups[label]) groups[label] = [];
      groups[label].push(entry);
    });

    return Object.keys(groups).sort(function(a, b) {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    }).map(function(label) {
      return {
        label: label,
        entries: groups[label]
      };
    });
  }

  function getCategoryOptions(snippets, skins) {
    var seen = {};
    var options = [];

    function add(category) {
      var label = getCategoryLabel(category);
      var key = label.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      options.push(label);
    }

    Object.keys(snippets || {}).forEach(function(key) {
      add(snippets[key] && snippets[key].category);
    });

    Object.keys(skins || {}).forEach(function(key) {
      add(skins[key] && skins[key].category);
    });

    return options.sort(function(a, b) {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    });
  }

  function hasActiveFilters(state) {
    var viewState = cloneState(state);
    return !!(
      viewState.query ||
      viewState.category ||
      viewState.groupByCategory ||
      viewState.includeSnippets !== DEFAULT_STATE.includeSnippets ||
      viewState.includeSkins !== DEFAULT_STATE.includeSkins ||
      viewState.sortBy !== DEFAULT_STATE.sortBy ||
      viewState.userOnly ||
      viewState.dynamicOnly ||
      viewState.multiOnly ||
      viewState.quickOnly
    );
  }

  var api = {
    defaultState: function(overrides) { return cloneState(overrides); },
    cloneState: cloneState,
    getSnippetEntries: getSnippetEntries,
    getSkinEntries: getSkinEntries,
    groupEntriesByCategory: groupEntriesByCategory,
    getCategoryOptions: getCategoryOptions,
    hasActiveFilters: hasActiveFilters
  };

  root.CPToolkit = root.CPToolkit || {};
  root.CPToolkit.snippetLibraryView = api;
  root.CPToolkitSnippetLibraryView = api;
})(typeof window !== "undefined" ? window : this);
