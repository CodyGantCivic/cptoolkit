(function loadTool() {
  var thisTool = "layout-manager-sorter";
  var MODE_KEY = "layout-manager-sorter-mode";
  var MODE_DEFAULT = "default";
  var CONTROL_ID = "cp-toolkit-layout-sorter-controls";
  var STYLE_ID = "cp-toolkit-layout-sorter-styles";
  var currentMode = MODE_DEFAULT;
  var filterText = "";
  var isApplying = false;
  var refreshTimer = null;
  var observer = null;
  var initialized = false;

  function isLayoutsPage() {
    var path = window.location.pathname.toLowerCase();
    return (
      path === "/admin/designcenter/layouts" ||
      path === "/admin/designcenter/layouts/" ||
      path.indexOf("/admin/designcenter/layouts/index") === 0
    );
  }

  function sanitizeMode(mode) {
    if (mode === "base-first") {
      return "default";
    }
    if (mode === "year-first") {
      return "newest-first";
    }

    if (
      mode === "server" ||
      mode === "name-asc" ||
      mode === "name-desc" ||
      mode === "default" ||
      mode === "newest-first"
    ) {
      return mode;
    }
    return MODE_DEFAULT;
  }

  function normalizeName(name) {
    return (name || "").replace(/\s+/g, " ").trim();
  }

  function getLayoutName(item) {
    var link = item && item.querySelector ? item.querySelector("h3 a") : null;
    return normalizeName(link ? link.textContent : "");
  }

  function getLayoutId(item) {
    var fromData = item && item.getAttribute ? String(item.getAttribute("data-cp-layout-id") || "") : "";
    if (/^\d+$/.test(fromData)) {
      return fromData;
    }

    var link = item && item.querySelector ? item.querySelector("h3 a[href]") : null;
    var href = link ? String(link.getAttribute("href") || "") : "";
    var match = href.match(/\/layouts\/modify\/(\d+)/i);
    if (match && match[1]) {
      return match[1];
    }

    var actionButton = item && item.querySelector ? item.querySelector(".openActionMenu[onclick]") : null;
    var actionOnClick = actionButton ? String(actionButton.getAttribute("onclick") || "") : "";
    var actionMatch = actionOnClick.match(/structureMenu__([0-9]+)/i);
    if (actionMatch && actionMatch[1]) {
      return actionMatch[1];
    }

    var actionMenu = item && item.querySelector ? item.querySelector("ul.actionMenu[id]") : null;
    var actionId = actionMenu ? String(actionMenu.getAttribute("id") || "") : "";
    var menuMatch = actionId.match(/structureMenu__([0-9]+)/i);
    if (menuMatch && menuMatch[1]) {
      return menuMatch[1];
    }

    return "";
  }

  function getNumericLayoutId(item) {
    var value = item && item.getAttribute ? String(item.getAttribute("data-cp-layout-id") || "") : "";
    if (!/^\d+$/.test(value)) {
      return NaN;
    }
    var id = Number(value);
    return Number.isFinite(id) ? id : NaN;
  }

  function getItemsContainer() {
    return document.querySelector(".listing .items, .items");
  }

  function getLayoutItems(container) {
    if (!container || !container.children) {
      return [];
    }

    var items = [];
    for (var i = 0; i < container.children.length; i++) {
      var child = container.children[i];
      if (child && child.classList && child.classList.contains("item")) {
        items.push(child);
      }
    }
    return items;
  }

  function ensureMetadata(items) {
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item) continue;

      if (!item.hasAttribute("data-cp-layout-original-order")) {
        item.setAttribute("data-cp-layout-original-order", String(i));
      }

      var layoutId = getLayoutId(item);
      if (layoutId) {
        item.setAttribute("data-cp-layout-id", layoutId);
      } else if (item.hasAttribute("data-cp-layout-id")) {
        item.removeAttribute("data-cp-layout-id");
      }
    }
  }

  function getBaseRank(name) {
    var lower = name.toLowerCase();
    if (lower === "home") return 0;
    if (lower === "interior") return 1;
    if (lower === "simple") return 2;
    return 100;
  }

  function compareByName(aName, bName, descending) {
    var result = aName.localeCompare(bName, undefined, {
      numeric: true,
      sensitivity: "base"
    });
    return descending ? -result : result;
  }

  function buildComparator(mode) {
    return function(a, b) {
      var aName = getLayoutName(a);
      var bName = getLayoutName(b);

      if (mode === "server") {
        var aOrder = Number(a.getAttribute("data-cp-layout-original-order") || "0");
        var bOrder = Number(b.getAttribute("data-cp-layout-original-order") || "0");
        return aOrder - bOrder;
      }

      if (mode === "name-asc") {
        return compareByName(aName, bName, false);
      }

      if (mode === "name-desc") {
        return compareByName(aName, bName, true);
      }

      if (mode === "newest-first") {
        var aId = getNumericLayoutId(a);
        var bId = getNumericLayoutId(b);
        var aHasId = Number.isFinite(aId);
        var bHasId = Number.isFinite(bId);

        if (aHasId !== bHasId) {
          return aHasId ? -1 : 1;
        }
        if (aHasId && bHasId && aId !== bId) {
          return bId - aId;
        }
        return compareByName(aName, bName, false);
      }

      var aRank = getBaseRank(aName);
      var bRank = getBaseRank(bName);
      if (aRank !== bRank) {
        return aRank - bRank;
      }
      return compareByName(aName, bName, false);
    };
  }

  function filterItems(items) {
    var visibleCount = 0;
    var query = filterText.toLowerCase();

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var name = getLayoutName(item).toLowerCase();
      var visible = !query || name.indexOf(query) !== -1;
      item.style.display = visible ? "" : "none";
      if (visible) visibleCount += 1;
    }

    return visibleCount;
  }

  function updateCount(visibleCount, totalCount) {
    var countEl = document.querySelector("#" + CONTROL_ID + " .cp-toolkit-layout-sorter-count");
    if (!countEl) return;
    countEl.textContent = String(visibleCount) + " / " + String(totalCount) + " shown";
  }

  function applySortAndFilter() {
    var container = getItemsContainer();
    if (!container) return;

    var items = getLayoutItems(container);
    if (!items.length) return;

    ensureMetadata(items);
    var sorted = items.slice().sort(buildComparator(currentMode));

    isApplying = true;
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < sorted.length; i++) {
      fragment.appendChild(sorted[i]);
    }
    container.appendChild(fragment);

    var visibleCount = filterItems(sorted);
    updateCount(visibleCount, sorted.length);

    window.requestAnimationFrame(function() {
      isApplying = false;
    });
  }

  function scheduleApply() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function() {
      applySortAndFilter();
    }, 120);
  }

  function saveMode(mode) {
    var payload = {};
    payload[MODE_KEY] = mode;
    chrome.storage.local.set(payload);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
.cp-toolkit-layout-sorter {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px 0;
  padding: 10px 12px;
  border: 1px solid #d2dbe8;
  border-radius: 8px;
  background: #f7f9fc;
  font-family: "Segoe UI", Arial, sans-serif;
}
.cp-toolkit-layout-sorter label {
  margin: 0;
  color: #1c2f4c;
  font-size: 12px;
  font-weight: 600;
}
.cp-toolkit-layout-sorter select,
.cp-toolkit-layout-sorter input[type="text"] {
  height: 30px;
  border: 1px solid #b8c5d8;
  border-radius: 6px;
  padding: 0 10px;
  font-size: 12px;
  color: #1c2f4c;
  background: #fff;
}
.cp-toolkit-layout-sorter input[type="text"] {
  min-width: 180px;
}
.cp-toolkit-layout-sorter button {
  height: 30px;
  line-height: 1;
  border: 1px solid #b8c5d8;
  border-radius: 6px;
  background: #fff;
  color: #334d73;
  font-size: 12px;
  padding: 0 10px;
  cursor: pointer;
}
.cp-toolkit-layout-sorter button:hover {
  background: #eef3fa;
}
.cp-toolkit-layout-sorter #cp-toolkit-layout-filter-clear {
  background: #af282f;
  border-color: #af282f;
  color: #fff;
}
.cp-toolkit-layout-sorter #cp-toolkit-layout-filter-clear:hover {
  background: #8f2026;
  border-color: #8f2026;
}
.cp-toolkit-layout-sorter .cp-toolkit-layout-sorter-count {
  margin-left: auto;
  color: #5f718f;
  font-size: 11px;
}
@media (max-width: 900px) {
  .cp-toolkit-layout-sorter {
    flex-wrap: wrap;
  }
  .cp-toolkit-layout-sorter .cp-toolkit-layout-sorter-count {
    width: 100%;
    margin-left: 0;
  }
}
`;
    (document.head || document.documentElement).appendChild(style);
  }

  function buildControls() {
    var container = getItemsContainer();
    if (!container || !container.parentNode) return;

    var existing = document.getElementById(CONTROL_ID);
    if (!existing) {
      existing = document.createElement("div");
      existing.id = CONTROL_ID;
      existing.className = "cp-toolkit-layout-sorter";
      existing.innerHTML = `
<label for="cp-toolkit-layout-sorter-mode">Sort</label>
<select id="cp-toolkit-layout-sorter-mode">
  <option value="default">Default (Home, Interior, Simple, then A-Z)</option>
  <option value="name-asc">Name (A to Z)</option>
  <option value="name-desc">Name (Z to A)</option>
  <option value="newest-first">Newest First (By Layout ID)</option>
  <option value="server">Server Order</option>
</select>
<label for="cp-toolkit-layout-filter">Filter</label>
<input id="cp-toolkit-layout-filter" type="text" placeholder="Type to filter layouts..." />
<button type="button" id="cp-toolkit-layout-filter-clear">Clear</button>
<span class="cp-toolkit-layout-sorter-count"></span>
`;

      container.parentNode.insertBefore(existing, container);
    }

    var modeSelect = existing.querySelector("#cp-toolkit-layout-sorter-mode");
    var filterInput = existing.querySelector("#cp-toolkit-layout-filter");
    var clearButton = existing.querySelector("#cp-toolkit-layout-filter-clear");

    if (modeSelect && !modeSelect.hasAttribute("data-cp-bound")) {
      modeSelect.setAttribute("data-cp-bound", "true");
      modeSelect.value = currentMode;
      modeSelect.addEventListener("change", function() {
        currentMode = sanitizeMode(modeSelect.value);
        modeSelect.value = currentMode;
        saveMode(currentMode);
        applySortAndFilter();
      });
    } else if (modeSelect) {
      modeSelect.value = currentMode;
    }

    if (filterInput && !filterInput.hasAttribute("data-cp-bound")) {
      filterInput.setAttribute("data-cp-bound", "true");
      filterInput.value = filterText;
      filterInput.addEventListener("input", function() {
        filterText = filterInput.value || "";
        applySortAndFilter();
      });
    } else if (filterInput) {
      filterInput.value = filterText;
    }

    if (clearButton && !clearButton.hasAttribute("data-cp-bound")) {
      clearButton.setAttribute("data-cp-bound", "true");
      clearButton.addEventListener("click", function() {
        filterText = "";
        if (filterInput) {
          filterInput.value = "";
        }
        applySortAndFilter();
      });
    }
  }

  function nodeContainsLayoutList(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.classList && (node.classList.contains("items") || node.classList.contains("item"))) {
      return true;
    }
    return !!(node.querySelector && node.querySelector(".items, .item"));
  }

  function bindObservers() {
    if (observer || !document.body) return;

    observer = new MutationObserver(function(mutations) {
      if (isApplying) return;

      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];
        if (!mutation) continue;

        if (mutation.addedNodes && mutation.addedNodes.length) {
          for (var j = 0; j < mutation.addedNodes.length; j++) {
            if (nodeContainsLayoutList(mutation.addedNodes[j])) {
              buildControls();
              scheduleApply();
              return;
            }
          }
        }

        if (mutation.removedNodes && mutation.removedNodes.length) {
          for (var k = 0; k < mutation.removedNodes.length; k++) {
            if (nodeContainsLayoutList(mutation.removedNodes[k])) {
              scheduleApply();
              return;
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function bindAjaxComplete() {
    if (!window.jQuery) return;

    var $doc = window.jQuery(document);
    if ($doc.data("cp-toolkit-layout-sorter-ajax-bound")) return;
    $doc.data("cp-toolkit-layout-sorter-ajax-bound", true);

    $doc.ajaxComplete(function(event, xhr, settings) {
      var url = settings && settings.url ? String(settings.url).toLowerCase() : "";
      if (
        url.indexOf("/designcenter/layouts/") !== -1 ||
        url.indexOf("/admin/designcenter/layouts/index") !== -1
      ) {
        buildControls();
        scheduleApply();
      }
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;

    ensureStyles();
    buildControls();
    applySortAndFilter();
    bindObservers();
    bindAjaxComplete();

    console.log("[CP Toolkit] Loaded " + thisTool);
  }

  chrome.storage.local.get([thisTool, MODE_KEY], function(settings) {
    if (chrome.runtime.lastError) {
      console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
      return;
    }

    detect_if_cp_site(function() {
      if (window.top !== window.self) {
        return;
      }
      if (settings[thisTool] === false || !isLayoutsPage()) {
        return;
      }

      currentMode = sanitizeMode(settings[MODE_KEY]);
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
    });
  });
})();

