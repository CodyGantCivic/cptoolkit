// Robust auto-dismiss-help-welcome (vanilla JS)
(function () {
  var TOOL = "auto-dismiss-help-welcome";

  function isCivicPlusSite() {
    // Basic heuristic - update if you have a better detection
    return /(?:civicplus|yourcompanydomain)\./i.test(location.hostname);
  }

  function removeShowWelcomeParam() {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("ShowWelcomeMessage")) {
        url.searchParams.delete("ShowWelcomeMessage");
        // Replace state (no reload)
        history.replaceState(null, document.title, url.toString());
        // console.log("[CP Toolkit] Removed ShowWelcomeMessage param (no reload)."); // Phase 3: Reduced logging
      }
    } catch (err) {
      console.warn("[CP Toolkit] removeShowWelcomeParam failed:", err);
    }
  }

  function injectHideStyles() {
    try {
      if (document.getElementById("cp-toolkit_dismiss-help")) return; // already added
      var style = document.createElement("style");
      style.id = "cp-toolkit_dismiss-help";
      style.textContent = `
        #widgetsTabTooltip, #workingCopyTooltip {
          display: none !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
      // console.log("[CP Toolkit] Injected hide styles for help/welcome tooltips."); // Phase 3: Reduced logging
    } catch (err) {
      console.warn("[CP Toolkit] injectHideStyles failed:", err);
    }
  }

  function hideMatchingNodes(root) {
    // also hides elements that appear dynamically and don't match IDs
    try {
      if (!root) root = document;
      var els = root.querySelectorAll("#widgetsTabTooltip, #workingCopyTooltip");
      els.forEach(e => {
        e.style.setProperty("display", "none", "important");
      });
    } catch (err) {
      console.warn("[CP Toolkit] hideMatchingNodes failed:", err);
    }
  }

  function watchForDynamicTooltips() {
    try {
      const observer = new MutationObserver(function (mutations) {
        for (const m of mutations) {
          if (m.addedNodes && m.addedNodes.length) {
            m.addedNodes.forEach(n => {
              if (n.nodeType === 1) { // element
                // quick check by id or descendant
                if (n.id === "widgetsTabTooltip" || n.id === "workingCopyTooltip" || n.querySelector("#widgetsTabTooltip, #workingCopyTooltip")) {
                  hideMatchingNodes(n);
                }
              }
            });
          }
        }
      });
      observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
      // also do an initial pass
      hideMatchingNodes(document);
      // console.log("[CP Toolkit] MutationObserver watching for dynamic tooltips."); // Phase 3: Reduced logging
    } catch (err) {
      console.warn("[CP Toolkit] watchForDynamicTooltips failed:", err);
    }
  }

  function init() {
    // Replace your detect_if_cp_site callback by a simple check if that helper isn't available
    var run = false;
    if (typeof detect_if_cp_site === "function") {
      try {
        detect_if_cp_site(function () { run = true; });
      } catch (e) {
        console.warn("[CP Toolkit] detect_if_cp_site call failed:", e);
      }
    } else if (isCivicPlusSite()) {
      run = true;
    }

    if (!run) {
      // Not a CivicPlus site (or detection not ready) — delay and retry once
      setTimeout(function () {
        if (typeof detect_if_cp_site === "function") {
          try {
            detect_if_cp_site(function () { 
              injectHideStyles();
              removeShowWelcomeParam();
              watchForDynamicTooltips();
            });
            return;
          } catch (e) { /* fallthrough */ }
        }
        if (isCivicPlusSite()) {
          injectHideStyles();
          removeShowWelcomeParam();
          watchForDynamicTooltips();
        } else {
          console.log("[CP Toolkit] CivicPlus site not detected - skipping auto-dismiss-help-welcome.");
        }
      }, 500); // small retry
      return;
    }

    // DOM ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        injectHideStyles();
        removeShowWelcomeParam();
        watchForDynamicTooltips();
      });
    } else {
      injectHideStyles();
      removeShowWelcomeParam();
      watchForDynamicTooltips();
    }
  }

  // If this script is executed in an isolated content-script world and needs to act in the page context,
  // ensure it runs as a content script (or inject an external file). But this code is vanilla and should work
  // as a normal content script.
  try {
    init();
  } catch (err) {
    console.error("[CP Toolkit] auto-dismiss init error:", err);
  }
})();

