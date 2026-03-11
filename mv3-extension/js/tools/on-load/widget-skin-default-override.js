/**
 * Widget Skin Default Override
 * 
 * When a new widget skin is created, this tool prompts the user to override
 * the default settings with more sensible values:
 * - Wrapper: FontSize null, TextAlignment 0
 * - Tab: Consistent padding
 */
(function loadTool() {
  var thisTool = "widget-skin-default-override";
  chrome.storage.local.get(thisTool, function(settings) {
    if (chrome.runtime.lastError) {
      console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
      return;
    }
    detect_if_cp_site(function() {
      if (settings[thisTool] !== false && window.location.pathname.toLowerCase().startsWith("/designcenter/themes")) {
        console.log("[CP Toolkit] Loaded " + thisTool);
        try {
          // CSP FIX: Use external helper file instead of inline script
          // The helper runs in MAIN world to access page's refreshContentContainersAsync function
          var script = document.createElement('script');
          script.src = chrome.runtime.getURL('js/tools/on-load/helpers/widget-skin-default-override-helper.js');
          (document.head || document.documentElement).appendChild(script);
        } catch (err) {
          console.warn(err);
        }
      }
    });
  });
})();
