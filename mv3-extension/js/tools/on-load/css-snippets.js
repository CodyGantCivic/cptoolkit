(function loadTool() {
    // Don't run inside iframes (e.g. Forethought chat widget)
    if (window !== window.top) return;

    var thisTool = "css-snippets";

    // CSS Snippets functionality
    // Left-click: Simple dropdown with dynamic snippets
    // Right-click: Full sidebar with all snippets from snippets.json

    chrome.storage.local.get(thisTool, function(settings) {
        if (chrome.runtime.lastError) {
            console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
            return;
        }

        detect_if_cp_site(function() {
            // This tool runs by default unless explicitly disabled
            if (settings[thisTool] !== false) {
                try {
                    initCSSSnippets();
                } catch (err) {
                    console.warn("[CP Toolkit](" + thisTool + ") Error:", err);
                }
            }
        }, thisTool);
    });

    function initCSSSnippets() {
        'use strict';

        const TOOLKIT_NAME = '[CP CSS Snippets]';
        const USER_SNIPPETS_KEY = 'cp-toolkit-user-snippets';
        const COPIED_SKINS_KEY = 'cp-toolkit-copied-skins';
        const SNIPPET_ORDER_KEY = 'cp-toolkit-snippet-order';
        var ALLOWED_STORAGE_KEYS = Object.create(null);
        ALLOWED_STORAGE_KEYS['cp-toolkit-multi-skins'] = true;
        var hasOwn = Object.prototype.hasOwnProperty;
        let snippetsData = null;
        let userSnippetsData = null;
        let copiedSkinsData = null;
        let sidebarElement = null;

        // ==================== USER SNIPPETS STORAGE ====================

        // Load user snippets from chrome.storage.local
        function loadUserSnippets() {
            return new Promise((resolve) => {
                if (!chrome.runtime?.id) { resolve({}); return; }
                chrome.storage.local.get(USER_SNIPPETS_KEY, (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn(TOOLKIT_NAME + ' Error loading user snippets:', chrome.runtime.lastError);
                        resolve({});
                        return;
                    }
                    userSnippetsData = result[USER_SNIPPETS_KEY] || {};
                    resolve(userSnippetsData);
                });
            });
        }

        // Save user snippets to chrome.storage.local
        function saveUserSnippets(snippets) {
            return new Promise((resolve, reject) => {
                if (!chrome.runtime?.id) { resolve(); return; }
                const data = {};
                data[USER_SNIPPETS_KEY] = snippets;
                chrome.storage.local.set(data, () => {
                    if (chrome.runtime.lastError) {
                        console.error(TOOLKIT_NAME + ' Error saving user snippets:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    userSnippetsData = snippets;
                    resolve();
                });
            });
        }

        // Add or update a user snippet
        async function saveUserSnippet(key, snippet) {
            const userSnippets = await loadUserSnippets();
            userSnippets[key] = { ...snippet, isUserSnippet: true };
            await saveUserSnippets(userSnippets);
            // Clear cache to force reload
            snippetsData = null;
        }

        // Delete a user snippet
        async function deleteUserSnippet(key) {
            const userSnippets = await loadUserSnippets();
            delete userSnippets[key];
            await saveUserSnippets(userSnippets);
            // Clear cache to force reload
            snippetsData = null;
        }

        // Generate unique key for new snippet
        function generateSnippetKey(name) {
            const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const timestamp = Date.now().toString(36);
            return `user-${base}-${timestamp}`;
        }

        // ==================== SNIPPET ORDER STORAGE ====================

        function loadSnippetOrder() {
            return new Promise((resolve) => {
                if (!chrome.runtime?.id) { resolve([]); return; }
                chrome.storage.local.get(SNIPPET_ORDER_KEY, (result) => {
                    if (chrome.runtime.lastError) {
                        resolve([]);
                        return;
                    }
                    resolve(result[SNIPPET_ORDER_KEY] || []);
                });
            });
        }

        function saveSnippetOrder(order) {
            return new Promise((resolve) => {
                if (!chrome.runtime?.id) { resolve(); return; }
                const data = {};
                data[SNIPPET_ORDER_KEY] = order;
                chrome.storage.local.set(data, () => {
                    if (chrome.runtime.lastError) {
                        console.warn(TOOLKIT_NAME + ' Error saving snippet order:', chrome.runtime.lastError);
                    }
                    resolve();
                });
            });
        }

        // ==================== COPIED SKINS STORAGE ====================

        function loadCopiedSkins() {
            return new Promise((resolve) => {
                if (!chrome.runtime?.id) { resolve({}); return; }
                chrome.storage.local.get(COPIED_SKINS_KEY, (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn(TOOLKIT_NAME + ' Error loading copied skins:', chrome.runtime.lastError);
                        resolve({});
                        return;
                    }
                    copiedSkinsData = result[COPIED_SKINS_KEY] || {};
                    resolve(copiedSkinsData);
                });
            });
        }

        function saveCopiedSkins(skins) {
            return new Promise((resolve, reject) => {
                if (!chrome.runtime?.id) { resolve(); return; }
                const data = {};
                data[COPIED_SKINS_KEY] = skins;
                chrome.storage.local.set(data, () => {
                    if (chrome.runtime.lastError) {
                        console.error(TOOLKIT_NAME + ' Error saving copied skins:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    copiedSkinsData = skins;
                    resolve();
                });
            });
        }

        async function saveCopiedSkin(key, skinData) {
            const skins = await loadCopiedSkins();
            skins[key] = skinData;
            await saveCopiedSkins(skins);
        }

        async function deleteCopiedSkin(key) {
            const skins = await loadCopiedSkins();
            delete skins[key];
            await saveCopiedSkins(skins);
        }

        function generateCopiedSkinKey(name) {
            const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const timestamp = Date.now().toString(36);
            return `skin-${base}-${timestamp}`;
        }

        // ==================== MAIN WORLD BRIDGE ====================
        // The helper script runs in the page's MAIN world to access DesignCenter.
        // We communicate via CustomEvents since content scripts are isolated.

        let copiedSkinsHelperReady = false;

        function injectCopiedSkinsHelper() {
            if (document.getElementById('cp-toolkit-copied-skins-helper')) return;

            var script = document.createElement('script');
            script.id = 'cp-toolkit-copied-skins-helper';
            script.src = chrome.runtime.getURL('js/tools/on-load/helpers/copied-skins-helper.js');
            (document.head || document.documentElement).appendChild(script);
        }

        // Send a request to the MAIN world helper and wait for response
        function sendHelperRequest(action, data) {
            return new Promise(function(resolve) {
                var requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

                function onResponse(e) {
                    var resp = e.detail;
                    if (resp && resp.requestId === requestId) {
                        document.removeEventListener('cp-toolkit-copied-skins-response', onResponse);
                        resolve(resp);
                    }
                }

                document.addEventListener('cp-toolkit-copied-skins-response', onResponse);

                var detail = Object.assign({ action: action, requestId: requestId }, data || {});
                document.dispatchEvent(new CustomEvent('cp-toolkit-copied-skins-request', {
                    detail: detail
                }));

                // Timeout after 3 seconds
                setTimeout(function() {
                    document.removeEventListener('cp-toolkit-copied-skins-response', onResponse);
                    resolve({ error: 'timeout' });
                }, 3000);
            });
        }

        // Inject helper on Theme Manager pages
        if (window.location.pathname.toLowerCase().indexOf('/designcenter/themes/') !== -1) {
            // Wait for DOM to be ready before injecting
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() { injectCopiedSkinsHelper(); });
            } else {
                injectCopiedSkinsHelper();
            }
            // Listen for helper ready signal
            document.addEventListener('cp-toolkit-copied-skins-response', function onReady(e) {
                if (e.detail && e.detail.action === 'ready') {
                    copiedSkinsHelperReady = true;
                    document.removeEventListener('cp-toolkit-copied-skins-response', onReady);
                }
            });
        }

        // ==================== STORAGE BRIDGE (whitelisted) ====================
        // Allows on-demand tools (MAIN world) to get/set chrome.storage.local
        // via CustomEvents. Tools in MAIN world can't access chrome APIs directly.
        // Only whitelisted toolkit keys are accepted — page JS on any
        // CP-detected top-frame page (which can include client-controlled HTML
        // widgets) could otherwise read/write arbitrary toolkit storage.
        // To allow a new tool key, add it to ALLOWED_STORAGE_KEYS above.

        document.addEventListener('cp-toolkit-storage-get', function(e) {
            var detail = e.detail || {};
            if (!chrome.runtime?.id) return;
            if (typeof detail.key !== 'string' || !hasOwn.call(ALLOWED_STORAGE_KEYS, detail.key)) {
                console.warn('[CP Toolkit](css-snippets) storage-get rejected for non-whitelisted key:', detail.key);
                return;
            }
            chrome.storage.local.get(detail.key, function(result) {
                document.dispatchEvent(new CustomEvent('cp-toolkit-storage-response', {
                    detail: { requestId: detail.requestId, data: result[detail.key] }
                }));
            });
        });

        document.addEventListener('cp-toolkit-storage-set', function(e) {
            var detail = e.detail || {};
            if (!chrome.runtime?.id) return;
            if (typeof detail.key !== 'string' || !hasOwn.call(ALLOWED_STORAGE_KEYS, detail.key)) {
                console.warn('[CP Toolkit](css-snippets) storage-set rejected for non-whitelisted key:', detail.key);
                return;
            }
            var obj = {};
            obj[detail.key] = detail.value;
            chrome.storage.local.set(obj, function() {
                document.dispatchEvent(new CustomEvent('cp-toolkit-storage-response', {
                    detail: { requestId: detail.requestId, success: true }
                }));
            });
        });

        // ==================== SIMPLE DROPDOWN SNIPPETS ====================
        // These snippets use dynamic selector replacement

        // Find the selector element near the textarea
        // Could be #ExternalIDStyle, p.cpExpandCollapseControl, or a plain <p> with selector
        function findSelectorElement(container) {
            // First try specific IDs/classes
            const externalIdStyle = container.querySelector('#ExternalIDStyle, p[id="ExternalIDStyle"]');
            if (externalIdStyle) return externalIdStyle;

            const expandControl = container.querySelector('p.cpExpandCollapseControl');
            if (expandControl) return expandControl;

            // Look for first <p> that contains a CSS selector pattern (starts with . or #)
            const paragraphs = container.querySelectorAll('p');
            for (const p of paragraphs) {
                const text = p.textContent.trim();
                // Match patterns like ".mainNav {" or "#container {" or ".fancyButton .text"
                if (/^[.#][\w-]+/.test(text)) {
                    return p;
                }
            }

            return null;
        }

        // Determine the editing context and return appropriate selector info
        // Contexts: 'skin' (widget skins), 'fancyButton', 'nav', 'container'
        function getContextInfo(textarea) {
            const result = {
                type: 'skin',
                fullSelector: '',
                useMobileCenter: true
            };

            const container = textarea.closest('li.noLabel') || textarea.closest('div');
            if (!container) {
                result.fullSelector = `.widget.skin${getSkinId(textarea)} .widgetHeader`;
                return result;
            }

            // Find the selector element
            const selectorElement = findSelectorElement(container);

            if (!selectorElement) {
                result.fullSelector = `.widget.skin${getSkinId(textarea)} .widgetHeader`;
                return result;
            }

            // Clean up the selector text - remove trailing { and whitespace
            let selectorText = selectorElement.textContent.trim();
            selectorText = selectorText.replace(/\s*\{?\s*$/, '').trim();

            // Check for fancy button context
            if (selectorText.includes('.fancyButton')) {
                result.type = 'fancyButton';
                const buttonId = getFancyButtonId(textarea);

                if (selectorText.includes(':link') || selectorText.includes(':visited')) {
                    // .fancyButton:link, .fancyButton:visited → .fancyButton1
                    result.fullSelector = `.fancyButton${buttonId}`;
                } else {
                    // Check if we're in a custom text style (Text Style 1, 2, 3, etc.)
                    const textStyleIndex = getTextStyleIndex();

                    if (textStyleIndex) {
                        // Custom text style: .fancyButton .text → .fancyButton1 .textStyle1
                        result.fullSelector = `.fancyButton${buttonId} .textStyle${textStyleIndex}`;
                    } else {
                        // Default: .fancyButton .text → .fancyButton1 .text
                        const childMatch = selectorText.match(/\.fancyButton\s+(.+)/);
                        const child = childMatch ? ` ${childMatch[1]}` : '';
                        result.fullSelector = `.fancyButton${buttonId}${child}`;
                    }
                }
                return result;
            }

            // Check for nav context
            if (selectorText.includes('.mainNavItem') || selectorText.includes('.mainNav')) {
                result.type = 'nav';

                if (selectorText.includes('.mainNavItem')) {
                    // .mainNavItem:link, .mainNavItem:visited → .wide .mainNavItem
                    result.fullSelector = '.wide .mainNavItem';
                } else {
                    // .mainNav → .mainNav
                    result.fullSelector = '.mainNav';
                }
                return result;
            }

            // Check for feature column context
            if (selectorText.toLowerCase().includes('#featurecolumn')) {
                result.type = 'featureColumn';
                result.fullSelector = '#featureColumn';
                return result;
            }

            // Check for container context (starts with #)
            if (selectorText.startsWith('#')) {
                result.type = 'container';
                // Extract just the ID selector (before any space)
                const idMatch = selectorText.match(/(#[\w-]+)/);
                result.fullSelector = idMatch ? idMatch[1] : selectorText;
                return result;
            }

            // Default to widget skin context
            result.type = 'skin';
            const skinId = getSkinId(textarea);

            if (selectorText === '.widget') {
                // Wrapper section - no child selector needed
                result.fullSelector = `.widget.skin${skinId}`;
            } else {
                result.fullSelector = `.widget.skin${skinId} ${selectorText}`;
            }

            return result;
        }

        // Get fancy button ID from textarea context
        function getFancyButtonId(textarea) {
            const id = textarea.id;
            if (id) {
                // Try patterns like FancyButton_1_xxx (the underscore before the number is key)
                const match = id.match(/FancyButton_(\d+)_/i);
                if (match) return match[1];
            }

            // Try to find from URL parameter (e.g., ?id=1 or ?buttonId=1)
            const urlParams = new URLSearchParams(window.location.search);
            const buttonIdParam = urlParams.get('id') || urlParams.get('buttonId');
            if (buttonIdParam && /^\d+$/.test(buttonIdParam)) {
                return buttonIdParam;
            }

            // Look for a hidden input or data attribute with the button ID
            const hiddenInput = document.querySelector('input[name*="ButtonId"], input[name*="buttonId"]');
            if (hiddenInput && hiddenInput.value && /^\d+$/.test(hiddenInput.value)) {
                return hiddenInput.value;
            }

            return '1'; // Default to 1
        }

        // Get text style index from the fancy button tab selector
        // Returns the style index (1, 2, 3, etc.) if in a custom text style, or null if default
        function getTextStyleIndex() {
            const tabSelect = document.querySelector('#selectedTab');
            if (!tabSelect) return null;

            const selectedOption = tabSelect.options[tabSelect.selectedIndex];
            if (!selectedOption) return null;

            // Check for data-style-index attribute (Text Style 1, 2, 3, etc.)
            const styleIndex = selectedOption.getAttribute('data-style-index');
            return styleIndex || null;
        }

        // Get the skin ID from the textarea
        function getSkinId(textarea) {
            if (!textarea) return '000';

            const skinId = textarea.getAttribute('data-cp-skin-handler-attached') ||
                           textarea.getAttribute('data-cp-skin-processed');
            if (skinId) return skinId;

            const id = textarea.id;
            if (id && id.includes('skin')) {
                const match = id.match(/skin(\d+)/i);
                if (match) return match[1];
            }

            return '000';
        }

        // Process a quick snippet template with actual values
        function processQuickSnippet(template, textarea) {
            const context = getContextInfo(textarea);

            // Build mobile selector prefix if applicable
            // Just outputs the selector - user adds their own pseudo-elements and properties
            let mobileRule = '';
            if (context.fullSelector) {
                mobileRule = `.row.outer:not(.wide) ${context.fullSelector}`;
            }

            // Build hover selector based on context type
            // Adds :is(:hover, :focus, :active) in the appropriate position
            let hoverSelector = '';
            if (context.fullSelector) {
                if (context.type === 'fancyButton') {
                    // e.g., .fancyButton1 .text → .fancyButton1:is(:hover, :focus, :active) .text
                    const match = context.fullSelector.match(/^(\.fancyButton\d+)(.*)$/);
                    if (match) {
                        const buttonPart = match[1]; // .fancyButton1
                        const childPart = match[2] || ''; // .text or .textStyle1 etc.
                        hoverSelector = `${buttonPart}:is(:hover, :focus, :active)${childPart}`;
                    } else {
                        hoverSelector = `${context.fullSelector}:is(:hover, :focus, :active)`;
                    }
                } else if (context.type === 'skin') {
                    // e.g., .widget.skin123 .widgetHeader → .widget.skin123 .widgetHeader:is(:hover, :focus, :active)
                    // e.g., .widget.skin123 → .widget.skin123:is(:hover, :focus, :active)
                    hoverSelector = `${context.fullSelector}:is(:hover, :focus, :active)`;
                } else if (context.type === 'container') {
                    // e.g., #siteFooter → #siteFooter:is(:hover, :focus, :active)
                    hoverSelector = `${context.fullSelector}:is(:hover, :focus, :active)`;
                } else if (context.type === 'nav') {
                    // e.g., .wide .mainNavItem → .wide .mainNavItem:is(:hover, :focus-within, :focus)
                    // Use focus-within for nav items since they contain child elements
                    hoverSelector = `${context.fullSelector}:is(:hover, :focus-within, :focus)`;
                } else {
                    // Fallback for any other context
                    hoverSelector = `${context.fullSelector}:is(:hover, :focus, :active)`;
                }
            }

            return template
                .replace(/\{\{FULL_SELECTOR\}\}/g, context.fullSelector)
                .replace(/\{\{MOBILE_RULE\}\}/g, mobileRule)
                .replace(/\{\{HOVER_SELECTOR\}\}/g, hoverSelector);
        }

        // ==================== CONTEXT-AWARE SNIPPETS ====================
        // Detect context and return relevant snippet keys from the library
        // User snippets are also included if their category matches the active context

        // Map of specific snippet keys to context types (for built-in snippets)
        // This ensures only the intended built-in snippets appear in each context
        const KEY_TO_CONTEXT_MAP = {
            'nav-basics': ['nav'],
            'feature-column': ['featureColumn'],
            'mega-menu-bullets': ['megaMenu'],
            'mega-menu-border-radius': ['megaMenu'],
            'mega-menu-border': ['megaMenu'],
            'carousel-basics': ['news'],
            'carousel-height-matched': ['news'],
            'slideshow-basics': ['slideshow'],
            'footer-lines': ['footer'],
            'popular-links': ['links'],
            'flex-calendar': ['calendar'],
            'socials': ['socials']
        };

        // Map of category names (lowercase) to context types
        // This allows user snippets with matching categories to appear in context
        // Note: 'layout' is intentionally NOT mapped as it's too generic
        const CATEGORY_TO_CONTEXT_MAP = {
            // Button categories
            'buttons': ['fancyButton'],
            'button': ['fancyButton'],
            'fancy button': ['fancyButton'],
            'fancy buttons': ['fancyButton'],
            // Menu categories
            'menus': ['nav', 'megaMenu'],
            'menu': ['nav', 'megaMenu'],
            'navigation': ['nav', 'megaMenu'],
            'nav': ['nav'],
            'nav items': ['nav'],
            'mega menu': ['megaMenu'],
            'megamenu': ['megaMenu'],
            // News/Carousel/Slideshow categories
            'news': ['news'],
            'carousels': ['news', 'slideshow'],
            'carousel': ['news'],
            'slideshow': ['slideshow'],
            'slideshows': ['slideshow'],
            // Footer categories
            'footer': ['footer'],
            'footers': ['footer'],
            // Links categories
            'links': ['links'],
            'link': ['links'],
            'popular links': ['links'],
            'popularlinks': ['links'],
            'popular resources': ['links'],
            // Calendar categories
            'calendar': ['calendar'],
            'calendars': ['calendar'],
            // Social categories
            'social': ['socials'],
            'socials': ['socials'],
            'social media': ['socials'],
            // Headers category
            'headers': ['headers'],
            'header': ['headers'],
            // Feature column
            'feature column': ['featureColumn'],
            'featurecolumn': ['featureColumn']
            // Note: 'layout' and 'custom' are NOT mapped - they won't show in context lists
        };

        // Predefined categories for the snippet modal dropdown
        // These are the categories users can select when creating snippets
        const SNIPPET_CATEGORIES = [
            { value: 'Buttons', label: 'Buttons', description: 'Shows in Fancy Button Builder' },
            { value: 'News', label: 'News', description: 'Skins with "news" or "carousel" in name' },
            { value: 'Slideshow', label: 'Slideshow', description: 'Skins with "slideshow" in name' },
            { value: 'Mega Menu', label: 'Mega Menu', description: 'Skins with "mega menu" in name' },
            { value: 'Nav Items', label: 'Nav Items', description: 'Navigation menu style editor' },
            { value: 'Footer', label: 'Footer', description: 'Skins with "footer" in name' },
            { value: 'Links', label: 'Links', description: 'Skins with "link", "links", or "popular resources" in name' },
            { value: 'Calendar', label: 'Calendar', description: 'Skins with "calendar" in name or calendar component' },
            { value: 'Socials', label: 'Socials', description: 'Skins with "social media" or "socials" in name' },
            { value: 'Headers', label: 'Headers', description: 'Skins with "header" or "headers" in name' },
            { value: 'Custom', label: 'Custom', description: 'Custom category (won\'t appear in context lists)' }
        ];

        // Category icon mapping for sidebar badges
        function getCategoryIcon(category) {
            const cat = (category || '').toLowerCase();
            const icons = {
                'buttons':   '<path d="M21 3H3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"></path><line x1="9" y1="7" x2="15" y2="7"></line>',
                'news':      '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path><line x1="10" y1="6" x2="18" y2="6"></line><line x1="10" y1="10" x2="18" y2="10"></line><line x1="10" y1="14" x2="14" y2="14"></line>',
                'slideshow': '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line>',
                'mega menu': '<line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>',
                'nav items': '<circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>',
                'footer':    '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="15" x2="21" y2="15"></line>',
                'links':     '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>',
                'calendar':  '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
                'socials':   '<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>',
                'headers':   '<polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line>',
                'custom':    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>'
            };
            const svg = icons[cat] || '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>';
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + svg + '</svg>';
        }

        // Widget skin component types (from CMS #widgetSkinComponentTypeID)
        // These are the different sections where CSS can be added in a widget skin
        const SKIN_COMPONENT_TYPES = [
            { id: 0, name: 'Wrapper', description: 'Outer container styles' },
            { id: 1, name: 'Header', description: 'Widget header styles' },
            { id: 2, name: 'Item List', description: 'Container for all items' },
            { id: 3, name: 'Item', description: 'Individual item styles' },
            { id: 4, name: 'Item Title', description: 'Title text within items' },
            { id: 5, name: 'Item Secondary Text', description: 'Secondary/description text' },
            { id: 6, name: 'Item Bullets', description: 'Bullet point styles' },
            { id: 7, name: 'Item Link', description: 'Links within items' },
            { id: 8, name: '"Read on" Link', description: 'Read more link styles' },
            { id: 9, name: '"View all" Link', description: 'View all link styles' },
            { id: 10, name: '"RSS" Link', description: 'RSS feed link styles' },
            { id: 11, name: 'Footer', description: 'Widget footer styles' }
        ];

        // Detect active context types based on current modal/section
        function getActiveContextTypes(textarea) {
            const contexts = [];

            // Check for fancy button context — textarea ID contains FancyButton or selector contains .fancyButton
            if (textarea && textarea.id && /fancybutton/i.test(textarea.id)) {
                contexts.push('fancyButton');
            } else {
                const selectorEl = findSelectorElement(textarea.closest('li.noLabel') || textarea.closest('div'));
                if (selectorEl && selectorEl.textContent.toLowerCase().includes('.fancybutton')) {
                    contexts.push('fancyButton');
                }
            }

            // Check for nav modal - must have #MenuStyleName select
            const menuStyleSelect = document.querySelector('.cpPopOver #MenuStyleName');
            if (menuStyleSelect) {
                contexts.push('nav');
            }

            // Check for feature column
            const selectorElement = findSelectorElement(textarea.closest('li.noLabel') || textarea.closest('div'));
            if (selectorElement) {
                const selectorText = selectorElement.textContent.trim().toLowerCase();
                if (selectorText.includes('#featurecolumn')) {
                    contexts.push('featureColumn');
                }
            }

            // Check for skin modal - must have #widgetSkinComponentTypeID select
            const skinComponentSelect = document.querySelector('.cpPopOver #widgetSkinComponentTypeID');
            if (skinComponentSelect) {
                // Find the skin name using hdnUniqueID to locate the correct section
                const uniqueIdInput = document.querySelector('.cpPopOver #hdnUniqueID');
                let skinHeaderEl = null;

                if (uniqueIdInput && uniqueIdInput.value) {
                    const section = document.querySelector(`section.superWidget[data-uniqueid="${uniqueIdInput.value}"]`);
                    if (section) {
                        skinHeaderEl = section.querySelector('header.widgetHeader h3 a');
                    }
                }

                // Fallback to previous methods if uniqueID approach fails
                if (!skinHeaderEl) {
                    skinHeaderEl = document.querySelector('header.widgetHeader.superWidgetItems.focused h3 a') ||
                                   document.querySelector('h3.cpComponent.open a');
                }

                if (skinHeaderEl) {
                    const skinName = skinHeaderEl.textContent.toLowerCase();

                    if (skinName.includes('mega menu') || skinName.includes('megamenu')) {
                        contexts.push('megaMenu');
                    }
                    if (skinName.includes('news') || skinName.includes('carousel')) {
                        contexts.push('news');
                    }
                    if (skinName.includes('slideshow')) {
                        contexts.push('slideshow');
                    }
                    if (skinName.includes('footer')) {
                        contexts.push('footer');
                    }
                    if (skinName.includes('link') || skinName.includes('popular resources')) {
                        contexts.push('links');
                    }
                    if (skinName.includes('social media') || skinName.includes('socials')) {
                        contexts.push('socials');
                    }
                    if (skinName.includes('calendar')) {
                        contexts.push('calendar');
                    }
                    if (skinName.includes('header')) {
                        contexts.push('headers');
                    }
                }

                // Check for calendar component modal (regardless of skin name)
                const selectedIdx = skinComponentSelect.selectedIndex;
                const selectedOption = selectedIdx >= 0 ? skinComponentSelect.options[selectedIdx] : null;
                if (selectedOption && selectedOption.textContent.toLowerCase().includes('calendar')) {
                    contexts.push('calendar');
                }
            }

            return [...new Set(contexts)]; // Remove duplicates
        }

        // Check if a snippet's category matches any of the active contexts (for user snippets)
        function categoryMatchesContext(category, activeContexts) {
            if (!category || activeContexts.length === 0) {
                return false;
            }

            const categoryLower = category.toLowerCase();
            const mappedContexts = CATEGORY_TO_CONTEXT_MAP[categoryLower];

            if (mappedContexts) {
                // Category has explicit mapping - check if any mapped context is active
                return mappedContexts.some(ctx => activeContexts.includes(ctx));
            }

            // Fallback: check if category name contains any active context name
            // This handles cases like "Footer Styles" matching "footer" context
            return activeContexts.some(ctx => {
                const ctxLower = ctx.toLowerCase();
                return categoryLower.includes(ctxLower) || ctxLower.includes(categoryLower);
            });
        }

        // Check if a built-in snippet's key matches any of the active contexts
        function keyMatchesContext(key, activeContexts) {
            const mappedContexts = KEY_TO_CONTEXT_MAP[key];
            if (!mappedContexts) {
                return false;
            }
            return mappedContexts.some(ctx => activeContexts.includes(ctx));
        }

        // Get all snippets that match the current context (by key mapping or category)
        async function getContextSnippets(textarea) {
            const activeContexts = getActiveContextTypes(textarea);
            const matchingSnippets = [];

            if (activeContexts.length === 0) {
                return matchingSnippets;
            }

            try {
                const allSnippets = await loadSnippets();

                for (const [key, snippet] of Object.entries(allSnippets)) {
                    let matches = false;

                    if (snippet.isUserSnippet) {
                        // User snippets: match by category or name
                        matches = categoryMatchesContext(snippet.category, activeContexts) ||
                                  categoryMatchesContext(snippet.name, activeContexts);
                    } else {
                        // Built-in snippets: match by key (using KEY_TO_CONTEXT_MAP)
                        matches = keyMatchesContext(key, activeContexts);
                    }

                    if (matches) {
                        matchingSnippets.push({ key, ...snippet });
                    }
                }
            } catch (err) {
                console.warn(TOOLKIT_NAME + ' Could not load snippets for context matching:', err);
            }

            return matchingSnippets;
        }

        // Build the simple dropdown HTML (now async to load context snippets)
        async function buildDropdownHTML(textarea) {
            let html = '<ul class="css-snippet-dropdown-list">';

            // Add user snippets with dynamicSelector AND alwaysInQuickList to the quick list
            const userSnippets = await loadUserSnippets();
            const alwaysShowSnippets = Object.entries(userSnippets).filter(([key, snippet]) =>
                snippet.dynamicSelector && snippet.alwaysInQuickList
            );

            // Track keys already shown to avoid duplicates
            const alwaysShowKeys = new Set(alwaysShowSnippets.map(([key]) => key));

            if (alwaysShowSnippets.length > 0) {
                alwaysShowSnippets.forEach(([key, snippet]) => {
                    html += `<li data-library-key="${key}" data-dynamic="true">${snippet.name}</li>`;
                });
            }

            // Get context-aware snippets (both built-in and user snippets by category)
            const contextSnippets = await getContextSnippets(textarea);

            // Filter out snippets that were already added in the alwaysShow section
            const filteredContextSnippets = contextSnippets.filter(snippet => !alwaysShowKeys.has(snippet.key));

            if (filteredContextSnippets.length > 0) {
                // Add separator only if there are items above
                if (alwaysShowSnippets.length > 0) {
                    html += '<li class="snippet-separator"></li>';
                }

                // Add context-aware snippets from library (includes user snippets with matching category)
                filteredContextSnippets.forEach(snippet => {
                    html += `<li data-library-key="${snippet.key}">${snippet.name}</li>`;
                });
            }

            html += '</ul>';
            return html;
        }

        // ==================== SIDEBAR SNIPPETS ====================
        // Load snippets from JSON file and merge with user snippets

        function loadSnippets(forceReload = false) {
            return new Promise((resolve, reject) => {
                if (snippetsData && !forceReload) {
                    resolve(snippetsData);
                    return;
                }

                if (!chrome.runtime?.id) { resolve({}); return; }
                const snippetsUrl = chrome.runtime.getURL('data/snippets.json');

                Promise.all([
                    fetch(snippetsUrl).then(response => {
                        if (!response.ok) {
                            throw new Error('Failed to load snippets.json');
                        }
                        return response.json();
                    }),
                    loadUserSnippets()
                ])
                .then(([builtInSnippets, userSnippets]) => {
                    // Mark built-in snippets
                    for (const key of Object.keys(builtInSnippets)) {
                        builtInSnippets[key].isUserSnippet = false;
                    }

                    // Merge: user snippets come after built-in
                    snippetsData = { ...builtInSnippets, ...userSnippets };

                    const builtInCount = Object.keys(builtInSnippets).length;
                    const userCount = Object.keys(userSnippets).length;
                    console.log(TOOLKIT_NAME + ` Loaded ${builtInCount} built-in + ${userCount} user snippets`);
                    resolve(snippetsData);
                })
                .catch(err => {
                    console.error(TOOLKIT_NAME + ' Error loading snippets:', err);
                    reject(err);
                });
            });
        }

        // Replace skin IDs in snippet code
        function processSidebarSnippet(code, skinId) {
            // Replace all .skinXXX patterns with the current skin ID
            return code.replace(/\.skin\d+/g, '.skin' + skinId);
        }

        // Format code for display with syntax highlighting
        function formatCodeForDisplay(code) {
            // Simple syntax highlighting
            let formatted = code
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                // Properties
                .replace(/([a-z\-]+)(\s*:)/gi, '<span class="css-prop">$1</span>$2')
                // Values after colon
                .replace(/:(\s*)([^;{}]+)(;)/g, ':<span class="css-val">$1$2</span>$3')
                // Selectors (lines ending with {)
                .replace(/^(.+)(\{)$/gm, '<span class="css-sel">$1</span>$2')
                // Brackets
                .replace(/([{}])/g, '<span class="css-bracket">$1</span>');
            return formatted;
        }

        // Get logo URL - must use chrome.runtime.getURL for extension resources
        function getLogoUrl() {
            try {
                return chrome.runtime.getURL('images/wordmark.png');
            } catch (e) {
                console.warn(TOOLKIT_NAME + ' Could not get logo URL:', e);
                return '';
            }
        }

        // Create the sidebar element
        function createSidebar() {
            if (sidebarElement) return sidebarElement;

            const sidebar = document.createElement('div');
            sidebar.id = 'cp-toolkit-snippets-sidebar';
            sidebar.innerHTML = `
                <div class="snippets-sidebar-header">
                    <img src="${getLogoUrl()}" alt="CivicPlus" class="snippets-logo">
                    <span class="snippets-title">CSS Snippets</span>
                    <button class="snippets-sidebar-fullscreen" title="Open full page">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg>
                    </button>
                    <button class="snippets-sidebar-close" title="Close">&times;</button>
                </div>
                <div class="snippets-sidebar-actions">
                    <button class="snippets-action-btn snippets-add-btn" title="Add Snippet">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Add
                    </button>
                    <button class="snippets-action-btn snippets-import-btn" title="Import Snippets">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        Import
                    </button>
                    <button class="snippets-action-btn snippets-export-btn" title="Export Snippets">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Export
                    </button>
                    <button class="snippets-action-btn snippets-save-skin-btn" title="Save Widget Skin">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        Save Skin
                    </button>
                    <button class="snippets-action-btn snippets-edit-mode-btn" title="Edit Mode">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit
                    </button>
                </div>
                <div class="snippets-sidebar-search">
                    <input type="text" placeholder="Search snippets..." />
                </div>
                <div class="snippets-sidebar-content"></div>
                <div class="snippets-sidebar-toast"></div>
            `;

            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                #cp-toolkit-snippets-sidebar {
                    position: fixed;
                    top: 0;
                    right: -520px;
                    width: 500px;
                    height: 100vh;
                    background: #fff;
                    box-shadow: -4px 0 20px rgba(0,0,0,0.15);
                    z-index: 2147483647;
                    display: flex;
                    flex-direction: column;
                    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    transition: right 0.3s ease, visibility 0.3s;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                    padding: 0;
                    margin: 0;
                    left: auto;
                    visibility: hidden;
                }
                #cp-toolkit-snippets-sidebar.open {
                    right: 0;
                    visibility: visible;
                }
                #cp-toolkit-snippets-sidebar button {
                    line-height: normal;
                    width: auto;
                    height: auto;
                    min-width: 0;
                    box-sizing: border-box;
                }
                #cp-toolkit-snippets-sidebar svg {
                    fill: none;
                }
                .snippets-sidebar-header {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0;
                    padding: 16px 20px;
                    background: linear-gradient(135deg, #af282f 0%, #8a1f24 100%);
                    color: #fff;
                    flex-shrink: 0;
                    position: relative;
                }
                .snippets-logo {
                    height: 28px;
                    width: auto;
                }
                .snippets-title {
                    flex: 1;
                    font-size: 16px;
                    font-weight: 500;
                    opacity: 0.9;
                }
                #cp-toolkit-snippets-sidebar .snippets-sidebar-close,
                #cp-toolkit-snippets-sidebar .snippets-sidebar-fullscreen {
                    background: none;
                    border: none;
                    color: #fff;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                    position: absolute;
                    opacity: 0.8;
                    transition: opacity 0.2s;
                    width: auto;
                    height: auto;
                }
                #cp-toolkit-snippets-sidebar .snippets-sidebar-close {
                    font-size: 28px;
                    right: 10px;
                    top: 10px;
                    height: 28px;
                    width: 28px;
                }
                #cp-toolkit-snippets-sidebar .snippets-sidebar-fullscreen {
                    left: 10px;
                    top: 10px;
                    width: 28px;
                    height: 28px;
                }
                #cp-toolkit-snippets-sidebar .snippets-sidebar-close:hover,
                #cp-toolkit-snippets-sidebar .snippets-sidebar-fullscreen:hover {
                    opacity: 1;
                }
                .snippets-sidebar-search {
                    padding: 12px 20px;
                    border-bottom: 1px solid #e0e0e0;
                    flex-shrink: 0;
                }
                .snippets-sidebar-search input {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    font-size: 14px;
                    box-sizing: border-box;
                }
                .snippets-sidebar-search input:focus {
                    outline: none;
                    border-color: #af282f;
                }
                .snippets-sidebar-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0;
                }
                .snippet-item {
                    border-bottom: 1px solid #e0e0e0;
                }
                .snippet-item-header {
                    display: flex;
                    align-items: center;
                    padding: 14px 20px;
                    cursor: pointer;
                    user-select: none;
                    font-size: 14px;
                    color: #333;
                    transition: background 0.15s;
                }
                .snippet-item-header:hover {
                    background: #f5f5f5;
                }
                .snippet-item.expanded .snippet-item-header {
                    background: #f0f0f0;
                    border-bottom: 1px solid #e0e0e0;
                }
                .snippet-item-name {
                    flex: 1;
                    font-weight: 500;
                }
                .snippet-item-category {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 22px;
                    height: 22px;
                    padding: 0;
                    border-radius: 50%;
                    color: #636366;
                    background: rgba(118, 118, 128, 0.12);
                    flex-shrink: 0;
                }
                .snippet-item-category svg {
                    width: 12px;
                    height: 12px;
                }
                .snippet-item-content {
                    display: none;
                    padding: 0;
                    background: #fff;
                }
                .snippet-item.expanded .snippet-item-content {
                    display: block;
                }
                .snippet-code {
                    padding: 16px 20px;
                    margin: 0;
                    font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
                    font-size: 12px;
                    line-height: 1.5;
                    color: #24292e;
                    white-space: pre-wrap;
                    word-break: break-word;
                    overflow-x: auto;
                }
                .snippet-code .css-prop { color: #0451a5; }
                .snippet-code .css-val { color: #a31515; }
                .snippet-code .css-sel { color: #800000; }
                .snippet-code .css-bracket { color: #000; }
                .snippet-actions {
                    padding: 12px 20px;
                    background: #f0f0f0;
                    border-top: 1px solid #e0e0e0;
                }
                .snippet-copy-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    background: #af282f;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .snippet-copy-btn:hover {
                    background: #c42f37;
                }
                .snippet-copy-btn svg {
                    width: 14px;
                    height: 14px;
                }
                .snippets-sidebar-toast {
                    position: absolute;
                    bottom: 20px;
                    left: 20px;
                    right: 20px;
                    background: #333;
                    color: #fff;
                    padding: 12px 16px;
                    border-radius: 6px;
                    font-size: 14px;
                    text-align: center;
                    opacity: 0;
                    transform: translateY(10px);
                    transition: opacity 0.3s, transform 0.3s;
                    pointer-events: none;
                }
                .snippets-sidebar-toast.show {
                    opacity: 1;
                    transform: translateY(0);
                }
                /* Action buttons row */
                .snippets-sidebar-actions {
                    display: flex;
                    gap: 8px;
                    justify-content:center;
                    padding: 12px 20px;
                    border-bottom: 1px solid #e0e0e0;
                    background: #f8f8f8;
                }
                .snippets-action-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 12px;
                    background: #fff;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .snippets-action-btn:hover {
                    background: #f0f0f0;
                    border-color: #999;
                }
                .snippets-action-btn svg {
                    width: 14px;
                    height: 14px;
                }
                .snippets-add-btn:hover {
                    background: #e8f5e9;
                    border-color: #4caf50;
                    color: #2e7d32;
                }
                .snippets-save-skin-btn:hover {
                    background: #e3f2fd;
                    border-color: #1976d2;
                    color: #1565c0;
                }
                /* Badge base styles */
                .snippet-user-badge,
                .snippet-multi-badge,
                .snippet-dynamic-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 22px;
                    height: 22px;
                    padding: 0;
                    border-radius: 50%;
                    margin-right: 4px;
                    flex-shrink: 0;
                }
                .snippet-user-badge svg,
                .snippet-multi-badge svg,
                .snippet-dynamic-badge svg {
                    width: 12px;
                    height: 12px;
                }
                /* User badge - warm red/coral */
                .snippet-user-badge {
                    color: #c41c27;
                    background: rgba(196, 28, 39, 0.12);
                }
                /* Multi-component badge - blue */
                .snippet-multi-badge {
                    color: #0066cc;
                    background: rgba(0, 102, 204, 0.12);
                }
                .snippet-item.multi-component {
                    border-left: 3px solid rgba(0, 102, 204, 0.5);
                }
                /* Dynamic selector badge - purple */
                .snippet-dynamic-badge {
                    color: #8944ab;
                    background: rgba(137, 68, 171, 0.12);
                }
                .snippet-item.dynamic-selector {
                    border-left: 3px solid rgba(137, 68, 171, 0.5);
                }
                /* Copied Skins section */
                .snippet-skin-badge {
                    font-size: 10px;
                    font-weight: 600;
                    padding: 3px 8px;
                    border-radius: 12px;
                    letter-spacing: 0.02em;
                    text-transform: uppercase;
                    color: #1565c0;
                    background: rgba(25, 118, 210, 0.12);
                    flex-shrink: 0;
                }
                .copied-skins-section {
                    border-bottom: 2px solid #1976d2;
                }
                .copied-skins-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 20px;
                    background: #e3f2fd;
                    font-size: 13px;
                    font-weight: 600;
                    color: #1565c0;
                    cursor: pointer;
                    user-select: none;
                }
                .copied-skins-header:hover {
                    background: #bbdefb;
                }
                .copied-skins-chevron {
                    transition: transform 0.2s;
                    flex-shrink: 0;
                    margin-left: 8px;
                }
                .copied-skins-section.collapsed .copied-skins-chevron {
                    transform: rotate(-90deg);
                }
                .copied-skins-section.collapsed .copied-skin-item {
                    display: none !important;
                }
                .copied-skins-count {
                    background: #1976d2;
                    color: #fff;
                    padding: 2px 8px;
                    margin: 0 auto;
                    margin-right: 0;
                    font-size: 11px;
                    border-radius: 20px;
                }
                .copied-skin-item {
                    border-bottom: 1px solid #e0e0e0;
                    padding: 12px 20px;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .copied-skin-item:hover {
                    background: #f5f5f5;
                }
                .copied-skin-item-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .copied-skin-name {
                    flex: 1;
                    font-weight: 500;
                    font-size: 14px;
                    color: #333;
                }
                .copied-skin-meta {
                    font-size: 11px;
                    color: #888;
                    flex-shrink: 0;
                }
                .copied-skin-source {
                    font-size: 11px;
                    color: #666;
                    margin-top: 4px;
                    margin-left: 50px;
                }
                .copied-skin-source-link {
                    color: #1976d2;
                    text-decoration: none;
                    font-size: 11px;
                    font-weight: 500;
                    margin-left: 6px;
                }
                .copied-skin-source-link:hover {
                    text-decoration: underline;
                }
                .copied-skin-delete-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    padding: 0;
                    background: none;
                    border: 1px solid transparent;
                    border-radius: 4px;
                    cursor: pointer;
                    color: #999;
                    flex-shrink: 0;
                    transition: all 0.15s;
                }
                .copied-skin-delete-btn:hover {
                    color: #c41c27;
                    background: rgba(196, 28, 39, 0.08);
                    border-color: rgba(196, 28, 39, 0.2);
                }
                .copied-skin-delete-btn svg {
                    width: 14px;
                    height: 14px;
                }
                /* Skin select in modals */
                .snippet-modal-skin-select {
                    width: 100%;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    padding: 6px;
                    font-size: 14px;
                    font-family: inherit;
                    box-sizing: border-box;
                }
                .snippet-modal-skin-select option {
                    padding: 4px 8px;
                }
                .snippet-modal-skin-info {
                    margin-bottom: 16px;
                    padding: 12px;
                    background: #f5f5f5;
                    border-radius: 4px;
                }
                .snippet-modal-skin-info-name {
                    font-weight: 600;
                    font-size: 15px;
                    margin-bottom: 4px;
                }
                .snippet-modal-skin-info-detail {
                    font-size: 12px;
                    color: #666;
                }
                .snippet-modal-warning {
                    margin-top: 12px;
                    padding: 10px;
                    background: #fff8e1;
                    border-left: 3px solid #ffc107;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #795548;
                }
                /* Edit/Delete buttons */
                #cp-toolkit-snippets-sidebar .snippet-edit-btn,
                #cp-toolkit-snippets-sidebar .snippet-delete-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    padding: 0;
                    background: #f0f0f0;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-left: 8px;
                }
                #cp-toolkit-snippets-sidebar .snippet-edit-btn:hover {
                    background: #e3f2fd;
                    border-color: #2196f3;
                    color: #1976d2;
                }
                #cp-toolkit-snippets-sidebar .snippet-delete-btn:hover {
                    background: #ffebee;
                    border-color: #f44336;
                    color: #c62828;
                }
                #cp-toolkit-snippets-sidebar .snippet-edit-btn svg,
                #cp-toolkit-snippets-sidebar .snippet-delete-btn svg {
                    width: 14px;
                    height: 14px;
                }
                /* User snippet highlight */
                .snippet-item.user-snippet {
                    background: #fbfbfb;
                }
                .snippet-item.user-snippet .snippet-item-header:hover {
                    background: #f0f0f0;
                }
                /* Edit mode toggle button */
                .snippets-edit-mode-btn.active {
                    background: #af282f;
                    color: #fff;
                    border-color: #af282f;
                }
                .snippets-edit-mode-btn.active:hover {
                    background: #8c2026;
                    border-color: #8c2026;
                    color: #fff;
                }
                /* Drag handle - hidden by default, shown in edit mode */
                .snippet-drag-handle {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    width: 16px;
                    flex-shrink: 0;
                    cursor: grab;
                    color: #bbb;
                    margin-right: 6px;
                    transition: color 0.15s;
                }
                .edit-mode .snippet-drag-handle {
                    display: inline-flex;
                }
                .snippet-drag-handle:hover {
                    color: #666;
                }
                .snippet-drag-handle:active {
                    cursor: grabbing;
                }
                /* Header delete button - hidden by default, shown in edit mode */
                .snippet-header-delete-btn {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    padding: 0;
                    margin-left: 6px;
                    background: none;
                    border: 1px solid transparent;
                    border-radius: 4px;
                    cursor: pointer;
                    color: #bbb;
                    flex-shrink: 0;
                    transition: all 0.15s;
                }
                .edit-mode .snippet-header-delete-btn {
                    display: inline-flex;
                }
                .snippet-header-delete-btn:hover {
                    color: #c41c27;
                    background: rgba(196, 28, 39, 0.08);
                    border-color: rgba(196, 28, 39, 0.2);
                }
                .snippet-header-delete-btn svg {
                    width: 13px;
                    height: 13px;
                }
                /* Delete All button */
                .snippets-delete-all {
                    display: none;
                    width: calc(100% - 40px);
                    margin: 16px 20px;
                    padding: 10px 20px;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    background: #fff;
                    color: #c41c27;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .edit-mode .snippets-delete-all {
                    display: block;
                }
                .snippets-delete-all:hover {
                    background: #c41c27;
                    color: #fff;
                    border-color: #c41c27;
                }
                /* Drag states */
                .snippet-item.dragging {
                    opacity: 0.4;
                    background: #f0f0f0;
                }
                .snippet-item.drag-over-top {
                    box-shadow: 0 -2px 0 0 #af282f;
                }
                .snippet-item.drag-over-bottom {
                    box-shadow: 0 2px 0 0 #af282f;
                }
                /* Modal styles */
                .snippet-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2147483647;
                }
                .snippet-modal {
                    background: #fff;
                    border-radius: 8px;
                    width: 500px;
                    max-width: 90vw;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                }
                .snippet-modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    border-bottom: 1px solid #e0e0e0;
                }
                .snippet-modal-header h3 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                }
                .snippet-modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                    line-height: 1;
                }
                .snippet-modal-close:hover {
                    color: #333;
                }
                .snippet-modal-body {
                    padding: 20px;
                    overflow-y: auto;
                    flex: 1;
                }
                .snippet-modal-field {
                    margin-bottom: 16px;
                }
                .snippet-modal-field label {
                    display: block;
                    margin-bottom: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    color: #333;
                }
                .snippet-modal-field input,
                .snippet-modal-field textarea {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    font-size: 14px;
                    box-sizing: border-box;
                    font-family: inherit;
                }
                .snippet-modal-field textarea {
                    font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
                    font-size: 12px;
                    resize: vertical;
                    min-height: 150px;
                }
                .snippet-modal-field input:focus,
                .snippet-modal-field textarea:focus {
                    outline: none;
                    border-color: #af282f;
                }
                .snippet-modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                    padding: 16px 20px;
                    border-top: 1px solid #e0e0e0;
                    background: #f8f8f8;
                }
                .snippet-modal-btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .snippet-modal-btn.primary {
                    background: #af282f;
                    color: #fff;
                }
                .snippet-modal-btn.primary:hover {
                    background: #c42f37;
                }
                .snippet-modal-btn.secondary {
                    background: #e0e0e0;
                    color: #333;
                }
                .snippet-modal-btn.secondary:hover {
                    background: #d0d0d0;
                }
                .snippet-modal-field select {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    font-size: 14px;
                    box-sizing: border-box;
                    font-family: inherit;
                    background: #fff;
                    cursor: pointer;
                }
                .snippet-modal-field select:focus {
                    outline: none;
                    border-color: #af282f;
                }
                .snippet-category-hint {
                    margin: 6px 0 0;
                    font-size: 12px;
                    color: #666;
                    font-style: italic;
                }
                .snippet-category-note {
                    margin: 6px 0 0;
                    font-size: 11px;
                    color: #888;
                    padding: 6px 10px;
                    background: #fff8e1;
                    border-radius: 4px;
                    border-left: 3px solid #ffc107;
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(sidebar);

            sidebarElement = sidebar;
            return sidebar;
        }

        // Show toast notification
        function showToast(sidebar, message) {
            const toast = sidebar.querySelector('.snippets-sidebar-toast');
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2000);
        }

        // Build sidebar content - flat list, no categories
        function buildSidebarContent(snippets, copiedSkins, snippetOrder) {
            let html = '';

            // Render copied skins section if any exist
            copiedSkins = copiedSkins || {};
            snippetOrder = snippetOrder || [];
            const skinEntries = Object.entries(copiedSkins);
            if (skinEntries.length > 0) {
                html += '<div class="copied-skins-section collapsed">';
                html += '<div class="copied-skins-header">';
                html += '<span>Copied Skins</span>';
                html += '<span class="copied-skins-count">' + skinEntries.length + '</span>';
                html += '<svg class="copied-skins-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>';
                html += '</div>';

                for (const [key, skin] of skinEntries) {
                    const savedDate = skin.savedAt ? new Date(skin.savedAt).toLocaleDateString() : '';
                    const sourceInfo = skin.sourceSkinName ? 'from ' + skin.sourceSkinName + ' (ID: ' + skin.sourceSkinID + ')' : '';
                    const componentCount = skin.components ? skin.components.length : 0;

                    const sourceLink = skin.sourceUrl ? ` <a href="${skin.sourceUrl}" target="_blank" class="copied-skin-source-link" title="${skin.sourceUrl}">Source</a>` : '';

                    html += `
                        <div class="copied-skin-item" data-skin-key="${key}">
                            <div class="copied-skin-item-header">
                                <span class="snippet-skin-badge">Skin</span>
                                <span class="copied-skin-name">${skin.name}</span>
                                <span class="copied-skin-meta">${savedDate}</span>
                                <button class="copied-skin-delete-btn" data-skin-key="${key}" title="Delete saved skin">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                            <div class="copied-skin-source">${sourceInfo}${sourceInfo && componentCount ? ' \u2022 ' : ''}${componentCount} component(s)${sourceLink}</div>
                        </div>
                    `;
                }
                html += '</div>';
            }

            // Sort snippets by saved order
            let snippetEntries = Object.entries(snippets);
            if (snippetOrder.length > 0) {
                const orderMap = {};
                snippetOrder.forEach((key, idx) => orderMap[key] = idx);
                snippetEntries.sort((a, b) => {
                    const aIdx = orderMap[a[0]] !== undefined ? orderMap[a[0]] : Infinity;
                    const bIdx = orderMap[b[0]] !== undefined ? orderMap[b[0]] : Infinity;
                    return aIdx - bIdx;
                });
            }

            for (const [key, snippet] of snippetEntries) {
                // Handle multi-component snippets - combine all component codes
                let codeToDisplay = snippet.code || '';
                const hasComponents = snippet.components && Object.keys(snippet.components).length > 0;

                if (hasComponents) {
                    // Build combined code display with component headers
                    const componentCodes = [];
                    for (const [compId, code] of Object.entries(snippet.components)) {
                        const comp = SKIN_COMPONENT_TYPES.find(c => c.id === parseInt(compId, 10));
                        const compName = comp ? comp.name : `Component ${compId}`;
                        componentCodes.push(`/* === ${compName} === */\n${code}`);
                    }
                    codeToDisplay = componentCodes.join('\n\n');
                }

                const formattedCode = formatCodeForDisplay(codeToDisplay);
                const isUserSnippet = snippet.isUserSnippet === true;
                const isDynamic = snippet.dynamicSelector === true;
                const userBadge = isUserSnippet ? '<span class="snippet-user-badge" title="User Snippet"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></span>' : '';
                const multiCompBadge = hasComponents ? '<span class="snippet-multi-badge" title="Multi-Component"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect></svg></span>' : '';
                const dynamicBadge = isDynamic ? '<span class="snippet-dynamic-badge" title="Dynamic Selector"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg></span>' : '';
                const headerDeleteBtn = isUserSnippet ? `<button class="snippet-header-delete-btn" data-key="${key}" title="Delete snippet"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>` : '';
                const editDeleteBtns = isUserSnippet ? `
                    <button class="snippet-edit-btn" data-key="${key}" title="Edit snippet">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="snippet-delete-btn" data-key="${key}" title="Delete snippet">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                ` : '';

                // Button text and title for multi-component vs dynamic vs single
                const insertBtnText = hasComponents ? 'Insert All' : (isDynamic ? 'Insert' : 'Copy');
                const insertBtnTitle = hasComponents ? 'Insert code into each component section' : (isDynamic ? 'Insert into current textarea' : 'Copy to clipboard');

                html += `
                    <div class="snippet-item${isUserSnippet ? ' user-snippet' : ''}${hasComponents ? ' multi-component' : ''}${isDynamic ? ' dynamic-selector' : ''}" data-snippet-key="${key}" data-has-components="${hasComponents}">
                        <div class="snippet-item-header">
                            <span class="snippet-drag-handle" title="Drag to reorder"><svg width="10" height="14" viewBox="0 0 10 14"><circle cx="3" cy="2" r="1.2" fill="currentColor"/><circle cx="7" cy="2" r="1.2" fill="currentColor"/><circle cx="3" cy="7" r="1.2" fill="currentColor"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/><circle cx="3" cy="12" r="1.2" fill="currentColor"/><circle cx="7" cy="12" r="1.2" fill="currentColor"/></svg></span>
                            <span class="snippet-item-name">${snippet.name}</span>
                            ${userBadge}
                            ${multiCompBadge}
                            ${dynamicBadge}
                            <span class="snippet-item-category" title="${snippet.category || 'Other'}">${getCategoryIcon(snippet.category)}</span>
                            ${headerDeleteBtn}
                        </div>
                        <div class="snippet-item-content">
                            <pre class="snippet-code">${formattedCode}</pre>
                            <div class="snippet-actions">
                                <button class="snippet-copy-btn" data-key="${key}" title="${insertBtnTitle}">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                    ${insertBtnText}
                                </button>
                                ${editDeleteBtns}
                            </div>
                        </div>
                    </div>
                `;
            }

            // Delete All button (only visible in edit mode)
            html += '<button class="snippets-delete-all" title="Delete all user snippets and copied skins">Delete All User Data</button>';

            return html;
        }

        // Show snippet editor modal
        function showSnippetModal(existingKey = null, existingSnippet = null) {
            const isEdit = existingKey !== null;
            const title = isEdit ? 'Edit Snippet' : 'Add Snippet';

            // Check if existing category is a predefined one or custom
            const existingCategory = existingSnippet?.category || 'Custom';
            const isPredefinedCategory = SNIPPET_CATEGORIES.some(cat =>
                cat.value.toLowerCase() === existingCategory.toLowerCase()
            );
            const selectedCategory = isPredefinedCategory ? existingCategory : 'Custom';
            const customCategoryValue = isPredefinedCategory ? '' : existingCategory;

            // Check existing snippet settings
            const hasDynamicSelector = existingSnippet?.dynamicSelector === true;
            const hasMultipleComponents = existingSnippet?.components && Object.keys(existingSnippet.components).length > 0;
            const existingComponents = existingSnippet?.components || {};

            // Build category options
            const categoryOptions = SNIPPET_CATEGORIES.map(cat => {
                const selected = cat.value.toLowerCase() === selectedCategory.toLowerCase() ? 'selected' : '';
                return `<option value="${cat.value}" ${selected}>${cat.label}</option>`;
            }).join('');

            // Build component checkboxes
            const componentCheckboxes = SKIN_COMPONENT_TYPES.map(comp => {
                const checked = existingComponents[comp.id] !== undefined ? 'checked' : '';
                return `
                    <label class="snippet-component-checkbox">
                        <input type="checkbox" value="${comp.id}" ${checked} />
                        <span>${comp.name}</span>
                    </label>
                `;
            }).join('');

            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.className = 'snippet-modal-overlay';
            overlay.innerHTML = `
                <div class="snippet-modal snippet-modal-wide">
                    <div class="snippet-modal-header">
                        <h3>${title}</h3>
                        <button class="snippet-modal-close">&times;</button>
                    </div>
                    <div class="snippet-modal-body">
                        <div class="snippet-modal-field">
                            <label for="snippet-name">Name</label>
                            <input type="text" id="snippet-name" placeholder="My Snippet" value="${existingSnippet?.name || ''}" />
                        </div>
                        <div class="snippet-modal-field">
                            <label for="snippet-category">Category</label>
                            <select id="snippet-category">
                                ${categoryOptions}
                            </select>
                            <p class="snippet-category-hint"></p>
                        </div>
                        <div class="snippet-modal-field snippet-custom-category-field" style="display: ${selectedCategory === 'Custom' ? 'block' : 'none'};">
                            <label for="snippet-custom-category">Custom Category Name</label>
                            <input type="text" id="snippet-custom-category" placeholder="My Category" value="${customCategoryValue}" />
                            <p class="snippet-category-note">Note: Custom categories won't appear in context-aware quick lists</p>
                        </div>

                        <!-- Advanced Options -->
                        <div class="snippet-modal-field snippet-advanced-toggle">
                            <label class="snippet-checkbox-label">
                                <input type="checkbox" id="snippet-dynamic-selector" ${hasDynamicSelector ? 'checked' : ''} />
                                <span>Enable dynamic selector replacement</span>
                            </label>
                            <p class="snippet-field-hint">Uses template variables: {{FULL_SELECTOR}}, {{MOBILE_RULE}}, {{HOVER_SELECTOR}}</p>
                            <div class="snippet-dynamic-warning" style="display: ${hasDynamicSelector ? 'block' : 'none'};">
                                <p class="snippet-warning-text">Recommended for small, reusable snippets like a media query or an after element. <a href="#" class="snippet-dynamic-more-info">More info</a></p>
                                <div class="snippet-dynamic-info-panel" style="display: none;">
                                    <p class="snippet-info-title">How Dynamic Selectors Work</p>
                                    <p>When you use template variables, the snippet automatically detects which Advanced Styles section you're working in and builds the correct CSS selector for you.</p>
                                    <p class="snippet-info-title">Variable Reference</p>
                                    <table class="snippet-info-table">
                                        <tr><th>Variable</th><th>Resolves To</th><th>Example (skin Item section)</th></tr>
                                        <tr><td><code>{{FULL_SELECTOR}}</code></td><td>Full selector for current section</td><td><code>.widget.skin98 .widgetItem</code></td></tr>
                                        <tr><td><code>{{HOVER_SELECTOR}}</code></td><td>Selector + hover/focus states</td><td><code>.widget.skin98 .widgetItem:is(:hover, :focus, :active)</code></td></tr>
                                        <tr><td><code>{{MOBILE_RULE}}</code></td><td>Mobile-wrapped selector</td><td><code>.row.outer:not(.wide) .widget.skin98 .widgetItem</code></td></tr>
                                    </table>
                                    <p class="snippet-info-title">Example: "After Element / Center on Mobile"</p>
                                    <p>Here's how the same snippet produces different output depending on which section you insert it into:</p>
                                    <p class="snippet-info-subtitle">In the <strong>Wrapper</strong> section of skin 130:</p>
<pre class="snippet-info-code">position: relative;
}

.widget.skin130::after {
    position: absolute;
    content: &quot;&quot;;
    width: 74px;
    height: 3px;
    bottom: -7px;
    left: 0;
    background: #FED318;
}

.row.outer:not(.wide) .widget.skin130::after {
    left: 50%;
    transform: translateX(-50%);</pre>
                                    <p class="snippet-info-subtitle">In the <strong>Item Title</strong> section of skin 130:</p>
<pre class="snippet-info-code">position: relative;
}

.widget.skin130 .widgetTitle::after {
    position: absolute;
    content: &quot;&quot;;
    width: 74px;
    height: 3px;
    bottom: -7px;
    left: 0;
    background: #FED318;
}

.row.outer:not(.wide) .widget.skin130 .widgetTitle::after {
    left: 50%;
    transform: translateX(-50%);</pre>
                                    <p class="snippet-info-title">Setting Up Selectors</p>
                                    <p>Here's how to use template variables in your snippet and what they produce. In the <strong>Item</strong> section of skin 98:</p>
                                    <p class="snippet-info-subtitle">You write:</p>
<pre class="snippet-info-code">}
{{FULL_SELECTOR}} {
    background-color: #FFF;
}
{{HOVER_SELECTOR}} {
    background-color: #000;</pre>
                                    <p class="snippet-info-subtitle">Output:</p>
<pre class="snippet-info-code">}
.widget.skin98 .widgetItem {
    background-color: #FFF;
}
.widget.skin98 .widgetItem:is(:hover, :focus, :active) {
    background-color: #000;</pre>
                                    <p class="snippet-info-note">The selector adapts to wherever you insert — <code>{{FULL_SELECTOR}}</code> becomes the section's selector, <code>{{HOVER_SELECTOR}}</code> adds interactive states, and <code>{{MOBILE_RULE}}</code> wraps it in a mobile breakpoint. You add your own pseudo-elements (::after, ::before) and properties.</p>
                                </div>
                            </div>
                        </div>

                        <div class="snippet-modal-field snippet-advanced-toggle">
                            <label class="snippet-checkbox-label">
                                <input type="checkbox" id="snippet-always-quick-list" ${existingSnippet?.alwaysInQuickList ? 'checked' : ''} />
                                <span>Always show in quick list</span>
                            </label>
                            <p class="snippet-field-hint">Show this snippet in the quick list regardless of category</p>
                        </div>

                        <div class="snippet-modal-field snippet-advanced-toggle">
                            <label class="snippet-checkbox-label">
                                <input type="checkbox" id="snippet-multi-component" ${hasMultipleComponents ? 'checked' : ''} />
                                <span>Uses multiple skin components</span>
                            </label>
                            <p class="snippet-field-hint">Code for different sections (Wrapper, Item, Header, etc.)</p>
                        </div>

                        <!-- Single code textarea (shown when multi-component is OFF) -->
                        <div class="snippet-modal-field snippet-single-code" style="display: ${hasMultipleComponents ? 'none' : 'block'};">
                            <label for="snippet-code">CSS Code</label>
                            <textarea id="snippet-code" rows="10" placeholder="/* Your CSS code here */">${existingSnippet?.code || ''}</textarea>
                        </div>

                        <!-- Multi-component section (shown when multi-component is ON) -->
                        <div class="snippet-multi-component-section" style="display: ${hasMultipleComponents ? 'block' : 'none'};">
                            <div class="snippet-modal-field">
                                <label>Select Components</label>
                                <div class="snippet-component-grid">
                                    ${componentCheckboxes}
                                </div>
                            </div>
                            <div class="snippet-component-editors"></div>
                        </div>
                    </div>
                    <div class="snippet-modal-footer">
                        <button class="snippet-modal-btn secondary snippet-modal-cancel">Cancel</button>
                        <button class="snippet-modal-btn primary snippet-modal-save">Save</button>
                    </div>
                </div>
            `;

            // Add additional styles for new elements
            if (!document.getElementById('snippet-modal-advanced-styles')) {
                const advancedStyles = document.createElement('style');
                advancedStyles.id = 'snippet-modal-advanced-styles';
                advancedStyles.textContent = `
                    .snippet-modal-wide {
                        width: 650px !important;
                        max-height: 85vh !important;
                    }
                    .snippet-checkbox-label {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        cursor: pointer;
                        font-weight: 500;
                    }
                    .snippet-checkbox-label input {
                        width: 16px;
                        height: 16px;
                        cursor: pointer;
                    }
                    .snippet-field-hint {
                        margin: 4px 0 0 24px;
                        font-size: 12px;
                        color: #666;
                        font-style: italic;
                    }
                    .snippet-component-grid {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 8px;
                        margin-top: 8px;
                    }
                    .snippet-component-checkbox {
                        display: flex !important;
                        align-items: center;
                        gap: 6px;
                        font-size: 13px;
                        cursor: pointer;
                        padding: 4px 8px;
                        border-radius: 4px;
                        background: #f5f5f5;
                        transition: background 0.2s;
                    }
                    .snippet-component-checkbox:hover {
                        background: #e8e8e8;
                    }
                    .snippet-component-checkbox input {
                        cursor: pointer;
                        width:20px;
                    }
                    .snippet-component-editors {
                        margin-top: 16px;
                    }
                    .snippet-component-editor {
                        margin-bottom: 12px;
                        border: 1px solid #ddd;
                        border-radius: 6px;
                        overflow: hidden;
                    }
                    .snippet-component-editor-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 10px 14px;
                        background: #f0f0f0;
                        cursor: pointer;
                        user-select: none;
                        font-weight: 500;
                        font-size: 13px;
                    }
                    .snippet-component-editor-header:hover {
                        background: #e8e8e8;
                    }
                    .snippet-component-editor-toggle {
                        font-size: 12px;
                        color: #666;
                        transition: transform 0.2s;
                    }
                    .snippet-component-editor.collapsed .snippet-component-editor-toggle {
                        transform: rotate(-90deg);
                    }
                    .snippet-component-editor-body {
                        padding: 12px;
                        background: #fff;
                    }
                    .snippet-component-editor.collapsed .snippet-component-editor-body {
                        display: none;
                    }
                    .snippet-component-editor textarea {
                        width: 100%;
                        min-height: 100px;
                        padding: 10px;
                        border: 1px solid #ccc;
                        border-radius: 4px;
                        font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
                        font-size: 12px;
                        resize: vertical;
                        box-sizing: border-box;
                    }
                    .snippet-component-editor textarea:focus {
                        outline: none;
                        border-color: #af282f;
                    }
                    .snippet-dynamic-warning {
                        margin: 8px 0 0 24px;
                        padding: 10px 12px;
                        background: #fff3e0;
                        border-left: 3px solid #ff9800;
                        border-radius: 4px;
                    }
                    .snippet-warning-text {
                        margin: 0;
                        font-size: 12px;
                        color: #e65100;
                        line-height: 1.4;
                    }
                    .snippet-dynamic-more-info {
                        color: #1565c0;
                        text-decoration: none;
                        font-weight: 600;
                    }
                    .snippet-dynamic-more-info:hover {
                        text-decoration: underline;
                    }
                    .snippet-dynamic-info-panel {
                        margin-top: 10px;
                        padding: 14px;
                        background: #fff;
                        border: 1px solid #e0e0e0;
                        border-radius: 6px;
                        font-size: 12px;
                        line-height: 1.5;
                        color: #333;
                    }
                    .snippet-dynamic-info-panel p {
                        margin: 0 0 8px 0;
                    }
                    .snippet-dynamic-info-panel code {
                        background: #f5f5f5;
                        padding: 1px 5px;
                        border-radius: 3px;
                        font-size: 11px;
                        color: #d32f2f;
                    }
                    .snippet-info-title {
                        font-weight: 700;
                        color: #1565c0;
                        margin-top: 4px;
                    }
                    .snippet-info-subtitle {
                        font-weight: 600;
                        color: #555;
                        margin-bottom: 4px !important;
                    }
                    .snippet-info-code {
                        background: #1e1e1e;
                        color: #d4d4d4;
                        padding: 10px 12px;
                        border-radius: 4px;
                        font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
                        font-size: 11px;
                        line-height: 1.4;
                        overflow-x: auto;
                        margin: 0 0 12px 0;
                        white-space: pre;
                    }
                    .snippet-info-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 12px;
                        font-size: 11px;
                    }
                    .snippet-info-table th {
                        text-align: left;
                        padding: 6px 8px;
                        background: #f5f5f5;
                        border-bottom: 2px solid #ddd;
                        font-weight: 600;
                        color: #555;
                    }
                    .snippet-info-table td {
                        padding: 6px 8px;
                        border-bottom: 1px solid #eee;
                        vertical-align: top;
                    }
                    .snippet-info-table code {
                        font-size: 10px;
                        word-break: break-all;
                    }
                    .snippet-info-note {
                        padding: 8px 10px;
                        background: #e3f2fd;
                        border-radius: 4px;
                        color: #1565c0;
                        font-size: 11px;
                        margin-bottom: 0 !important;
                    }
                    .snippet-radio-group {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        margin-top: 8px;
                        margin-left: 24px;
                    }
                    .snippet-radio-label {
                        display: flex !important;
                        align-items: center;
                        gap: 8px;
                        cursor: pointer;
                        font-size: 13px;
                    }
                    .snippet-radio-label input {
                        cursor: pointer;
                        width:20px;
                    }
                `;
                document.head.appendChild(advancedStyles);
            }

            document.body.appendChild(overlay);

            const categorySelect = overlay.querySelector('#snippet-category');
            const customCategoryField = overlay.querySelector('.snippet-custom-category-field');
            const categoryHint = overlay.querySelector('.snippet-category-hint');
            const dynamicSelectorCheckbox = overlay.querySelector('#snippet-dynamic-selector');
            const dynamicWarning = overlay.querySelector('.snippet-dynamic-warning');
            const multiComponentCheckbox = overlay.querySelector('#snippet-multi-component');
            const singleCodeSection = overlay.querySelector('.snippet-single-code');
            const multiComponentSection = overlay.querySelector('.snippet-multi-component-section');
            const componentEditorsContainer = overlay.querySelector('.snippet-component-editors');
            const componentCheckboxInputs = overlay.querySelectorAll('.snippet-component-checkbox input');

            // Update hint based on selected category
            const updateCategoryHint = () => {
                const selected = categorySelect.value;
                const category = SNIPPET_CATEGORIES.find(cat => cat.value === selected);
                if (category && selected !== 'Custom') {
                    categoryHint.textContent = category.description;
                    categoryHint.style.display = 'block';
                } else {
                    categoryHint.style.display = 'none';
                }
            };

            // Build component editor sections
            const buildComponentEditors = () => {
                const selectedComponents = [];
                componentCheckboxInputs.forEach(cb => {
                    if (cb.checked) {
                        const compId = parseInt(cb.value, 10);
                        const comp = SKIN_COMPONENT_TYPES.find(c => c.id === compId);
                        if (comp) {
                            selectedComponents.push(comp);
                        }
                    }
                });

                // Sort by ID
                selectedComponents.sort((a, b) => a.id - b.id);

                // Build editors HTML
                let editorsHtml = '';

                selectedComponents.forEach((comp) => {
                    const existingCode = existingComponents[comp.id] || '';
                    editorsHtml += `
                        <div class="snippet-component-editor" data-component-id="${comp.id}">
                            <div class="snippet-component-editor-header">
                                <span>${comp.name}</span>
                            </div>
                            <div class="snippet-component-editor-body">
                                <textarea placeholder="/* ${comp.name} styles */">${existingCode}</textarea>
                            </div>
                        </div>
                    `;
                });

                componentEditorsContainer.innerHTML = editorsHtml;
            };

            // Show/hide custom category field
            categorySelect.addEventListener('change', () => {
                const isCustom = categorySelect.value === 'Custom';
                customCategoryField.style.display = isCustom ? 'block' : 'none';
                updateCategoryHint();
            });

            // Toggle dynamic selector options
            dynamicSelectorCheckbox.addEventListener('change', () => {
                const isDynamic = dynamicSelectorCheckbox.checked;
                dynamicWarning.style.display = isDynamic ? 'block' : 'none';
            });

            // "More Info" toggle for dynamic selector explanation
            const moreInfoLink = overlay.querySelector('.snippet-dynamic-more-info');
            if (moreInfoLink) {
                moreInfoLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    const panel = overlay.querySelector('.snippet-dynamic-info-panel');
                    if (panel) {
                        const isVisible = panel.style.display !== 'none';
                        panel.style.display = isVisible ? 'none' : 'block';
                        moreInfoLink.textContent = isVisible ? 'More info' : 'Hide info';
                    }
                });
            }

            // Toggle multi-component mode
            multiComponentCheckbox.addEventListener('change', () => {
                const isMulti = multiComponentCheckbox.checked;
                singleCodeSection.style.display = isMulti ? 'none' : 'block';
                multiComponentSection.style.display = isMulti ? 'block' : 'none';
                if (isMulti) {
                    buildComponentEditors();
                }
            });

            // Update editors when component checkboxes change
            componentCheckboxInputs.forEach(cb => {
                cb.addEventListener('change', buildComponentEditors);
            });

            // Initialize
            updateCategoryHint();
            if (hasMultipleComponents) {
                buildComponentEditors();
            }

            // Focus name input
            setTimeout(() => overlay.querySelector('#snippet-name').focus(), 50);

            // Close modal
            const closeModal = () => overlay.remove();

            overlay.querySelector('.snippet-modal-close').addEventListener('click', closeModal);
            overlay.querySelector('.snippet-modal-cancel').addEventListener('click', closeModal);

            // Save snippet
            overlay.querySelector('.snippet-modal-save').addEventListener('click', async () => {
                const name = overlay.querySelector('#snippet-name').value.trim();
                const selectedCat = overlay.querySelector('#snippet-category').value;
                const customCat = overlay.querySelector('#snippet-custom-category').value.trim();
                const dynamicSelector = overlay.querySelector('#snippet-dynamic-selector').checked;
                const alwaysInQuickList = overlay.querySelector('#snippet-always-quick-list')?.checked || false;
                const isMultiComponent = overlay.querySelector('#snippet-multi-component').checked;

                // Use custom category name if "Custom" is selected, otherwise use the selected category
                const category = selectedCat === 'Custom' ? (customCat || 'Custom') : selectedCat;

                if (!name) {
                    alert('Please enter a snippet name.');
                    return;
                }

                let snippetData = { name, category, dynamicSelector, alwaysInQuickList };

                if (isMultiComponent) {
                    // Collect component codes
                    const components = {};
                    let hasAnyCode = false;

                    componentEditorsContainer.querySelectorAll('.snippet-component-editor').forEach(editor => {
                        const compId = editor.getAttribute('data-component-id');
                        const code = editor.querySelector('textarea').value;
                        if (code.trim()) {
                            components[compId] = code;
                            hasAnyCode = true;
                        }
                    });

                    if (!hasAnyCode) {
                        alert('Please enter CSS code for at least one component.');
                        return;
                    }

                    snippetData.components = components;
                    snippetData.code = ''; // Clear single code when using components
                } else {
                    const code = overlay.querySelector('#snippet-code').value;
                    if (!code) {
                        alert('Please enter some CSS code.');
                        return;
                    }
                    snippetData.code = code;
                }

                const key = isEdit ? existingKey : generateSnippetKey(name);
                await saveUserSnippet(key, snippetData);

                closeModal();

                // Refresh sidebar
                if (sidebarElement) {
                    refreshSidebar();
                }
            });
        }

        // ==================== COPIED SKINS MODALS ====================

        // Show modal to save a widget skin
        async function showSaveSkinModal() {
            // Ensure helper is injected
            injectCopiedSkinsHelper();

            // Ask helper for skins list
            var checkResp = await sendHelperRequest('getSkins');
            if (checkResp.error === 'timeout' || !checkResp.skins) {
                alert('Widget skins are not available. Please ensure you are on the Theme Manager page and the theme has loaded.');
                return;
            }

            var validSkins = checkResp.skins;
            if (validSkins.length === 0) {
                alert('No valid widget skins found on this page.');
                return;
            }

            const skinOptions = validSkins.map(function(skin) {
                return '<option value="' + skin.WidgetSkinID + '">' +
                    (skin.Name || 'Unnamed Skin') + ' (' + skin.WidgetSkinID + ')' +
                    '</option>';
            }).join('');

            const selectSize = Math.min(validSkins.length, 12);

            const overlay = document.createElement('div');
            overlay.className = 'snippet-modal-overlay';
            overlay.innerHTML = `
                <div class="snippet-modal">
                    <div class="snippet-modal-header">
                        <h3>Save Widget Skin</h3>
                        <button class="snippet-modal-close">&times;</button>
                    </div>
                    <div class="snippet-modal-body">
                        <div class="snippet-modal-field">
                            <label for="save-skin-name">Save As Name</label>
                            <input type="text" id="save-skin-name" placeholder="e.g., Client A - Default Skin" />
                        </div>
                        <div class="snippet-modal-field">
                            <label for="save-skin-select">Select Skin to Copy</label>
                            <select id="save-skin-select" class="snippet-modal-skin-select" size="${selectSize}">
                                ${skinOptions}
                            </select>
                            <div style="margin-top:4px;font-size:12px;color:#555;">${validSkins.length} skin(s) available</div>
                        </div>
                    </div>
                    <div class="snippet-modal-footer">
                        <button class="snippet-modal-btn secondary snippet-modal-cancel">Cancel</button>
                        <button class="snippet-modal-btn primary save-skin-confirm">Save Skin</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const closeModal = function() { overlay.remove(); };

            overlay.querySelector('.snippet-modal-close').addEventListener('click', closeModal);
            overlay.querySelector('.snippet-modal-cancel').addEventListener('click', closeModal);
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) closeModal();
            });

            const skinSelect = overlay.querySelector('#save-skin-select');
            const nameInput = overlay.querySelector('#save-skin-name');

            // Auto-populate name when skin is selected
            skinSelect.addEventListener('change', function() {
                var selectedSkin = validSkins.find(function(s) { return s.WidgetSkinID == skinSelect.value; });
                if (selectedSkin && !nameInput.value.trim()) {
                    nameInput.value = selectedSkin.Name;
                }
            });

            // Save handler
            overlay.querySelector('.save-skin-confirm').addEventListener('click', async function() {
                var selectedSkinId = skinSelect.value;
                var saveName = nameInput.value.trim();

                if (!saveName) {
                    alert('Please enter a name for the saved skin.');
                    nameInput.focus();
                    return;
                }
                if (!selectedSkinId) {
                    alert('Please select a skin.');
                    skinSelect.focus();
                    return;
                }

                // Read full skin data from MAIN world via helper
                var readResp = await sendHelperRequest('readSkin', { skinId: selectedSkinId });
                if (!readResp.skinData) {
                    alert('Could not read skin data. The skin may no longer exist.');
                    return;
                }

                var skinData = {
                    name: saveName,
                    savedAt: new Date().toISOString(),
                    sourceSkinName: readResp.skinData.sourceSkinName,
                    sourceSkinID: readResp.skinData.sourceSkinID,
                    sourceUrl: window.location.origin,
                    version: '1.1',
                    componentIndexes: readResp.skinData.componentIndexes,
                    components: readResp.skinData.components
                };

                var key = generateCopiedSkinKey(saveName);
                await saveCopiedSkin(key, skinData);

                closeModal();

                if (sidebarElement) {
                    refreshSidebar();
                    showToast(sidebarElement, 'Saved skin "' + saveName + '"');
                }
            });

            // Keyboard support
            overlay.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') closeModal();
            });

            setTimeout(function() { nameInput.focus(); }, 50);
        }

        // Show modal to apply a saved skin to a target
        async function showApplySkinModal(savedSkinKey, savedSkinData) {
            // Ensure helper is injected
            injectCopiedSkinsHelper();

            // Ask helper for skins list
            var checkResp = await sendHelperRequest('getSkins');
            if (checkResp.error === 'timeout' || !checkResp.skins) {
                alert('Widget skins are not available. Please ensure you are on the Theme Manager page and the theme has loaded.');
                return;
            }

            var validSkins = checkResp.skins;
            if (validSkins.length === 0) {
                alert('No valid widget skins found on this page.');
                return;
            }

            const skinOptions = validSkins.map(function(skin) {
                return '<option value="' + skin.WidgetSkinID + '">' +
                    (skin.Name || 'Unnamed Skin') + ' (' + skin.WidgetSkinID + ')' +
                    '</option>';
            }).join('');

            const selectSize = Math.min(validSkins.length, 12);
            const componentCount = savedSkinData.components ? savedSkinData.components.length : 0;
            const sourceInfo = savedSkinData.sourceSkinName
                ? 'Originally from: ' + savedSkinData.sourceSkinName + ' (ID: ' + savedSkinData.sourceSkinID + ')'
                : '';

            const overlay = document.createElement('div');
            overlay.className = 'snippet-modal-overlay';
            overlay.innerHTML = `
                <div class="snippet-modal">
                    <div class="snippet-modal-header">
                        <h3>Apply Saved Skin</h3>
                        <button class="snippet-modal-close">&times;</button>
                    </div>
                    <div class="snippet-modal-body">
                        <div class="snippet-modal-skin-info">
                            <div class="snippet-modal-skin-info-name">${savedSkinData.name}</div>
                            <div class="snippet-modal-skin-info-detail">${sourceInfo}</div>
                            <div class="snippet-modal-skin-info-detail">${componentCount} component(s) saved</div>
                        </div>
                        <div class="snippet-modal-field">
                            <label for="apply-skin-select">Apply to Target Skin</label>
                            <select id="apply-skin-select" class="snippet-modal-skin-select" size="${selectSize}">
                                ${skinOptions}
                            </select>
                            <div style="margin-top:4px;font-size:12px;color:#555;">${validSkins.length} skin(s) available</div>
                        </div>
                        <div class="snippet-modal-warning">
                            <strong>Warning:</strong> This will overwrite all component styles in the target skin. Skin ID references will be automatically updated.
                        </div>
                    </div>
                    <div class="snippet-modal-footer">
                        <button class="snippet-modal-btn secondary snippet-modal-cancel">Cancel</button>
                        <button class="snippet-modal-btn primary apply-skin-confirm" style="background:#1976d2;">Apply Skin</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            const closeModal = function() { overlay.remove(); };

            overlay.querySelector('.snippet-modal-close').addEventListener('click', closeModal);
            overlay.querySelector('.snippet-modal-cancel').addEventListener('click', closeModal);
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) closeModal();
            });

            // Apply handler
            overlay.querySelector('.apply-skin-confirm').addEventListener('click', async function() {
                var targetSkinId = overlay.querySelector('#apply-skin-select').value;
                if (!targetSkinId) {
                    alert('Please select a target skin.');
                    return;
                }

                var targetSkin = validSkins.find(function(s) { return s.WidgetSkinID == targetSkinId; });
                if (!targetSkin) {
                    alert('Target skin not found.');
                    return;
                }

                var confirmed = confirm(
                    'Apply "' + savedSkinData.name + '" to "' + targetSkin.Name + '" (ID: ' + targetSkin.WidgetSkinID + ')?\n\n' +
                    'This will overwrite ' + componentCount + ' component(s) in the target skin.'
                );

                if (!confirmed) return;

                // Send apply request to MAIN world helper
                var applyResp = await sendHelperRequest('applySkin', {
                    targetSkinId: targetSkinId,
                    components: savedSkinData.components,
                    sourceSkinId: savedSkinData.sourceSkinID
                });

                closeModal();

                if (applyResp.success) {
                    if (sidebarElement) {
                        showToast(sidebarElement, 'Applied "' + savedSkinData.name + '" to "' + targetSkin.Name + '"');
                    }

                    // Prompt to save
                    var shouldSave = confirm(
                        applyResp.copiedCount + ' component(s) applied to "' + targetSkin.Name + '".\n\n' +
                        'Click OK to save changes now, or Cancel to review first.\n' +
                        '(Remember to save the theme before leaving the page.)'
                    );

                    if (shouldSave) {
                        sendHelperRequest('saveTheme');
                    }
                } else {
                    alert('Error applying skin: ' + (applyResp.error || 'Unknown error'));
                }
            });

            // Double-click to apply
            overlay.querySelector('#apply-skin-select').addEventListener('dblclick', function() {
                overlay.querySelector('.apply-skin-confirm').click();
            });

            // Keyboard support
            overlay.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') closeModal();
                if (e.key === 'Enter' && e.target.tagName === 'SELECT') {
                    overlay.querySelector('.apply-skin-confirm').click();
                }
            });

            setTimeout(function() {
                overlay.querySelector('#apply-skin-select').focus();
            }, 50);
        }

        // Import snippets from JSON file
        function importSnippets() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    const text = await file.text();
                    const imported = JSON.parse(text);

                    if (typeof imported !== 'object' || Array.isArray(imported)) {
                        throw new Error('Invalid format');
                    }

                    const userSnippets = await loadUserSnippets();
                    let count = 0;
                    let skippedDuplicates = 0;

                    // Build lookup of existing snippets for duplicate detection
                    const existingSnippets = Object.values(userSnippets);

                    // Import snippets
                    const importedSnippets = {};
                    const importedCopiedSkins = {};

                    for (const [key, item] of Object.entries(imported)) {
                        if (key.startsWith('skin-') && item.components && Array.isArray(item.components)) {
                            // This is a copied skin entry
                            importedCopiedSkins[key] = item;
                        } else {
                            importedSnippets[key] = item;
                        }
                    }

                    for (const snippet of Object.values(importedSnippets)) {
                        // Support both single-code and multi-component snippets
                        const hasCode = snippet.code && snippet.code.trim();
                        const hasComponents = snippet.components && Object.keys(snippet.components).length > 0;

                        if (snippet.name && (hasCode || hasComponents)) {
                            // Check for duplicates: same name AND same code/components
                            const isDuplicate = existingSnippets.some(function(existing) {
                                if (existing.name !== snippet.name) return false;
                                // Compare code
                                if (hasCode && existing.code) {
                                    return existing.code.trim() === snippet.code.trim();
                                }
                                // Compare components
                                if (hasComponents && existing.components) {
                                    return JSON.stringify(existing.components) === JSON.stringify(snippet.components);
                                }
                                return false;
                            });

                            if (isDuplicate) {
                                skippedDuplicates++;
                                continue;
                            }

                            const newKey = generateSnippetKey(snippet.name);
                            const newSnippet = {
                                name: snippet.name,
                                category: snippet.category || 'Imported',
                                isUserSnippet: true
                            };

                            // Include code if present
                            if (hasCode) {
                                newSnippet.code = snippet.code;
                            }

                            // Include components if present (multi-component snippet)
                            if (hasComponents) {
                                newSnippet.components = snippet.components;
                            }

                            // Include dynamicSelector flag if present
                            if (snippet.dynamicSelector === true) {
                                newSnippet.dynamicSelector = true;
                            }

                            // Include alwaysShow flag if present
                            if (snippet.alwaysShow === true) {
                                newSnippet.alwaysShow = true;
                            }

                            userSnippets[newKey] = newSnippet;
                            count++;
                        }
                    }

                    await saveUserSnippets(userSnippets);

                    // Import copied skins (with duplicate detection)
                    let skinCount = 0;
                    let skippedSkins = 0;
                    if (Object.keys(importedCopiedSkins).length > 0) {
                        const existingSkins = await loadCopiedSkins();
                        const existingSkinValues = Object.values(existingSkins);

                        for (const [key, skinData] of Object.entries(importedCopiedSkins)) {
                            // Check for duplicate: same name and same source skin ID
                            const isDuplicate = existingSkinValues.some(function(existing) {
                                return existing.name === skinData.name &&
                                       existing.sourceSkinID === skinData.sourceSkinID &&
                                       existing.components && skinData.components &&
                                       existing.components.length === skinData.components.length;
                            });

                            if (isDuplicate) {
                                skippedSkins++;
                                continue;
                            }

                            const newKey = generateCopiedSkinKey(skinData.name || 'Imported Skin');
                            existingSkins[newKey] = skinData;
                            skinCount++;
                        }

                        await saveCopiedSkins(existingSkins);
                    }

                    snippetsData = null; // Force reload

                    if (sidebarElement) {
                        refreshSidebar();
                        let msg = `Imported ${count} snippet(s)`;
                        if (skinCount > 0) msg += `, ${skinCount} skin(s)`;
                        if (skippedDuplicates > 0 || skippedSkins > 0) {
                            msg += ` (${skippedDuplicates + skippedSkins} duplicate(s) skipped)`;
                        }
                        showToast(sidebarElement, msg);
                    }
                } catch (err) {
                    console.error(TOOLKIT_NAME + ' Import error:', err);
                    alert('Failed to import snippets. Please check the file format.');
                }
            });

            input.click();
        }

        // Export user snippets and copied skins to JSON file
        async function exportSnippets() {
            const [userSnippets, copiedSkins] = await Promise.all([
                loadUserSnippets(),
                loadCopiedSkins()
            ]);
            const snippetCount = Object.keys(userSnippets).length;
            const skinCount = Object.keys(copiedSkins).length;

            if (snippetCount === 0 && skinCount === 0) {
                alert('No user snippets or copied skins to export.');
                return;
            }

            // Clean up snippets for export (remove isUserSnippet flag)
            const exportData = {};
            for (const [key, snippet] of Object.entries(userSnippets)) {
                const exportSnippet = {
                    name: snippet.name,
                    category: snippet.category
                };

                // Include code if present
                if (snippet.code) {
                    exportSnippet.code = snippet.code;
                }

                // Include components if present (multi-component snippet)
                if (snippet.components && Object.keys(snippet.components).length > 0) {
                    exportSnippet.components = snippet.components;
                }

                // Include dynamicSelector flag if true
                if (snippet.dynamicSelector === true) {
                    exportSnippet.dynamicSelector = true;
                }

                // Include alwaysShow flag if true
                if (snippet.alwaysShow === true) {
                    exportSnippet.alwaysShow = true;
                }

                exportData[key] = exportSnippet;
            }

            // Include copied skins (keys start with "skin-")
            for (const [key, skinData] of Object.entries(copiedSkins)) {
                exportData[key] = skinData;
            }

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'cp-toolkit-snippets.json';
            a.click();

            URL.revokeObjectURL(url);

            if (sidebarElement) {
                let msg = `Exported ${snippetCount} snippet(s)`;
                if (skinCount > 0) msg += `, ${skinCount} skin(s)`;
                showToast(sidebarElement, msg);
            }
        }

        // Refresh sidebar content
        async function refreshSidebar() {
            if (!sidebarElement) return;

            const [snippets, copiedSkins, snippetOrder] = await Promise.all([
                loadSnippets(true),
                loadCopiedSkins(),
                loadSnippetOrder()
            ]);
            const content = sidebarElement.querySelector('.snippets-sidebar-content');
            content.innerHTML = buildSidebarContent(snippets, copiedSkins, snippetOrder);

            // Re-attach event listeners
            attachSidebarEventListeners(sidebarElement, snippets);
            attachCopiedSkinEventListeners(sidebarElement, copiedSkins);
        }

        // Attach event listeners to sidebar items
        function attachSidebarEventListeners(sidebar, snippets) {
            const content = sidebar.querySelector('.snippets-sidebar-content');
            const items = content.querySelectorAll('.snippet-item');

            // Item expand/collapse - these are new elements each time, so listeners are fine
            items.forEach(item => {
                const header = item.querySelector('.snippet-item-header');
                header.addEventListener('click', function(e) {
                    if (e.target.closest('.snippet-edit-btn') || e.target.closest('.snippet-delete-btn') || e.target.closest('.snippet-drag-handle') || e.target.closest('.snippet-header-delete-btn')) {
                        return;
                    }
                    e.stopPropagation();
                    items.forEach(other => {
                        if (other !== item) other.classList.remove('expanded');
                    });
                    item.classList.toggle('expanded');
                });
            });

            // Drag-and-drop reordering - per-item handlers (re-added each refresh)
            items.forEach(item => {
                const handle = item.querySelector('.snippet-drag-handle');
                if (handle) {
                    handle.addEventListener('mousedown', () => {
                        if (!sidebar.classList.contains('edit-mode')) return;
                        content._dragActivatedItem = item;
                        item.setAttribute('draggable', 'true');
                    });
                }

                item.addEventListener('dragstart', (e) => {
                    if (content._dragActivatedItem !== item) {
                        e.preventDefault();
                        return;
                    }
                    item.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', item.dataset.snippetKey);
                });

                item.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    const dragging = content.querySelector('.snippet-item.dragging');
                    if (!dragging || dragging === item) return;
                    e.dataTransfer.dropEffect = 'move';

                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    item.classList.remove('drag-over-top', 'drag-over-bottom');
                    if (e.clientY < midY) {
                        item.classList.add('drag-over-top');
                    } else {
                        item.classList.add('drag-over-bottom');
                    }
                });

                item.addEventListener('dragleave', () => {
                    item.classList.remove('drag-over-top', 'drag-over-bottom');
                });

                item.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    item.classList.remove('drag-over-top', 'drag-over-bottom');
                    const dragging = content.querySelector('.snippet-item.dragging');
                    if (!dragging || dragging === item) return;

                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        item.parentNode.insertBefore(dragging, item);
                    } else {
                        item.parentNode.insertBefore(dragging, item.nextSibling);
                    }

                    // Save new order from current DOM order
                    const newOrder = [];
                    content.querySelectorAll('.snippet-item[data-snippet-key]').forEach(el => {
                        newOrder.push(el.dataset.snippetKey);
                    });
                    await saveSnippetOrder(newOrder);
                });

                item.addEventListener('dragend', () => {
                    item.classList.remove('dragging');
                    item.setAttribute('draggable', 'false');
                    content._dragActivatedItem = null;
                    content.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
                        el.classList.remove('drag-over-top', 'drag-over-bottom');
                    });
                });
            });

            // Copy, Edit, Delete buttons - use event delegation on content
            // Only add this listener once (check if already attached)
            if (content.dataset.clickListenerAttached === 'true') {
                // Update the snippets reference for the existing listener
                content._snippetsRef = snippets;
                return;
            }

            content._snippetsRef = snippets;
            content.dataset.clickListenerAttached = 'true';

            content.addEventListener('click', async function(e) {
                const copyBtn = e.target.closest('.snippet-copy-btn');
                const editBtn = e.target.closest('.snippet-edit-btn');
                const deleteBtn = e.target.closest('.snippet-delete-btn');
                const headerDeleteBtn = e.target.closest('.snippet-header-delete-btn');
                const currentSnippets = content._snippetsRef;
                const currentSkinId = sidebar.dataset.skinId || '000';

                if (copyBtn) {
                    e.stopPropagation();
                    const snippetKey = copyBtn.getAttribute('data-key');
                    const snippet = currentSnippets[snippetKey];

                    if (!snippet) return;

                    // Check if this is a multi-component snippet
                    const hasComponents = snippet.components && Object.keys(snippet.components).length > 0;

                    if (hasComponents) {
                        // Multi-component snippet: insert into each component section
                        // Check if we're in a widget skin modal (component select exists)
                        const componentSelect = document.querySelector('.cpPopOver #widgetSkinComponentTypeID');
                        if (!componentSelect) {
                            showToast(sidebar, 'Please open a widget skin to insert multi-component snippets');
                            return;
                        }

                        // Get any textarea in the modal to pass to the insert function
                        const currentTextarea = document.querySelector('.cpPopOver #MiscellaneousStyles') ||
                                               document.querySelector('#MiscellaneousStyles');

                        // Insert into all component sections
                        await insertMultiComponentSnippet(snippet, currentSkinId, currentTextarea, snippet.dynamicSelector);
                        showToast(sidebar, `Inserted "${snippet.name}" into ${Object.keys(snippet.components).length} component(s)`);
                    } else if (snippet.code) {
                        // Single-code snippet
                        // If it has dynamic selectors, insert directly into textarea
                        if (snippet.dynamicSelector) {
                            // Find the current textarea
                            const currentTextarea = document.querySelector('.cpPopOver #MiscellaneousStyles') ||
                                                   document.querySelector('.cpPopOver #HeaderMiscellaneousStyles1') ||
                                                   document.querySelector('.cpPopOver #LinkNormalMiscellaneousStyles') ||
                                                   document.querySelector('.cpPopOver textarea.widgetSkin[id$="MiscellaneousStyles"]') ||
                                                   document.querySelector('#MiscellaneousStyles') ||
                                                   document.querySelector('textarea.sitestyleupdate') ||
                                                   document.querySelector('#SearchBoxStyles');

                            if (!currentTextarea) {
                                showToast(sidebar, 'Please open an Advanced Styles section to insert this snippet');
                                return;
                            }

                            // Process skin IDs first, then dynamic selectors
                            let processedCode = processSidebarSnippet(snippet.code, currentSkinId);
                            processedCode = processQuickSnippet(processedCode, currentTextarea);

                            insertCodeAtCursor(currentTextarea, processedCode);
                            showToast(sidebar, `Inserted "${snippet.name}"`);
                        } else {
                            // Regular snippet: copy to clipboard
                            const processedCode = processSidebarSnippet(snippet.code, currentSkinId);
                            navigator.clipboard.writeText(processedCode).then(() => {
                                showToast(sidebar, `Copied "${snippet.name}" to clipboard!`);
                            }).catch(err => {
                                console.error(TOOLKIT_NAME + ' Failed to copy:', err);
                                showToast(sidebar, 'Failed to copy snippet');
                            });
                        }
                    }
                }

                if (editBtn) {
                    e.stopPropagation();
                    const snippetKey = editBtn.getAttribute('data-key');
                    const snippet = currentSnippets[snippetKey];
                    if (snippet) {
                        showSnippetModal(snippetKey, snippet);
                    }
                }

                if (deleteBtn) {
                    e.stopPropagation();
                    const snippetKey = deleteBtn.getAttribute('data-key');
                    const snippet = currentSnippets[snippetKey];
                    if (snippet && confirm(`Delete "${snippet.name}"?`)) {
                        await deleteUserSnippet(snippetKey);
                        refreshSidebar();
                        showToast(sidebar, `Deleted "${snippet.name}"`);
                    }
                }

                if (headerDeleteBtn) {
                    e.stopPropagation();
                    const snippetKey = headerDeleteBtn.getAttribute('data-key');
                    const snippet = currentSnippets[snippetKey];
                    if (snippet && confirm(`Delete "${snippet.name}"?`)) {
                        await deleteUserSnippet(snippetKey);
                        refreshSidebar();
                        showToast(sidebar, `Deleted "${snippet.name}"`);
                    }
                }

                // Delete All button
                var deleteAllBtn = e.target.closest('.snippets-delete-all');
                if (deleteAllBtn) {
                    e.stopPropagation();
                    if (!confirm('Delete ALL user snippets and copied skins? This cannot be undone.')) return;
                    await saveUserSnippets({});
                    await saveCopiedSkins({});
                    await saveSnippetOrder([]);
                    refreshSidebar();
                    showToast(sidebar, 'All user data deleted');
                }
            });
        }

        // Attach event listeners to copied skin items in sidebar
        function attachCopiedSkinEventListeners(sidebar, copiedSkins) {
            const content = sidebar.querySelector('.snippets-sidebar-content');

            if (content.dataset.skinClickListenerAttached === 'true') {
                content._copiedSkinsRef = copiedSkins;
                return;
            }

            content._copiedSkinsRef = copiedSkins;
            content.dataset.skinClickListenerAttached = 'true';

            content.addEventListener('click', async function(e) {
                // Toggle collapse on header click
                var header = e.target.closest('.copied-skins-header');
                if (header) {
                    var section = header.closest('.copied-skins-section');
                    if (section) section.classList.toggle('collapsed');
                    return;
                }

                var deleteBtn = e.target.closest('.copied-skin-delete-btn');
                var skinItem = e.target.closest('.copied-skin-item');
                var currentSkins = content._copiedSkinsRef;

                if (deleteBtn) {
                    e.stopPropagation();
                    var skinKey = deleteBtn.getAttribute('data-skin-key');
                    var skin = currentSkins[skinKey];
                    if (skin && confirm('Delete saved skin "' + skin.name + '"?')) {
                        await deleteCopiedSkin(skinKey);
                        refreshSidebar();
                        showToast(sidebar, 'Deleted "' + skin.name + '"');
                    }
                    return;
                }

                if (skinItem) {
                    // Don't open apply modal when clicking the source link
                    if (e.target.closest('.copied-skin-source-link')) return;
                    e.stopPropagation();
                    var skinKey = skinItem.getAttribute('data-skin-key');
                    var skin = currentSkins[skinKey];
                    if (skin) {
                        showApplySkinModal(skinKey, skin);
                    }
                }
            });
        }

        // Close the sidebar and clean up
        function closeSidebar() {
            if (!sidebarElement) return;
            sidebarElement.classList.remove('open');
            sidebarElement.classList.remove('edit-mode');
            // Clear content to keep DOM clean
            const content = sidebarElement.querySelector('.snippets-sidebar-content');
            if (content) content.innerHTML = '';
            // Reset edit button
            const editBtn = sidebarElement.querySelector('.snippets-edit-mode-btn');
            if (editBtn) {
                editBtn.classList.remove('active');
                editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Edit';
            }
            // Clear search
            const searchInput = sidebarElement.querySelector('.snippets-sidebar-search input');
            if (searchInput) searchInput.value = '';
        }

        // Open the sidebar
        function openSidebar(textarea) {
            const skinId = getSkinId(textarea);
            const sidebar = createSidebar();
            sidebar.dataset.skinId = skinId;

            // Check if action button listeners have already been added
            const listenersAttached = sidebar.dataset.listenersAttached === 'true';

            Promise.all([loadSnippets(), loadCopiedSkins(), loadSnippetOrder()]).then(function(results) {
                const snippets = results[0];
                const copiedSkins = results[1];
                const snippetOrder = results[2];
                const content = sidebar.querySelector('.snippets-sidebar-content');
                content.innerHTML = buildSidebarContent(snippets, copiedSkins, snippetOrder);

                const searchInput = sidebar.querySelector('.snippets-sidebar-search input');

                // Attach item event listeners
                attachSidebarEventListeners(sidebar, snippets);
                attachCopiedSkinEventListeners(sidebar, copiedSkins);

                // Only add action button listeners once
                if (!listenersAttached) {
                    // Search filtering
                    searchInput.addEventListener('input', function(e) {
                        const query = e.target.value.toLowerCase().trim();

                        // Filter snippet items
                        const items = content.querySelectorAll('.snippet-item');
                        items.forEach(item => {
                            const name = item.querySelector('.snippet-item-name').textContent.toLowerCase();
                            const category = item.querySelector('.snippet-item-category').textContent.toLowerCase();
                            const matches = query === '' || name.includes(query) || category.includes(query);
                            item.style.display = matches ? '' : 'none';
                        });

                        // Filter copied skin items
                        const skinItems = content.querySelectorAll('.copied-skin-item');
                        let anySkinVisible = false;
                        skinItems.forEach(function(item) {
                            const name = item.querySelector('.copied-skin-name').textContent.toLowerCase();
                            const matches = query === '' || name.includes(query) || 'skin'.includes(query);
                            item.style.display = matches ? '' : 'none';
                            if (matches) anySkinVisible = true;
                        });

                        // Show/hide copied skins section header
                        const skinSection = content.querySelector('.copied-skins-section');
                        if (skinSection) {
                            const sectionHeader = skinSection.querySelector('.copied-skins-header');
                            if (sectionHeader) {
                                sectionHeader.style.display = (query === '' || anySkinVisible) ? '' : 'none';
                            }
                        }

                    });

                    // Action buttons
                    sidebar.querySelector('.snippets-add-btn').addEventListener('click', () => {
                        showSnippetModal();
                    });

                    sidebar.querySelector('.snippets-import-btn').addEventListener('click', () => {
                        importSnippets();
                    });

                    sidebar.querySelector('.snippets-export-btn').addEventListener('click', () => {
                        exportSnippets();
                    });

                    sidebar.querySelector('.snippets-save-skin-btn').addEventListener('click', () => {
                        showSaveSkinModal();
                    });

                    // Edit mode toggle
                    sidebar.querySelector('.snippets-edit-mode-btn').addEventListener('click', function() {
                        const isEditMode = sidebar.classList.toggle('edit-mode');
                        this.classList.toggle('active', isEditMode);
                        this.innerHTML = isEditMode
                            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Done'
                            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Edit';
                    });

                    // Full page button — must go through service worker since content scripts
                    // can't open chrome-extension:// URLs directly
                    sidebar.querySelector('.snippets-sidebar-fullscreen').addEventListener('click', function() {
                        if (chrome.runtime?.id) {
                            chrome.runtime.sendMessage({ action: 'cp-open-extension-page', page: 'html/snippets.html' });
                        }
                    });

                    // Close button
                    sidebar.querySelector('.snippets-sidebar-close').addEventListener('click', function() {
                        closeSidebar();
                    });

                    // Mark listeners as attached
                    sidebar.dataset.listenersAttached = 'true';
                }

                // Open sidebar
                setTimeout(() => sidebar.classList.add('open'), 10);
                searchInput.focus();
            });
        }

        // Close sidebar when clicking outside (but not when a modal is open)
        document.addEventListener('click', function(e) {
            if (sidebarElement && sidebarElement.classList.contains('open')) {
                // Don't close if a modal is open (toolkit or CMS)
                if (document.querySelector('.snippet-modal-overlay') ||
                    e.target.closest('.modalContainerCP')) return;
                if (!sidebarElement.contains(e.target)) {
                    closeSidebar();
                }
            }
        });

        // ==================== INIT FOR EACH EDITOR ====================

        async function initSnippetsForEditor(codeToggle, codePopup, textarea) {
            // Setup simple dropdown (hover) and sidebar (click)
            codePopup.innerHTML = await buildDropdownHTML(textarea);
            codePopup.classList.add('css-snippet-dropdown');

            // Track hover state for both toggle and popup
            let hoverTimeout = null;

            async function showDropdown() {
                clearTimeout(hoverTimeout);

                // Close any other open dropdowns
                document.querySelectorAll('.css-code-popup.visible').forEach(popup => {
                    if (popup !== codePopup) {
                        popup.classList.remove('visible');
                    }
                });

                // Rebuild dropdown to detect current context (in case user switched tabs)
                codePopup.innerHTML = await buildDropdownHTML(textarea);

                // Copy theme from wrapper
                const wrapper = codeToggle.closest('.css-editor-wrapper');
                if (wrapper) {
                    const theme = wrapper.getAttribute('data-theme') || 'light';
                    codePopup.setAttribute('data-theme', theme);
                }

                codePopup.classList.add('visible');
            }

            function hideDropdown() {
                hoverTimeout = setTimeout(() => {
                    codePopup.classList.remove('visible');
                }, 150);
            }

            // Hover on toggle button shows dropdown
            codeToggle.addEventListener('mouseenter', function() {
                showDropdown();
            });
            codeToggle.addEventListener('mouseleave', function() {
                hideDropdown();
            });

            // Keep dropdown open while hovering over it
            codePopup.addEventListener('mouseenter', function() {
                clearTimeout(hoverTimeout);
            });
            codePopup.addEventListener('mouseleave', function() {
                hideDropdown();
            });

            // Click opens sidebar (both left and right click)
            codeToggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                // Close dropdown if open
                codePopup.classList.remove('visible');

                // Open sidebar
                openSidebar(textarea);
            });

            codeToggle.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                e.stopPropagation();

                // Close dropdown if open
                codePopup.classList.remove('visible');

                // Open sidebar
                openSidebar(textarea);
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', function(e) {
                if (!codeToggle.contains(e.target) && !codePopup.contains(e.target)) {
                    codePopup.classList.remove('visible');
                }
            });

            // Handle snippet selection (dropdown)
            codePopup.addEventListener('click', async function(e) {
                // Check for library snippet (data-library-key)
                const libraryItem = e.target.closest('li[data-library-key]');
                if (libraryItem) {
                    e.preventDefault();
                    e.stopPropagation();

                    const snippetKey = libraryItem.getAttribute('data-library-key');
                    const isDynamic = libraryItem.getAttribute('data-dynamic') === 'true';

                    try {
                        const snippets = await loadSnippets();
                        const snippet = snippets[snippetKey];
                        const skinId = getSkinId(textarea);

                        if (snippet) {
                            // Check if snippet has multiple components
                            if (snippet.components && Object.keys(snippet.components).length > 0) {
                                // Multi-component snippet - insert into appropriate textareas
                                await insertMultiComponentSnippet(snippet, skinId, textarea, snippet.dynamicSelector);
                            } else if (snippet.code) {
                                // Process skin IDs first
                                let processedCode = processSidebarSnippet(snippet.code, skinId);

                                // If snippet has dynamic selectors enabled, also process template variables
                                if (snippet.dynamicSelector || isDynamic) {
                                    processedCode = processQuickSnippet(processedCode, textarea);
                                }

                                insertCodeAtCursor(textarea, processedCode);
                            }
                        }
                    } catch (err) {
                        console.error(TOOLKIT_NAME + ' Failed to load snippet:', err);
                    }

                    codePopup.classList.remove('visible');
                    return;
                }
            });

            console.log(TOOLKIT_NAME + ' Initialized for textarea');
        }

        // Insert a multi-component snippet into the appropriate textareas
        // Each component's code goes into the matching component type textarea
        // This automatically switches between components and opens Advanced Styles as needed
        async function insertMultiComponentSnippet(snippet, skinId, currentTextarea, dynamicSelector = false) {
            const components = snippet.components;
            const componentIds = Object.keys(components);
            let insertedCount = 0;

            // Get the current component type from the dropdown
            const componentSelect = document.querySelector('.cpPopOver #widgetSkinComponentTypeID');
            const originalComponentId = componentSelect ? componentSelect.value : null;

            if (!componentSelect) {
                console.warn(TOOLKIT_NAME + ' Could not find component selector');
                // Fall back to inserting first available component only
                const firstCompId = componentIds[0];
                if (firstCompId && components[firstCompId]) {
                    let processedCode = processSidebarSnippet(components[firstCompId], skinId);
                    if (dynamicSelector) {
                        processedCode = processQuickSnippet(processedCode, currentTextarea);
                    }
                    insertCodeAtCursor(currentTextarea, processedCode);
                }
                return insertedCount;
            }

            // For each component in the snippet, switch to it and insert code
            let lastInsertedCompId = null;

            for (const compId of componentIds) {
                const code = components[compId];
                if (!code) continue;

                // Process skin IDs first
                let processedCode = processSidebarSnippet(code, skinId);

                // Always switch to the target component to ensure we're in the right section
                const targetTextarea = await switchToComponentAndGetTextarea(compId);

                if (targetTextarea) {
                    // Process dynamic selectors for this component's textarea
                    if (dynamicSelector) {
                        processedCode = processQuickSnippet(processedCode, targetTextarea);
                    }
                    if (insertCodeAtCursor(targetTextarea, processedCode)) {
                        insertedCount++;
                        lastInsertedCompId = compId;
                        console.log(TOOLKIT_NAME + ` Inserted code into component ${compId}`);
                    }
                } else {
                    console.warn(TOOLKIT_NAME + ` Could not find textarea for component ${compId}`);
                }
            }

            // Switch back to original component only if we ended on a different one
            if (originalComponentId && componentSelect && lastInsertedCompId !== originalComponentId) {
                componentSelect.value = originalComponentId;
                componentSelect.dispatchEvent(new Event('change', { bubbles: true }));
                // Wait for UI to update and re-open advanced styles
                await new Promise(resolve => setTimeout(resolve, 150));
                await switchToComponentAndGetTextarea(originalComponentId);
            }

            console.log(TOOLKIT_NAME + ` Inserted snippet into ${insertedCount} component(s)`);
            return insertedCount;
        }

        // Switch to a specific component type and return its textarea
        // This simulates selecting the component from the dropdown, opens the Advanced tab,
        // and expands the Advanced Styles section
        async function switchToComponentAndGetTextarea(componentId) {
            const componentSelect = document.querySelector('.cpPopOver #widgetSkinComponentTypeID');
            if (!componentSelect) return null;

            // Change the component type
            componentSelect.value = componentId;
            componentSelect.dispatchEvent(new Event('change', { bubbles: true }));

            // Wait for the UI to update (longer delay for component switch)
            await new Promise(resolve => setTimeout(resolve, 600));

            // Verify the component was actually switched
            if (componentSelect.value !== String(componentId)) {
                console.warn(TOOLKIT_NAME + ` Component ${componentId} may not exist in dropdown`);
            }

            // Click on the "Advanced" tab to switch to it
            // Different components use different tab hrefs:
            // - Most components: #widgetSkinMiscTab
            // - Link components (7-10): #linkMisc
            let advancedTab = document.querySelector('.cpPopOver .cpTabs a[href="#widgetSkinMiscTab"]');
            let miscTabId = '#widgetSkinMiscTab';
            if (!advancedTab) {
                advancedTab = document.querySelector('.cpPopOver .cpTabs a[href="#linkMisc"]');
                miscTabId = '#linkMisc';
            }

            if (advancedTab) {
                advancedTab.click();
                // Wait for tab content to load
                await new Promise(resolve => setTimeout(resolve, 600));
            } else {
                console.warn(TOOLKIT_NAME + ` Advanced tab not found for component ${componentId}`);
                return null;
            }

            // Check if the misc tab content is visible
            const miscTabContent = document.querySelector('.cpPopOver ' + miscTabId);
            if (!miscTabContent || miscTabContent.offsetParent === null) {
                console.warn(TOOLKIT_NAME + ` Misc tab content not visible for component ${componentId}`);
            }

            // Try to find the textarea with retries, expanding the Advanced Styles section if needed
            let textarea = null;
            for (let attempt = 0; attempt < 5; attempt++) {
                // Try multiple selectors - different components have different textarea IDs:
                // - Most components: #MiscellaneousStyles
                // - Header: #HeaderMiscellaneousStyles1
                // - Links: #LinkNormalMiscellaneousStyles
                textarea = document.querySelector('.cpPopOver #MiscellaneousStyles');
                if (!textarea) {
                    textarea = document.querySelector('#MiscellaneousStyles');
                }
                // For Header component - use the first one (Normal section)
                if (!textarea) {
                    textarea = document.querySelector('.cpPopOver #HeaderMiscellaneousStyles1');
                }
                // For Link components - use the first one (Normal/Link state)
                if (!textarea) {
                    textarea = document.querySelector('.cpPopOver #LinkNormalMiscellaneousStyles');
                }
                // Fallback: find the first visible textarea with widgetSkin class in the misc tab
                if (!textarea && miscTabContent) {
                    const allTextareas = miscTabContent.querySelectorAll('textarea.widgetSkin');
                    for (const ta of allTextareas) {
                        // Check if textarea is visible (parent expand box is displayed)
                        if (ta.offsetParent !== null) {
                            textarea = ta;
                            break;
                        }
                    }
                }

                if (textarea) {
                    console.log(TOOLKIT_NAME + ` Found textarea ${textarea.id} on attempt ${attempt + 1}`);
                    break;
                }

                // Textarea not found - try clicking the toggle to expand
                if (attempt <= 2) {
                    // Find the Advanced Styles toggle - try multiple selectors
                    // For Header: look for h4.cpExpandCollapseControl (Normal/Hover sections)
                    // For Links: look for p.cpExpandCollapseControl
                    const advancedStylesToggle = document.querySelector('.cpPopOver ' + miscTabId + ' p#ExternalIDStyle') ||
                                                 document.querySelector('.cpPopOver ' + miscTabId + ' h4.cpExpandCollapseControl') ||
                                                 document.querySelector('.cpPopOver ' + miscTabId + ' p.cpExpandCollapseControl') ||
                                                 document.querySelector('.cpPopOver ' + miscTabId + ' .cpExpandCollapseControl');
                    if (advancedStylesToggle) {
                        console.log(TOOLKIT_NAME + ` Clicking toggle to expand (attempt ${attempt + 1})`);
                        advancedStylesToggle.click();
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } else if (attempt === 0) {
                        console.warn(TOOLKIT_NAME + ` No toggle found for component ${componentId} in ${miscTabId}`);
                    }
                }

                // Wait and retry
                await new Promise(resolve => setTimeout(resolve, 400));
            }

            if (!textarea) {
                console.warn(TOOLKIT_NAME + ` Could not find textarea after 5 attempts for component ${componentId}`);
            }

            return textarea;
        }

        // Character limit for CMS textareas
        const MAX_CHAR_LIMIT = 1000;

        // Helper function to insert code at cursor position with smart spacing
        // Handles parent selector zone insertion for snippets that start with properties
        // Returns true if successful, false if character limit exceeded
        function insertCodeAtCursor(textarea, code) {
            const currentValue = textarea.value;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;

            // Check if the snippet starts with CSS properties (no selector, no closing brace)
            // This indicates the properties belong to the parent CMS selector
            const trimmedCode = code.trimStart();
            const startsWithProperty = /^[a-z\-]+\s*:/i.test(trimmedCode);

            // Special handling: if snippet starts with properties and textarea has a }
            // Insert leading properties into the "parent selector zone" (before first })
            if (startsWithProperty && currentValue.includes('}')) {
                const snippetFirstBraceIdx = code.indexOf('}');

                // Split snippet into parent selector properties and child selectors
                let leadingProperties, afterSnippetBrace;

                if (snippetFirstBraceIdx !== -1) {
                    // Snippet has a } - split at that point
                    leadingProperties = code.substring(0, snippetFirstBraceIdx).trim();
                    // Keep the } - it will close any unclosed selectors in the existing content
                    // (The textarea's } closes the parent, the snippet's } closes user's child selectors)
                    afterSnippetBrace = code.substring(snippetFirstBraceIdx);
                } else {
                    // No } in snippet - entire snippet is parent selector properties
                    leadingProperties = code.trim();
                    afterSnippetBrace = '';
                }

                // Only do special handling if there are actual leading properties
                if (leadingProperties.length > 0) {
                    // Find the first } in the textarea (end of parent selector zone)
                    const textareaFirstBraceIdx = currentValue.indexOf('}');

                    // Content before and after the first } in textarea
                    const beforeBrace = currentValue.substring(0, textareaFirstBraceIdx);
                    const afterBrace = currentValue.substring(textareaFirstBraceIdx); // Includes the }

                    // Build new content:
                    // 1. Existing content before first } (parent selector properties)
                    // 2. Our leading properties (also for parent selector)
                    // 3. The first } and everything after (existing child selectors)
                    // 4. Rest of our snippet (new child selectors)

                    let newContent = beforeBrace;

                    // Add newline before our properties if needed
                    if (newContent.length > 0 && !newContent.endsWith('\n')) {
                        newContent += '\n';
                    }

                    newContent += leadingProperties;

                    // Add newline before the closing brace
                    if (leadingProperties.length > 0 && !leadingProperties.endsWith('\n')) {
                        newContent += '\n';
                    }

                    newContent += afterBrace;

                    // Add the rest of the snippet (starts with } to close unclosed selectors)
                    if (afterSnippetBrace.length > 0) {
                        // Add newline before the closing brace if existing content doesn't end with one
                        if (!newContent.endsWith('\n')) {
                            newContent += '\n';
                        }
                        newContent += afterSnippetBrace;
                    }

                    // Check character limit
                    if (newContent.length > MAX_CHAR_LIMIT) {
                        const needed = newContent.length;
                        alert(`Cannot paste snippet: exceeds ${MAX_CHAR_LIMIT} character limit.\n\nResult would be ${needed} characters, but limit is ${MAX_CHAR_LIMIT}.`);
                        return false;
                    }

                    textarea.value = newContent;

                    // Position cursor at end
                    textarea.selectionStart = newContent.length;
                    textarea.selectionEnd = newContent.length;
                    textarea.focus();

                    // Dispatch events to notify CMS of change
                    dispatchChangeEvents(textarea, newContent.length);

                    return true;
                }
            }

            // Normal insertion: at cursor with smart spacing
            const textBefore = currentValue.substring(0, start);

            // Check if we need to add a newline before the code
            let prefix = '';
            if (textBefore.length > 0) {
                const lastChar = textBefore[textBefore.length - 1];
                if (lastChar !== '\n') {
                    prefix = '\n';
                }
            }

            // Build the final code to insert
            const finalCode = prefix + code;

            // Calculate new length (current - selected text + new code)
            const selectedLength = end - start;
            const newTotalLength = currentValue.length - selectedLength + finalCode.length;

            // Check character limit
            if (newTotalLength > MAX_CHAR_LIMIT) {
                const available = MAX_CHAR_LIMIT - (currentValue.length - selectedLength);
                const needed = finalCode.length;
                alert(`Cannot paste snippet: exceeds ${MAX_CHAR_LIMIT} character limit.\n\nSnippet needs ${needed} characters, but only ${Math.max(0, available)} available.`);
                return false;
            }

            // Insert the code
            textarea.value = currentValue.substring(0, start) + finalCode + currentValue.substring(end);

            // Position cursor at the end of inserted code
            const newPosition = start + finalCode.length;
            textarea.selectionStart = newPosition;
            textarea.selectionEnd = newPosition;
            textarea.focus();

            // Dispatch events to notify CMS of change
            dispatchChangeEvents(textarea, newPosition);

            return true;
        }

        // Helper to dispatch events that notify the CMS of textarea changes
        function dispatchChangeEvents(textarea, cursorPosition) {
            // Dispatch multiple events to ensure CMS recognizes the change
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));

            // Also dispatch keyboard events to simulate typing
            textarea.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }));
            textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));

            // Trigger blur and focus to help some frameworks detect changes
            textarea.blur();
            textarea.focus();
            textarea.selectionStart = cursorPosition;
            textarea.selectionEnd = cursorPosition;
        }

        // Expose global API
        window.CPToolkit = window.CPToolkit || {};
        window.CPToolkit.cssSnippets = {
            init: initSnippetsForEditor,
            loadSnippets: loadSnippets
        };

        // Listen for messages from the popup to open the sidebar
        if (chrome.runtime?.id) chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
            if (message && message.action === 'openSnippetsSidebar') {
                openSidebar(null);
                sendResponse({ success: true });
            }
        });

        console.log(TOOLKIT_NAME + ' Ready');
    }
})();
