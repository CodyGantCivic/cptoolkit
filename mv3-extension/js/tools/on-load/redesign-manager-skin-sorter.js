(function loadTool() {
  var thisTool = "redesign-manager-skin-sorter";
  var DATA_KEY = "theme-manager-skin-organizer-data";
  var STYLE_ID = "cp-toolkit-redesign-skin-sorter-style";
  var HEADER_CLASS = "cp-toolkit-redesign-category-header";
  var SORTED_ATTR = "data-cp-toolkit-skin-sorted";
  var DEFAULT_UNCATEGORIZED_COLOR = "#9aa8bf";

  var initialized = false;
  var observer = null;
  var sortTimer = null;

  function isRedesignManagerPage() {
    var path = String(window.location.pathname || "").toLowerCase();
    return (
      path.indexOf("/designcenter/redesignmanager/index") !== -1 ||
      path.indexOf("/admin/designcenter/redesignmanager/index") !== -1
    );
  }

  function getReadableTextColor(hexColor) {
    var color = String(hexColor || "#6e7f99").replace("#", "");
    if (color.length === 3) {
      color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
    }
    var r = parseInt(color.substring(0, 2), 16);
    var g = parseInt(color.substring(2, 4), 16);
    var b = parseInt(color.substring(4, 6), 16);
    var luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.6 ? "#1f3558" : "#ffffff";
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      "." + HEADER_CLASS + "{list-style:none;padding:6px 12px!important;margin:10px 0 2px!important;border-radius:5px;font-size:12px;font-weight:600;font-family:\"Segoe UI\",Arial,sans-serif;display:flex;align-items:center;gap:8px}" +
      "." + HEADER_CLASS + ":first-child{margin-top:2px!important}" +
      "." + HEADER_CLASS + " .cp-toolkit-cat-count{margin-left:auto;font-weight:400;font-size:11px;opacity:0.7}";
    (document.head || document.documentElement).appendChild(style);
  }

  function createHeader(name, color, count) {
    var header = document.createElement("li");
    header.className = HEADER_CLASS;
    header.style.backgroundColor = color;
    header.style.color = getReadableTextColor(color);

    var nameSpan = document.createElement("span");
    nameSpan.textContent = name;

    var countSpan = document.createElement("span");
    countSpan.className = "cp-toolkit-cat-count";
    countSpan.textContent = count + (count === 1 ? " skin" : " skins");

    header.appendChild(nameSpan);
    header.appendChild(countSpan);
    return header;
  }

  function sortSkins(categories, assignments) {
    var list = document.getElementById("redesignPropertyList-WidgetSkins");
    if (!list) return;

    var items = list.querySelectorAll("li.redesignPropertyList-property");
    if (!items.length) return;

    // Remove existing headers
    var existingHeaders = list.querySelectorAll("." + HEADER_CLASS);
    for (var h = 0; h < existingHeaders.length; h++) {
      existingHeaders[h].parentNode.removeChild(existingHeaders[h]);
    }

    // Build category lookup
    var categoryMap = {};
    for (var c = 0; c < categories.length; c++) {
      categoryMap[categories[c].id] = categories[c];
    }

    // Group items by category
    var groups = {};
    var usedCategoryIds = [];
    var uncategorized = [];

    for (var i = 0; i < items.length; i++) {
      var select = items[i].querySelector("select[data-id]");
      if (!select) {
        uncategorized.push(items[i]);
        continue;
      }
      var skinId = select.getAttribute("data-id");
      var catId = assignments[skinId];
      if (catId && categoryMap[catId]) {
        if (!groups[catId]) {
          groups[catId] = [];
          usedCategoryIds.push(catId);
        }
        groups[catId].push(items[i]);
      } else {
        uncategorized.push(items[i]);
      }
    }

    // If everything is uncategorized, no point in sorting
    if (!usedCategoryIds.length) return;

    // Sort category order to match the original categories array order
    usedCategoryIds.sort(function(a, b) {
      var idxA = -1, idxB = -1;
      for (var k = 0; k < categories.length; k++) {
        if (categories[k].id === a) idxA = k;
        if (categories[k].id === b) idxB = k;
      }
      return idxA - idxB;
    });

    // Sort items alphabetically within each group
    function sortByName(a, b) {
      var nameA = (a.querySelector(".redesignPropertyList-propertyItem--name") || {}).textContent || "";
      var nameB = (b.querySelector(".redesignPropertyList-propertyItem--name") || {}).textContent || "";
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
    }

    // Rebuild list into a fragment
    var fragment = document.createDocumentFragment();

    for (var g = 0; g < usedCategoryIds.length; g++) {
      var catId = usedCategoryIds[g];
      var cat = categoryMap[catId];
      var groupItems = groups[catId];
      groupItems.sort(sortByName);

      fragment.appendChild(createHeader(cat.name, cat.color, groupItems.length));
      for (var k = 0; k < groupItems.length; k++) {
        fragment.appendChild(groupItems[k]);
      }
    }

    // Uncategorized at the end
    if (uncategorized.length) {
      uncategorized.sort(sortByName);
      fragment.appendChild(createHeader("Uncategorized", DEFAULT_UNCATEGORIZED_COLOR, uncategorized.length));
      for (var u = 0; u < uncategorized.length; u++) {
        fragment.appendChild(uncategorized[u]);
      }
    }

    list.appendChild(fragment);
    list.setAttribute(SORTED_ATTR, "true");
    console.log("[CP Toolkit](" + thisTool + ") Sorted " + items.length + " skins into " + usedCategoryIds.length + " categories");
  }

  function scheduleSortSkins(categories, assignments) {
    clearTimeout(sortTimer);
    sortTimer = setTimeout(function() {
      sortSkins(categories, assignments);
    }, 100);
  }

  function init(categories, assignments) {
    if (initialized) return;
    initialized = true;

    ensureStyles();
    sortSkins(categories, assignments);

    // Watch for list repopulation (e.g. theme switching)
    var list = document.getElementById("redesignPropertyList-WidgetSkins");
    if (list && window.MutationObserver) {
      observer = new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].addedNodes && mutations[i].addedNodes.length) {
            // Check if the added nodes are actual skin items (not our headers)
            for (var j = 0; j < mutations[i].addedNodes.length; j++) {
              var node = mutations[i].addedNodes[j];
              if (node.nodeType === 1 && node.classList && node.classList.contains("redesignPropertyList-property")) {
                scheduleSortSkins(categories, assignments);
                return;
              }
            }
          }
        }
      });
      observer.observe(list, { childList: true });
    }

    console.log("[CP Toolkit] Loaded " + thisTool);
  }

  chrome.storage.local.get([thisTool, DATA_KEY], function(settings) {
    if (chrome.runtime.lastError) {
      console.warn("[CP Toolkit](" + thisTool + ") error loading settings:", chrome.runtime.lastError);
      return;
    }

    detect_if_cp_site(function() {
      if (settings[thisTool] === false) return;
      if (window.top !== window.self) return;
      if (!isRedesignManagerPage()) return;

      var siteKey = String(window.location.hostname || "unknown").toLowerCase();
      var allData = settings[DATA_KEY];
      if (!allData || typeof allData !== "object") return;

      var siteData = allData[siteKey];
      if (!siteData || typeof siteData !== "object") return;

      var categories = Array.isArray(siteData.categories) ? siteData.categories : [];
      var assignments = siteData.assignments && typeof siteData.assignments === "object" ? siteData.assignments : {};

      if (!categories.length) return;

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function() {
          init(categories, assignments);
        });
      } else {
        init(categories, assignments);
      }
    });
  });
})();
