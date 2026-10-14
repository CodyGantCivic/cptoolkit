// widget-skin-advanced-style-helper.js
(function loadTool() {
  var thisTool = "widget-skin-advanced-style-helper";
  // Enable debug logging for troubleshooting. Set to true to see logs.
  const DEBUG = false;

  chrome.storage.local.get(thisTool, function(settings) {
    if (chrome.runtime.lastError) {
      console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
      return;
    }

    detect_if_cp_site(function() {
      if (settings[thisTool] !== false) {
        if (DEBUG) console.log("[CP Toolkit] ✓ Loading " + thisTool);
        try {
          initWidgetSkinHelper();
        } catch (err) {
          console.warn("[CP Toolkit](" + thisTool + ") Error:", err);
        }
      } else {
        if (DEBUG) console.log("[CP Toolkit] ○ Skipping " + thisTool + " (disabled in settings)");
      }
    });
  });

  function initWidgetSkinHelper() {
    'use strict';

    const TOOLKIT_NAME = '[CP Widget Skin Helper]';

    // Only run on Theme Manager and Widget Manager pages
    const currentPath = window.location.pathname.toLowerCase();
    const isThemeManager = currentPath.startsWith('/designcenter/themes/');
    const isWidgetManager = currentPath.startsWith('/designcenter/widgets/');

    if (!isThemeManager && !isWidgetManager) {
      if (DEBUG) console.log(TOOLKIT_NAME, 'not on theme/widget manager page - aborting');
      return;
    }

    if (DEBUG) console.log(TOOLKIT_NAME, 'Initializing...');

    // ----------------- Inject page helper -----------------
    // This helper runs in the page context and can call page jQuery internals.
    function injectPageHelper() {
      if (window.__CPToolkit_fireAllJqChangeHandlersInjected) return;
      
      // CSP FIX: Load external helper file instead of inline code
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('js/tools/on-load/helpers/widget-skin-change-handler.js');
      (document.head || document.documentElement).appendChild(s);
      
      console.log('[CP Toolkit] Loaded external helper: widget-skin-change-handler.js');
    }

    injectPageHelper();

    // ----------------- Utilities -----------------
    function getSkinId() {
      const skinIdInput = document.getElementById('hdnSkinID');
      return skinIdInput ? skinIdInput.value : null;
    }

    function replaceSkinNumbers(text, skinId) {
      if (!skinId || skinId === '-1') return text;
      return text.replace(/\.skin\d+/g, '.skin' + skinId);
    }

    function firePageChangeHandlers(elem) {
      // Prefer injected page helper (calls handlers in page context)
      try {
        if (typeof window.__CPToolkit_fireAllJqChangeHandlers === 'function') {
          window.__CPToolkit_fireAllJqChangeHandlers(elem);
          return;
        }
      } catch (err) {
        if (DEBUG) console.warn(TOOLKIT_NAME, 'error calling injected helper', err);
      }

      // Fallbacks
      try {
        if (window.jQuery) {
          window.jQuery(elem).trigger('change');
          return;
        }
      } catch (err) { /* ignore */ }

      try {
        elem.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (err) {
        if (DEBUG) console.warn(TOOLKIT_NAME, 'final fallback dispatch failed', err);
      }
    }

    // ----------------- Attach handlers -----------------
    function attachTextareaHandlers(textarea, skinId) {
      // allow rebind if skinId changed
      if (textarea.dataset.cpSkinHandlerAttached === skinId) return;
      textarea.dataset.cpSkinHandlerAttached = skinId;

      function doReplaceAndNotify() {
        const sid = getSkinId();
        if (!sid || sid === '-1') return;

        const original = textarea.value || '';
        const newVal = replaceSkinNumbers(original, sid);

        if (newVal !== original) {
          textarea.value = newVal;
          // native input event
          try { textarea.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
          // call page handlers (best chance) then native fallback
          firePageChangeHandlers(textarea);
          try { textarea.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
          if (DEBUG) console.log(TOOLKIT_NAME, 'Replaced on handler & fired change for', textarea.id || textarea);
        }
        if (textarea.dataset) textarea.dataset.cpSkinProcessed = sid;
      }

      textarea.addEventListener('blur', doReplaceAndNotify);
      textarea.addEventListener('change', doReplaceAndNotify);
      textarea.addEventListener('keydown', function(e) {
        if ((e.key === 'Enter' || e.keyCode === 13) && (e.ctrlKey || e.metaKey)) {
          doReplaceAndNotify();
        }
      });
    }

    // ----------------- Main processing -----------------
    let lastSeenSkinId = getSkinId();

    function processTextareas() {
      const skinId = getSkinId();

      // If skinId changed, clear processed markers so we re-run replacements
      if (lastSeenSkinId !== skinId) {
        document.querySelectorAll('textarea').forEach(t => {
          if (t.dataset && t.dataset.cpSkinProcessed) delete t.dataset.cpSkinProcessed;
          if (t.dataset && t.dataset.cpSkinHandlerAttached) delete t.dataset.cpSkinHandlerAttached;
        });
        lastSeenSkinId = skinId;
        if (DEBUG) console.log(TOOLKIT_NAME, 'skinId changed; cleared processed markers');
      }

      if (!skinId || skinId === '-1') return;

      const nodes = document.querySelectorAll(
        'textarea[id*="MiscellaneousStyles"], textarea[id*="MiscStyles"], textarea#txtHeader, textarea#txtFooter, textarea.autoUpdate'
      );

      nodes.forEach(textarea => {
        attachTextareaHandlers(textarea, skinId);

        const currentValue = textarea.value || '';
        if (currentValue === '') return;

        if (textarea.dataset.cpSkinProcessed !== skinId) {
          const replaced = replaceSkinNumbers(currentValue, skinId);
          if (replaced !== currentValue) {
            textarea.value = replaced;
            try { textarea.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
            firePageChangeHandlers(textarea);
            try { textarea.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
            if (DEBUG) console.log(TOOLKIT_NAME, 'initial replace for', textarea.id || textarea);
          }
          textarea.dataset.cpSkinProcessed = skinId;
        }
      });
    }

    // ----------------- Observers & polling -----------------
    function startObserving() {
      let debounceTimer = null;
      const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(processTextareas, 300);
      });

      if (document.body) observer.observe(document.body, { childList: true, subtree: true });

      // watch for hdnSkinID change
      const skinInput = document.getElementById('hdnSkinID');
      if (skinInput) {
        skinInput.addEventListener('change', () => {
          lastSeenSkinId = null;
          processTextareas();
        });
      }

      // safety: periodic check (low-frequency)
      const POLL_MS = 1500;
      setInterval(() => {
        processTextareas();
      }, POLL_MS);
    }

    // ----------------- init -----------------
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        processTextareas();
        startObserving();
      });
    } else {
      processTextareas();
      startObserving();
    }

    // ----------------- copy selector snippet -----------------
    // Each Advanced / Miscellaneous Styles box is labelled by the CMS with the
    // selector it sits inside (e.g. ".widgetItem {") in text just above the
    // box. The snippet prefixes that label with .widget.skinN so a new rule
    // can be started at the cursor: "}" closes the box's own rule, then the
    // full selector opens a new one. Any state in the label (:hover, :active)
    // is carried through as-is.
    function findSelectorLabel(textarea) {
      const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();
      const isOpener = (text) => text.length > 1 && text.length <= 200 &&
        text.charAt(text.length - 1) === '{' && text.indexOf('{') === text.length - 1;

      let node = textarea.closest('.css-editor-wrapper') || textarea;
      for (let depth = 0; depth < 4 && node && node !== document.body; depth++) {
        let sibling = node.previousSibling;
        for (let seen = 0; sibling && seen < 6; seen++, sibling = sibling.previousSibling) {
          const text = clean(sibling.textContent);
          if (isOpener(text)) return text.slice(0, -1).trim();
        }
        node = node.parentElement;
      }
      return null;
    }

    function buildSkinSelector(labelSelector, skinId) {
      const prefix = '.widget.skin' + skinId;
      return labelSelector.split(',').map((part) => {
        const selector = part.trim();
        if (!selector) return '';
        // ".widget", ".widget:hover", ".widget .x" become ".widget.skinN..."
        // ".widgetItem" is a different class, so it becomes a descendant.
        const match = /^\.widget(?![\w-])(.*)$/.exec(selector);
        if (match) return prefix + match[1].replace(/\.skin\d+/g, '');
        return prefix + ' ' + selector.replace(/^\.skin\d+\s*/, '');
      }).filter(Boolean).join(',\n');
    }

    function getSelectorCopySnippetForTextarea(textarea) {
      const skinId = getSkinId();
      if (!textarea || !skinId || skinId === '-1') return null;
      const label = findSelectorLabel(textarea);
      if (!label) return null;
      const selector = buildSkinSelector(label, skinId);
      return selector ? '}\n\n' + selector + ' {' : null;
    }

    // ----------------- expose API -----------------
    window.CPToolkit = window.CPToolkit || {};
    window.CPToolkit.widgetSkinHelper = {
      getSkinId: getSkinId,
      replaceSkinNumbers: replaceSkinNumbers,
      processTextareas: processTextareas,
      getSelectorCopySnippetForTextarea: getSelectorCopySnippetForTextarea,
      debugInfo: function() {
        return {
          skinId: getSkinId(),
          pageHelperInjected: !!window.__CPToolkit_fireAllJqChangeHandlersInjected,
          hasPageJQuery: !!window.jQuery
        };
      }
    };

    if (DEBUG) console.log(TOOLKIT_NAME + ' ✓ Ready');
  }
})();
