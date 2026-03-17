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
    function normalizeToFancyButton1(text) {
      return text.replace(/\.fancyButton\d+\b/g, '.fancyButton1');
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

    // ==================== PROCESS TEXTAREAS ====================
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
        
        // Normalize to fancyButton1 for editing
        const normalizedText = normalizeToFancyButton1(currentValue);
        
        if (currentValue !== normalizedText) {
          textarea.value = normalizedText;
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          // console.log(TOOLKIT_NAME + ' ✓ Normalized to .fancyButton1 in #' + (textarea.id || 'textarea'));
        }
        
        textarea.dataset.cpFancyProcessed = 'true';
      });
    }
    
    // ==================== INSERT BUTTON HANDLER ====================
    function addInsertButtonFallback(insertBtn) {
      // Fallback for when jQuery isn't available or handlers aren't attached yet
      insertBtn.addEventListener('click', function(e) {
        const currentSelector = getCurrentFancyButtonSelector();
        // console.log(TOOLKIT_NAME + ' Insert clicked (fallback) - converting to .' + currentSelector);
        
        // Update all textareas
        document.querySelectorAll('textarea.autoUpdate, textarea[id^="fancyButton"][id$="MiscStyles"]').forEach(textarea => {
          if (textarea.value) {
            const newText = textarea.value.replace(/\.fancyButton\d+\b/g, '.' + currentSelector);
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
                    text = text.replace(/\.fancyButton\d+\b/g, '.' + currentSelector);
                    $(this).val(text);
                    $(this).change();
                  });
                  
                  document.querySelectorAll('textarea[id^="fancyButton"][id$="MiscStyles"]').forEach(textarea => {
                    if (textarea.value) {
                      const newText = textarea.value.replace(/\.fancyButton\d+\b/g, '.' + currentSelector);
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
        }, 300);
      });
      
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
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
        setupInsertButtonHandler();
        startObserving();
      });
    } else {
      // console.log(TOOLKIT_NAME + ' Document already loaded, initializing immediately...');
      processTextareas();
      fixRenderedFancyButtonStyles();
      setupInsertButtonHandler();
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
      processTextareas: processTextareas
    };
    
    // console.log(TOOLKIT_NAME + ' ✓ Ready');
  }
})();
