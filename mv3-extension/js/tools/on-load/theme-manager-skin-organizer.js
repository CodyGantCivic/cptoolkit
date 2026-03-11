(function loadTool() {
  var thisTool = "theme-manager-skin-organizer";
  var DATA_KEY = "theme-manager-skin-organizer-data";
  var STYLE_ID = "cp-toolkit-theme-skin-organizer-style";
  var CONTROL_CLASS = "cp-toolkit-skin-organizer-controls";
  var ENHANCED_ATTR = "data-cp-toolkit-skin-organizer";
  var UNCATEGORIZED_KEY = "__uncategorized__";
  var DEFAULT_BADGE_COLOR = "#6e7f99";
  var DEFAULT_UNCATEGORIZED_COLOR = "#9aa8bf";
  var DEFAULT_FILTER_MODE = "all";

  var siteKey = String(window.location.hostname || "unknown").toLowerCase();
  var initialized = false;
  var observer = null;
  var scanTimer = null;
  var categoryIdCounter = 0;
  var allData = {};
  var siteData = createDefaultSiteData();
  var modalOpen = false;
  var saveTimer = null;

  function isThemesIndexPage() {
    var path = String(window.location.pathname || "").toLowerCase();
    return (
      path.indexOf("/designcenter/themes/index") === 0 ||
      path.indexOf("/admin/designcenter/themes/index") === 0
    );
  }

  function createDefaultSiteData() {
    return {
      categories: [],
      assignments: {},
      filterMode: DEFAULT_FILTER_MODE,
      filterCategoryIds: []
    };
  }

  function sanitizeFilterMode(value) {
    if (value === "all" || value === "include" || value === "exclude") {
      return value;
    }
    return DEFAULT_FILTER_MODE;
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function isValidHexColor(value) {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || ""));
  }

  function normalizeHexColor(value, fallback) {
    var raw = String(value || "").trim();
    if (!isValidHexColor(raw)) {
      return fallback || DEFAULT_BADGE_COLOR;
    }
    if (raw.length === 4) {
      return (
        "#" +
        raw.charAt(1) + raw.charAt(1) +
        raw.charAt(2) + raw.charAt(2) +
        raw.charAt(3) + raw.charAt(3)
      ).toLowerCase();
    }
    return raw.toLowerCase();
  }

  function createCategoryId() {
    categoryIdCounter += 1;
    return "cat-" + Date.now().toString(36) + "-" + categoryIdCounter.toString(36);
  }

  function sanitizeCategory(raw, index, seenIds) {
    raw = raw || {};
    var id = String(raw.id || "").trim();
    if (!id || seenIds[id]) {
      id = createCategoryId();
    }
    seenIds[id] = true;

    var name = normalizeText(raw.name);
    if (!name) {
      name = "Category " + String(index + 1);
    }

    return {
      id: id,
      name: name,
      color: normalizeHexColor(raw.color, DEFAULT_BADGE_COLOR)
    };
  }

  function sanitizeSiteData(raw) {
    var safe = createDefaultSiteData();
    var source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    var categoriesRaw = Array.isArray(source.categories) ? source.categories : [];
    var seenIds = {};

    for (var i = 0; i < categoriesRaw.length; i++) {
      safe.categories.push(sanitizeCategory(categoriesRaw[i], i, seenIds));
    }

    var validCategories = {};
    for (var j = 0; j < safe.categories.length; j++) {
      validCategories[safe.categories[j].id] = true;
    }

    var assignmentsRaw = source.assignments && typeof source.assignments === "object"
      ? source.assignments
      : {};
    var keys = Object.keys(assignmentsRaw);
    for (var k = 0; k < keys.length; k++) {
      var skinId = String(keys[k] || "").trim();
      var categoryId = String(assignmentsRaw[keys[k]] || "").trim();
      if (!/^\d+$/.test(skinId)) continue;
      if (!validCategories[categoryId]) continue;
      safe.assignments[skinId] = categoryId;
    }

    safe.filterMode = sanitizeFilterMode(source.filterMode);
    var filterRaw = Array.isArray(source.filterCategoryIds) ? source.filterCategoryIds : [];
    var filterIds = [];
    for (var x = 0; x < filterRaw.length; x++) {
      var filterId = String(filterRaw[x] || "").trim();
      if (filterId === UNCATEGORIZED_KEY || validCategories[filterId]) {
        filterIds.push(filterId);
      }
    }
    safe.filterCategoryIds = filterIds;

    return safe;
  }

  function getCategoryById(categoryId) {
    var id = String(categoryId || "").trim();
    if (!id) return null;
    for (var i = 0; i < siteData.categories.length; i++) {
      if (siteData.categories[i].id === id) {
        return siteData.categories[i];
      }
    }
    return null;
  }

  function loadData(callback) {
    chrome.storage.local.get(DATA_KEY, function(settings) {
      if (chrome.runtime.lastError) {
        console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
        callback();
        return;
      }

      var rawAllData = settings[DATA_KEY];
      if (rawAllData && typeof rawAllData === "object" && !Array.isArray(rawAllData)) {
        allData = rawAllData;
      } else {
        allData = {};
      }

      siteData = sanitizeSiteData(allData[siteKey]);
      callback();
    });
  }

  function saveData(callback) {
    allData[siteKey] = sanitizeSiteData(siteData);
    var payload = {};
    payload[DATA_KEY] = allData;
    if (callback) callback();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function() {
      chrome.storage.local.set(payload, function() {
        if (chrome.runtime.lastError) {
          console.error("[CP Toolkit] Error saving settings for " + thisTool + ":", chrome.runtime.lastError);
        }
      });
    }, 150);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
.${CONTROL_CLASS}{margin:0 0 10px;border:1px solid #d5ddeb;border-radius:8px;background:#f8fafd;padding:8px 10px;font:12px "Segoe UI",Arial,sans-serif}
.${CONTROL_CLASS} .top{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.${CONTROL_CLASS} button,.${CONTROL_CLASS} select{height:30px;border:1px solid #bcc8db;border-radius:6px;background:#fff;color:#273b5e;font-size:12px;line-height:1}
.${CONTROL_CLASS} button{padding:0 12px;cursor:pointer}
.${CONTROL_CLASS} .manage{border-color:#af282f;color:#af282f;font-weight:600}
.${CONTROL_CLASS} .manage:hover,.${CONTROL_CLASS} button.manage:hover,.${CONTROL_CLASS} .manage:focus-visible,.${CONTROL_CLASS} button.manage:focus-visible{background:#af282f!important;border-color:#af282f!important;color:#fff!important}
.${CONTROL_CLASS} .summary{color:#4f6488;font-size:11px;font-weight:600}
.${CONTROL_CLASS} .count{margin-left:auto;color:#5a6f93;font-size:11px;font-weight:600}
#skinsToPreview li .cp-toolkit-skin-id-badge{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:18px;padding:0 6px;border-radius:999px;border:1px solid transparent;font-size:10px;line-height:1;font-weight:700;margin-left:6px;vertical-align:middle}
.cp-toolkit-skin-organizer-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(12,21,34,.42);padding:16px}
.cp-toolkit-skin-organizer-modal{width:min(1040px,100%);max-height:calc(100vh - 32px);background:#fff;border:1px solid #d6deed;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;font:12px "Segoe UI",Arial,sans-serif;box-shadow:0 16px 44px rgba(20,34,56,.24)}
.cp-toolkit-skin-organizer-modal-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e4ebf6}
.cp-toolkit-skin-organizer-modal-header h4{margin:0;font-size:17px;color:#1f3357}
.cp-toolkit-skin-organizer-modal-close{border:none;background:transparent;color:#5d7297;font-size:28px;line-height:1;cursor:pointer;padding:0 4px}
.cp-toolkit-skin-organizer-modal-body{display:grid;grid-template-columns:330px 1fr;gap:16px;padding:16px 18px;overflow:auto}
.cp-toolkit-skin-organizer-panel{border:1px solid #d8dfeb;border-radius:10px;background:#f9fbff;padding:12px;min-height:0}
.cp-toolkit-skin-organizer-panel h5{margin:0 0 10px;font-size:13px;color:#2a4168}
.cp-toolkit-skin-organizer-new-category{display:grid;grid-template-columns:1fr 32px 48px;gap:4px;margin-bottom:10px}
.cp-toolkit-skin-organizer-new-category input[type="text"],.cp-toolkit-skin-organizer-new-category input[type="color"],.cp-toolkit-skin-organizer-new-category button,.cp-toolkit-skin-organizer-assignment-search,.cp-toolkit-skin-organizer-assignment-select,.cp-toolkit-skin-organizer-category-name,.cp-toolkit-skin-organizer-filter-mode{border:1px solid #bfccdf;border-radius:6px;font-size:12px;color:#243a61;box-sizing:border-box}
.cp-toolkit-skin-organizer-new-category input[type="text"],.cp-toolkit-skin-organizer-assignment-search,.cp-toolkit-skin-organizer-category-name{padding:7px 9px}
.cp-toolkit-skin-organizer-new-category input[type="color"],.cp-toolkit-skin-organizer-category-row input[type="color"]{width:100%;padding:0;background:#fff;border:1px solid #bfccdf;border-radius:8px;box-sizing:border-box;cursor:pointer;overflow:hidden;-webkit-appearance:none;appearance:none}
.cp-toolkit-skin-organizer-new-category input[type="color"]{height:32px}
.cp-toolkit-skin-organizer-category-row input[type="color"]{height:30px}
.cp-toolkit-skin-organizer-new-category input[type="color"]::-webkit-color-swatch-wrapper,.cp-toolkit-skin-organizer-category-row input[type="color"]::-webkit-color-swatch-wrapper{padding:2px;border-radius:7px}
.cp-toolkit-skin-organizer-new-category input[type="color"]::-webkit-color-swatch,.cp-toolkit-skin-organizer-category-row input[type="color"]::-webkit-color-swatch{border:none;border-radius:5px}
.cp-toolkit-skin-organizer-new-category input[type="color"]::-moz-color-swatch,.cp-toolkit-skin-organizer-category-row input[type="color"]::-moz-color-swatch{border:none;border-radius:5px}
.cp-toolkit-skin-organizer-new-category button{line-height:1;background:#af282f;color:#fff;cursor:pointer}
.cp-toolkit-skin-organizer-category-list{display:grid;gap:4px;max-height:260px;overflow:auto;}
.cp-toolkit-skin-organizer-category-row{display:grid;grid-template-columns:32px 1fr 48px;gap:4px;align-items:center}
.cp-toolkit-skin-organizer-category-delete{border:1px solid #cf9ea2;color:#932831;background:#fff6f7;border-radius:6px;font-size:11px;line-height:1;height:30px;cursor:pointer}
.cp-toolkit-skin-organizer-filter-block{margin-top:12px;padding-top:12px;border-top:1px solid #dce5f2}
.cp-toolkit-skin-organizer-filter-row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px;margin-bottom:8px}
.cp-toolkit-skin-organizer-filter-row label{display:grid;gap:4px;font-size:11px;font-weight:600;color:#415883}
.cp-toolkit-skin-organizer-filter-mode{height:30px;padding:0 8px;background:#fff}
.cp-toolkit-skin-organizer-filter-reset{height:30px;padding:0 12px;border:1px solid #bcc8db;border-radius:6px;background:#fff;color:#2b4168;line-height:1;cursor:pointer}
.cp-toolkit-skin-organizer-filter-options{display:grid;gap:6px;max-height:210px;overflow:auto;padding:2px 3px 6px 2px}
.cp-toolkit-skin-organizer-filter-option{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid #d7deea;border-radius:999px;background:#fff;color:#344a6f;font-size:11px}
.cp-toolkit-skin-organizer-filter-option input{margin:0;accent-color:#af282f}
.cp-toolkit-skin-organizer-filter-swatch{width:10px;height:10px;border-radius:999px;border:1px solid rgba(0,0,0,.12)}
.cp-toolkit-skin-organizer-assignment-search{width:100%;margin-bottom:10px}
.cp-toolkit-skin-organizer-assignment-list{display:grid;gap:8px;max-height:560px;overflow:auto;padding:8px 8px 0px 0px}
.cp-toolkit-skin-organizer-assignment-row{display:grid;grid-template-columns:1fr 190px;gap:8px;align-items:center;border:1px solid #e0e6f1;border-radius:8px;background:#fff;padding:4px 4px 4px 8px}
.cp-toolkit-skin-organizer-assignment-name{font-size:12px;color:#233a5f;line-height:1.35}
.cp-toolkit-skin-organizer-assignment-select{height:30px;padding:0 8px;background:#fff}
.cp-toolkit-skin-organizer-empty-row{font-size:12px;color:#5b6f93;background:#fff;border:1px dashed #d7dfea;border-radius:8px;padding:11px}
.cp-toolkit-skin-organizer-modal-footer{border-top:1px solid #e4ebf6;padding:12px 18px;display:flex;justify-content:flex-end;gap:8px}
.cp-toolkit-skin-organizer-modal-footer button{height:32px;border-radius:6px;border:1px solid #b9c7dc;background:#fff;color:#2a4168;font-size:12px;line-height:1;padding:0 12px;cursor:pointer}
.cp-toolkit-skin-organizer-modal-footer .primary{border-color:#af282f;background:#af282f;color:#fff}
@media (max-width:940px){.cp-toolkit-skin-organizer-modal-body{grid-template-columns:1fr}.cp-toolkit-skin-organizer-assignment-row{grid-template-columns:1fr}}
`;
    (document.head || document.documentElement).appendChild(style);
  }

  function getSkinList(popover) {
    return popover && popover.querySelector ? popover.querySelector("#skinsToPreview") : null;
  }

  function getSkinItems(popover) {
    var list = getSkinList(popover);
    if (!list) return [];
    var all = list.querySelectorAll("li");
    var items = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].querySelector("input.previewSkinID")) {
        items.push(all[i]);
      }
    }
    return items;
  }

  function getSkinId(item) {
    var input = item && item.querySelector ? item.querySelector("input.previewSkinID") : null;
    var value = input ? String(input.value || "").trim() : "";
    return /^\d+$/.test(value) ? value : "";
  }

  function getSkinName(item) {
    if (!item || !item.querySelector) return "";
    var label = item.querySelector("label");
    if (!label) return "";
    var clone = label.cloneNode(true);
    var badges = clone.querySelectorAll(".cp-toolkit-skin-id-badge");
    for (var i = 0; i < badges.length; i++) {
      if (badges[i].parentNode) {
        badges[i].parentNode.removeChild(badges[i]);
      }
    }
    return normalizeText(clone.textContent);
  }

  function getReadableTextColor(hexColor) {
    var color = normalizeHexColor(hexColor, DEFAULT_BADGE_COLOR).replace("#", "");
    var r = parseInt(color.substring(0, 2), 16);
    var g = parseInt(color.substring(2, 4), 16);
    var b = parseInt(color.substring(4, 6), 16);
    var luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.6 ? "#1f3558" : "#ffffff";
  }

  function updateSkinBadge(item, skinId, category) {
    if (!item || !skinId) return;
    var label = item.querySelector("label");
    if (!label && !item) return;

    var badge = item.querySelector(".cp-toolkit-skin-id-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "cp-toolkit-skin-id-badge";
    }
    if (label) {
      if (badge.parentNode !== label) {
        label.appendChild(badge);
      }
    } else if (badge.parentNode !== item) {
      item.appendChild(badge);
    }

    var bg = category ? category.color : DEFAULT_UNCATEGORIZED_COLOR;
    badge.textContent = skinId;
    badge.style.backgroundColor = bg;
    badge.style.borderColor = bg;
    badge.style.color = getReadableTextColor(bg);
    badge.setAttribute("title", category ? category.name + " (Skin " + skinId + ")" : "Uncategorized (Skin " + skinId + ")");
  }

  function getFilterSelectionSet() {
    var set = {};
    var ids = Array.isArray(siteData.filterCategoryIds) ? siteData.filterCategoryIds : [];
    for (var i = 0; i < ids.length; i++) {
      var id = String(ids[i] || "").trim();
      if (id) {
        set[id] = true;
      }
    }
    return set;
  }

  function getFilterOptions() {
    var options = [{
      id: UNCATEGORIZED_KEY,
      name: "Uncategorized",
      color: DEFAULT_UNCATEGORIZED_COLOR
    }];

    for (var i = 0; i < siteData.categories.length; i++) {
      options.push({
        id: siteData.categories[i].id,
        name: siteData.categories[i].name,
        color: siteData.categories[i].color
      });
    }

    return options;
  }

  function applyFilterAndBadges(popover) {
    var items = getSkinItems(popover);
    var mode = sanitizeFilterMode(siteData.filterMode);
    var selected = getFilterSelectionSet();
    var selectedCount = Object.keys(selected).length;
    var shown = 0;
    var total = 0;

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var skinId = getSkinId(item);
      if (!skinId) continue;
      total += 1;

      var categoryId = String(siteData.assignments[skinId] || "");
      var category = getCategoryById(categoryId);
      updateSkinBadge(item, skinId, category);

      var lookupKey = categoryId || UNCATEGORIZED_KEY;
      var visible = true;
      if (mode === "include" && selectedCount > 0) {
        visible = !!selected[lookupKey];
      } else if (mode === "exclude" && selectedCount > 0) {
        visible = !selected[lookupKey];
      }

      item.style.display = visible ? "" : "none";
      if (visible) shown += 1;
    }

    var controls = popover.querySelector("." + CONTROL_CLASS);
    if (controls) {
      var countEl = controls.querySelector(".count");
      if (countEl) {
        countEl.textContent = String(shown) + " / " + String(total) + " shown";
      }
      var summaryEl = controls.querySelector(".summary");
      if (summaryEl) {
        summaryEl.textContent = getFilterSummaryText();
      }
    }
  }

  function getFilterSummaryText() {
    var mode = sanitizeFilterMode(siteData.filterMode);
    var count = Array.isArray(siteData.filterCategoryIds) ? siteData.filterCategoryIds.length : 0;
    if (mode === "all" || count === 0) {
      return "Filter: Showing all skins";
    }
    var categoryWord = count === 1 ? "category" : "categories";
    if (mode === "include") {
      return "Filter: Showing " + count + " selected " + categoryWord;
    }
    return "Filter: Hiding " + count + " selected " + categoryWord;
  }

  function ensureControls(popover) {
    var list = getSkinList(popover);
    if (!list || !list.parentNode) return;

    var controls = popover.querySelector("." + CONTROL_CLASS);
    if (!controls) {
      controls = document.createElement("div");
      controls.className = CONTROL_CLASS;
      controls.innerHTML = `
<div class="top">
  <button type="button" class="manage">Manage Categories & Filters</button>
  <span class="summary"></span>
  <span class="count"></span>
</div>
`;
      list.parentNode.insertBefore(controls, list);
    }

    if (!controls.hasAttribute("data-cp-bound")) {
      controls.setAttribute("data-cp-bound", "true");

      var manageButton = controls.querySelector(".manage");
      if (manageButton) {
        manageButton.addEventListener("click", function() {
          openManagerModal(popover);
        });
      }
    }
  }

  function isTargetPopover(element) {
    if (!element || element.nodeType !== 1) return false;
    if (!element.classList || !element.classList.contains("cpPopOver")) return false;
    if (!element.classList.contains("adminWrap")) return false;

    var title = element.querySelector(".cpPopOverHeader h3");
    var text = normalizeText(title ? title.textContent : "").toLowerCase();
    if (!text || text.indexOf("container preview options") === -1) {
      return false;
    }

    return !!element.querySelector("#skinsToPreview");
  }

  function forEachTargetPopover(callback) {
    var popovers = document.querySelectorAll(".cpPopOver.adminWrap");
    for (var i = 0; i < popovers.length; i++) {
      if (isTargetPopover(popovers[i])) {
        callback(popovers[i]);
      }
    }
  }

  function applyToAllPopovers() {
    forEachTargetPopover(function(popover) {
      ensureControls(popover);
      applyFilterAndBadges(popover);
    });
  }

  function bindListObserver(popover) {
    if (popover.hasAttribute(ENHANCED_ATTR)) return;
    popover.setAttribute(ENHANCED_ATTR, "true");

    var list = getSkinList(popover);
    if (!list || !window.MutationObserver) return;

    var localObserver = new MutationObserver(function() {
      if (modalOpen) return;
      setTimeout(function() {
        if (modalOpen) return;
        if (document.body && document.body.contains(popover)) {
          ensureControls(popover);
          applyFilterAndBadges(popover);
        }
      }, 40);
    });

    localObserver.observe(list, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function scanAndEnhance() {
    forEachTargetPopover(function(popover) {
      ensureControls(popover);
      applyFilterAndBadges(popover);
      bindListObserver(popover);
    });
  }

  function scheduleScanAndEnhance() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanAndEnhance, 80);
  }

  function pruneAssignmentsForDeletedCategories() {
    var valid = {};
    for (var i = 0; i < siteData.categories.length; i++) {
      valid[siteData.categories[i].id] = true;
    }

    var assignmentKeys = Object.keys(siteData.assignments);
    for (var k = 0; k < assignmentKeys.length; k++) {
      var key = assignmentKeys[k];
      if (!valid[siteData.assignments[key]]) {
        delete siteData.assignments[key];
      }
    }

    var cleanFilterIds = [];
    for (var x = 0; x < siteData.filterCategoryIds.length; x++) {
      var id = siteData.filterCategoryIds[x];
      if (id === UNCATEGORIZED_KEY || valid[id]) {
        cleanFilterIds.push(id);
      }
    }
    siteData.filterCategoryIds = cleanFilterIds;
  }

  function openManagerModal(popover) {
    var skins = [];
    var items = getSkinItems(popover);
    for (var i = 0; i < items.length; i++) {
      var skinId = getSkinId(items[i]);
      if (!skinId) continue;
      skins.push({
        id: skinId,
        name: getSkinName(items[i]) || ("Skin " + skinId)
      });
    }

    skins.sort(function(a, b) {
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });

    var existing = document.querySelector(".cp-toolkit-skin-organizer-overlay");
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    var overlay = document.createElement("div");
    overlay.className = "cp-toolkit-skin-organizer-overlay";
    overlay.innerHTML = `
<div class="cp-toolkit-skin-organizer-modal" role="dialog" aria-modal="true">
  <div class="cp-toolkit-skin-organizer-modal-header">
    <h4>Skin Categories & Filters</h4>
    <button type="button" class="cp-toolkit-skin-organizer-modal-close" aria-label="Close">&times;</button>
  </div>
  <div class="cp-toolkit-skin-organizer-modal-body">
    <section class="cp-toolkit-skin-organizer-panel">
      <h5>Categories</h5>
      <div class="cp-toolkit-skin-organizer-new-category">
        <input type="text" class="cp-toolkit-skin-organizer-new-name" maxlength="40" placeholder="Base, Airport, Parks & Rec..." />
        <input type="color" class="cp-toolkit-skin-organizer-new-color" value="#6e7f99" />
        <button type="button" class="cp-toolkit-skin-organizer-new-add">Add</button>
      </div>
      <div class="cp-toolkit-skin-organizer-category-list"></div>
      <div class="cp-toolkit-skin-organizer-filter-block">
        <h5>Filter</h5>
        <div class="cp-toolkit-skin-organizer-filter-row">
          <label>
            <span>Mode</span>
            <select class="cp-toolkit-skin-organizer-filter-mode">
              <option value="all">Show All Skins</option>
              <option value="include">Show Selected Categories</option>
              <option value="exclude">Hide Selected Categories</option>
            </select>
          </label>
          <button type="button" class="cp-toolkit-skin-organizer-filter-reset">Reset Filter</button>
        </div>
        <div class="cp-toolkit-skin-organizer-filter-options"></div>
      </div>
    </section>
    <section class="cp-toolkit-skin-organizer-panel">
      <h5>Assign Categories to Skins</h5>
      <input type="text" class="cp-toolkit-skin-organizer-assignment-search" placeholder="Search skins..." />
      <div class="cp-toolkit-skin-organizer-assignment-list"></div>
    </section>
  </div>
  <div class="cp-toolkit-skin-organizer-modal-footer">
    <button type="button" class="cp-toolkit-skin-organizer-close-secondary">Close</button>
    <button type="button" class="cp-toolkit-skin-organizer-close-primary primary">Done</button>
  </div>
</div>
`;
    document.body.appendChild(overlay);
    modalOpen = true;

    var closeButton = overlay.querySelector(".cp-toolkit-skin-organizer-modal-close");
    var closeSecondary = overlay.querySelector(".cp-toolkit-skin-organizer-close-secondary");
    var closePrimary = overlay.querySelector(".cp-toolkit-skin-organizer-close-primary");
    var newNameInput = overlay.querySelector(".cp-toolkit-skin-organizer-new-name");
    var newColorInput = overlay.querySelector(".cp-toolkit-skin-organizer-new-color");
    var addButton = overlay.querySelector(".cp-toolkit-skin-organizer-new-add");
    var categoryList = overlay.querySelector(".cp-toolkit-skin-organizer-category-list");
    var assignmentSearch = overlay.querySelector(".cp-toolkit-skin-organizer-assignment-search");
    var assignmentList = overlay.querySelector(".cp-toolkit-skin-organizer-assignment-list");
    var filterModeSelect = overlay.querySelector(".cp-toolkit-skin-organizer-filter-mode");
    var filterResetButton = overlay.querySelector(".cp-toolkit-skin-organizer-filter-reset");
    var filterOptionsContainer = overlay.querySelector(".cp-toolkit-skin-organizer-filter-options");

    function closeModal() {
      modalOpen = false;
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      applyToAllPopovers();
    }

    function updateAfterDataChange(sectionsToSkip) {
      pruneAssignmentsForDeletedCategories();
      var skip = sectionsToSkip || {};
      saveData(function() {
        if (!skip.categories) renderCategoryRows();
        if (!skip.filters) renderModalFilterOptions();
        if (!skip.assignments) renderAssignmentRows();
        applyToAllPopovers();
      });
    }

    function syncFilterCategoryIdsFromModal() {
      if (!filterOptionsContainer) return;
      var selected = [];
      var inputs = filterOptionsContainer.querySelectorAll("input[type='checkbox'][data-category-id]");
      for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].checked) {
          selected.push(String(inputs[i].getAttribute("data-category-id") || ""));
        }
      }
      siteData.filterCategoryIds = selected;
    }

    function renderModalFilterOptions() {
      if (!filterOptionsContainer) return;
      filterOptionsContainer.innerHTML = "";
      if (filterModeSelect) {
        filterModeSelect.value = sanitizeFilterMode(siteData.filterMode);
      }

      var options = getFilterOptions();
      var selected = getFilterSelectionSet();

      for (var i = 0; i < options.length; i++) {
        var option = options[i];
        var label = document.createElement("label");
        label.className = "cp-toolkit-skin-organizer-filter-option";

        var input = document.createElement("input");
        input.type = "checkbox";
        input.setAttribute("data-category-id", option.id);
        input.checked = !!selected[option.id];

        var swatch = document.createElement("span");
        swatch.className = "cp-toolkit-skin-organizer-filter-swatch";
        swatch.style.backgroundColor = option.color;
        swatch.style.borderColor = option.color;

        var text = document.createElement("span");
        text.textContent = option.name;

        label.appendChild(input);
        label.appendChild(swatch);
        label.appendChild(text);
        filterOptionsContainer.appendChild(label);
      }
    }

    function renderCategoryRows() {
      categoryList.innerHTML = "";
      if (!siteData.categories.length) {
        var empty = document.createElement("div");
        empty.className = "cp-toolkit-skin-organizer-empty-row";
        empty.textContent = "No categories yet. Add one above.";
        categoryList.appendChild(empty);
        return;
      }

      for (var i = 0; i < siteData.categories.length; i++) {
        (function(categoryId) {
          var category = getCategoryById(categoryId);
          if (!category) return;

          var row = document.createElement("div");
          row.className = "cp-toolkit-skin-organizer-category-row";

          var colorInput = document.createElement("input");
          colorInput.type = "color";
          colorInput.value = normalizeHexColor(category.color, DEFAULT_BADGE_COLOR);
          colorInput.addEventListener("change", function() {
            var current = getCategoryById(categoryId);
            if (!current) return;
            current.color = normalizeHexColor(colorInput.value, DEFAULT_BADGE_COLOR);
            updateAfterDataChange({ categories: true, assignments: true });
          });

          var nameInput = document.createElement("input");
          nameInput.type = "text";
          nameInput.className = "cp-toolkit-skin-organizer-category-name";
          nameInput.maxLength = 40;
          nameInput.value = category.name;
          nameInput.addEventListener("change", function() {
            var current = getCategoryById(categoryId);
            if (!current) return;
            var nextName = normalizeText(nameInput.value);
            current.name = nextName || current.name;
            updateAfterDataChange({ categories: true });
          });

          var deleteButton = document.createElement("button");
          deleteButton.type = "button";
          deleteButton.className = "cp-toolkit-skin-organizer-category-delete";
          deleteButton.textContent = "Delete";
          deleteButton.addEventListener("click", function() {
            siteData.categories = siteData.categories.filter(function(item) {
              return item.id !== categoryId;
            });
            updateAfterDataChange();
          });

          row.appendChild(colorInput);
          row.appendChild(nameInput);
          row.appendChild(deleteButton);
          categoryList.appendChild(row);
        })(siteData.categories[i].id);
      }
    }

    function renderAssignmentRows() {
      assignmentList.innerHTML = "";
      var query = normalizeText(assignmentSearch.value).toLowerCase();
      var visible = [];
      for (var i = 0; i < skins.length; i++) {
        var skin = skins[i];
        if (!query || skin.name.toLowerCase().indexOf(query) !== -1 || skin.id.indexOf(query) !== -1) {
          visible.push(skin);
        }
      }

      if (!visible.length) {
        var empty = document.createElement("div");
        empty.className = "cp-toolkit-skin-organizer-empty-row";
        empty.textContent = "No skins match this search.";
        assignmentList.appendChild(empty);
        return;
      }

      for (var j = 0; j < visible.length; j++) {
        (function(skin) {
          var row = document.createElement("div");
          row.className = "cp-toolkit-skin-organizer-assignment-row";

          var name = document.createElement("div");
          name.className = "cp-toolkit-skin-organizer-assignment-name";
          name.textContent = skin.name + " (" + skin.id + ")";

          var select = document.createElement("select");
          select.className = "cp-toolkit-skin-organizer-assignment-select";

          var unassigned = document.createElement("option");
          unassigned.value = "";
          unassigned.textContent = "Uncategorized";
          select.appendChild(unassigned);

          for (var i = 0; i < siteData.categories.length; i++) {
            var category = siteData.categories[i];
            var option = document.createElement("option");
            option.value = category.id;
            option.textContent = category.name;
            select.appendChild(option);
          }

          select.value = String(siteData.assignments[skin.id] || "");
          select.addEventListener("change", function() {
            var selectedCategoryId = String(select.value || "");
            if (!selectedCategoryId) {
              delete siteData.assignments[skin.id];
            } else {
              siteData.assignments[skin.id] = selectedCategoryId;
            }
            saveData(function() {
              applyToAllPopovers();
            });
          });

          row.appendChild(name);
          row.appendChild(select);
          assignmentList.appendChild(row);
        })(visible[j]);
      }
    }

    function addCategoryFromInputs() {
      var name = normalizeText(newNameInput.value);
      if (!name) return;
      var color = normalizeHexColor(newColorInput.value, DEFAULT_BADGE_COLOR);
      siteData.categories.push({
        id: createCategoryId(),
        name: name,
        color: color
      });
      newNameInput.value = "";
      newColorInput.value = DEFAULT_BADGE_COLOR;
      updateAfterDataChange();
      newNameInput.focus();
    }

    closeButton.addEventListener("click", closeModal);
    closeSecondary.addEventListener("click", closeModal);
    closePrimary.addEventListener("click", closeModal);
    overlay.addEventListener("click", function(event) {
      if (event.target === overlay) closeModal();
    });
    addButton.addEventListener("click", addCategoryFromInputs);
    newNameInput.addEventListener("keydown", function(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        addCategoryFromInputs();
      }
    });
    if (filterModeSelect) {
      filterModeSelect.addEventListener("change", function() {
        siteData.filterMode = sanitizeFilterMode(filterModeSelect.value);
        saveData(function() {
          applyToAllPopovers();
        });
      });
    }
    if (filterResetButton) {
      filterResetButton.addEventListener("click", function() {
        siteData.filterMode = "all";
        siteData.filterCategoryIds = [];
        saveData(function() {
          renderModalFilterOptions();
          applyToAllPopovers();
        });
      });
    }
    if (filterOptionsContainer) {
      filterOptionsContainer.addEventListener("change", function(event) {
        var target = event.target;
        if (!target || target.nodeType !== 1) return;
        if (!target.matches("input[type='checkbox'][data-category-id]")) return;
        syncFilterCategoryIdsFromModal();
        saveData(function() {
          applyToAllPopovers();
        });
      });
    }
    var searchTimer = null;
    assignmentSearch.addEventListener("input", function() {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderAssignmentRows, 120);
    });

    renderCategoryRows();
    renderModalFilterOptions();
    renderAssignmentRows();
    setTimeout(function() {
      newNameInput.focus();
    }, 30);
  }

  function bindObservers() {
    if (observer || !window.MutationObserver || !document.body) return;

    observer = new MutationObserver(function(mutations) {
      if (modalOpen) return;
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i] && mutations[i].addedNodes && mutations[i].addedNodes.length) {
          scheduleScanAndEnhance();
          break;
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    if (window.jQuery) {
      var $doc = window.jQuery(document);
      if (!$doc.data("cp-toolkit-theme-skin-organizer-ajax-bound")) {
        $doc.data("cp-toolkit-theme-skin-organizer-ajax-bound", true);
        $doc.ajaxComplete(function() {
          scheduleScanAndEnhance();
        });
      }
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;

    ensureStyles();
    scanAndEnhance();
    bindObservers();
    console.log("[CP Toolkit] Loaded " + thisTool);
  }

  chrome.storage.local.get([thisTool], function(settings) {
    if (chrome.runtime.lastError) {
      console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
      return;
    }

    detect_if_cp_site(function() {
      if (window.top !== window.self) return;
      if (settings[thisTool] === false || !isThemesIndexPage()) return;

      loadData(function() {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", init);
        } else {
          init();
        }
      });
    });
  });
})();
