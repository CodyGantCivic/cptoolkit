/**
 * Fix Copied Skin References - Onload Script
 *
 * Automatically fixes CSS skin ID references when copying widget skins
 * via the CMS "Copy Widget Skin" feature.
 *
 * Problem: When you copy a skin (e.g., skin 101 → new skin 108), the
 * MiscellaneousStyles still contains references to the source skin ID
 * (.widget.skin101) instead of the new skin ID (.widget.skin108).
 *
 * Solution: This script intercepts the copy workflow and automatically
 * updates the CSS references after the new skin gets its ID from the server.
 */
(function loadTool() {
  var thisTool = "fix-copied-skin-references";

  chrome.storage.local.get(thisTool, function(settings) {
    if (chrome.runtime.lastError) {
      console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
      return;
    }

    detect_if_cp_site(function() {
      if (settings[thisTool] !== false) {
        var currentPage = window.location.pathname.toLowerCase();

        // Only run on Theme Manager pages
        if (!currentPage.startsWith("/designcenter/themes/")) {
          return;
        }

        console.log("[CP Toolkit] Loaded " + thisTool);

        try {
          // CSP FIX: Use external helper file instead of inline script
          // The helper runs in MAIN world to access page's DesignCenter object
          var script = document.createElement('script');
          script.src = chrome.runtime.getURL('js/tools/on-load/helpers/fix-copied-skin-references-helper.js');
          (document.head || document.documentElement).appendChild(script);
        } catch (err) {
          console.warn("[CP Toolkit](" + thisTool + ") Error injecting helper:", err);
        }
      }
    });
  });
})();
