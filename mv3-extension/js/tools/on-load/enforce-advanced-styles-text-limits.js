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

      // Skin CSS references the skin by number (.widget.skin1). The enabled-by-
      // default widget-skin-advanced-style-helper rewrites .skin\d+ -> .skin{liveId}
      // on blur (reading #hdnSkinID), which GROWS the value when the live id has
      // more digits than what was typed. Native maxlength counts literal chars and
      // doesn't block that programmatic rewrite, so the value can blow past the cap
      // and the server silently truncates on save. These mirror the helper's exact
      // expansion semantics so we enforce against the real save-form length.
      function getSkinId() {
        var el = document.getElementById("hdnSkinID");
        return el ? el.value : null;
      }
      function replaceSkinNumbers(text, skinId) {
        if (!skinId || skinId === "-1") return text;
        return text.replace(/\.skin\d+/g, ".skin" + skinId);
      }
      function serverLengthOf(text) {
        return replaceSkinNumbers(text, getSkinId()).length;
      }
      // Bulk-cut by the overflow, then fine-tune one char at a time. Converges
      // because expansion adds a bounded constant per match.
      function trimToExpandedCap(text, cap) {
        if (cap == null) return text;
        var serverLen = serverLengthOf(text);
        if (serverLen <= cap) return text;
        var out = text.substring(0, Math.max(0, text.length - (serverLen - cap)));
        while (out.length > 0 && serverLengthOf(out) > cap) {
          out = out.substring(0, out.length - 1);
        }
        return out;
      }
      // Live input guard: stop the user at the EXPANDED cap without rewriting the
      // displayed text. Attached once per textarea (the rAF observer re-runs
      // applyTheme constantly). No-op on mini-ide-enhanced fields — mini-ide adds
      // css-editor-textarea and runs its own save-form truncation, so this is the
      // mini-ide-OFF enforcer only.
      function attachSkinLengthGuard(el) {
        if (!el || el.dataset.cpEnforceGuardAttached === "1") return;
        el.dataset.cpEnforceGuardAttached = "1";
        var composing = false;
        function enforce() {
          if (el.classList.contains("css-editor-textarea")) return;
          if (composing) return;
          var cap = capFor(el);
          if (cap == null) return;
          var before = el.value;
          var after = trimToExpandedCap(before, cap);
          if (after === before) return;
          var pos = el.selectionStart;
          el.value = after;
          var clamped = Math.min(pos == null ? after.length : pos, after.length);
          try { el.selectionStart = el.selectionEnd = clamped; } catch (e) {}
          console.log("[CP Toolkit](" + thisTool +
            ") Trimmed to expanded skin cap " + cap + " (save-form length)");
        }
        el.addEventListener("input", enforce);
        el.addEventListener("compositionstart", function() { composing = true; });
        el.addEventListener("compositionend", function() { composing = false; enforce(); });
      }

      function applyTheme() {
        // Match the native CSS-editor classes, which are present whether or not
        // mini-ide is enabled. The previous selector keyed off .css-editor-textarea
        // — a class mini-ide adds — so enforcement silently did nothing when
        // mini-ide was disabled. capFor() reads the cap (incl. the per-id skin
        // split) from the shared helper.
        $("textarea.widgetSkin, textarea.containerStyle, textarea.menu").each(function() {
          setMaxlengthIfNeeded($(this), capFor(this));
          attachSkinLengthGuard(this);
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
