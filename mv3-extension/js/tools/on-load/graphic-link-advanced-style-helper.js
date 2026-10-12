(function loadTool() {
  var thisTool = "graphic-link-advanced-style-helper";
  
  chrome.storage.local.get(thisTool, function(settings) {
    if (chrome.runtime.lastError) {
      console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
      return;
    }
    
    detect_if_cp_site(function() {
      // This tool runs by default unless explicitly disabled
      if (settings[thisTool] !== false) {
        console.log("[CP Toolkit] Loaded " + thisTool);
        try {
          initGraphicLinkHelper();
        } catch (err) {
          console.warn("[CP Toolkit](" + thisTool + ") Error:", err);
        }
      } else {
        // console.log("[CP Toolkit] ○ Skipping " + thisTool + " (disabled in settings)");
      }
    });
  });
  
  function initGraphicLinkHelper() {
    'use strict';

    const TOOLKIT_NAME = '[CP Graphic Link Helper]';

    // Only run on Graphic Links page - check both path and URL
    const currentPath = window.location.pathname.toLowerCase();
    const currentHref = window.location.href.toLowerCase();
    const isGraphicLinksPage = currentPath.includes('/admin/graphiclinks.aspx') || 
                                currentHref.includes('/admin/graphiclinks.aspx') ||
                                currentPath.includes('graphiclinks.aspx');
    
    if (!isGraphicLinksPage) {
      // console.log(TOOLKIT_NAME + ' Not on Graphic Links page (path: ' + currentPath + '), skipping...');
      return;
    }
    
    // console.log(TOOLKIT_NAME + ' Initializing on Graphic Links page...');
    
    // Store current button selector
    let currentFancyButtonSelector = 'fancyButton1';
    
    // ==================== FANCY BUTTON DETECTION ====================
    function getFancyButtonId() {
      const fancyButtonContainer = document.querySelector('.fancyButtonContainer a.fancyButton');
      if (!fancyButtonContainer) return null;
      
      const classes = fancyButtonContainer.className;
      if (!classes) return null;
      
      const classList = classes.split(' ');
      for (const cls of classList) {
        const match = cls.match(/^fancyButton(\d+)$/);
        if (match && match[1]) {
          currentFancyButtonSelector = 'fancyButton' + match[1];
          return match[1];
        }
      }
      
      currentFancyButtonSelector = 'fancyButton1';
      return '1';
    }
    
    function getCurrentFancyButtonSelector() {
      getFancyButtonId();
      return currentFancyButtonSelector;
    }
    
    // ==================== NUMBER REPLACEMENT FUNCTIONS ====================
    // Selector-list-aware: a dual selector like
    // ".fancyButton1 .text, .fancyButton1556 .text" is the deliberate,
    // already-correct portable form the copy buttons produce — one half
    // for the builder's live preview (placeholder), one half for the real
    // saved page. Collapsing both down to "1" (the old behavior) destroys
    // the real-ID half every time the builder reopens after a save,
    // silently turning it into a duplicate of the placeholder. Only a
    // stray id that is neither the placeholder nor this button's real id
    // (e.g. pasted in from a different button's saved CSS) gets collapsed.
    function normalizeToFancyButton1(text, currentButtonId) {
      return text.replace(/\.fancyButton(\d+)\b/g, function(match, num) {
        if (num === '1' || num === currentButtonId) return match;
        return '.fancyButton1';
      });
    }
    
    function denormalizeFromFancyButton1(text, selector) {
      if (!selector || selector === 'fancyButton1') return text;
      return text.replace(/\.fancyButton1\b/g, '.' + selector);
    }
    
    // ==================== FIX RENDERED STYLES ====================
    function fixRenderedFancyButtonStyles() {
      const fancyButtons = document.querySelectorAll('a.fancyButton[class*="fancyButton"]');
      
      fancyButtons.forEach(button => {
        const classes = button.className.split(' ');
        const buttonClass = classes.find(c => c.match(/^fancyButton\d+$/));
        
        if (!buttonClass) return;
        
        const buttonNum = buttonClass.replace('fancyButton', '');
        if (buttonNum === '1') return;
        
        // Find associated style tag
        let styleTag = null;
        
        // Method 1: Check siblings
        let currentElement = button.nextElementSibling;
        while (currentElement && !styleTag) {
          if (currentElement.tagName === 'STYLE') {
            styleTag = currentElement;
            break;
          }
          currentElement = currentElement.nextElementSibling;
        }
        
        // Method 2: Check parent container
        if (!styleTag) {
          const container = button.closest('td') || button.closest('div') || button.closest('.fancyButtonContainer');
          if (container) {
            styleTag = container.querySelector('style[scoped]') || container.querySelector('style');
          }
        }
        
        // Method 3: Check parent's siblings
        if (!styleTag) {
          const parent = button.parentElement;
          if (parent) {
            let sibling = parent.nextElementSibling;
            while (sibling && !styleTag) {
              if (sibling.tagName === 'STYLE') {
                styleTag = sibling;
                break;
              }
              styleTag = sibling.querySelector('style');
              if (styleTag) break;
              sibling = sibling.nextElementSibling;
            }
          }
        }
        
        if (styleTag && styleTag.tagName === 'STYLE') {
          const originalCSS = styleTag.textContent;
          const updatedCSS = originalCSS.replace(/\.fancyButton1\b/g, `.fancyButton${buttonNum}`);
          
          if (originalCSS !== updatedCSS) {
            styleTag.textContent = updatedCSS;
            // console.log(TOOLKIT_NAME + ' Fixed styles: .fancyButton1 → .fancyButton' + buttonNum);
          }
        }
      });
    }
    
    // ==================== FIX HTML-ENCODED CSS ====================
    // The CMS sometimes HTML-encodes CSS inside <style> tags on the
    // graphic link edit page (e.g. content: &quot;&quot; instead of content: "").
    // HTML entities are not decoded inside <style> tags, so the CSS breaks.
    // Only decode &quot; and &amp; — skip &lt;/&gt; to avoid any risk.
    function fixHtmlEncodedStyles() {
      const allStyles = document.querySelectorAll('style');
      allStyles.forEach(styleTag => {
        const css = styleTag.textContent;
        if (css.indexOf('fancyButton') < 0) return;
        if (css.indexOf('&quot;') < 0 && css.indexOf('&amp;') < 0) return;
        const fixed = css.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        if (fixed !== css) {
          styleTag.textContent = fixed;
        }
      });
    }

    // The CMS can leave a previous Fancy Button Builder modal's DOM behind
    // (hidden) when it is reopened without a full page reload. Any lookup
    // that assumes there is only one #selectedTab or one #fancyButton*Misc
    // in the whole document can silently grab a stale, hidden instance
    // instead of the one actually on screen. Scoping to the visible modal
    // avoids that.
    function getVisibleFancyButtonModal() {
      const modals = document.querySelectorAll('.modalContainer.fancyButtonBuilder');
      for (const m of modals) {
        if (m.offsetParent !== null) return m;
      }
      return modals[0] || null;
    }

    // ==================== FANCY BUTTON ID BADGE ====================
    // Shows the real .fancyButtonN class next to the Fancy Button Builder
    // modal title so the number is visible without opening DevTools.
    function injectFancyButtonIdBadge() {
      const modal = getVisibleFancyButtonModal();
      if (!modal) return;

      const titleEl = modal.querySelector('h3.modalTitle');
      const titleLeft = titleEl && titleEl.parentElement;
      if (!titleLeft) return;

      let badge = titleLeft.querySelector('.cpFancyButtonIdBadge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'cpFancyButtonIdBadge';
        badge.style.cssText = 'display:inline-block;margin-left:8px;padding:2px 10px;' +
          'background:#0b5b8a;color:#fff;border-radius:999px;font-size:12px;' +
          'font-weight:600;font-family:Arial,sans-serif;vertical-align:middle;' +
          'letter-spacing:.02em;';
        titleLeft.appendChild(badge);
      }

      const buttonId = getFancyButtonId();
      badge.textContent = buttonId ? ('#' + buttonId) : 'unsaved';
      badge.title = buttonId
        ? ('This is Fancy Button #' + buttonId + '. Use .fancyButton' + buttonId + ' when referencing this button in a selector.')
        : 'This button has not been saved yet, so it does not have a permanent ID.';
    }

    // ==================== SELECTOR FORMAT CONVERT BUTTON ====================
    // Always-present button beside the ID badge. Greyed out unless one of the
    // style boxes has a rule missing its .fancyButton1 or real-ID selector
    // (an old-format button); pressing it adds only the missing half using
    // Mini IDE's Make Portable engine. It edits the textareas only; nothing
    // is saved until the user saves the button as usual.
    const CONVERT_BTN_CLASS = 'cpFancyButtonConvertBtn';
    let convertStatusTimer = null;

    function getStyleTextareas(modal) {
      return Array.prototype.slice.call(modal.querySelectorAll(
        'textarea#fancyButtonNormalMiscStyles, ' +
        'textarea#fancyButtonHoverMiscStyles, ' +
        'textarea[id^="fancyButton"][id$="MiscStyles"], ' +
        'textarea.autoUpdate'
      ));
    }

    function setConvertButtonState(btn, enabled, label, title) {
      btn.disabled = !enabled;
      btn.textContent = label;
      btn.title = title;
      btn.style.setProperty('background', enabled ? '#af282f' : '#9aa5b1', 'important');
      btn.style.setProperty('opacity', enabled ? '1' : '0.6', 'important');
      btn.style.setProperty('cursor', enabled ? 'pointer' : 'not-allowed', 'important');
    }

    function getTextareasNeedingConversion(modal, buttonId, portable) {
      return getStyleTextareas(modal).filter(function(textarea) {
        return textarea.value && portable.cssNeedsPortableConversion(textarea.value, buttonId);
      });
    }

    function updateSelectorConvertButton() {
      const modal = getVisibleFancyButtonModal();
      if (!modal) return;

      const titleEl = modal.querySelector('h3.modalTitle');
      const titleLeft = titleEl && titleEl.parentElement;
      if (!titleLeft) return;

      let btn = titleLeft.querySelector('.' + CONVERT_BTN_CLASS);
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = CONVERT_BTN_CLASS;
        btn.style.cssText = 'display:inline-block!important;width:auto!important;margin:0 0 0 8px!important;' +
          'padding:2px 10px!important;border:none!important;border-radius:999px!important;color:#fff!important;' +
          'font-size:12px!important;font-weight:600!important;font-family:Arial,sans-serif!important;' +
          'line-height:1.4!important;vertical-align:middle;';
        btn.addEventListener('click', handleConvertSelectorsClick);
        titleLeft.appendChild(btn);
      }

      // While a "just updated" message is showing, leave the label alone.
      if (btn.dataset.cpJustUpdated === 'true') return;

      const buttonId = getFancyButtonId();
      const portable = window.CPToolkit && window.CPToolkit.portable;

      if (!buttonId || buttonId === '1') {
        setConvertButtonState(btn, false, 'Update selectors',
          'Save this button first so it has a permanent ID, then selectors can be updated.');
      } else if (!portable || typeof portable.cssNeedsPortableConversion !== 'function') {
        setConvertButtonState(btn, false, 'Update selectors',
          'Turn on Mini IDE to check and update selectors.');
      } else {
        const needing = getTextareasNeedingConversion(modal, buttonId, portable);
        if (needing.length > 0) {
          setConvertButtonState(btn, true, 'Update selectors',
            'Old selector format found in ' + needing.length + ' style box' + (needing.length === 1 ? '' : 'es') +
            '. Click to add the missing .fancyButton1 / .fancyButton' + buttonId + ' selector. Nothing is saved until you save the button.');
        } else {
          setConvertButtonState(btn, false, '✓ Selectors up to date',
            'Every style box already has both .fancyButton1 and .fancyButton' + buttonId + '.');
        }
      }
    }

    function handleConvertSelectorsClick(e) {
      e.preventDefault();
      e.stopPropagation();
      const btn = e.currentTarget;
      const modal = getVisibleFancyButtonModal();
      const portable = window.CPToolkit && window.CPToolkit.portable;
      const buttonId = getFancyButtonId();
      if (!modal || !portable || !buttonId || buttonId === '1' || btn.disabled) return;

      let updated = 0;
      let skipped = 0;
      getTextareasNeedingConversion(modal, buttonId, portable).forEach(function(textarea) {
        const result = portable.transformCssPortable(textarea.value, buttonId, true);
        if (result.parseError || !result.changed) {
          skipped += 1;
          return;
        }
        textarea.value = result.output;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        updated += 1;
      });

      btn.dataset.cpJustUpdated = 'true';
      setConvertButtonState(btn, false,
        updated > 0 ? '✓ Updated – save to keep' : 'Could not update',
        updated > 0
          ? 'Updated ' + updated + ' style box' + (updated === 1 ? '' : 'es') + '. Save the button to keep the changes.'
          : (skipped > 0 ? 'The selectors in ' + skipped + ' style box(es) could not be updated safely. Use Make Portable to review them.' : ''));
      clearTimeout(convertStatusTimer);
      convertStatusTimer = setTimeout(function() {
        delete btn.dataset.cpJustUpdated;
        updateSelectorConvertButton();
      }, 4000);
    }

    // ==================== SELECTOR COPY BUTTONS ====================
    // Each Advanced Styles panel (Background outer/inner, Default Text
    // Style, and any number of added Text Styles) is identified by the
    // #selectedTab dropdown's option value, e.g. "#fancyButtonText2".
    // That id is a stable, CMS-controlled anchor — unlike the on-screen
    // selector label, which the native UI renders identically for
    // Background (inner), Default Text Style, and every Text Style N.
    // The real per-style class (.textStyleN) comes from cp-ImportFancyButton.js,
    // which already relies on that same rendered markup.
    function getSelectorBaseForContainerId(containerId) {
      if (containerId === 'fancyButtonOuterBackground') return '';
      if (containerId === 'fancyButtonInnerBackground') return ' .text';
      if (containerId === 'fancyButtonText') return ' .text';
      const styleMatch = containerId.match(/^fancyButtonText(\d+)$/);
      if (styleMatch) return ' .textStyle' + styleMatch[1];
      return null;
    }

    // The ADV STYLES content for a level lives in a separate "Misc" panel,
    // not the panel named by the #selectedTab option value itself (that one
    // only holds Background & Border / Spacing & Sizing fields). Confirmed
    // by direct measurement (getBoundingClientRect + computed display) of
    // each candidate container:
    //   - Background outer/inner each get their own permanent Misc panel.
    //   - Default Text Style's panel is #fancyButtonTextStyleMisc (no suffix).
    //   - Each added Text Style N gets its OWN panel, #fancyButtonTextStyleMiscN
    //     — NOT a shared panel. (An earlier version of this code assumed all
    //     Text Styles shared one #fancyButtonTextStyleMisc container; that
    //     was wrong — that id belongs only to Default Text Style, is real,
    //     and stays in the DOM with display:none once a numbered style is
    //     added, which is why buttons injected into it were never visible.)
    function getMiscContainerId(containerId) {
      if (containerId === 'fancyButtonOuterBackground') return 'fancyButtonOuterBackgroundMisc';
      if (containerId === 'fancyButtonInnerBackground') return 'fancyButtonInnerBackgroundMisc';
      if (containerId === 'fancyButtonText') return 'fancyButtonTextStyleMisc';
      const styleMatch = containerId.match(/^fancyButtonText(\d+)$/);
      if (styleMatch) return 'fancyButtonTextStyleMisc' + styleMatch[1];
      return null;
    }

    function buildSelectorCopySnippet(buttonId, base, isHover) {
      const state = isHover ? ':is(:hover, :focus, :active)' : '';
      let snippet = '.fancyButton1' + state + base;
      if (buttonId && buttonId !== '1') {
        snippet += ',\n.fancyButton' + buttonId + state + base;
      }
      return '}\n\n' + snippet + ' {';
    }

    function copySelectorSnippetToClipboard(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => fallbackCopySnippet(text));
      } else {
        fallbackCopySnippet(text);
      }
    }

    function fallbackCopySnippet(text) {
      const scratch = document.createElement('textarea');
      scratch.value = text;
      scratch.style.position = 'fixed';
      scratch.style.opacity = '0';
      document.body.appendChild(scratch);
      scratch.select();
      try { document.execCommand('copy'); } catch (err) { /* no-op */ }
      document.body.removeChild(scratch);
    }

    function makeSelectorCopyButton(base, isHover) {
      const wrapper = document.createElement('span');
      wrapper.className = 'cpSelectorCopyBtn';
      wrapper.style.cssText = 'position:relative !important;display:inline-flex !important;' +
        'align-items:center !important;margin:0 0 0 10px !important;';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '⧉';
      btn.style.cssText = 'display:inline-flex !important;align-items:center !important;' +
        'justify-content:center !important;width:20px !important;height:20px !important;' +
        'min-width:20px !important;max-width:20px !important;min-height:20px !important;' +
        'max-height:20px !important;margin:0 !important;padding:0 !important;' +
        'font-size:12px !important;line-height:1 !important;cursor:pointer !important;' +
        'border:1px solid #b9c6cf !important;border-radius:4px !important;' +
        'background:#f5f8fa !important;color:#0b5b8a !important;box-shadow:none !important;' +
        'box-sizing:border-box !important;appearance:none !important;' +
        '-webkit-appearance:none !important;';

      const tooltip = document.createElement('span');
      tooltip.textContent = 'Copy a starting selector for a new rule at this level';
      tooltip.style.cssText = 'position:absolute !important;top:130% !important;' +
        'left:0 !important;' +
        'background:#1f2d3a !important;color:#fff !important;padding:5px 9px !important;' +
        'border-radius:4px !important;font-size:11px !important;line-height:1.3 !important;' +
        'white-space:nowrap !important;display:none !important;z-index:10000 !important;' +
        'pointer-events:none !important;box-shadow:0 2px 6px rgba(0,0,0,.25) !important;' +
        'font-family:Arial,sans-serif !important;';

      // No click or hover listeners here. "Add New Text Style" clones the
      // previous panel's markup, and a markup clone never carries over
      // JS-attached listeners — only delegated listeners bound once to the
      // stable modal (in injectSelectorCopyButtons) survive that. Click
      // already uses delegation; hover needs the same treatment
      // (handleSelectorCopyHover, bound to 'mouseover'/'mouseout' since
      // mouseenter/mouseleave don't bubble and can't be delegated).
      wrapper.dataset.cpBase = base;
      wrapper.dataset.cpHover = isHover ? 'true' : 'false';

      wrapper.appendChild(btn);
      wrapper.appendChild(tooltip);
      return wrapper;
    }

    function handleSelectorCopyClick(e) {
      const wrapper = e.target.closest('.cpSelectorCopyBtn');
      if (!wrapper) return;
      const btn = e.target.closest('button');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      const base = wrapper.dataset.cpBase || '';
      const isHover = wrapper.dataset.cpHover === 'true';
      const buttonId = getFancyButtonId();
      const snippet = buildSelectorCopySnippet(buttonId, base, isHover);
      copySelectorSnippetToClipboard(snippet);

      const tooltip = wrapper.querySelector('span');
      if (tooltip) {
        const original = tooltip.dataset.cpOriginalText || tooltip.textContent;
        tooltip.dataset.cpOriginalText = original;
        tooltip.textContent = 'Copied!';
        setTimeout(() => { tooltip.textContent = original; }, 1200);
      }
    }

    function handleSelectorCopyHover(e) {
      const wrapper = e.target.closest('.cpSelectorCopyBtn');
      if (!wrapper) return;
      const tooltip = wrapper.querySelector('span');
      if (!tooltip) return;

      if (e.type === 'mouseover') {
        const cameFromSameWrapper = e.relatedTarget && e.relatedTarget.closest &&
          e.relatedTarget.closest('.cpSelectorCopyBtn') === wrapper;
        if (cameFromSameWrapper) return;
        tooltip.style.setProperty('display', 'block', 'important');
      } else if (e.type === 'mouseout') {
        const goingToSameWrapper = e.relatedTarget && e.relatedTarget.closest &&
          e.relatedTarget.closest('.cpSelectorCopyBtn') === wrapper;
        if (goingToSameWrapper) return;
        tooltip.style.setProperty('display', 'none', 'important');
      }
    }

    function injectSelectorCopyButtons() {
      const modal = getVisibleFancyButtonModal();
      if (!modal) return;

      // Bound once per modal instance, never rebound — this is what makes
      // the click handling immune to individual buttons being replaced.
      if (!modal.dataset.cpCopyDelegationBound) {
        // Capture phase: runs on the way down, before any bubble-phase
        // stopPropagation() elsewhere in the modal (e.g. a click-outside
        // guard) can swallow the event first.
        modal.addEventListener('click', handleSelectorCopyClick, true);
        modal.addEventListener('mouseover', handleSelectorCopyHover);
        modal.addEventListener('mouseout', handleSelectorCopyHover);
        modal.dataset.cpCopyDelegationBound = 'true';
        console.log('[CP Toolkit] copy-button click delegation bound to modal');
      }

      const tabSelect = modal.querySelector('select#selectedTab');
      if (!tabSelect) return;

      // Map, not Set: each Misc container now maps 1:1 to a specific level,
      // so the correct base class can be baked in once, from the DOM
      // structure itself, rather than re-read from the dropdown at click
      // time (which proved unreliable immediately after adding a new Text
      // Style, before the dropdown's own value settles).
      const miscToBase = new Map();
      tabSelect.querySelectorAll('option').forEach(opt => {
        const containerId = (opt.value || '').replace(/^#/, '');
        if (!containerId) return;
        const miscId = getMiscContainerId(containerId);
        const base = getSelectorBaseForContainerId(containerId);
        if (miscId && base !== null && !miscToBase.has(miscId)) {
          miscToBase.set(miscId, base);
        }
      });

      miscToBase.forEach((base, miscId) => {
        const container = modal.querySelector('#' + miscId);
        if (!container) return;

        const headers = container.querySelectorAll('p.cpExpandCollapseControl');
        headers.forEach((header, idx) => {
          const isHover = idx === 1;
          const parent = header.parentElement;
          const box = header.nextElementSibling; // .cpExpandCollapseBox

          // "Add New Text Style" clones the previous panel's whole DOM
          // subtree, which carries over an already-injected button —
          // complete with its OLD data-cp-base from the panel it was
          // cloned from. Checking only "does a button already exist" and
          // skipping isn't enough: that stale clone survives with the
          // wrong target baked in, silently. So an existing wrapper here
          // always gets its data attributes overwritten with the base for
          // *this* container; only a genuinely missing wrapper gets created.
          const existing = parent.querySelector('.cpSelectorCopyBtn');
          if (existing) {
            existing.dataset.cpBase = base;
            existing.dataset.cpHover = isHover ? 'true' : 'false';
            return;
          }

          // Constraints confirmed by live testing:
          // 1. header.nextElementSibling is the .cpExpandCollapseBox that
          //    holds the textarea, and the native toggle depends on that
          //    direct adjacency — the button must never be inserted there.
          // 2. The header's own toggle listener fires before a descendant's
          //    handler could stop it (capture phase and/or mousedown), so
          //    the button must never be a descendant of the header either.
          // The button is therefore inserted as a DOM sibling *before* the
          // header (preserving both constraints), and flexbox `order` on
          // the shared parent visually moves it to after the header text —
          // `order` changes paint order only, never nextElementSibling, so
          // the toggle keeps working. (An earlier attempt used
          // `display:inline-block` on the header for same-line layout; that
          // introduced a large gap above the content box, a known
          // inline-block whitespace quirk. flex has no such issue —
          // measured zero gap live.)
          parent.style.setProperty('display', 'flex', 'important');
          parent.style.setProperty('flex-wrap', 'wrap', 'important');
          parent.style.setProperty('align-items', 'center', 'important');
          header.style.setProperty('order', '1', 'important');
          if (box) {
            box.style.setProperty('order', '3', 'important');
            box.style.setProperty('flex-basis', '100%', 'important');
          }

          const btn = makeSelectorCopyButton(base, isHover);
          btn.style.setProperty('order', '2', 'important');
          header.insertAdjacentElement('beforebegin', btn);
        });
      });
    }

    // ==================== PROCESS TEXTAREAS ====================
    // Removed: this used to rewrite a saved textarea's value on every load
    // to normalize .fancyButtonN back to the placeholder .fancyButton1 for
    // editing/preview. That destructive rewrite is exactly the anti-pattern
    // the copy-buttons feature's regression investigation flagged — it
    // silently collapsed a deliberate dual/portable selector (one half for
    // preview, one half for the real saved page) into a duplicate every
    // time the builder reopened. No longer touches persisted values at all.
    function processTextareas() {
      const buttonId = getFancyButtonId();
      if (!buttonId) return;

      const textareas = document.querySelectorAll(
        'textarea#fancyButtonNormalMiscStyles, ' +
        'textarea#fancyButtonHoverMiscStyles, ' +
        'textarea[id^="fancyButton"][id$="MiscStyles"], ' +
        'textarea.autoUpdate'
      );

      textareas.forEach(textarea => {
        const currentValue = textarea.value;
        if (!currentValue) return;

        // Skip if already processed
        if (textarea.dataset.cpFancyProcessed === 'true') return;

        textarea.dataset.cpFancyProcessed = 'true';
      });
    }
    
    // ==================== INSERT BUTTON HANDLER ====================
    // Selector-list-aware rewrite via window.CPToolkit.portable.applyForSave
    // preserves dual selectors when the user has applied "Make Portable".
    // Falls back to flat regex if the portable helper isn't loaded yet.
    function portableApplyForSave(text, selector) {
      const portable = window.CPToolkit && window.CPToolkit.portable;
      if (portable && typeof portable.applyForSave === 'function') {
        return portable.applyForSave(text, selector);
      }
      return text.replace(/\.fancyButton\d+\b/g, '.' + selector);
    }

    function addInsertButtonFallback(insertBtn) {
      // Fallback for when jQuery isn't available or handlers aren't attached yet
      insertBtn.addEventListener('click', function(e) {
        const currentSelector = getCurrentFancyButtonSelector();
        // console.log(TOOLKIT_NAME + ' Insert clicked (fallback) - converting to .' + currentSelector);

        // Update all textareas
        document.querySelectorAll('textarea.autoUpdate, textarea[id^="fancyButton"][id$="MiscStyles"]').forEach(textarea => {
          if (textarea.value) {
            const newText = portableApplyForSave(textarea.value, currentSelector);
            if (newText !== textarea.value) {
              textarea.value = newText;
              textarea.dispatchEvent(new Event('change', { bubbles: true }));
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        });
        
        // Fix button class after a delay (let CivicPlus code run first)
        setTimeout(() => {
          if (typeof $ !== 'undefined') {
            const buttonEl = $('.fancyButtonContainer a.fancyButton');
            if (buttonEl.length) {
              const newClass = buttonEl.attr('class').replace(/fancyButton\d+/g, currentSelector);
              buttonEl.attr('class', newClass);
            }
          } else {
            const buttonEl = document.querySelector('.fancyButtonContainer a.fancyButton');
            if (buttonEl) {
              buttonEl.className = buttonEl.className.replace(/fancyButton\d+/g, currentSelector);
            }
          }
        }, 100);
      }, true); // Use capture phase to run before other handlers
    }
    
    function setupInsertButtonHandler() {
      const observer = new MutationObserver(() => {
        const insertBtn = document.querySelector('.insertFancy');
        if (insertBtn && !insertBtn.dataset.cpToolkitBound) {
          insertBtn.dataset.cpToolkitBound = 'true';
          // console.log(TOOLKIT_NAME + ' Found insert button, setting up handler...');
          
          let handlerAttached = false;
          
          // Try jQuery method first if available
          if (typeof $ !== 'undefined' && typeof $._data === 'function') {
            try {
              const events = $._data(insertBtn, 'events');
              if (events && events.click && events.click[0]) {
                const oldHandler = events.click[0].handler;
                
                function newHandler(e) {
                  const currentSelector = getCurrentFancyButtonSelector();
                  // console.log(TOOLKIT_NAME + ' Insert clicked (jQuery) - converting to .' + currentSelector);

                  // Update all textareas
                  $('textarea.autoUpdate').each(function() {
                    let text = $(this).val();
                    text = portableApplyForSave(text, currentSelector);
                    $(this).val(text);
                    $(this).change();
                  });

                  document.querySelectorAll('textarea[id^="fancyButton"][id$="MiscStyles"]').forEach(textarea => {
                    if (textarea.value) {
                      const newText = portableApplyForSave(textarea.value, currentSelector);
                      if (newText !== textarea.value) {
                        textarea.value = newText;
                        textarea.dispatchEvent(new Event('change', { bubbles: true }));
                      }
                    }
                  });
                  
                  // Call original handler
                  oldHandler(e);
                  
                  // Fix button class
                  setTimeout(() => {
                    const buttonEl = $('.fancyButtonContainer a.fancyButton');
                    if (buttonEl.length) {
                      const newClass = buttonEl.attr('class').replace(/fancyButton\d+/g, currentSelector);
                      buttonEl.attr('class', newClass);
                    }
                  }, 100);
                }
                
                $('.insertFancy').unbind('click').click(newHandler);
                // console.log(TOOLKIT_NAME + ' ✓ Insert button handler attached (jQuery method)');
                handlerAttached = true;
              } else {
                // console.log(TOOLKIT_NAME + ' No jQuery click handler found yet, using fallback');
              }
            } catch (err) {
              console.warn(TOOLKIT_NAME + ' jQuery handler error:', err);
            }
          } else {
            // console.log(TOOLKIT_NAME + ' jQuery not available, using fallback');
          }
          
          // Use fallback if jQuery method didn't work
          if (!handlerAttached) {
            addInsertButtonFallback(insertBtn);
            // console.log(TOOLKIT_NAME + ' ✓ Insert button handler attached (fallback method)');
          }
          
          observer.disconnect();
        }
      });
      
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }
    
    // ==================== MUTATION OBSERVER ====================
    function startObserving() {
      let debounceTimer = null;
      
      const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          processTextareas();
          fixHtmlEncodedStyles();
          fixRenderedFancyButtonStyles();
          injectFancyButtonIdBadge();
          updateSelectorConvertButton();
          injectSelectorCopyButtons();
        }, 300);
      });

      // Typing doesn't mutate the DOM, so re-check on edits to a style box.
      let inputTimer = null;
      document.addEventListener('input', (e) => {
        const t = e.target;
        if (!t || t.tagName !== 'TEXTAREA' || !/^fancyButton.*MiscStyles$/.test(t.id || '') && !t.classList.contains('autoUpdate')) return;
        clearTimeout(inputTimer);
        inputTimer = setTimeout(updateSelectorConvertButton, 400);
      }, true);
      
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }
    
    // ==================== AUTO-ESTABLISH REAL ID FOR A NEW BUTTON ====================
    // On a brand-new (never-saved) Graphic Link, the outer "Insert Fancy
    // Button" button only opens the Builder - the resulting button has no
    // real CMS-assigned ID until an actual server save happens, so the ID
    // badge and Copy Selector buttons are useless until then. Previously
    // this meant: insert, save, close, reopen, by hand, before you could
    // style anything with a correct selector. This automates that whole
    // round trip from a single click on the outer Insert Fancy Button: it
    // drives the modal's own Insert click, fills a default link if none is
    // set (a new Graphic Link can't be saved with an empty one), saves and
    // publishes, and reopens the Builder pointed at the same, now-real
    // button - all before any Advanced Styles are written, so nothing ever
    // needs a selector rewritten after the fact.
    const AUTO_ID_PENDING_KEY = 'cp-toolkit-fancy-button-autoid-pending';

    function isAddLinkPage() {
      // "Add Link" = brand new item, never saved. "Modify Link" = editing
      // an existing one - this feature must never touch an existing button.
      // This label renders as a plain <span> inside the link form's
      // .actions block, not a heading tag.
      const label = document.querySelector('#frmQLLinkList .actions span');
      return !!(label && /^\s*Add Link\s*$/i.test((label.textContent || '').trim()));
    }

    function waitFor(checkFn, timeoutMs) {
      return new Promise(function(resolve, reject) {
        const start = Date.now();
        (function poll() {
          let result;
          try { result = checkFn(); } catch (err) { result = null; }
          if (result) return resolve(result);
          if (Date.now() - start > timeoutMs) return reject(new Error('Timed out waiting for condition'));
          setTimeout(poll, 150);
        })();
      });
    }

    // Calls whatever click handler(s) are actually bound on an element
    // directly, as plain function calls, instead of dispatching a click
    // event and hoping it's interpreted the way a real click would be.
    // This is the same technique setupInsertButtonHandler() above already
    // relies on (reading jQuery's internal event registry via $._data),
    // reused here because it doesn't depend on event-trust semantics at
    // all - it just invokes the JS function that's already bound.
    function invokeBoundClickHandlers(el) {
      if (!el) return false;
      if (typeof $ === 'undefined' || typeof $._data !== 'function') return false;

      let events;
      try {
        events = $._data(el, 'events');
      } catch (err) {
        console.warn(TOOLKIT_NAME + ' $._data threw while reading bound click handlers:', err);
        return false;
      }
      const handlers = events && events.click;
      if (!handlers || !handlers.length) return false;

      const evt = $.Event('click');
      evt.target = el;
      evt.currentTarget = el;
      let invoked = false;
      handlers.forEach(function(h) {
        try {
          h.handler.call(el, evt);
          invoked = true;
        } catch (err) {
          console.warn(TOOLKIT_NAME + ' Bound click handler threw during auto-id flow:', err);
        }
      });
      return invoked;
    }

    function triggerClick(el, label) {
      if (!el) {
        console.warn(TOOLKIT_NAME + ' triggerClick called with no element (' + (label || 'unlabeled') + ')');
        return false;
      }
      if (invokeBoundClickHandlers(el)) {
        console.log(TOOLKIT_NAME + ' triggerClick(' + (label || 'unlabeled') + '): invoked via bound jQuery handler(s)');
        return true;
      }
      // Fall back to a dispatched event if nothing is bound via jQuery.
      // Some of these buttons respond to mousedown rather than click, so
      // dispatching all three (matching what a real click actually
      // produces) covers whichever one a given button is bound to,
      // instead of guessing per-element.
      try {
        const opts = { bubbles: true, cancelable: true, view: window };
        const downResult = el.dispatchEvent(new MouseEvent('mousedown', opts));
        const upResult = el.dispatchEvent(new MouseEvent('mouseup', opts));
        const clickResult = el.dispatchEvent(new MouseEvent('click', opts));
        console.log(TOOLKIT_NAME + ' triggerClick(' + (label || 'unlabeled') + '): dispatched mousedown/mouseup/click, results=' + JSON.stringify([downResult, upResult, clickResult]));
        return downResult || upResult || clickResult;
      } catch (err) {
        console.warn(TOOLKIT_NAME + ' dispatchEvent click fallback threw during auto-id flow:', err);
        return false;
      }
    }

    // Sets a text input's value in a way that's recognized by both plain
    // jQuery validation (value + input/change/blur) and any modern
    // framework-bound field that ignores a raw .value assignment (bypasses
    // the native property setter the framework overrides, the standard
    // workaround for that class of field).
    function setFieldValue(el, value) {
      if (!el) return;
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      try {
        nativeSetter.call(el, value);
      } catch (err) {
        el.value = value;
      }
      el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: value }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    function getWebAddressInput() {
      // #txtLinkURL is a visible but non-authoritative field - typing into
      // it leaves it empty and instead populates #linkUrl, which is what's
      // actually validated and saved. #linkUrl is the one that must be set.
      return document.getElementById('linkUrl') || document.getElementById('txtLinkURL');
    }

    function getSaveAndPublishButton() {
      return document.querySelector('input[name="saveAndPublish"]');
    }

    function getLastListedGraphicLinkRow() {
      // New items always land at the bottom of the list on this page.
      const rows = document.querySelectorAll('tr[data-item="dragdrop"].ui-sortable-handle[id]');
      let lastRow = null;
      rows.forEach(function(row) {
        if (/^\d+$/.test(row.id)) lastRow = row;
      });
      return lastRow;
    }

    async function runAutoEstablishRealId() {
      console.log(TOOLKIT_NAME + ' runAutoEstablishRealId: started.');
      try {
        console.log(TOOLKIT_NAME + ' A1: waiting for the Builder modal to open...');
        await waitFor(getVisibleFancyButtonModal, 5000);
        console.log(TOOLKIT_NAME + ' A1 done: modal is open.');

        const insertBtn = document.querySelector('.insertFancy');
        if (!insertBtn) throw new Error('Could not find the Builder\'s own Insert Fancy Button');
        console.log(TOOLKIT_NAME + ' A2: clicking the modal\'s own Insert Fancy Button...');
        triggerClick(insertBtn, 'modal insertFancy');

        console.log(TOOLKIT_NAME + ' A3: waiting for the modal to close...');
        await waitFor(function() { return !getVisibleFancyButtonModal(); }, 8000);
        console.log(TOOLKIT_NAME + ' A3 done: modal closed.');

        const webAddressInput = getWebAddressInput();
        console.log(TOOLKIT_NAME + ' A4: Web Address field found=' + !!webAddressInput + ' current value="' + (webAddressInput ? webAddressInput.value : '') + '"');
        if (webAddressInput && !webAddressInput.value.trim()) {
          setFieldValue(webAddressInput, '/');
          console.log(TOOLKIT_NAME + ' A4 done: filled blank Web Address with "/", now reads "' + webAddressInput.value + '"');
        }

        const savePublishBtn = getSaveAndPublishButton();
        if (!savePublishBtn) throw new Error('Could not find the Save and Publish button');
        console.log(TOOLKIT_NAME + ' A5: found Save and Publish button, about to click it.');

        // A validation alert (e.g. "you haven't entered a valid link") fully
        // blocks JS until a human dismisses it - confirmed live. Catch that
        // specific case instead of silently hanging until someone notices
        // and clicks it away, with no idea why the page froze.
        let blockedByAlert = null;
        const originalAlert = window.alert;
        window.alert = function(message) {
          blockedByAlert = message;
          return originalAlert.call(window, message);
        };

        // The flag is set synchronously, immediately before the click, not
        // after - if Save and Publish causes any kind of page change (a real
        // navigation or an in-place form rebuild), anything placed after the
        // click is not guaranteed to run at all. The alert check below still
        // clears it afterward if the save genuinely failed.
        sessionStorage.setItem(AUTO_ID_PENDING_KEY, '1');
        console.log(TOOLKIT_NAME + ' A6: pending flag set, clicking Save and Publish now.');
        triggerClick(savePublishBtn, 'saveAndPublish');
        console.log(TOOLKIT_NAME + ' A6 done: click dispatched (script is still running, so no full navigation happened synchronously).');

        // Give the save a moment in case nothing navigates on its own - if
        // it already did, this reload is a harmless no-op on whatever page
        // we're now on.
        await new Promise(function(resolve) { setTimeout(resolve, 1200); });
        window.alert = originalAlert;
        console.log(TOOLKIT_NAME + ' A7: post-save wait finished. blockedByAlert=' + JSON.stringify(blockedByAlert) + ', current heading=' + JSON.stringify(document.querySelector('#frmQLLinkList .actions span') ? document.querySelector('#frmQLLinkList .actions span').textContent.trim() : null) + ', pendingFlagNow=' + sessionStorage.getItem(AUTO_ID_PENDING_KEY));

        if (blockedByAlert) {
          sessionStorage.removeItem(AUTO_ID_PENDING_KEY);
          throw new Error('Save and Publish was blocked by a CMS validation alert: "' + blockedByAlert + '"');
        }
        console.log(TOOLKIT_NAME + ' A8: calling location.reload() now.');
        location.reload();
      } catch (err) {
        sessionStorage.removeItem(AUTO_ID_PENDING_KEY);
        console.warn(TOOLKIT_NAME + ' Auto-establish-ID flow stopped partway through, leaving the rest to be done by hand:', err);
      }
    }

    async function resumeAutoEstablishRealIdAfterReload() {
      if (sessionStorage.getItem(AUTO_ID_PENDING_KEY) !== '1') {
        console.log(TOOLKIT_NAME + ' resumeAutoEstablishRealIdAfterReload: no pending flag, nothing to do.');
        return;
      }
      sessionStorage.removeItem(AUTO_ID_PENDING_KEY);
      console.log(TOOLKIT_NAME + ' resumeAutoEstablishRealIdAfterReload: pending flag found, resuming.');

      try {
        console.log(TOOLKIT_NAME + ' Step 1: waiting for the last listed row...');
        const row = await waitFor(getLastListedGraphicLinkRow, 8000);
        const realId = row.id;
        console.log(TOOLKIT_NAME + ' Step 1 done: found row id ' + realId);

        const fancyButtonLink = row.querySelector('a.fancyButton');
        if (!fancyButtonLink) throw new Error('Could not find the .fancyButton link inside the last row (id ' + realId + ')');
        console.log(TOOLKIT_NAME + ' Step 2: clicking the fancy button link in that row...');
        triggerClick(fancyButtonLink, 'fancyButtonLink');

        // This page has three "Modify" buttons - two hidden ones classed
        // "modifyImage" for the plain Image / Mouse Over Image sections
        // (not applicable to a Fancy Button), and the one that matters
        // here, classed plain "modify", inside a container specifically
        // named .addRemoveForFancyButton.
        console.log(TOOLKIT_NAME + ' Step 3: waiting for the Modify button to appear...');
        const modifyBtn = await waitFor(function() {
          return document.querySelector('.addRemoveForFancyButton button.modify, .addRemoveForFancyButton .modify');
        }, 5000);
        console.log(TOOLKIT_NAME + ' Step 3 done: found Modify button, clicking it...', modifyBtn);
        triggerClick(modifyBtn, 'modifyBtn');

        console.log(TOOLKIT_NAME + ' Step 4: waiting for the Fancy Button Builder modal to appear...');
        await waitFor(getVisibleFancyButtonModal, 5000);
        console.log(TOOLKIT_NAME + ' Reopened the Builder for button #' + realId + ' with its real ID established.');
      } catch (err) {
        console.warn(TOOLKIT_NAME + ' Could not automatically reopen the Builder after saving - open it manually via Modify:', err);
      }
    }

    let autoEstablishRealIdRunning = false;

    function setupAutoEstablishRealId() {
      resumeAutoEstablishRealIdAfterReload();

      // Delegated, permanent listener instead of binding to one specific
      // button element. This page has other scripts (e.g.
      // graphic-link-autofill.js) that watch and rebuild parts of this form
      // on their own, so a directly-bound listener can end up attached to a
      // node that gets destroyed and replaced before the real click - a
      // dataset flag confirming "bound" on the old node proves nothing
      // about whichever node is actually there at click time. Delegation on
      // document.body, bound once and never re-bound, is unaffected by any
      // number of element replacements. Listening on mousedown rather than
      // click since this button's own handler responds to mousedown.
      document.body.addEventListener('mousedown', function(e) {
        const target = e.target.closest ? e.target.closest('#insertFancyButton') : null;
        if (!target) return;
        if (!isAddLinkPage()) return;
        if (autoEstablishRealIdRunning) return;
        autoEstablishRealIdRunning = true;
        console.log(TOOLKIT_NAME + ' Delegated mousedown on #insertFancyButton detected on Add Link page - starting auto-establish-ID flow.');
        runAutoEstablishRealId().finally(function() {
          autoEstablishRealIdRunning = false;
        });
      }, true);
    }

    // ==================== INITIALIZATION ====================
    // console.log(TOOLKIT_NAME + ' Starting initialization...');
    // console.log(TOOLKIT_NAME + ' - document.readyState:', document.readyState);
    // console.log(TOOLKIT_NAME + ' - document.body exists:', !!document.body);
    
    if (document.readyState === 'loading') {
      // console.log(TOOLKIT_NAME + ' Waiting for DOMContentLoaded...');
      document.addEventListener('DOMContentLoaded', () => {
        // console.log(TOOLKIT_NAME + ' DOMContentLoaded fired, initializing...');
        processTextareas();
        fixRenderedFancyButtonStyles();
        injectFancyButtonIdBadge();
        updateSelectorConvertButton();
        injectSelectorCopyButtons();
        setupInsertButtonHandler();
        setupAutoEstablishRealId();
startObserving();
      });
    } else {
      // console.log(TOOLKIT_NAME + ' Document already loaded, initializing immediately...');
      processTextareas();
      fixRenderedFancyButtonStyles();
      injectFancyButtonIdBadge();
      updateSelectorConvertButton();
      injectSelectorCopyButtons();
      setupInsertButtonHandler();
      setupAutoEstablishRealId();
      startObserving();
    }

    // Expose API
    window.CPToolkit = window.CPToolkit || {};
    window.CPToolkit.graphicLinkHelper = {
      getFancyButtonId: getFancyButtonId,
      getCurrentFancyButtonSelector: getCurrentFancyButtonSelector,
      normalizeToFancyButton1: normalizeToFancyButton1,
      denormalizeFromFancyButton1: denormalizeFromFancyButton1,
      fixRenderedFancyButtonStyles: fixRenderedFancyButtonStyles,
      processTextareas: processTextareas,
      injectFancyButtonIdBadge: injectFancyButtonIdBadge,
      injectSelectorCopyButtons: injectSelectorCopyButtons,
      runAutoEstablishRealId: runAutoEstablishRealId
    };
    
    // console.log(TOOLKIT_NAME + ' ✓ Ready');
  }
})();
