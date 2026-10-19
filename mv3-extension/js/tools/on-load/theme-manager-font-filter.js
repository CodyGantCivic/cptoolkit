(function loadTool() {
  var thisTool = "theme-manager-font-filter";
  var CONTROL_ID = "cp-toolkit-font-filter-controls";
  var STYLE_ID = "cp-toolkit-font-filter-style";
  var ENHANCED_ATTR = "data-cp-toolkit-font-filter";

  var initialized = false;
  var observer = null;
  var scanTimer = null;
  var filterText = "";

  function isThemesIndexPage() {
    var path = String(window.location.pathname || "").toLowerCase();
    return (
      path.indexOf("/designcenter/themes/index") === 0 ||
      path.indexOf("/admin/designcenter/themes/index") === 0
    );
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function getManageFontsModal() {
    return document.querySelector(".cpPopOver.manageFonts");
  }

  function getActiveFontList(modal) {
    var panel = modal.querySelector(".cpTabPanel.showing");
    if (!panel) return null;
    return panel.querySelector("ol.semanticList.fontList");
  }

  function getFontItems(list) {
    if (!list) return [];
    var items = [];
    for (var i = 0; i < list.children.length; i++) {
      if (list.children[i].tagName === "LI") {
        items.push(list.children[i]);
      }
    }
    return items;
  }

  function getFontName(item) {
    var link = item.querySelector("a");
    return normalizeText(link ? link.textContent : "");
  }

  function applyFilter(modal) {
    var controls = modal.querySelector("#" + CONTROL_ID);
    var countEl = controls ? controls.querySelector(".cp-toolkit-font-filter-count") : null;
    var list = getActiveFontList(modal);

    if (!list) {
      if (countEl) countEl.textContent = "";
      return;
    }

    var items = getFontItems(list);
    var query = filterText.trim().toLowerCase();
    var shown = 0;

    for (var i = 0; i < items.length; i++) {
      var name = getFontName(items[i]).toLowerCase();
      var visible = !query || name.indexOf(query) !== -1;
      items[i].style.display = visible ? "" : "none";
      if (visible) shown += 1;
    }

    if (countEl) {
      countEl.textContent = String(shown) + " / " + String(items.length) + " shown";
    }
  }

  // The native "Sort by Popularity" / "Sort Alphabetically" controls
  // (.fontFilter) are position:absolute at a fixed pixel offset relative to
  // an ancestor that has nothing to do with this filter box — a fixed
  // rectangle on screen, completely independent of this box's size or
  // position. No amount of margin/max-width tuning on a normal-flow element
  // can reliably avoid a collision with something that doesn't participate
  // in flow at all; every such fix only ever worked for one specific
  // content width. Instead, the native controls are hidden entirely (see
  // ensureStyles) and replaced with two buttons inside this one row that
  // delegate to the real (hidden) buttons underneath — this box now owns
  // its whole layout, so there is nothing left to collide with.
  function getActiveFontFilterP(modal) {
    var panel = modal.querySelector(".cpTabPanel.showing");
    return panel ? panel.querySelector("p.fontFilter") : null;
  }

  function isNativeSortActive(nativeButton) {
    return !!nativeButton && nativeButton.className.indexOf("inactive") === -1;
  }

  function syncSortButtonStates(modal, controls) {
    var nativeFilter = getActiveFontFilterP(modal);
    var myPop = controls.querySelector(".cp-toolkit-sort-popularity");
    var myAlpha = controls.querySelector(".cp-toolkit-sort-alpha");
    if (!nativeFilter || !myPop || !myAlpha) return;

    var nativePop = nativeFilter.querySelector(".button.popularity");
    var nativeAlpha = nativeFilter.querySelector(".button.alphabetically");
    myPop.classList.toggle("active", isNativeSortActive(nativePop));
    myAlpha.classList.toggle("active", isNativeSortActive(nativeAlpha));
  }

  function triggerNativeSort(modal, controls, buttonClass) {
    var nativeFilter = getActiveFontFilterP(modal);
    var nativeButton = nativeFilter ? nativeFilter.querySelector(".button." + buttonClass) : null;
    if (nativeButton) nativeButton.click();
    // Give the native sort handler a moment to finish reordering/toggling
    // its own active class before mirroring that state onto our buttons.
    setTimeout(function() {
      syncSortButtonStates(modal, controls);
      applyFilter(modal);
    }, 30);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
#${CONTROL_ID}{display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin:10px 16px;padding:6px 10px;border:1px solid #d5ddeb;border-radius:8px;background:#f7f9fc;font-family:"Segoe UI",Arial,sans-serif}
#${CONTROL_ID} label{margin:0;color:#1c2f4c;font-size:12px;font-weight:600}
#${CONTROL_ID} input[type="text"]{height:28px;min-width:200px;border:1px solid #b8c5d8;border-radius:6px;padding:0 10px;font-size:12px;color:#1c2f4c;background:#fff}
#${CONTROL_ID} button{height:28px;line-height:1;border:1px solid #b8c5d8;border-radius:6px;background:#fff;color:#334d73;font-size:12px;padding:0 10px;cursor:pointer}
#${CONTROL_ID} button:hover{background:#eef3fa}
#${CONTROL_ID} .cp-toolkit-sort-btn{color:#334d73}
#${CONTROL_ID} .cp-toolkit-sort-btn.active{background:#0b5b8a;color:#fff;border-color:#0b5b8a}
#${CONTROL_ID} .cp-toolkit-sort-btn.active:hover{background:#0b5b8a}
#${CONTROL_ID} .cp-toolkit-font-filter-count{flex-basis:100%;margin:0;color:#5f718f;font-size:11px}
.manageFonts .fontFilter{display:none!important}
`;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureControls(modal) {
    var header = modal.querySelector(".cpPopOverHeader");
    var body = modal.querySelector(".cpPopOverBody");
    if (!header || !body || !header.parentNode) return;

    var controls = modal.querySelector("#" + CONTROL_ID);
    if (!controls) {
      controls = document.createElement("div");
      controls.id = CONTROL_ID;
      controls.innerHTML = `
<label for="cp-toolkit-font-filter-input">Filter</label>
<input id="cp-toolkit-font-filter-input" type="text" placeholder="Type to filter fonts..." />
<button type="button" class="cp-toolkit-font-filter-clear">Clear</button>
<button type="button" class="cp-toolkit-sort-btn cp-toolkit-sort-popularity">Sort by Popularity</button>
<button type="button" class="cp-toolkit-sort-btn cp-toolkit-sort-alpha">Sort A-Z</button>
<span class="cp-toolkit-font-filter-count"></span>
`;
      // Placed directly below the "Manage Fonts" header, above the tabs —
      // stays visible and effective no matter which tab is active.
      header.parentNode.insertBefore(controls, body);
    }

    var input = controls.querySelector("input");
    var clearButton = controls.querySelector(".cp-toolkit-font-filter-clear");

    if (input && !input.hasAttribute("data-cp-bound")) {
      input.setAttribute("data-cp-bound", "true");
      input.value = filterText;
      input.addEventListener("input", function() {
        filterText = input.value || "";
        applyFilter(modal);
      });
    }

    if (clearButton && !clearButton.hasAttribute("data-cp-bound")) {
      clearButton.setAttribute("data-cp-bound", "true");
      clearButton.addEventListener("click", function() {
        filterText = "";
        if (input) input.value = "";
        applyFilter(modal);
      });
    }

    var popButton = controls.querySelector(".cp-toolkit-sort-popularity");
    if (popButton && !popButton.hasAttribute("data-cp-bound")) {
      popButton.setAttribute("data-cp-bound", "true");
      popButton.addEventListener("click", function() {
        triggerNativeSort(modal, controls, "popularity");
      });
    }

    var alphaButton = controls.querySelector(".cp-toolkit-sort-alpha");
    if (alphaButton && !alphaButton.hasAttribute("data-cp-bound")) {
      alphaButton.setAttribute("data-cp-bound", "true");
      alphaButton.addEventListener("click", function() {
        triggerNativeSort(modal, controls, "alphabetically");
      });
    }

    var tabLinks = modal.querySelectorAll(".cpTabs a");
    for (var i = 0; i < tabLinks.length; i++) {
      if (tabLinks[i].hasAttribute("data-cp-bound")) continue;
      tabLinks[i].setAttribute("data-cp-bound", "true");
      tabLinks[i].addEventListener("click", function() {
        // Let the native tab switch finish before re-filtering/re-syncing
        // against the newly active panel's list and sort state.
        setTimeout(function() {
          applyFilter(modal);
          syncSortButtonStates(modal, controls);
        }, 60);
      });
    }

    syncSortButtonStates(modal, controls);
  }

  function enhanceModal(modal) {
    // The Manage Fonts modal element can be reused while its contents are
    // rebuilt on reopen, which drops our controls but leaves the attribute
    // behind. Trust the controls themselves, not the attribute alone.
    if (modal.hasAttribute(ENHANCED_ATTR) && modal.querySelector("#" + CONTROL_ID)) return;
    modal.setAttribute(ENHANCED_ATTR, "true");
    filterText = "";
    ensureStyles();
    ensureControls(modal);
    applyFilter(modal);
  }

  function scanAndEnhance() {
    var modal = getManageFontsModal();
    if (modal) enhanceModal(modal);
  }

  function scheduleScanAndEnhance() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanAndEnhance, 80);
  }

  function bindObservers() {
    if (observer || !window.MutationObserver || !document.body) return;

    observer = new MutationObserver(function(mutations) {
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

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
    });
  });
})();
