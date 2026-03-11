(function loadTool() {
  var thisTool = "enforce-advanced-styles-text-limits";
  chrome.storage.local.get(thisTool, function(settings) {
    if (chrome.runtime.lastError) {
      console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
      return;
    }
    var currentPage = window.location.pathname.toLowerCase();
    var isThemeManager = currentPage.startsWith("/designcenter/themes/");
    var isWidgetManager = currentPage.startsWith("/designcenter/widgets/");
    detect_if_cp_site(function() {
      if (settings[thisTool] !== false && (isThemeManager || isWidgetManager)) {
        console.log("[CP Toolkit] Loaded " + thisTool);
        
        // Wait for document.body to be available
        function initWhenReady() {
          if (!document.body) {
            setTimeout(initWhenReady, 50);
            return;
          }
          
          try {
            if (isThemeManager) {
              // Watch for popover textareas and add maxlength when they appear
              var applyThemeMaxlength = function() {
                $(".cpPopOver textarea").each(function() {
                  if (!$(this).attr("maxlength")) {
                    $(this).attr("maxlength", 1000);
                    // console.log("[CP Toolkit](" + thisTool + ") Applied maxlength to theme textarea");
                  }
                });
              };
              
              // Apply immediately to any existing textareas
              applyThemeMaxlength();
              
              // Watch for new popovers being added to the DOM
              var observer = new MutationObserver(function(mutations) {
                applyThemeMaxlength();
              });
              
              observer.observe(document.body, {
                childList: true,
                subtree: true
              });
              
            } else if (isWidgetManager) {
              // Watch for widget options modal and add maxlength when it appears
              var applyWidgetMaxlength = function() {
                var miscAdvStyles = $("#MiscAdvStyles");
                if (miscAdvStyles.length && !miscAdvStyles.attr("maxlength")) {
                  miscAdvStyles.attr("maxlength", 1000);
                  // console.log("[CP Toolkit](" + thisTool + ") Applied maxlength to MiscAdvStyles");
                }
              };
              
              // Apply immediately to any existing elements
              applyWidgetMaxlength();
              
              // Watch for modal being added to the DOM
              var observer = new MutationObserver(function(mutations) {
                applyWidgetMaxlength();
              });
              
              observer.observe(document.body, {
                childList: true,
                subtree: true
              });
            }
          } catch (err) {
            console.warn("[CP Toolkit](" + thisTool + ") Error:", err);
          }
        }
        
        initWhenReady();
      }
    });
  });
})();
