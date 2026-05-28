(function loadTool() {
  var thisTool = "enforce-advanced-styles-text-limits";
  chrome.storage.local.get(thisTool, function(settings) {
    if (chrome.runtime.lastError) {
      console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
      return;
    }
    if (settings[thisTool] === false) return;

    var pathname = window.location.pathname.toLowerCase();
    var isThemeManager = pathname.startsWith("/designcenter/themes/");
    var isGraphicLinks = pathname === "/admin/graphiclinks.aspx";
    if (!isThemeManager && !isGraphicLinks) return;

    detect_if_cp_site(function() {
      console.log("[CP Toolkit] Loaded " + thisTool);

      // Idempotent setter: writes only when the current attribute differs from
      // target. Needed because mini-ide rewrites backdrop.innerHTML on every
      // keystroke (high-frequency DOM churn) and because popover nodes get
      // reused across contexts and must be reclassified on each rerun.
      function setMaxlengthIfNeeded($el, target) {
        if (target == null) return;
        var current = parseInt($el.attr("maxlength"), 10);
        if (current !== target) $el.attr("maxlength", target);
      }

      // Classification lives in the shared helper so mini-ide can apply the
      // same caps when this tool is disabled. Conservative fallback to 1000
      // when the helper returns null (unrecognized future shape under-allows
      // rather than allowing oversave).
      function capFor(el) {
        var helper = window.CPToolkit && window.CPToolkit.advancedStylesLimits;
        var cap = helper ? helper.get(el) : null;
        return cap != null ? cap : 1000;
      }

      function applyTheme() {
        $(".cpPopOver textarea.css-editor-textarea").each(function() {
          setMaxlengthIfNeeded($(this), capFor(this));
        });
      }

      function applyGraphicLinks() {
        $('textarea[id^="fancyButton"][id$="MiscStyles"]').each(function() {
          setMaxlengthIfNeeded($(this), capFor(this));
        });
      }

      function initWhenReady() {
        if (!document.body) { setTimeout(initWhenReady, 50); return; }
        try {
          var apply = isThemeManager ? applyTheme : applyGraphicLinks;
          apply();
          // Coalesce mutation bursts to one apply per animation frame. mini-ide
          // rewrites backdrop.innerHTML on every keystroke; without rAF batching
          // the body-level subtree observer would re-run the jQuery selector on
          // every input event.
          var rafId = null;
          var observer = new MutationObserver(function() {
            if (rafId !== null) return;
            rafId = requestAnimationFrame(function() {
              rafId = null;
              apply();
            });
          });
          observer.observe(document.body, { childList: true, subtree: true });
        } catch (err) {
          console.warn("[CP Toolkit](" + thisTool + ") Error:", err);
        }
      }

      initWhenReady();
    });
  });
})();
