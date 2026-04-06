(function loadTool() {
  var thisTool = "mini-ide";
  chrome.storage.local.get(thisTool, function(settings) {
    if (chrome.runtime.lastError) {
      console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
      return;
    }
    detect_if_cp_site(function() {
      if (settings[thisTool] !== false) {
        console.log("[CP Toolkit] Loaded " + thisTool);
        try {
(function() {
    'use strict';

    const TOOLKIT_NAME = '[CivicPlus CSS Editor]';

    // ==================== THEME SYSTEM (PHASE 2) ====================
    const THEMES = ['light', 'dark', 'no-styles'];
    const THEME_STORAGE_KEY = 'css-editor-theme';
    const DEFAULT_THEME = 'light';
    const PSEUDO_MODE_STORAGE_KEY = 'theme-manager-enhancer-pseudo-mode';
    const PSEUDO_MODE_DEFAULT = 'legacy-fix';
    const PSEUDO_MODES = ['legacy-fix', 'cms-default', 'off'];
    const PSEUDO_MODE_LABELS = {
        'legacy-fix': 'Safe layout bounds',
        'cms-default': 'CMS default bounds',
        'off': 'Override off'
    };
    const PSEUDO_MODE_SHORT_LABELS = {
        'legacy-fix': '::0',
        'cms-default': '::-2',
        'off': '::x'
    };
    let pseudoModeCache = null;
    let pseudoModeStorageListenerBound = false;

    /**
     * Get saved theme from localStorage or return default
     */
    function getSavedTheme() {
        try {
            const saved = localStorage.getItem(THEME_STORAGE_KEY);
            // Validate saved theme is one of our valid themes
            if (saved && THEMES.includes(saved)) {
                return saved;
            }
            return DEFAULT_THEME;
        } catch (e) {
            console.warn(TOOLKIT_NAME + ' localStorage not available:', e);
            return DEFAULT_THEME;
        }
    }

    /**
     * Save theme preference to localStorage
     */
    function saveTheme(theme) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
            // console.log(TOOLKIT_NAME + ' Theme saved:', theme); // Phase 3: Reduced logging
        } catch (e) {
            console.warn(TOOLKIT_NAME + ' Failed to save theme:', e);
        }
    }

    /**
     * Apply theme to all CSS editor wrappers on the page
     */
    function applyGlobalTheme(theme) {
        if (!THEMES.includes(theme)) {
            console.warn(TOOLKIT_NAME + ' Invalid theme:', theme);
            theme = DEFAULT_THEME;
        }

        const wrappers = document.querySelectorAll('.css-editor-wrapper');
        // console.log(TOOLKIT_NAME + ' Applying theme "' + theme + '" to ' + wrappers.length + ' editor(s)'); // Phase 3: Reduced logging

        wrappers.forEach(wrapper => {
            // Set data-theme attribute
            wrapper.setAttribute('data-theme', theme);
            
            // Remove old theme classes
            wrapper.classList.remove('theme-light', 'theme-dark', 'theme-no-styles');
            
            // Add new theme class
            wrapper.classList.add('theme-' + theme);
        });

        // Save to localStorage
        saveTheme(theme);
    }

    /**
     * Cycle to next theme in sequence: light → dark → no-styles → light
     */
    function cycleTheme() {
        const current = getSavedTheme();
        const currentIndex = THEMES.indexOf(current);
        const nextIndex = (currentIndex + 1) % THEMES.length;
        const nextTheme = THEMES[nextIndex];
        
        // console.log(TOOLKIT_NAME + ' Cycling theme: ' + current + ' → ' + nextTheme); // Phase 3: Reduced logging
        applyGlobalTheme(nextTheme);
    }

    /**
     * Initialize theme system - restore saved theme on page load
     */
    function initializeTheme() {
        const savedTheme = getSavedTheme();
        // console.log(TOOLKIT_NAME + ' Theme system initialized. Saved theme:', savedTheme); // Phase 3: Reduced logging
        // Note: Theme is now applied to each editor as it's created (see createCSSEditor)
    }

    // ==================== SITE DETECTION ====================
    async function isCivicPlusSite() {
        // console.log(TOOLKIT_NAME + ' Detecting if this site is a CivicPlus site. If not, a 404 error below is normal.'); // Phase 3: Reduced logging
        return new Promise((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('HEAD', '/Assets/Mystique/Shared/Components/ModuleTiles/Templates/cp-Module-Tile.html');
            xhr.onload = function() {
                resolve(xhr.status === 200);
            };
            xhr.onerror = () => resolve(false);
            xhr.send();
        });
    }

    function pageMatches(patterns) {
        const url = window.location.href.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        return patterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
            return regex.test(url) || regex.test(pathname);
        });
    }

    function isThemeManagerPage() {
        return pageMatches(['/designcenter/themes/']);
    }

    function sanitizePseudoMode(mode) {
        return PSEUDO_MODES.includes(mode) ? mode : PSEUDO_MODE_DEFAULT;
    }

    function getNextPseudoMode(mode) {
        const normalizedMode = sanitizePseudoMode(mode);
        const currentIndex = PSEUDO_MODES.indexOf(normalizedMode);
        const nextIndex = (currentIndex + 1) % PSEUDO_MODES.length;
        return PSEUDO_MODES[nextIndex];
    }

    function applyPseudoModeToButton(button, mode) {
        if (!button) return;

        const normalizedMode = sanitizePseudoMode(mode);
        const modeLabel = PSEUDO_MODE_LABELS[normalizedMode] || PSEUDO_MODE_LABELS[PSEUDO_MODE_DEFAULT];
        const shortLabel = PSEUDO_MODE_SHORT_LABELS[normalizedMode] || PSEUDO_MODE_SHORT_LABELS[PSEUDO_MODE_DEFAULT];
        const labelNode = button.querySelector('.pseudo-label');

        button.setAttribute('data-mode', normalizedMode);
        button.setAttribute('title', 'Pseudo override: ' + modeLabel + ' (click to cycle)');
        button.setAttribute('aria-label', 'Pseudo override: ' + modeLabel + '. Click to cycle.');

        if (labelNode) {
            labelNode.textContent = shortLabel;
        }
    }

    function updateAllPseudoModeButtons(mode) {
        document.querySelectorAll('.css-pseudo-toggle').forEach((button) => {
            applyPseudoModeToButton(button, mode);
        });
    }

    function bindPseudoModeStorageListener() {
        if (pseudoModeStorageListenerBound || !chrome.storage || !chrome.storage.onChanged) {
            return;
        }

        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local' || !changes[PSEUDO_MODE_STORAGE_KEY]) {
                return;
            }

            pseudoModeCache = sanitizePseudoMode(changes[PSEUDO_MODE_STORAGE_KEY].newValue);
            updateAllPseudoModeButtons(pseudoModeCache);
        });

        pseudoModeStorageListenerBound = true;
    }

    function readPseudoModeFromStorage(callback) {
        if (!chrome.storage || !chrome.storage.local) {
            callback(PSEUDO_MODE_DEFAULT);
            return;
        }

        chrome.storage.local.get(PSEUDO_MODE_STORAGE_KEY, (settings) => {
            if (chrome.runtime.lastError) {
                console.warn(TOOLKIT_NAME + ' Failed to read pseudo mode:', chrome.runtime.lastError);
                callback(PSEUDO_MODE_DEFAULT);
                return;
            }

            callback(sanitizePseudoMode(settings[PSEUDO_MODE_STORAGE_KEY]));
        });
    }

    function initializePseudoToggle(button) {
        if (!button || !isThemeManagerPage()) {
            return;
        }

        bindPseudoModeStorageListener();

        const applyMode = (mode) => {
            pseudoModeCache = sanitizePseudoMode(mode);
            updateAllPseudoModeButtons(pseudoModeCache);
        };

        if (pseudoModeCache) {
            applyMode(pseudoModeCache);
        } else {
            readPseudoModeFromStorage(applyMode);
        }

        const cyclePseudoMode = (event) => {
            event.preventDefault();
            event.stopPropagation();

            const currentMode = sanitizePseudoMode(button.getAttribute('data-mode') || pseudoModeCache || PSEUDO_MODE_DEFAULT);
            const nextMode = getNextPseudoMode(currentMode);
            const settings = {};

            pseudoModeCache = nextMode;
            updateAllPseudoModeButtons(nextMode);
            settings[PSEUDO_MODE_STORAGE_KEY] = nextMode;

            chrome.storage.local.set(settings, () => {
                if (chrome.runtime.lastError) {
                    console.warn(TOOLKIT_NAME + ' Failed to save pseudo mode:', chrome.runtime.lastError);
                }
            });
        };

        button.addEventListener('click', cyclePseudoMode);
        button.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                cyclePseudoMode(event);
            }
        });
    }

    // ==================== CSS INJECTION ====================
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .css-editor-wrapper {
                position: relative;
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                font-size: 13px;
                line-height: 1.5;
                border-radius: 4px;
                overflow: visible
                ;
                background: #ffffff;
                border: 2px solid #e0e0e0;
                transition: border-color 0.3s ease;
                height: 100%;
                display: flex;
                flex-direction: column;
            }
            .css-editor-wrapper.valid { border-color: #4ec9b0; }
            .css-editor-wrapper.invalid { border-color: #e51400; }
            .css-editor-wrapper.warning { border-color: #bf8803; }
            .css-editor-container {
                display: flex;
                position: relative;
                min-height: 200px;
                flex: 1;
                overflow: hidden;
            }
            .css-line-numbers {
                padding: 10px 5px;
                background: #f3f3f3;
                color: #237893;
                text-align: right;
                user-select: none;
                border-right: 1px solid #e0e0e0;
                min-width: 20px;
                overflow: hidden;
                font-family: monospace !important;
                font-size: 13px !important;
                line-height: 19.5px !important;
            }
            .css-line-numbers div {
                line-height: 19.5px !important;
                height: 19.5px !important;
            }
            .css-line-numbers .wrapped-line {
                color: #999999;
            }
            .css-editor-content {
                flex: 1;
                position: relative;
                overflow: auto;
                background: #ffffff;
            }
            .css-editor-backdrop {
                position: relative;
                padding: 10px;
                color: #000000;
                white-space: pre-wrap;
                word-wrap: break-word;
                pointer-events: none;
                overflow-wrap: break-word;
                min-height: 100%;
                font-family: monospace !important;
                font-size: 13px !important;
                line-height: 19.5px !important;
                letter-spacing: normal !important;
                word-spacing: normal !important;
                text-transform: none !important;
                text-indent: 0 !important;
                text-shadow: none !important;
                text-rendering: auto !important;
                -webkit-font-smoothing: antialiased !important;
                -moz-osx-font-smoothing: grayscale !important;
                z-index: 1 !important; /* Behind textarea */
            }
            .css-editor-textarea {
                position: absolute;
                z-index: 2 !important; /* Above backdrop */
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                width: 100% !important;
                height: 100% !important;
                padding: 10px !important;
                margin: 0 !important;
                background: transparent !important;
                color: transparent !important;
                caret-color: #000000 !important;
                border: none !important;
                outline: none !important;
                resize: none !important;
                font-family: monospace !important;
                font-size: 13px !important;
                line-height: 19.5px !important;
                white-space: pre-wrap !important;
                word-wrap: break-word !important;
                overflow-wrap: break-word !important;
                overflow: hidden !important;
                z-index: 2;
                -webkit-text-fill-color: transparent !important;
                spellcheck: false !important;
                letter-spacing: normal !important;
                word-spacing: normal !important;
                text-transform: none !important;
                text-indent: 0 !important;
                text-shadow: none !important;
                text-rendering: auto !important;
                -webkit-font-smoothing: antialiased !important;
                -moz-osx-font-smoothing: grayscale !important;
                font-weight: normal !important;
                font-style: normal !important;
                font-variant: normal !important;
            }
            .css-editor-textarea::selection {
                background: rgba(173, 214, 255, 0.5) !important;
                color: transparent !important;
                -webkit-text-fill-color: transparent !important;
            }
            .css-editor-textarea::-moz-selection {
                background: rgba(173, 214, 255, 0.5) !important;
                color: transparent !important;
            }
            /* VS Code Light Theme Colors */
            .css-property { color: #0451a5; }
            .css-value { color: #a31515; }
            .css-number { color: #098658; }
            .css-unit { color: #098658; }
            .css-color { color: #a31515; }
            .css-important { color: #af00db; font-weight: bold; }
            .css-comment { color: #008000; font-style: italic; }
            .css-selector { color: #800000; }
            .css-element-selector { color: #0451a5; }
            .css-pseudo { color: #0000ff; }
            .css-at-rule { color: #af00db; font-weight: bold; }
            .css-combinator { color: #000000; }
            .css-bracket { color: #098658; font-weight: bold; }
            .css-bracket-parent { color: #0000ff; font-weight: bold; }
            .css-semicolon { color: #000000; }
            .css-colon { color: #000000; }
            .css-string { color: #a31515; }
            .css-skin-class { color: #267f99; font-weight: bold; }
            .css-validation-indicator {
                position: relative;
                padding: 5px 10px;
                background: #f3f3f3;
                border-top: 1px solid #e0e0e0;
                color: #000000;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 0px;
                justify-content: flex-end;
                width: 100%;
                flex-shrink: 0;
            }
            .css-validation-status {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-right: auto; /* Push to left, others to right */
            }
            .css-char-counter {
                display: flex;
                align-items: center;
                justify-content: center;
                min-width: 60px;
                font-size: 11px;
                color: #616161;
            }
            .css-char-counter.warning {
                color: #bf8803;
            }
            .css-char-counter.error {
                color: #e51400;
                font-weight: bold;
            }
            .css-validation-indicator .status-icon {
                width: 8px;
                height: 8px;
                min-width: 8px;
                min-height: 8px;
                border-radius: 50%;
            }
            .css-validation-indicator.valid .status-icon { background: #4ec9b0; }
            .css-validation-indicator.invalid .status-icon { background: #e51400; }
            .css-validation-indicator.warning .status-icon { background: #bf8803; }
            /* DISABLED: Color preview boxes (causing issues - keep code for potential restore)
            .css-color-preview {
                display: inline-block;
                width: 14px;
                height: 14px;
                border: 1px solid #cccccc;
                border-radius: 2px;
                margin-right: 6px;
                vertical-align: middle;
                box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);
            }
            */

            /* ==================== PHASE 3: THEME / PSEUDO / SNIPPET TOGGLES ==================== */
            .css-validation-indicator .css-theme-toggle,
            .css-validation-indicator .css-code-toggle,
            .css-validation-indicator .css-pseudo-toggle {
                flex: 0 0 auto;
                margin-left: 8px;
                /* Override CivicPlus admin button styles */
                position: relative !important;
                width: 26px !important;
                height: 26px !important;
                min-width: 26px !important; /* Prevent modal from shrinking */
                min-height: 26px !important;
                padding: 0 !important; /* Override .button padding */
                margin: 0 0 0 8px !important; /* Override .button margin, add left space */
                background: transparent !important;
                border: 1px solid #ccc !important; /* Override .button border */
                border-radius: 4px !important;
                cursor: pointer !important;
                display: inline-flex !important; /* Changed from flex - inline in validation bar */
                align-items: center !important;
                justify-content: center !important;
                transition: background 0.2s, border-color 0.2s !important;
                flex-shrink: 0 !important; /* Don't shrink in flex container */
                vertical-align: middle !important; /* Align with text */
                line-height: normal !important; /* Override .button line-height: 41px */
                font-size: inherit !important; /* Override .button font-size */
                letter-spacing: normal !important; /* Override .button letter-spacing */
                text-transform: none !important; /* Override .button text-transform */
                text-decoration: none !important; /* Override .button text-decoration */
                white-space: nowrap !important; /* Override .button white-space */
                user-select: none !important;
                text-align: center !important;
            }
            .css-validation-indicator .css-theme-toggle:hover,
            .css-validation-indicator .css-code-toggle:hover,
            .css-validation-indicator .css-pseudo-toggle:hover {
                background: rgba(0, 0, 0, 0.05) !important;
                border-color: #999 !important;
                opacity: 1 !important; /* Prevent .button hover opacity changes */
            }
            .css-validation-indicator .css-theme-toggle:focus,
            .css-validation-indicator .css-code-toggle:focus,
            .css-validation-indicator .css-pseudo-toggle:focus {
                outline: 2px solid #0078d4 !important;
                outline-offset: 2px !important;
            }
            .css-validation-indicator .css-theme-toggle svg,
            .css-validation-indicator .css-code-toggle svg {
                width: 13px !important; /* Slightly smaller for compact layout */
                height: 13px !important;
                min-width: 13px !important;
                min-height: 13px !important;
                stroke-width: 2 !important;
                stroke: #666 !important; /* Default: gray for code toggle */
                fill: none !important; /* Prevent black circle from fill: currentColor */
                display: block !important; /* Prevent inline weirdness */
            }
            .css-validation-indicator .css-theme-toggle svg {
                stroke: #b8860b !important; /* Dark yellow for theme toggle (light theme) */
            }
            .css-validation-indicator .css-pseudo-toggle .pseudo-label {
                display: inline-block;
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                font-size: 10px;
                font-weight: 700;
                line-height: 1;
                letter-spacing: 0.1px;
                color: #555;
            }
            .css-validation-indicator .css-pseudo-toggle[data-mode="legacy-fix"] .pseudo-label {
                color: #2f7a47;
            }
            .css-validation-indicator .css-pseudo-toggle[data-mode="cms-default"] .pseudo-label {
                color: #8f6a00;
            }
            .css-validation-indicator .css-pseudo-toggle[data-mode="off"] .pseudo-label {
                color: #7a3b3b;
            }

            /* ==================== CODE SNIPPETS DROPDOWN ==================== */
            .css-code-popup {
                position: absolute;
                bottom: 100%;
                right: 0;
                margin-bottom: 4px;
                background: #fff;
                border: 1px solid #ccc;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                min-width: 200px;
                z-index: 100000;
                display: none;
            }
            .css-code-popup.visible {
                display: block;
            }
            .css-code-popup:empty,
            .css-code-popup.visible:not(:has(li)) {
                display: none;
            }
            /* Simple dropdown list */
            .css-snippet-dropdown-list {
                list-style: none;
                margin: 0;
                padding: 4px 0;
                max-height: 200px;
                overflow-y: auto;
                overflow-x: hidden;
            }
            .css-snippet-dropdown-list li {
                padding: 8px 12px;
                cursor: pointer;
                font-size: 12px;
                color: #333;
                white-space: nowrap;
                transition: background 0.1s;
            }
            .css-snippet-dropdown-list li:hover {
                background: #f0f0f0;
            }
            .css-snippet-dropdown-list li.snippet-separator {
                height: 1px;
                padding: 0;
                margin: 4px 8px;
                background: #e0e0e0;
                cursor: default;
            }
            .css-snippet-dropdown-list li.snippet-separator:hover {
                background: #e0e0e0;
            }
            .css-snippet-dropdown-list .user-badge {
                font-size: 9px;
                background: #af282f;
                color: #fff;
                padding: 1px 5px;
                border-radius: 8px;
                margin-left: 6px;
                vertical-align: middle;
            }
            /* Position wrapper for dropdown */
            .css-code-toggle {
                position: relative;
            }

            /* ==================== PHASE 3: LIGHT THEME (DEFAULT) ==================== */
            .css-editor-wrapper[data-theme="light"],
            .css-editor-wrapper.theme-light {
                background: #ffffff;
                border-color: #e0e0e0;
            }
            /* Light theme validation borders */
            .css-editor-wrapper[data-theme="light"].valid,
            .css-editor-wrapper.theme-light.valid { border-color: #4ec9b0; }
            .css-editor-wrapper[data-theme="light"].invalid,
            .css-editor-wrapper.theme-light.invalid { border-color: #e51400; }
            .css-editor-wrapper[data-theme="light"].warning,
            .css-editor-wrapper.theme-light.warning { border-color: #bf8803; }
            .css-editor-wrapper[data-theme="light"] .css-editor-content,
            .css-editor-wrapper.theme-light .css-editor-content {
                background: #ffffff;
            }
            .css-editor-wrapper[data-theme="light"] .css-editor-backdrop,
            .css-editor-wrapper.theme-light .css-editor-backdrop {
                color: #000000;
            }
            .css-editor-wrapper[data-theme="light"] .css-line-numbers,
            .css-editor-wrapper.theme-light .css-line-numbers {
                background: #f3f3f3;
                color: #237893;
                border-right-color: #e0e0e0;
            }
            .css-editor-wrapper[data-theme="light"] .css-editor-textarea,
            .css-editor-wrapper.theme-light .css-editor-textarea {
                caret-color: #000000 !important;
            }
            .css-editor-wrapper[data-theme="light"] .css-theme-toggle svg,
            .css-editor-wrapper.theme-light .css-theme-toggle svg {
                stroke: #b8860b !important;
            }
            .css-editor-wrapper[data-theme="light"] .css-code-toggle svg,
            .css-editor-wrapper.theme-light .css-code-toggle svg {
                stroke: #555 !important;
            }
            .css-editor-wrapper[data-theme="light"] .css-pseudo-toggle .pseudo-label,
            .css-editor-wrapper.theme-light .css-pseudo-toggle .pseudo-label {
                color: #555;
            }
            .css-editor-wrapper[data-theme="light"] .css-validation-indicator,
            .css-editor-wrapper.theme-light .css-validation-indicator {
                background: #f3f3f3;
                border-top-color: #e0e0e0;
                color: #000000;
            }

            /* ==================== PHASE 3: DARK THEME ==================== */
            .css-editor-wrapper[data-theme="dark"],
            .css-editor-wrapper.theme-dark {
                background: #1e1e1e;
                border-color: #3c3c3c;
            }
            .css-editor-wrapper[data-theme="dark"] .css-editor-content,
            .css-editor-wrapper.theme-dark .css-editor-content {
                background: #1e1e1e;
            }
            .css-editor-wrapper[data-theme="dark"] .css-editor-backdrop,
            .css-editor-wrapper.theme-dark .css-editor-backdrop {
                color: #d4d4d4;
            }
            .css-editor-wrapper[data-theme="dark"] .css-line-numbers,
            .css-editor-wrapper.theme-dark .css-line-numbers {
                background: #2d2d2d;
                color: #858585;
                border-right-color: #3c3c3c;
            }
            .css-editor-wrapper[data-theme="dark"] .css-line-numbers .wrapped-line,
            .css-editor-wrapper.theme-dark .css-line-numbers .wrapped-line {
                color: #666;
            }
            .css-editor-wrapper[data-theme="dark"] .css-editor-textarea,
            .css-editor-wrapper.theme-dark .css-editor-textarea {
                caret-color: #d4d4d4 !important;
            }
            .css-editor-wrapper[data-theme="dark"] .css-theme-toggle,
            .css-editor-wrapper.theme-dark .css-theme-toggle,
            .css-editor-wrapper[data-theme="dark"] .css-code-toggle,
            .css-editor-wrapper.theme-dark .css-code-toggle,
            .css-editor-wrapper[data-theme="dark"] .css-pseudo-toggle,
            .css-editor-wrapper.theme-dark .css-pseudo-toggle {
                border-color: #555;
            }
            .css-editor-wrapper[data-theme="dark"] .css-theme-toggle:hover,
            .css-editor-wrapper.theme-dark .css-theme-toggle:hover,
            .css-editor-wrapper[data-theme="dark"] .css-code-toggle:hover,
            .css-editor-wrapper.theme-dark .css-code-toggle:hover,
            .css-editor-wrapper[data-theme="dark"] .css-pseudo-toggle:hover,
            .css-editor-wrapper.theme-dark .css-pseudo-toggle:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: #777;
            }
            .css-editor-wrapper[data-theme="dark"] .css-theme-toggle svg,
            .css-editor-wrapper.theme-dark .css-theme-toggle svg {
                stroke: #fff !important;
            }
            .css-editor-wrapper[data-theme="dark"] .css-code-toggle svg,
            .css-editor-wrapper.theme-dark .css-code-toggle svg {
                stroke: #d4d4d4 !important;
            }
            .css-editor-wrapper[data-theme="dark"] .css-pseudo-toggle .pseudo-label,
            .css-editor-wrapper.theme-dark .css-pseudo-toggle .pseudo-label {
                color: #d4d4d4;
            }
            .css-editor-wrapper[data-theme="dark"] .css-pseudo-toggle[data-mode="legacy-fix"] .pseudo-label {
                color: #7ee787;
            }
            .css-editor-wrapper[data-theme="dark"] .css-pseudo-toggle[data-mode="cms-default"] .pseudo-label {
                color: #f2cc60;
            }
            .css-editor-wrapper[data-theme="dark"] .css-pseudo-toggle[data-mode="off"] .pseudo-label {
                color: #ff8a8a;
            }
            .css-code-popup[data-theme="dark"] {
                background: #2d2d2d;
                border-color: #555;
            }
            .css-code-popup[data-theme="dark"] .css-snippet-dropdown-list li {
                color: #d4d4d4;
            }
            .css-code-popup[data-theme="dark"] .css-snippet-dropdown-list li:hover {
                background: #3c3c3c;
            }
            .css-code-popup[data-theme="dark"] .css-snippet-dropdown-list li.snippet-separator {
                background: #555;
            }
            .css-code-popup[data-theme="dark"] .css-snippet-dropdown-list li.snippet-separator:hover {
                background: #555;
            }
            .css-code-popup[data-theme="dark"] .css-snippet-dropdown-list .user-badge {
                background: #c42f37;
            }
            .css-editor-wrapper[data-theme="dark"] .css-validation-indicator,
            .css-editor-wrapper.theme-dark .css-validation-indicator {
                background: #2d2d2d;
                border-top-color: #3c3c3c;
                color: #d4d4d4;
            }
            .css-editor-wrapper[data-theme="dark"] .css-char-counter,
            .css-editor-wrapper.theme-dark .css-char-counter {
                color: #999;
            }
            /* Dark theme syntax colors */
            .css-editor-wrapper[data-theme="dark"] .css-property,
            .css-editor-wrapper.theme-dark .css-property { color: #9cdcfe; }
            .css-editor-wrapper[data-theme="dark"] .css-value,
            .css-editor-wrapper.theme-dark .css-value { color: #ce9178; }
            .css-editor-wrapper[data-theme="dark"] .css-selector,
            .css-editor-wrapper.theme-dark .css-selector { color: #d7ba7d; }
            .css-editor-wrapper[data-theme="dark"] .css-comment,
            .css-editor-wrapper.theme-dark .css-comment { color: #6a9955; }
            .css-editor-wrapper[data-theme="dark"] .css-number,
            .css-editor-wrapper.theme-dark .css-number { color: #b5cea8; }
            .css-editor-wrapper[data-theme="dark"] .css-unit,
            .css-editor-wrapper.theme-dark .css-unit { color: #b5cea8; }
            .css-editor-wrapper[data-theme="dark"] .css-color,
            .css-editor-wrapper.theme-dark .css-color { color: #ce9178; }
            .css-editor-wrapper[data-theme="dark"] .css-string,
            .css-editor-wrapper.theme-dark .css-string { color: #ce9178; }
            .css-editor-wrapper[data-theme="dark"] .css-element-selector,
            .css-editor-wrapper.theme-dark .css-element-selector { color: #4ec9b0; }
            .css-editor-wrapper[data-theme="dark"] .css-pseudo,
            .css-editor-wrapper.theme-dark .css-pseudo { color: #dcdcaa; }
            .css-editor-wrapper[data-theme="dark"] .css-at-rule,
            .css-editor-wrapper.theme-dark .css-at-rule { color: #c586c0; }
            .css-editor-wrapper[data-theme="dark"] .css-important,
            .css-editor-wrapper.theme-dark .css-important { color: #569cd6; }
            .css-editor-wrapper[data-theme="dark"] .css-bracket,
            .css-editor-wrapper.theme-dark .css-bracket { color: #b5cea8; }
            .css-editor-wrapper[data-theme="dark"] .css-bracket-parent,
            .css-editor-wrapper.theme-dark .css-bracket-parent { color: #dcdcaa; }
            .css-editor-wrapper[data-theme="dark"] .css-semicolon,
            .css-editor-wrapper.theme-dark .css-semicolon { color: #d4d4d4; }
            .css-editor-wrapper[data-theme="dark"] .css-colon,
            .css-editor-wrapper.theme-dark .css-colon { color: #d4d4d4; }
            .css-editor-wrapper[data-theme="dark"] .css-skin-class,
            .css-editor-wrapper.theme-dark .css-skin-class { color: #4fc1ff; }
            .css-editor-wrapper[data-theme="dark"] .css-typo,
            .css-editor-wrapper.theme-dark .css-typo {
                text-decoration: underline wavy #f48771;
            }
            .css-editor-wrapper[data-theme="dark"] .css-combinator,
            .css-editor-wrapper.theme-dark .css-combinator { color: #d7ba7d; }
            /* Dark theme validation borders */
            .css-editor-wrapper[data-theme="dark"].valid,
            .css-editor-wrapper.theme-dark.valid { border-color: #4ec9b0; }
            .css-editor-wrapper[data-theme="dark"].invalid,
            .css-editor-wrapper.theme-dark.invalid { border-color: #f48771; }
            .css-editor-wrapper[data-theme="dark"].warning,
            .css-editor-wrapper.theme-dark.warning { border-color: #dcdcaa; }

            /* ==================== PHASE 3: NO-STYLES THEME ==================== */
            /* Identical to Light theme but with ALL BLACK CSS (no syntax colors) */
            .css-editor-wrapper[data-theme="no-styles"],
            .css-editor-wrapper.theme-no-styles {
                background: #ffffff;
                border-color: #e0e0e0;
            }
            .css-editor-wrapper[data-theme="no-styles"] .css-editor-content,
            .css-editor-wrapper.theme-no-styles .css-editor-content {
                background: #ffffff;
            }
            .css-editor-wrapper[data-theme="no-styles"] .css-editor-backdrop,
            .css-editor-wrapper.theme-no-styles .css-editor-backdrop {
                color: #000000;
            }
            .css-editor-wrapper[data-theme="no-styles"] .css-line-numbers,
            .css-editor-wrapper.theme-no-styles .css-line-numbers {
                background: #f3f3f3;
                color: #237893;
                border-right-color: #e0e0e0;
            }
            .css-editor-wrapper[data-theme="no-styles"] .css-editor-textarea,
            .css-editor-wrapper.theme-no-styles .css-editor-textarea {
                caret-color: #000000 !important;
            }
            .css-editor-wrapper[data-theme="no-styles"] .css-theme-toggle svg,
            .css-editor-wrapper.theme-no-styles .css-theme-toggle svg {
                stroke: #000 !important;
            }
            .css-editor-wrapper[data-theme="no-styles"] .css-code-toggle svg,
            .css-editor-wrapper.theme-no-styles .css-code-toggle svg {
                stroke: #333 !important;
            }
            .css-editor-wrapper[data-theme="no-styles"] .css-pseudo-toggle .pseudo-label,
            .css-editor-wrapper.theme-no-styles .css-pseudo-toggle .pseudo-label {
                color: #333;
            }
            .css-editor-wrapper[data-theme="no-styles"] .css-validation-indicator,
            .css-editor-wrapper.theme-no-styles .css-validation-indicator {
                background: #f3f3f3;
                border-top-color: #e0e0e0;
                color: #000000;
            }
            /* No-styles theme - ALL BLACK CSS (no syntax highlighting colors) */
            .css-editor-wrapper[data-theme="no-styles"] .css-property,
            .css-editor-wrapper[data-theme="no-styles"] .css-value,
            .css-editor-wrapper[data-theme="no-styles"] .css-number,
            .css-editor-wrapper[data-theme="no-styles"] .css-unit,
            .css-editor-wrapper[data-theme="no-styles"] .css-color,
            .css-editor-wrapper[data-theme="no-styles"] .css-important,
            .css-editor-wrapper[data-theme="no-styles"] .css-comment,
            .css-editor-wrapper[data-theme="no-styles"] .css-selector,
            .css-editor-wrapper[data-theme="no-styles"] .css-element-selector,
            .css-editor-wrapper[data-theme="no-styles"] .css-pseudo,
            .css-editor-wrapper[data-theme="no-styles"] .css-at-rule,
            .css-editor-wrapper[data-theme="no-styles"] .css-combinator,
            .css-editor-wrapper[data-theme="no-styles"] .css-bracket,
            .css-editor-wrapper[data-theme="no-styles"] .css-bracket-parent,
            .css-editor-wrapper[data-theme="no-styles"] .css-semicolon,
            .css-editor-wrapper[data-theme="no-styles"] .css-colon,
            .css-editor-wrapper[data-theme="no-styles"] .css-string,
            .css-editor-wrapper[data-theme="no-styles"] .css-skin-class,
            .css-editor-wrapper.theme-no-styles .css-property,
            .css-editor-wrapper.theme-no-styles .css-value,
            .css-editor-wrapper.theme-no-styles .css-number,
            .css-editor-wrapper.theme-no-styles .css-unit,
            .css-editor-wrapper.theme-no-styles .css-color,
            .css-editor-wrapper.theme-no-styles .css-important,
            .css-editor-wrapper.theme-no-styles .css-comment,
            .css-editor-wrapper.theme-no-styles .css-selector,
            .css-editor-wrapper.theme-no-styles .css-element-selector,
            .css-editor-wrapper.theme-no-styles .css-pseudo,
            .css-editor-wrapper.theme-no-styles .css-at-rule,
            .css-editor-wrapper.theme-no-styles .css-combinator,
            .css-editor-wrapper.theme-no-styles .css-bracket,
            .css-editor-wrapper.theme-no-styles .css-bracket-parent,
            .css-editor-wrapper.theme-no-styles .css-semicolon,
            .css-editor-wrapper.theme-no-styles .css-colon,
            .css-editor-wrapper.theme-no-styles .css-string,
            .css-editor-wrapper.theme-no-styles .css-skin-class {
                color: #000000 !important;
            }
            .css-editor-wrapper[data-theme="no-styles"] .css-typo,
            .css-editor-wrapper.theme-no-styles .css-typo {
                text-decoration: underline wavy #cc0000;
                color: #000000 !important;
            }

            /* ==================== SEARCH BOX STYLES LAYOUT FIX ==================== */
            /* Fix layout for SearchBoxStyles textarea which has unusual parent structure */
            #SearchBoxStyles.css-editor-textarea {
                /* Ensure parent div layout */
            }
            li:has(#SearchBoxStyles) > div {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-left: 0 !important;
            }
            li:has(#SearchBoxStyles) > div > div:has(.css-editor-wrapper) {
                margin-left: 0 !important;
            }

        `;
        document.head.appendChild(style);
    }

    // ==================== SYNTAX HIGHLIGHTER ====================
    // v7.4: Fixed HTML entity and combinator issues
    // Issue 1: <number> in @property syntax was displaying as <;number>
    //   Root cause: regex alternation (?:[^;}\n]|&[a-z]+;) had entity pattern SECOND
    //   and char class [^;}\n] included &, so it greedily matched & before entity could try
    //   Fix: Put entity pattern FIRST and exclude & from char class: (?:&[a-z]+;|[^;}&\n])
    // Issue 2: + combinator caused cursor misalignment
    //   Root cause: combinator highlighting added fixed spaces regardless of original whitespace
    //   Fix: Preserve original whitespace exactly
    function highlightCSS(code) {
        // First, escape HTML characters to prevent XSS and display issues
        code = code.replace(/[<>&]/g, (char) => {
            const escapeMap = { '<': '&lt;', '>': '&gt;', '&': '&amp;' };
            return escapeMap[char];
        });

        // List of HTML elements for selector highlighting
        const htmlElements = ['div', 'span', 'p', 'a', 'body', 'html', 'head', 'title', 'meta', 'link', 'style', 'script',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'footer', 'nav', 'main', 'section', 'article', 'aside',
            'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
            'form', 'input', 'button', 'select', 'option', 'textarea', 'label', 'fieldset', 'legend',
            'img', 'figure', 'figcaption', 'picture', 'video', 'audio', 'source', 'track', 'canvas', 'svg',
            'strong', 'em', 'b', 'i', 'u', 's', 'small', 'mark', 'del', 'ins', 'sub', 'sup', 'code', 'pre',
            'blockquote', 'q', 'cite', 'abbr', 'address', 'time', 'br', 'hr', 'iframe', 'embed', 'object', 'param'];

        // Track if we're inside a multi-line comment
        let inMultiLineComment = false;

        // Track if we're inside a multi-line value (e.g., linear-gradient spanning multiple lines)
        let inMultiLineValue = false;

        // Determine line type
        function detectLineType(line) {
            const trimmed = line.trim();

            // Empty line
            if (!trimmed) return 'empty';

            // Check for multi-line comment state first
            if (inMultiLineComment) {
                if (trimmed.includes('*/')) return 'comment-end';
                return 'comment-middle';
            }

            // Comment detection
            if (trimmed.startsWith('/*') && trimmed.includes('*/')) return 'comment-single';
            if (trimmed.startsWith('/*')) return 'comment-start';
            if (trimmed.startsWith('*')) return 'comment-middle'; // continuation line

            // @-rule (media, keyframes, import, etc.)
            if (trimmed.startsWith('@')) return 'at-rule';

            // Just brackets
            if (trimmed === '{' || trimmed === '}') return 'bracket';

            // Multi-line value continuation (e.g., lines inside a multi-line linear-gradient)
            if (inMultiLineValue) {
                // Count parens to track when the multi-line value ends
                const openParens = (trimmed.match(/\(/g) || []).length;
                const closeParens = (trimmed.match(/\)/g) || []).length;
                inMultiLineValue = openParens >= closeParens; // still open if parens don't close
                // If the line ends with ); or ); followed by a semicolon, the value is done
                if (/\)\s*;?\s*$/.test(trimmed) && closeParens > openParens) {
                    inMultiLineValue = false;
                }
                return 'value-continuation';
            }

            // Property declaration: starts with property name followed by colon
            // Pattern: word-chars (with hyphens), optional whitespace, colon
            if (/^[a-z\-]+\s*:/i.test(trimmed)) {
                // Check if this property starts a multi-line value (unclosed parentheses)
                const openParens = (trimmed.match(/\(/g) || []).length;
                const closeParens = (trimmed.match(/\)/g) || []).length;
                if (openParens > closeParens) {
                    inMultiLineValue = true;
                }
                return 'property';
            }

            // Selector: ends with { or looks like selector pattern
            if (trimmed.endsWith('{')) return 'selector';

            // Selector without brace (multi-line selector)
            if (/^[\w\s\.\#\[\]\:\(\)\,\>\+\~\*\-="']+$/.test(trimmed) &&
                !trimmed.includes(';')) return 'selector';

            // Mixed line: selector with inline property (e.g., ".class { color: red; }")
            if (trimmed.includes('{') && trimmed.includes(':')) return 'mixed';

            // Default to unknown/text
            return 'text';
        }

        // Highlight a selector (no <span> tags exist yet, so safe to match element names)
        function highlightSelector(selector) {
            let result = selector;

            // Use placeholder system to avoid conflicts
            const placeholders = [];

            // 1. First, protect .skin classes with placeholder
            // Add a space before placeholder to separate from previous class
            result = result.replace(/\.skin(\d+)/g, (match, num) => {
                const idx = placeholders.length;
                placeholders.push(`<span class="css-skin-class">.skin${num}</span>`);
                return `\x00PH${idx}\x00`;  // Use null char as delimiter instead of __
            });

            // 2. Highlight pseudo-elements (::before, ::after, etc.) - MUST come before pseudo-classes
            result = result.replace(/::([\w-]+)(\([^)]*\))?/g, (match) => {
                const idx = placeholders.length;
                placeholders.push(`<span class="css-pseudo">${match}</span>`);
                return `\x00PH${idx}\x00`;
            });

            // 3. Highlight pseudo-classes (:hover, :nth-child(), etc.)
            result = result.replace(/:(?!:)([\w-]+)(\([^)]*\))?/g, (match) => {
                const idx = placeholders.length;
                placeholders.push(`<span class="css-pseudo">${match}</span>`);
                return `\x00PH${idx}\x00`;
            });

            // 4. Highlight attribute selectors [attr="value"]
            result = result.replace(/\[[^\]]+\]/g, (match) => {
                const idx = placeholders.length;
                placeholders.push(`<span class="css-selector">${match}</span>`);
                return `\x00PH${idx}\x00`;
            });

            // 5. Highlight class selectors .className (include the . in the highlight)
            result = result.replace(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g, (match, className) => {
                const idx = placeholders.length;
                placeholders.push(`<span class="css-selector">.${className}</span>`);
                return `\x00PH${idx}\x00`;
            });

            // 6. Highlight ID selectors #idName (include the # in the highlight)
            result = result.replace(/#([a-zA-Z_-][a-zA-Z0-9_-]*)/g, (match, idName) => {
                // Skip hex colors (all hex digits)
                if (/^[0-9a-fA-F]+$/.test(idName)) return match;
                const idx = placeholders.length;
                placeholders.push(`<span class="css-selector">#${idName}</span>`);
                return `\x00PH${idx}\x00`;
            });

            // 7. Highlight HTML element selectors (golden color)
            // Create a single regex for all elements to avoid multiple passes
            const elementPattern = new RegExp(`\\b(${htmlElements.join('|')})\\b(?![\\w-])`, 'gi');
            result = result.replace(elementPattern, (match) => {
                const idx = placeholders.length;
                placeholders.push(`<span class="css-element-selector">${match}</span>`);
                return `\x00PH${idx}\x00`;
            });

            // 8. Highlight combinators (>, +, ~)
            // v7.4: Fixed to preserve original whitespace - don't add extra spaces!
            // The old code added fixed spaces which broke cursor alignment when original had none
            result = result.replace(/(\s*)([+~]|>|&gt;)(\s*)/g, (match, spaceBefore, comb, spaceAfter) => {
                const idx = placeholders.length;
                // Keep the combinator as-is (use &gt; for > to maintain HTML safety)
                const displayComb = comb === '>' ? '&gt;' : comb;
                // CRITICAL: Preserve the EXACT original whitespace to maintain character alignment
                placeholders.push(`${spaceBefore}<span class="css-combinator">${displayComb}</span>${spaceAfter}`);
                return `\x00PH${idx}\x00`;
            });

            // 9. Restore all placeholders
            placeholders.forEach((content, idx) => {
                result = result.replace(`\x00PH${idx}\x00`, content);
            });

            return result;
        }

        // Highlight a property line (property: value;)
        function highlightPropertyLine(line) {
            // v7.4: Fixed HTML entity regex properly
            // Problem: [^;}\n] was greedily matching & before entity pattern could try
            // Solution: Put entity pattern FIRST in alternation AND exclude & from char class
            // Pattern: (?:&[a-z]+;|[^;}&\n])+ - tries entity first, then non-special chars (excluding &)
            return line.replace(/([a-z\-]+)(\s*)(:)(\s*)((?:&[a-z]+;|[^;}&\n])+)(;?)/gi, (match, prop, space1, colon, space2, value, semicolon) => {
                // Skip if inside comment markers
                if (match.includes('/*') || match.includes('*/')) return match;
                // Skip if contains opening brace (not a property)
                if (value.includes('{')) return match;

                let highlightedValue = value;

                // Use placeholder system for colors
                const hexMatches = [];
                const rgbaMatches = [];

                // 1. Replace hex colors with placeholders
                highlightedValue = highlightedValue.replace(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g, (colorMatch) => {
                    const index = hexMatches.length;
                    hexMatches.push(colorMatch);
                    return `__HEX_${index}__`;
                });

                // 2. Replace rgb/rgba with placeholders
                highlightedValue = highlightedValue.replace(/rgba?\([^)]+\)/gi, (colorMatch) => {
                    const index = rgbaMatches.length;
                    rgbaMatches.push(colorMatch);
                    return `__RGBA_${index}__`;
                });

                // 3. Highlight numbers with units
                highlightedValue = highlightedValue.replace(/(\d+(?:\.\d+)?)(px|em|rem|vh|vw|vmin|vmax|%|deg|rad|grad|turn|s|ms|cm|mm|in|pt|pc|ex|ch|fr|q)(?![a-z])/gi, (numMatch, num, unit) => {
                    return `<span class="css-number">${num}${unit}</span>`;
                });

                // 4. Highlight standalone numbers
                highlightedValue = highlightedValue.replace(/(?<![.\d_])(\d+(?:\.\d+)?)(?![.\d%a-z_])/gi, (numMatch) => {
                    return `<span class="css-number">${numMatch}</span>`;
                });

                // 5. Restore hex colors with preview
                // 5. Restore hex colors (DISABLED: color preview boxes)
                highlightedValue = highlightedValue.replace(/__HEX_(\d+)__/g, (match, index) => {
                    const colorMatch = hexMatches[parseInt(index)];
                    // DISABLED: return `<span class="css-color">${colorMatch}</span><span class="css-color-preview" style="background:${colorMatch}"></span>`;
                    return `<span class="css-color">${colorMatch}</span>`;
                });

                // 6. Restore rgba (DISABLED: color preview boxes)
                highlightedValue = highlightedValue.replace(/__RGBA_(\d+)__/g, (match, index) => {
                    const colorMatch = rgbaMatches[parseInt(index)];
                    // DISABLED: return `<span class="css-color">${colorMatch}</span><span class="css-color-preview" style="background:${colorMatch}"></span>`;
                    return `<span class="css-color">${colorMatch}</span>`;
                });

                // 7. Highlight !important
                highlightedValue = highlightedValue.replace(/!important/gi, '<span class="css-important">!important</span>');

                // Wrap value
                highlightedValue = `<span class="css-value">${highlightedValue}</span>`;

                return `<span class="css-property">${prop}</span>${space1}<span class="css-colon">:</span>${space2}${highlightedValue}${semicolon ? '<span class="css-semicolon">;</span>' : ''}`;
            });
        }

        // Highlight a value continuation line (part of a multi-line value like linear-gradient)
        function highlightValueContent(line) {
            let result = line;
            const hexMatches = [];
            const rgbaMatches = [];

            // 1. Replace hex colors with placeholders
            result = result.replace(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g, (colorMatch) => {
                const index = hexMatches.length;
                hexMatches.push(colorMatch);
                return `__HEX_${index}__`;
            });

            // 2. Replace rgb/rgba with placeholders
            result = result.replace(/rgba?\([^)]+\)/gi, (colorMatch) => {
                const index = rgbaMatches.length;
                rgbaMatches.push(colorMatch);
                return `__RGBA_${index}__`;
            });

            // 3. Highlight numbers with units
            result = result.replace(/(\d+(?:\.\d+)?)(px|em|rem|vh|vw|vmin|vmax|%|deg|rad|grad|turn|s|ms|cm|mm|in|pt|pc|ex|ch|fr|q)(?![a-z])/gi, (numMatch, num, unit) => {
                return `<span class="css-number">${num}${unit}</span>`;
            });

            // 4. Highlight standalone numbers
            result = result.replace(/(?<![.\d_])(\d+(?:\.\d+)?)(?![.\d%a-z_])/gi, (numMatch) => {
                return `<span class="css-number">${numMatch}</span>`;
            });

            // 5. Restore hex colors
            result = result.replace(/__HEX_(\d+)__/g, (match, index) => {
                const colorMatch = hexMatches[parseInt(index)];
                return `<span class="css-color">${colorMatch}</span>`;
            });

            // 6. Restore rgba
            result = result.replace(/__RGBA_(\d+)__/g, (match, index) => {
                const colorMatch = rgbaMatches[parseInt(index)];
                return `<span class="css-color">${colorMatch}</span>`;
            });

            // Highlight semicolons
            result = result.replace(/;/g, '<span class="css-semicolon">;</span>');

            // Wrap in value span
            return `<span class="css-value">${result}</span>`;
        }

        // Highlight @-rules
        function highlightAtRule(line) {
            // First highlight the @-rule keyword only (purple)
            let result = line.replace(/(@[\w-]+)/g, '<span class="css-at-rule">$1</span>');

            // Highlight parentheses (blue)
            result = result.replace(/([()])/g, '<span class="css-pseudo">$1</span>');

            // Then highlight the media query contents
            // Highlight property names inside parentheses (like max-width) - blue
            result = result.replace(/(<span class="css-pseudo">\(<\/span>)([a-z-]+)\s*:/gi, '$1<span class="css-property">$2</span>:');

            // Highlight numbers with units (green)
            result = result.replace(/:(\s*)(\d+(?:\.\d+)?)(px|em|rem|vh|vw|vmin|vmax|%|pt|pc|in|cm|mm)/gi,
                ':<span class="css-number">$1$2$3</span>');

            // Highlight brackets as parent brackets (blue) for @-rules
            result = result.replace(/([{}])/g, '<span class="css-bracket-parent">$1</span>');

            return result;
        }

        // Process line by line
        const lines = code.split('\n');
        let atRuleDepth = 0; // Track nesting inside @-rules

        const processedLines = lines.map(line => {
            const lineType = detectLineType(line);

            // Track multi-line comments
            if (lineType === 'comment-start') inMultiLineComment = true;
            if (lineType === 'comment-end') inMultiLineComment = false;

            // Count brackets to track @-rule depth
            const openBrackets = (line.match(/{/g) || []).length;
            const closeBrackets = (line.match(/}/g) || []).length;

            let processed = line;

            // Determine if this closing bracket is for an @-rule (parent level)
            const isAtRuleClosing = lineType === 'bracket' && line.trim() === '}' && atRuleDepth === 1;

            switch (lineType) {
                case 'empty':
                    processed = line;
                    break;

                case 'comment-single':
                case 'comment-start':
                case 'comment-middle':
                case 'comment-end':
                    processed = `<span class="css-comment">${line}</span>`;
                    break;

                case 'at-rule':
                    processed = highlightAtRule(line);
                    atRuleDepth += openBrackets;
                    break;

                case 'bracket':
                    if (isAtRuleClosing) {
                        processed = line.replace(/([{}])/g, '<span class="css-bracket-parent">$1</span>');
                    } else {
                        processed = line.replace(/([{}])/g, '<span class="css-bracket">$1</span>');
                    }
                    break;

                case 'selector': {
                    // Split selector from brace if present
                    if (line.includes('{')) {
                        const braceIdx = line.indexOf('{');
                        const selectorPart = line.substring(0, braceIdx);
                        const bracePart = line.substring(braceIdx);
                        processed = highlightSelector(selectorPart) + bracePart.replace(/([{}])/g, '<span class="css-bracket">$1</span>');
                    } else {
                        processed = highlightSelector(line);
                    }
                    break;
                }

                case 'value-continuation':
                    // Continuation of a multi-line value - highlight as value content
                    processed = highlightValueContent(line);
                    break;

                case 'property':
                    processed = highlightPropertyLine(line);
                    // Handle closing brace on same line
                    processed = processed.replace(/([{}])/g, '<span class="css-bracket">$1</span>');
                    break;

                case 'mixed': {
                    // Line has both selector and property: ".class { color: red; }"
                    const openBrace = line.indexOf('{');
                    const closeBrace = line.lastIndexOf('}');

                    if (openBrace !== -1) {
                        const selectorPart = line.substring(0, openBrace);
                        let middlePart = line.substring(openBrace + 1, closeBrace !== -1 ? closeBrace : line.length);

                        // Highlight selector
                        const highlightedSelector = highlightSelector(selectorPart);

                        // Highlight properties in middle
                        const highlightedMiddle = highlightPropertyLine(middlePart);

                        processed = highlightedSelector +
                                   '<span class="css-bracket">{</span>' +
                                   highlightedMiddle +
                                   (closeBrace !== -1 ? '<span class="css-bracket">}</span>' : '');
                    }
                    break;
                }

                case 'text':
                default:
                    // Unknown line type - try property highlighting as fallback
                    processed = highlightPropertyLine(line);
                    processed = processed.replace(/([{}])/g, '<span class="css-bracket">$1</span>');
                    break;
            }

            // Update @-rule depth after processing (for non-at-rule lines)
            if (lineType !== 'at-rule') {
                atRuleDepth += openBrackets - closeBrackets;
                if (atRuleDepth < 0) atRuleDepth = 0;
            }

            return `<div class="code-line">${processed || '&nbsp;'}</div>`;
        });

        return processedLines.join('');
    }

    // ==================== LINE NUMBERS ====================
    function updateLineNumbers(textarea, lineNumbersDiv, backdrop) {
        const value = textarea.value;

        if (value.length === 0) {
            lineNumbersDiv.innerHTML = '<div>1</div>';
            return;
        }

        const style = window.getComputedStyle(backdrop);
        let lineHeight = parseFloat(style.lineHeight);
        if (isNaN(lineHeight) || lineHeight === 0) {
            const fs = parseFloat(style.fontSize) || 13;
            lineHeight = fs * 1.5;
        }

        const codeLines = backdrop.querySelectorAll('.code-line');

        let html = '';
        let logicalIndex = 1;

        codeLines.forEach((el) => {
            const h = el.getBoundingClientRect().height || el.offsetHeight || lineHeight;
            const visualLinesForThisLogical = Math.max(1, Math.round(h / lineHeight));

            html += `<div>${logicalIndex}</div>`;

            for (let i = 1; i < visualLinesForThisLogical; i++) {
                html += `<div class="wrapped-line"></div>`;
            }

            logicalIndex++;
        });

        lineNumbersDiv.innerHTML = html;
    }

    // ==================== SPELL CHECKING UTILITIES ====================

    // Levenshtein distance algorithm for fuzzy string matching
    function levenshteinDistance(a, b) {
        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }

    // Comprehensive list of valid CSS properties
    const validCSSProperties = [
        // Layout & Positioning
        'display', 'position', 'top', 'right', 'bottom', 'left', 'float', 'clear',
        'z-index', 'overflow', 'overflow-x', 'overflow-y', 'overflow-wrap', 'clip', 'visibility',

        // Box Model
        'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
        'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
        'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
        'box-sizing', 'aspect-ratio',

        // Border
        'border', 'border-width', 'border-style', 'border-color', 'border-radius',
        'border-top', 'border-right', 'border-bottom', 'border-left',
        'border-top-width', 'border-top-style', 'border-top-color', 'border-top-left-radius', 'border-top-right-radius',
        'border-right-width', 'border-right-style', 'border-right-color',
        'border-bottom-width', 'border-bottom-style', 'border-bottom-color', 'border-bottom-left-radius', 'border-bottom-right-radius',
        'border-left-width', 'border-left-style', 'border-left-color',
        'border-image', 'border-image-source', 'border-image-slice', 'border-image-width', 'border-image-outset', 'border-image-repeat',
        'border-collapse', 'border-spacing',

        // Background
        'background', 'background-color', 'background-image', 'background-repeat', 'background-attachment',
        'background-position', 'background-position-x', 'background-position-y', 'background-size', 'background-clip',
        'background-origin', 'background-blend-mode',

        // Typography
        'color', 'font', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
        'line-height', 'letter-spacing', 'word-spacing', 'text-align', 'text-decoration', 'text-decoration-line',
        'text-decoration-color', 'text-decoration-style', 'text-decoration-thickness',
        'text-transform', 'text-indent', 'text-shadow', 'text-overflow', 'text-rendering',
        'white-space', 'word-break', 'word-wrap', 'hyphens', 'writing-mode', 'direction', 'unicode-bidi',
        'vertical-align', 'text-align-last', 'text-justify',

        // Flexbox
        'flex', 'flex-direction', 'flex-wrap', 'flex-flow', 'justify-content', 'align-items',
        'align-content', 'align-self', 'flex-grow', 'flex-shrink', 'flex-basis', 'order',

        // Grid
        'grid', 'grid-template', 'grid-template-columns', 'grid-template-rows', 'grid-template-areas',
        'grid-column', 'grid-column-start', 'grid-column-end', 'grid-row', 'grid-row-start', 'grid-row-end',
        'grid-area', 'grid-auto-columns', 'grid-auto-rows', 'grid-auto-flow',
        'gap', 'row-gap', 'column-gap', 'grid-gap', 'grid-row-gap', 'grid-column-gap',
        'place-content', 'place-items', 'place-self', 'justify-items', 'justify-self',

        // Transform & Animation
        'transform', 'transform-origin', 'transform-style', 'perspective', 'perspective-origin',
        'backface-visibility', 'animation', 'animation-name', 'animation-duration', 'animation-timing-function',
        'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-fill-mode',
        'animation-play-state', 'transition', 'transition-property', 'transition-duration',
        'transition-timing-function', 'transition-delay', 'will-change',

        // Visual Effects
        'opacity', 'filter', 'backdrop-filter', 'mix-blend-mode', 'isolation',
        'box-shadow', 'clip-path', 'mask', 'mask-image', 'mask-mode', 'mask-repeat', 'mask-position',
        'mask-clip', 'mask-origin', 'mask-size', 'mask-composite',

        // Lists & Tables
        'list-style', 'list-style-type', 'list-style-position', 'list-style-image',
        'table-layout', 'caption-side', 'empty-cells',

        // Generated Content
        'content', 'quotes', 'counter-reset', 'counter-increment', 'counter-set',

        // UI
        'cursor', 'caret-color', 'pointer-events', 'resize', 'user-select', 'touch-action',
        'scroll-behavior', 'scroll-margin', 'scroll-padding', 'scroll-snap-type', 'scroll-snap-align',
        'appearance', 'outline', 'outline-width', 'outline-style', 'outline-color', 'outline-offset',

        // Columns
        'columns', 'column-count', 'column-width', 'column-gap', 'column-rule', 'column-rule-width',
        'column-rule-style', 'column-rule-color', 'column-span', 'column-fill', 'break-before',
        'break-after', 'break-inside',

        // Container Queries
        'container', 'container-type', 'container-name',

        // Other
        'all', 'object-fit', 'object-position', 'image-rendering', 'image-orientation',
        'shape-outside', 'shape-margin', 'shape-image-threshold',

        // Vendor Prefixes (common ones)
        '-webkit-appearance', '-moz-appearance', '-webkit-transform', '-moz-transform', '-ms-transform', '-o-transform',
        '-webkit-transition', '-moz-transition', '-ms-transition', '-o-transition',
        '-webkit-animation', '-moz-animation', '-ms-animation', '-o-animation',
        '-webkit-border-radius', '-moz-border-radius',
        '-webkit-box-shadow', '-moz-box-shadow',
        '-webkit-box-sizing', '-moz-box-sizing',
        '-webkit-user-select', '-moz-user-select', '-ms-user-select',
        '-webkit-filter', '-moz-filter', '-ms-filter',
        '-webkit-backdrop-filter',
        '-webkit-clip-path',
        '-webkit-mask', '-webkit-mask-image'
    ];

    // Cache for Levenshtein suggestions to improve performance
    const suggestionCache = {};

    // Find closest matching valid CSS property
    function findClosestProperty(typo) {
        // Check cache first
        if (suggestionCache[typo]) {
            return suggestionCache[typo];
        }

        let closest = null;
        let minDistance = Infinity;

        for (const validProp of validCSSProperties) {
            const distance = levenshteinDistance(typo, validProp);

            // Only suggest if 1-2 characters different and closer than previous match
            if (distance > 0 && distance <= 2 && distance < minDistance) {
                minDistance = distance;
                closest = validProp;
            }
        }

        // Cache the result
        suggestionCache[typo] = closest;
        return closest;
    }

    // Hybrid validation: dictionary first, then Levenshtein, then valid property check
    function validatePropertyName(propertyName) {
        const lowerProp = propertyName.toLowerCase();

        // 1. Check manual typo dictionary first (fastest, highest confidence)
        if (commonTypos[lowerProp]) {
            return {
                valid: false,
                suggestion: commonTypos[lowerProp],
                confidence: 'high'
            };
        }

        // 2. Check if it's a valid property
        if (validCSSProperties.includes(lowerProp)) {
            return { valid: true };
        }

        // 3. Check if it's a custom property (CSS variables)
        if (lowerProp.startsWith('--')) {
            return { valid: true };
        }

        // 4. Use Levenshtein to find closest match
        const suggestion = findClosestProperty(lowerProp);

        if (suggestion) {
            return {
                valid: false,
                suggestion: suggestion,
                confidence: 'medium'
            };
        }

        // 5. No suggestion found - unknown property
        return {
            valid: false,
            suggestion: null,
            confidence: 'unknown'
        };
    }

    // Valid CSS named colors (140 colors)
    const validCSSColors = [
        'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black',
        'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse',
        'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue',
        'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgrey', 'darkgreen', 'darkkhaki',
        'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon',
        'darkseagreen', 'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise',
        'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue',
        'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite',
        'gold', 'goldenrod', 'gray', 'grey', 'green', 'greenyellow', 'honeydew', 'hotpink',
        'indianred', 'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen',
        'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow',
        'lightgray', 'lightgrey', 'lightgreen', 'lightpink', 'lightsalmon', 'lightseagreen',
        'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow',
        'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine', 'mediumblue',
        'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen',
        'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose',
        'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange',
        'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred',
        'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple',
        'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen',
        'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey',
        'snow', 'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise',
        'violet', 'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen',
        // Special keywords
        'transparent', 'currentcolor', 'inherit', 'initial', 'unset'
    ];

    // Cache for color suggestions
    const colorSuggestionCache = {};

    // Find closest matching valid CSS color
    function findClosestColor(typo) {
        if (colorSuggestionCache[typo]) {
            return colorSuggestionCache[typo];
        }

        let closest = null;
        let minDistance = Infinity;

        for (const validColor of validCSSColors) {
            const distance = levenshteinDistance(typo, validColor);

            if (distance > 0 && distance <= 2 && distance < minDistance) {
                minDistance = distance;
                closest = validColor;
            }
        }

        colorSuggestionCache[typo] = closest;
        return closest;
    }

    // Color name typo dictionary (for common/high-confidence corrections)
    const commonColorTypos = {
        'reed': 'red',
        'redd': 'red',
        'blu': 'blue',
        'bleu': 'blue',
        'bule': 'blue',
        'grean': 'green',
        'gren': 'green',
        'greeen': 'green',
        'yellw': 'yellow',
        'yello': 'yellow',
        'yelow': 'yellow',
        'ornge': 'orange',
        'orage': 'orange',
        'purpel': 'purple',
        'purpl': 'purple',
        'pruple': 'purple',
        'pnk': 'pink',
        'pnik': 'pink',
        'blck': 'black',
        'balck': 'black',
        'blak': 'black',
        'whte': 'white',
        'wite': 'white',
        'whitee': 'white',
        'gry': 'gray',
        'silve': 'silver',
        'sliver': 'silver',
        'brwn': 'brown',
        'borwn': 'brown',
        'bown': 'brown'
    };

    // Validate color name
    function validateColorName(colorName) {
        const lowerColor = colorName.toLowerCase();

        // 1. Check manual color typo dictionary first
        if (commonColorTypos[lowerColor]) {
            return {
                valid: false,
                suggestion: commonColorTypos[lowerColor],
                confidence: 'high'
            };
        }

        // 2. Check if it's a valid color
        if (validCSSColors.includes(lowerColor)) {
            return { valid: true };
        }

        // 3. Use Levenshtein to find closest match
        const suggestion = findClosestColor(lowerColor);

        if (suggestion) {
            return {
                valid: false,
                suggestion: suggestion,
                confidence: 'medium'
            };
        }

        // 4. No suggestion found
        return {
            valid: false,
            suggestion: null,
            confidence: 'unknown'
        };
    }

    // Common CSS property typos mapped to correct property names
    const commonTypos = {
        // Border typos
        'bordr': 'border',
        'bordre': 'border',
        'boder': 'border',
        'broder': 'border',
        'border-raduis': 'border-radius',
        'border-raius': 'border-radius',
        'border-radiius': 'border-radius',
        'broder-radius': 'border-radius',

        // Color typos
        'collor': 'color',
        'colr': 'color',
        'clor': 'color',
        'colour': 'color',
        'backgroud': 'background',
        'backgrund': 'background',
        'bakground': 'background',
        'background-collor': 'background-color',
        'backgorund-color': 'background-color',

        // Display typos
        'dispaly': 'display',
        'dislay': 'display',
        'dsiplay': 'display',
        'displya': 'display',

        // Margin/Padding typos
        'margn': 'margin',
        'marign': 'margin',
        'maring': 'margin',
        'margim': 'margin',
        'paddin': 'padding',
        'paading': 'padding',
        'paddng': 'padding',

        // Width/Height typos
        'widht': 'width',
        'wdith': 'width',
        'witdh': 'width',
        'hieght': 'height',
        'heigth': 'height',
        'heght': 'height',
        'max-widht': 'max-width',
        'min-widht': 'min-width',
        'max-hieght': 'max-height',
        'min-hieght': 'min-height',

        // Position typos
        'postion': 'position',
        'positon': 'position',
        'psition': 'position',

        // Font typos
        'font-szie': 'font-size',
        'font-famly': 'font-family',
        'font-wieght': 'font-weight',
        'font-weigth': 'font-weight',

        // Text typos
        'txt-align': 'text-align',
        'text-decoraton': 'text-decoration',
        'text-trasform': 'text-transform',

        // Float typos
        'flot': 'float',
        'flaot': 'float',

        // Overflow typos
        'overlow': 'overflow',
        'overfow': 'overflow',

        // Z-index typos
        'zindex': 'z-index',
        'z-indx': 'z-index',

        // Opacity typos
        'opactiy': 'opacity',
        'opacty': 'opacity',

        // Transition typos
        'transistion': 'transition',
        'trasition': 'transition',
        'tranistion': 'transition',

        // Transform typos
        'tranform': 'transform',
        'trasform': 'transform',
        'transfrom': 'transform',

        // Vendor-prefixed transform typos
        '-webkit-tranform': '-webkit-transform',
        '-moz-tranform': '-moz-transform',
        '-ms-tranform': '-ms-transform',
        '-o-tranform': '-o-transform',
        '-webkit-trasform': '-webkit-transform',
        '-moz-trasform': '-moz-transform'
    };

    // ==================== VALIDATION ====================
    function findCssFunctionCalls(value, functionName) {
        const matches = [];
        if (!value || !functionName) return matches;

        const source = String(value);
        const lowerSource = source.toLowerCase();
        const needle = functionName.toLowerCase() + '(';
        let searchIndex = 0;

        while (searchIndex < lowerSource.length) {
            const start = lowerSource.indexOf(needle, searchIndex);
            if (start === -1) break;

            let depth = 1;
            let end = start + needle.length;

            while (end < source.length && depth > 0) {
                const char = source[end];
                if (char === '(') depth++;
                if (char === ')') depth--;
                end++;
            }

            if (depth !== 0) {
                break;
            }

            matches.push({
                start,
                end,
                content: source.slice(start + needle.length, end - 1)
            });
            searchIndex = end;
        }

        return matches;
    }

    function splitTopLevel(value, separatorChar) {
        const parts = [];
        let current = '';
        let depth = 0;

        for (let i = 0; i < value.length; i++) {
            const char = value[i];
            if (char === '(') depth++;
            if (char === ')' && depth > 0) depth--;

            if (char === separatorChar && depth === 0) {
                parts.push(current.trim());
                current = '';
                continue;
            }

            current += char;
        }

        if (current.trim() || !parts.length) {
            parts.push(current.trim());
        }

        return parts.filter(part => part !== '');
    }

    function isGradientDirectionSegment(value) {
        return /^(?:to\b|[-+]?\d*\.?\d+(?:deg|grad|rad|turn)\b)/i.test(String(value || '').trim());
    }

    function validateCSS(code) {
        const errors = [];
        const warnings = [];

        // Native browser CSS parser validation (safety net)
        let nativeParserFailed = false;
        try {
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(code);
        } catch (e) {
            nativeParserFailed = true;
            // Don't add error yet - custom validators will provide detailed message
        }

        // Strip strings and comments before counting brackets to avoid false positives
        let codeWithoutStringsAndComments = code;

        // Remove comments first
        codeWithoutStringsAndComments = codeWithoutStringsAndComments.replace(/\/\*[\s\S]*?\*\//g, '');

        // Remove quoted strings (both single and double quotes, with escape support)
        codeWithoutStringsAndComments = codeWithoutStringsAndComments.replace(/(['"])(?:(?=(\\?))\2.)*?\1/g, '');

        const openBrackets = (codeWithoutStringsAndComments.match(/{/g) || []).length;
        const closeBrackets = (codeWithoutStringsAndComments.match(/}/g) || []).length;
        if (openBrackets !== closeBrackets) {
            if (closeBrackets > openBrackets) {
                errors.push(`Unbalanced brackets: ${closeBrackets - openBrackets} extra closing brace(s) "}" - check for premature block closures`);
            } else {
                errors.push(`Unbalanced brackets: ${openBrackets - closeBrackets} unclosed opening brace(s) "{"`);
            }
        }

        // Check for unclosed comments
        const openComments = (code.match(/\/\*/g) || []).length;
        const closeComments = (code.match(/\*\//g) || []).length;
        if (openComments !== closeComments) {
            if (openComments > closeComments) {
                errors.push(`Unclosed comment - missing ${openComments - closeComments} closing "*/" tag(s)`);
            } else {
                errors.push(`Comment closing "*/" without opening "/*" tag`);
            }
        }

        // Check for comments that start improperly (text before /*)
        const lines = code.split('\n');
        lines.forEach((line, index) => {
            // Check for */ without /* on the same line or before
            if (line.includes('*/') && !line.includes('/*')) {
                // This might be a multi-line comment, but check if it looks like stray */
                const beforeStar = line.substring(0, line.indexOf('*/'));
                if (beforeStar.trim().length > 0 && !beforeStar.trim().startsWith('*')) {
                    // There's content before */ that doesn't look like continuation
                    const hasOpenCommentBefore = code.substring(0, code.split('\n').slice(0, index).join('\n').length).includes('/*');
                    if (!hasOpenCommentBefore) {
                        errors.push(`Line ${index + 1}: Closing comment tag "*/" without opening "/*"`);
                    }
                }
            }
        });

        // Check for unclosed strings (double quotes and single quotes)

        // Check for missing opening brackets
        // Pattern: selector followed by properties without opening bracket
        let inBlock = false;
        let inAtRule = false;
        let lastSelectorLine = -1;
        let lastSelectorContent = '';

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();

            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*') || trimmedLine.endsWith('*/')) {
                return;
            }

            // Track @-rules
            if (trimmedLine.startsWith('@')) {
                inAtRule = true;
            }

            // Check for opening bracket
            if (trimmedLine.includes('{')) {
                inBlock = true;
                lastSelectorLine = -1;
            }

            // Check for closing bracket
            if (trimmedLine.includes('}')) {
                inBlock = false;
                lastSelectorLine = -1;
                // Check if this closes an @-rule
                if (inAtRule && !trimmedLine.includes('{')) {
                    inAtRule = false;
                }
            }

            // Detect potential selector lines (lines that look like selectors)
            // Selectors typically contain: .class, #id, element, or combinators
            const looksLikeSelector = /^[\w\s\.\#\[\]\:\(\)\,\>\+\~\*\-]+$/.test(trimmedLine) &&
                                       !trimmedLine.includes(':') &&
                                       !trimmedLine.includes(';') &&
                                       !trimmedLine.includes('{') &&
                                       !trimmedLine.includes('}');

            if (looksLikeSelector && !inBlock) {
                lastSelectorLine = index;
                lastSelectorContent = trimmedLine;
            }

            // Check if we have a property declaration without being in a block
            const hasPropertyDeclaration = /^[a-z\-]+\s*:\s*.+/i.test(trimmedLine);

            if (hasPropertyDeclaration && !inBlock && lastSelectorLine !== -1) {
                errors.push(`Line ${lastSelectorLine + 1}: Missing opening bracket "{" after selector "${lastSelectorContent}"`);
                lastSelectorLine = -1; // Reset to avoid duplicate errors
            }

            // Check for orphaned declarations AFTER first block closes
            // Properties at file start are valid (CMS wraps them)
            // But properties after } are orphaned
            const hasSeenClosingBrace = code.substring(0, code.indexOf(trimmedLine)).includes('}');
            if (hasPropertyDeclaration && !inBlock && !inAtRule && lastSelectorLine === -1 && hasSeenClosingBrace) {
                errors.push(`Line ${index + 1}: Orphaned declaration "${trimmedLine.substring(0, 30)}..." - property must be inside a selector block`);
            }
        });
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();

            // Skip comments
            if (trimmedLine.startsWith('/*')) {
                return;
            }

            // Check for unclosed double-quote strings
            // Count quotes that are not escaped
            let doubleQuoteCount = 0;
            let singleQuoteCount = 0;
            let isEscaped = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (isEscaped) {
                    isEscaped = false;
                    continue;
                }

                if (char === '\\') {
                    isEscaped = true;
                    continue;
                }

                if (char === '"') {
                    doubleQuoteCount++;
                }

                if (char === "'") {
                    singleQuoteCount++;
                }
            }

            // Odd number of quotes means unclosed string
            if (doubleQuoteCount % 2 !== 0) {
                errors.push(`Line ${index + 1}: Unclosed double-quote string`);
            }

            if (singleQuoteCount % 2 !== 0) {
                errors.push(`Line ${index + 1}: Unclosed single-quote string`);
            }
        });

        // Check for duplicate properties and invalid selectors
        // Parse CSS blocks to find duplicate properties
        const blockPattern = /([^{]+)\{([^}]+)\}/g;
        let blockMatch;
        let blockIndex = 0;

        while ((blockMatch = blockPattern.exec(code)) !== null) {
            const selector = blockMatch[1].trim();
            const blockContent = blockMatch[2];
            blockIndex++;

            // Check for invalid selector syntax
            // Check for double dots (..)
            if (/\.\./.test(selector)) {
                errors.push(`Invalid selector "${selector.substring(0, 30)}..." - double dots (..)`);
            }

            // Check for double hashes (##)
            if (/##/.test(selector)) {
                errors.push(`Invalid selector "${selector.substring(0, 30)}..." - double hashes (##)`);
            }

            // Check for space before class/id in compound selector
            if (/\s+\.[a-z]/i.test(selector) || /\s+#[a-z]/i.test(selector)) {
                // This could be a descendant selector, which is valid, so only flag if it looks wrong
                // e.g., "div .class" is valid, but ". class" is not
                if (/^\.\s+[a-z]/i.test(selector) || /^#\s+[a-z]/i.test(selector)) {
                    errors.push(`Invalid selector "${selector.substring(0, 30)}..." - space after . or #`);
                }
            }

            // Check for missing colon before functional pseudo-classes
            // e.g., a:linkis(:hover) should be a:link:is(:hover)
            const missingColonMatch = selector.match(/:(link|visited|hover|focus|active|focus-within|focus-visible|first-child|last-child|nth-child|nth-of-type|first-of-type|last-of-type|only-child|only-of-type|empty|checked|disabled|enabled|required|optional|valid|invalid|placeholder-shown|root|target|any-link)(is|not|where|has)\s*\(/i);
            if (missingColonMatch) {
                errors.push(`Invalid selector "${selector.substring(0, 40)}..." - missing colon before :${missingColonMatch[2]}() (found ":${missingColonMatch[1]}${missingColonMatch[2]}(" instead of ":${missingColonMatch[1]}:${missingColonMatch[2]}(")`);
            }

            // Check for semicolons in selectors (invalid in :is(), :where(), etc.)
            // Skip if selector contains } or @ (regex captured across blocks)
            if (/;/.test(selector) && !selector.includes('}') && !selector.includes('@')) {
                errors.push(`Invalid selector "${selector.substring(0, 30)}..." - semicolons not allowed in selectors`);
            }

            // Check for duplicate properties within this block
            const properties = {};
            const propertyLines = blockContent.split(';');

            propertyLines.forEach((propLine) => {
                const propMatch = propLine.trim().match(/^([a-z\-]+)\s*:/i);
                if (propMatch) {
                    const propName = propMatch[1].toLowerCase();

                    if (properties[propName]) {
                        properties[propName]++;
                    } else {
                        properties[propName] = 1;
                    }
                }
            });

            // Report duplicates as warnings
            Object.keys(properties).forEach((propName) => {
                if (properties[propName] > 1) {
                    warnings.push(`Duplicate property "${propName}" defined ${properties[propName]} times in selector block ${blockIndex}`);
                }
            });
        }

        // Track multi-line values (unclosed parentheses) for validation
        let validationInMultiLineValue = false;

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();

            // Skip empty lines, comments, and lines with only brackets
            if (!trimmedLine || trimmedLine.startsWith('/*') || trimmedLine === '{' || trimmedLine === '}') {
                return;
            }

            // Track multi-line values: skip continuation lines from validation checks
            // that assume one-property-per-line (like the semicolon check)
            if (validationInMultiLineValue) {
                const openParens = (trimmedLine.match(/\(/g) || []).length;
                const closeParens = (trimmedLine.match(/\)/g) || []).length;
                if (closeParens > openParens || (/\)\s*;?\s*$/.test(trimmedLine) && closeParens >= openParens)) {
                    validationInMultiLineValue = false;
                }
                return; // Skip all per-line checks for continuation lines
            }

            // Detect start of multi-line value on property lines
            if (/^[a-z\-]+\s*:/i.test(trimmedLine)) {
                const openParens = (trimmedLine.match(/\(/g) || []).length;
                const closeParens = (trimmedLine.match(/\)/g) || []).length;
                if (openParens > closeParens) {
                    validationInMultiLineValue = true;
                }
            }

            // Check for selector issues before skipping selector lines
            if (trimmedLine.endsWith('{') || trimmedLine.includes('{')) {
                const selectorPart = trimmedLine.split('{')[0].trim();

                // Check for space after dot or hash at start of selector
                if (/^\.\s/.test(selectorPart)) {
                    errors.push(`Line ${index + 1}: Invalid selector - space after dot (.)`);
                }
                if (/^#\s/.test(selectorPart)) {
                    errors.push(`Line ${index + 1}: Invalid selector - space after hash (#)`);
                }
            }

            // Skip selector lines (lines that end with { or contain pseudo-classes/elements)
            // BUT: Don't skip property declarations like "padding:1em" or "color:red"
            // Property pattern: word-only chars, colon, value without spaces in property name
            // Also check that the colon isn't a pseudo-class/element (e.g., body:not(...), div::after)
            const colonMatch = trimmedLine.match(/^([a-z\-]+)\s*(:)/i);
            const looksLikePseudo = colonMatch && /^:?(?:not|is|where|has|hover|focus|active|visited|first-child|last-child|nth-child|nth-of-type|first-of-type|last-of-type|only-child|only-of-type|empty|checked|disabled|enabled|required|optional|valid|invalid|focus-within|focus-visible|placeholder-shown|root|lang|target|link|any-link|before|after|first-line|first-letter|selection|placeholder|marker|backdrop)\b/i.test(trimmedLine.substring((colonMatch[1]).length + colonMatch[2].length));
            const looksLikeProperty = /^[a-z\-]+\s*:\s*[^\s]/.test(trimmedLine) && !looksLikePseudo;

            if (!looksLikeProperty && (trimmedLine.endsWith('{') || /^[\w\s\.\#\[\]\:\(\)\,\>\+\~\*\-]+\{?$/.test(trimmedLine))) {
                return;
            }

            // Check for missing colon - property line without colon
            // Look for lines that have alphanumeric content and a value-like pattern but no colon
            if (!trimmedLine.includes(':') && !trimmedLine.startsWith('}') && !trimmedLine.endsWith('}')) {
                // Check if it looks like a property declaration (word followed by space/value)
                // Examples: "border-radius 10px", "color red", "display block"
                const possibleProperty = /^([a-z\-]+)\s+([^\s;]+)/i.test(trimmedLine);
                if (possibleProperty) {
                    errors.push(`Line ${index + 1}: Missing colon after property name`);
                }
            }

            // Check for stray/orphaned semicolon on its own line
            if (trimmedLine === ';') {
                errors.push(`Line ${index + 1}: Stray semicolon - not associated with any declaration`);
            }

            // Check for multiple consecutive closing braces
            if (/\}\}+/.test(trimmedLine)) {
                const braceCount = (trimmedLine.match(/\}/g) || []).length;
                if (braceCount > 1) {
                    errors.push(`Line ${index + 1}: Multiple consecutive closing braces (${braceCount} found)`);
                }
            }

            // Check for missing property values
            // Pattern: property: ; or property:; (colon with no value before semicolon)
            if (trimmedLine.includes(':')) {
                // Check for colon with no property name (e.g., ": ;" or ": value")
                if (/^\s*:\s*/.test(trimmedLine) && !trimmedLine.startsWith('::')) {
                    errors.push(`Line ${index + 1}: Missing property name before colon`);
                }

                // Match pattern like "color: ;" or "color:;" or "color:" at end of line
                const emptyValuePattern = /^([a-z\-]+)\s*:\s*;?\s*$/i;
                const match = trimmedLine.match(emptyValuePattern);
                if (match) {
                    errors.push(`Line ${index + 1}: Missing value for property "${match[1]}"`);
                }

                // Check for property name typos using hybrid validation
                const propertyMatch = trimmedLine.match(/^([a-z\-]+)\s*:/i);
                if (propertyMatch) {
                    // Skip if the colon is part of a pseudo-class/element (e.g., body:not(...), div::after)
                    const afterPropColon = trimmedLine.substring(propertyMatch[0].length);
                    if (/^:?(?:not|is|where|has|hover|focus|active|visited|first-child|last-child|nth-child|nth-of-type|first-of-type|last-of-type|only-child|only-of-type|empty|checked|disabled|enabled|required|optional|valid|invalid|focus-within|focus-visible|placeholder-shown|root|lang|target|link|any-link|before|after|first-line|first-letter|selection|placeholder|marker|backdrop)\b/i.test(afterPropColon)) {
                        return; // This is a selector with pseudo-class/element, not a property
                    }
                    const propertyName = propertyMatch[1].toLowerCase();
                    const validation = validatePropertyName(propertyName);

                    if (!validation.valid) {
                        if (validation.suggestion) {
                            errors.push(`Line ${index + 1}: Invalid property "${propertyName}" - did you mean "${validation.suggestion}"?`);
                        } else {
                            errors.push(`Line ${index + 1}: Unknown CSS property "${propertyName}"`);
                        }
                    }
                }

                // Check for invalid units
                // Valid CSS units: px, em, rem, %, vh, vw, vmin, vmax, pt, pc, in, cm, mm, ex, ch, s, ms, deg, rad, grad, turn, fr
                const validUnits = ['px', 'em', 'rem', '%', 'vh', 'vw', 'vmin', 'vmax', 'pt', 'pc', 'in', 'cm', 'mm', 'ex', 'ch', 's', 'ms', 'deg', 'rad', 'grad', 'turn', 'fr', 'q', 'dpi', 'dpcm', 'dppx', 'hz', 'khz'];

                // Strip URLs and hex colors before checking units to avoid false positives
                let lineForUnitCheck = trimmedLine;
                // Remove url() functions
                lineForUnitCheck = lineForUnitCheck.replace(/url\([^)]*\)/gi, '');
                // Remove hex colors (3, 4, 6, or 8 digits)
                lineForUnitCheck = lineForUnitCheck.replace(/#[0-9a-fA-F]{3,8}\b/g, '');

                // Match numbers followed by units (e.g., 10px, 1.5em, 100%, etc.)
                // Updated regex to catch longer unit sequences: [a-z]+ instead of [a-z]{1,4}
                const unitMatches = lineForUnitCheck.matchAll(/(\d+\.?\d*)(px|em|rem|%|vh|vw|vmin|vmax|pt|pc|in|cm|mm|ex|ch|s|ms|deg|rad|grad|turn|fr|q|dpi|dpcm|dppx|hz|khz|[a-z]+)\b/gi);

                for (const match of unitMatches) {
                    const unit = match[2].toLowerCase();

                    // Skip if this looks like it's part of a CSS keyword/function
                    // Check if the unit is followed by more letters (indicating it's a word, not a unit)
                    const fullMatch = match[0];
                    const afterMatch = lineForUnitCheck.substring(lineForUnitCheck.indexOf(fullMatch) + fullMatch.length, lineForUnitCheck.indexOf(fullMatch) + fullMatch.length + 1);
                    if (/[a-z]/i.test(afterMatch)) {
                        continue; // This is part of a longer word, skip it
                    }

                    // Check if it's a valid unit or a common typo
                    if (!validUnits.includes(unit)) {
                        // Common unit typos
                        const unitTypos = {
                            'pxx': 'px',
                            'pz': 'px',
                            'emm': 'em',
                            'rrem': 'rem',
                            'pct': '%',
                            'vhh': 'vh',
                            'vww': 'vw'
                        };

                        if (unitTypos[unit]) {
                            errors.push(`Line ${index + 1}: Invalid unit "${unit}" - did you mean "${unitTypos[unit]}"?`);
                        } else if (/^px+$/.test(unit) && unit !== 'px') {
                            // Catches pxxx, pxxxx, etc.
                            errors.push(`Line ${index + 1}: Invalid unit "${unit}" - did you mean "px"?`);
                        } else if (/^em+$/.test(unit) && unit !== 'em') {
                            // Catches emmm, emmmm, etc.
                            errors.push(`Line ${index + 1}: Invalid unit "${unit}" - did you mean "em"?`);
                        } else if (/^rem+$/.test(unit) && unit !== 'rem') {
                            // Catches remmm, remmmm, etc.
                            errors.push(`Line ${index + 1}: Invalid unit "${unit}" - did you mean "rem"?`);
                        } else if (/^vh+$/.test(unit) && unit !== 'vh') {
                            // Catches vhhh, vhhhh, etc.
                            errors.push(`Line ${index + 1}: Invalid unit "${unit}" - did you mean "vh"?`);
                        } else if (/^vw+$/.test(unit) && unit !== 'vw') {
                            // Catches vwww, vwwww, etc.
                            errors.push(`Line ${index + 1}: Invalid unit "${unit}" - did you mean "vw"?`);
                        } else if (/^[a-z]{2,}$/.test(unit)) {
                            // Unknown unit that looks like it could be a typo
                            errors.push(`Line ${index + 1}: Invalid or unknown unit "${unit}"`);
                        }
                    }
                }

                // Extract property name and value for multiple validations below
                // v7.4: Fixed HTML entity regex - entity pattern first, exclude & from char class
                const propValueMatch = trimmedLine.match(/^([a-z\-]+)\s*:\s*((?:&[a-z]+;|[^;&])+)/i);

                // Check for invalid color values
                if (propValueMatch) {
                    const propertyName = propValueMatch[1].toLowerCase();
                    const propertyValue = propValueMatch[2].trim();

                    // Check if this is a color-related property
                    const colorProperties = ['color', 'background-color', 'border-color', 'outline-color', 'text-decoration-color', 'background', 'box-shadow', 'text-shadow'];

                    if (colorProperties.includes(propertyName) || propertyName.includes('color')) {
                        // Check for malformed hex colors
                        // Updated regex to capture the full hex-like string (valid or invalid)
                        const hexMatches = propertyValue.matchAll(/#([0-9a-fA-F]{3,8}|[^\s;,)]+)/g);
                        for (const hexMatch of hexMatches) {
                            const hexValue = hexMatch[1];
                            const validHexLengths = [3, 4, 6, 8]; // #RGB, #RGBA, #RRGGBB, #RRGGBBAA

                            // Check for invalid hex characters first
                            if (!/^[0-9a-fA-F]+$/.test(hexValue)) {
                                errors.push(`Line ${index + 1}: Invalid hex color "#${hexValue}" - contains invalid characters (only 0-9, A-F allowed)`);
                            } else if (!validHexLengths.includes(hexValue.length)) {
                                // Only check length if characters are valid
                                errors.push(`Line ${index + 1}: Invalid hex color "#${hexValue}" - hex colors must be 3, 4, 6, or 8 characters`);
                            }
                        }

                        // Check for invalid RGB/RGBA values
                        const rgbMatches = propertyValue.matchAll(/rgba?\(([^)]+)\)/gi);
                        for (const rgbMatch of rgbMatches) {
                            let rgbContent = rgbMatch[1].trim();

                            // Temporarily replace calc() functions to avoid breaking comma splitting
                            const calcPlaceholders = [];
                            rgbContent = rgbContent.replace(/calc\([^)]+\)/gi, (match) => {
                                calcPlaceholders.push(match);
                                return `__CALC_${calcPlaceholders.length - 1}__`;
                            });

                            const values = rgbContent.split(',').map(v => v.trim());

                            // RGB should have 3 values, RGBA should have 4
                            const isRgba = rgbMatch[0].toLowerCase().startsWith('rgba');
                            const expectedLength = isRgba ? 4 : 3;

                            if (values.length !== expectedLength) {
                                errors.push(`Line ${index + 1}: Invalid ${isRgba ? 'rgba' : 'rgb'} - expected ${expectedLength} values, got ${values.length}`);
                            } else {
                                // Check RGB values (0-255) - skip calc() placeholders
                                for (let i = 0; i < 3; i++) {
                                    // Skip validation if value is a calc() placeholder
                                    if (values[i].includes('__CALC_')) {
                                        continue;
                                    }
                                    const val = parseInt(values[i]);
                                    if (isNaN(val) || val < 0 || val > 255) {
                                        errors.push(`Line ${index + 1}: Invalid ${isRgba ? 'rgba' : 'rgb'} - RGB values must be 0-255, got "${values[i]}"`);
                                        break;
                                    }
                                }

                                // Check alpha value (0-1) for RGBA
                                if (isRgba && values.length === 4) {
                                    // Skip validation if alpha is a calc() placeholder
                                    if (!values[3].includes('__CALC_')) {
                                        const alpha = parseFloat(values[3]);
                                        if (isNaN(alpha) || alpha < 0 || alpha > 1) {
                                            errors.push(`Line ${index + 1}: Invalid rgba - alpha value must be 0-1, got "${values[3]}"`);
                                        }
                                    }
                                }
                            }
                        }

                        // Check for color name typos using hybrid validation
                        const simpleWordMatch = propertyValue.match(/^([a-z]+)$/i);
                        if (simpleWordMatch) {
                            const word = simpleWordMatch[1].toLowerCase();
                            const colorValidation = validateColorName(word);

                            if (!colorValidation.valid) {
                                if (colorValidation.suggestion) {
                                    errors.push(`Line ${index + 1}: Invalid color "${word}" - did you mean "${colorValidation.suggestion}"?`);
                                } else {
                                    errors.push(`Line ${index + 1}: Unknown color name "${word}"`);
                                }
                            }
                        }
                    }
                }

                // Check for invalid property values (wrong value types)
                if (propValueMatch) {
                    const propertyName = propValueMatch[1].toLowerCase();
                    const propertyValue = propValueMatch[2].trim();

                    // Define expected value types for common properties
                    const propertyValueRules = {
                        'display': {
                            validValues: ['none', 'block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid', 'table', 'table-row', 'table-cell', 'list-item', 'run-in', 'contents', 'inherit', 'initial', 'unset'],
                            type: 'keyword',
                            message: 'must be a display keyword (block, inline, flex, grid, none, etc.)'
                        },
                        'position': {
                            validValues: ['static', 'relative', 'absolute', 'fixed', 'sticky', 'inherit', 'initial', 'unset'],
                            type: 'keyword',
                            message: 'must be a position keyword (static, relative, absolute, fixed, sticky)'
                        },
                        'float': {
                            validValues: ['none', 'left', 'right', 'inherit', 'initial', 'unset'],
                            type: 'keyword',
                            message: 'must be a float keyword (none, left, right)'
                        },
                        'clear': {
                            validValues: ['none', 'left', 'right', 'both', 'inherit', 'initial', 'unset'],
                            type: 'keyword',
                            message: 'must be a clear keyword (none, left, right, both)'
                        },
                        'overflow': {
                            validValues: ['visible', 'hidden', 'scroll', 'auto', 'inherit', 'initial', 'unset', 'clip'],
                            type: 'keyword',
                            message: 'must be an overflow keyword (visible, hidden, scroll, auto)'
                        },
                        'overflow-x': {
                            validValues: ['visible', 'hidden', 'scroll', 'auto', 'inherit', 'initial', 'unset', 'clip'],
                            type: 'keyword',
                            message: 'must be an overflow keyword (visible, hidden, scroll, auto)'
                        },
                        'overflow-y': {
                            validValues: ['visible', 'hidden', 'scroll', 'auto', 'inherit', 'initial', 'unset', 'clip'],
                            type: 'keyword',
                            message: 'must be an overflow keyword (visible, hidden, scroll, auto)'
                        },
                        'text-align': {
                            validValues: ['left', 'right', 'center', 'justify', 'start', 'end', 'inherit', 'initial', 'unset'],
                            type: 'keyword',
                            message: 'must be a text-align keyword (left, right, center, justify)'
                        },
                        'vertical-align': {
                            validValues: ['baseline', 'top', 'middle', 'bottom', 'sub', 'super', 'text-top', 'text-bottom', 'inherit', 'initial', 'unset'],
                            type: 'keyword-or-length',
                            message: 'must be a vertical-align keyword or length value'
                        },
                        'text-transform': {
                            validValues: ['none', 'capitalize', 'uppercase', 'lowercase', 'inherit', 'initial', 'unset'],
                            type: 'keyword',
                            message: 'must be a text-transform keyword (none, capitalize, uppercase, lowercase)'
                        },
                        'font-weight': {
                            validValues: ['normal', 'bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '700', '800', '900', 'inherit', 'initial', 'unset'],
                            type: 'keyword-or-number',
                            message: 'must be a font-weight keyword (normal, bold) or number (100-900)'
                        },
                        'font-style': {
                            validValues: ['normal', 'italic', 'oblique', 'inherit', 'initial', 'unset'],
                            type: 'keyword',
                            message: 'must be a font-style keyword (normal, italic, oblique)'
                        },
                        'text-decoration': {
                            validValues: ['none', 'underline', 'overline', 'line-through', 'inherit', 'initial', 'unset'],
                            type: 'keyword-or-multiple',
                            message: 'must be a text-decoration keyword (none, underline, overline, line-through)'
                        },
                        'cursor': {
                            validValues: ['auto', 'default', 'pointer', 'move', 'text', 'wait', 'help', 'crosshair', 'not-allowed', 'grab', 'grabbing', 'zoom-in', 'zoom-out', 'inherit', 'initial', 'unset'],
                            type: 'keyword-or-url',
                            message: 'must be a cursor keyword (pointer, default, move, text, etc.) or url()'
                        },
                        'visibility': {
                            validValues: ['visible', 'hidden', 'collapse', 'inherit', 'initial', 'unset'],
                            type: 'keyword',
                            message: 'must be a visibility keyword (visible, hidden, collapse)'
                        },
                        'z-index': {
                            validValues: ['auto', 'inherit', 'initial', 'unset'],
                            type: 'keyword-or-integer',
                            message: 'must be an integer or "auto"'
                        }
                    };

                    // Check if property has validation rules
                    if (propertyValueRules[propertyName]) {
                        const rule = propertyValueRules[propertyName];
                        const cleanValue = propertyValue.replace(/!important/i, '').trim();

                        // For strict keyword properties
                        if (rule.type === 'keyword') {
                            if (!rule.validValues.includes(cleanValue.toLowerCase())) {
                                // Check if it looks like a wrong type (e.g., numeric value for display)
                                if (/^\d+/.test(cleanValue)) {
                                    errors.push(`Line ${index + 1}: Invalid value "${cleanValue}" for property "${propertyName}" - ${rule.message}`);
                                } else if (!cleanValue.includes('var(') && !cleanValue.includes('calc(')) {
                                    // Only report if it's not a CSS variable or calc function
                                    errors.push(`Line ${index + 1}: Invalid value "${cleanValue}" for property "${propertyName}" - ${rule.message}`);
                                }
                            }
                        }

                        // For properties that accept keywords OR lengths
                        if (rule.type === 'keyword-or-length') {
                            const hasUnit = /^\d+\.?\d*(px|em|rem|%|vh|vw|pt|pc|in|cm|mm|ex|ch)$/i.test(cleanValue);
                            const isKeyword = rule.validValues.includes(cleanValue.toLowerCase());
                            if (!hasUnit && !isKeyword && !cleanValue.includes('var(') && !cleanValue.includes('calc(')) {
                                errors.push(`Line ${index + 1}: Invalid value "${cleanValue}" for property "${propertyName}" - ${rule.message}`);
                            }
                        }

                        // For properties that accept keywords OR numbers
                        if (rule.type === 'keyword-or-number') {
                            const isNumber = /^\d+$/.test(cleanValue);
                            const isKeyword = rule.validValues.includes(cleanValue.toLowerCase());
                            if (!isNumber && !isKeyword && !cleanValue.includes('var(')) {
                                errors.push(`Line ${index + 1}: Invalid value "${cleanValue}" for property "${propertyName}" - ${rule.message}`);
                            }
                        }

                        // For properties that accept keywords OR integers
                        if (rule.type === 'keyword-or-integer') {
                            const isInteger = /^-?\d+$/.test(cleanValue);
                            const isKeyword = rule.validValues.includes(cleanValue.toLowerCase());
                            if (!isInteger && !isKeyword && !cleanValue.includes('var(')) {
                                errors.push(`Line ${index + 1}: Invalid value "${cleanValue}" for property "${propertyName}" - ${rule.message}`);
                            }
                        }
                    }

                    // Check for properties that should NEVER have length values
                    const lengthIncompatibleProps = {
                        'display': true,
                        'position': true,
                        'float': true,
                        'clear': true,
                        'text-transform': true,
                        'font-style': true,
                        'visibility': true
                    };

                    if (lengthIncompatibleProps[propertyName]) {
                        // Check if value contains a length unit
                        if (/\d+\.?\d*(px|em|rem|%|vh|vw|pt|pc|in|cm|mm|ex|ch)/i.test(propertyValue)) {
                            errors.push(`Line ${index + 1}: Property "${propertyName}" does not accept length values`);
                        }
                    }

                    // Check for width/height with keyword values that don't make sense
                    if (['width', 'height', 'max-width', 'max-height', 'min-width', 'min-height'].includes(propertyName)) {
                        const invalidSizeKeywords = ['block', 'inline', 'flex', 'grid', 'left', 'right', 'center', 'top', 'bottom', 'absolute', 'relative', 'fixed'];
                        const cleanValue = propertyValue.replace(/!important/i, '').trim().toLowerCase();
                        if (invalidSizeKeywords.includes(cleanValue)) {
                            errors.push(`Line ${index + 1}: Invalid value "${cleanValue}" for property "${propertyName}" - must be a length, percentage, or valid keyword (auto, inherit, etc.)`);
                        }
                    }
                }

                // Check for calc() function errors
                // Updated regex to handle nested parentheses: (?: ... ) is non-capturing, handles one level of nesting
                const calcMatches = trimmedLine.matchAll(/calc\(((?:[^()]|\([^()]*\))*)\)/gi);
                for (const calcMatch of calcMatches) {
                    const calcContent = calcMatch[1];

                    // Check for missing spaces around operators (+, -, *, /)
                    // CSS calc() requires spaces around + and - operators
                    const plusMinusNoSpace = /\d(\+|-)\d/.test(calcContent) || /\)(\+|-)\d/.test(calcContent) || /\d(\+|-)\(/.test(calcContent);
                    if (plusMinusNoSpace) {
                        errors.push(`Line ${index + 1}: calc() requires spaces around + and - operators (e.g., "calc(100% - 20px)" not "calc(100%-20px)")`);
                    }

                    // Skip parenthesis checking for calc() - nested parens are valid
                    // The regex already ensures proper matching

                    // Check for invalid expressions - numbers without units in certain contexts
                    // In calc(), plain numbers should have units when used with lengths (except for multiplication/division)
                    const parts = calcContent.split(/[\+\-\*\/]/).map(p => p.trim());

                    // Check if there are operators
                    const hasOperators = /[\+\-\*\/]/.test(calcContent);
                    if (hasOperators) {
                        // Look for patterns like: 100% + 20 (missing unit on 20)
                        // But allow: 100% * 2 (multiplying by unitless number is OK)
                        const addSubPattern = calcContent.match(/([\d\.]+)(px|em|rem|%|vh|vw|vmin|vmax|pt|pc|in|cm|mm|ex|ch)?\s*[\+\-]\s*([\d\.]+)(px|em|rem|%|vh|vw|vmin|vmax|pt|pc|in|cm|mm|ex|ch)?/i);
                        if (addSubPattern) {
                            const firstNum = addSubPattern[1];
                            const firstUnit = addSubPattern[2];
                            const secondNum = addSubPattern[3];
                            const secondUnit = addSubPattern[4];

                            // If first has unit but second doesn't (or vice versa), that's likely an error
                            if ((firstUnit && !secondUnit) || (!firstUnit && secondUnit)) {
                                errors.push(`Line ${index + 1}: calc() mixing units and unitless numbers in addition/subtraction (e.g., "100% + 20" should be "100% + 20px")`);
                            }
                        }
                    }

                    // Check for empty calc()
                    if (calcContent.trim() === '') {
                        errors.push(`Line ${index + 1}: Empty calc() function`);
                    }

                    // Check for division by zero
                    if (/\/\s*0(?:\s|$|\))/.test(calcContent)) {
                        errors.push(`Line ${index + 1}: calc() division by zero`);
                    }

                    // Check for consecutive operators
                    if (/[\+\-\*\/]\s*[\+\-\*\/]/.test(calcContent.replace(/\s+/g, ' '))) {
                        errors.push(`Line ${index + 1}: calc() has consecutive operators`);
                    }
                }

                // Check for URL() function errors
                const urlMatches = trimmedLine.matchAll(/url\(([^)]*)\)?/gi);
                for (const urlMatch of urlMatches) {
                    const urlContent = urlMatch[1];
                    const fullMatch = urlMatch[0];

                    // Check for unclosed url() parenthesis
                    if (!fullMatch.endsWith(')')) {
                        errors.push(`Line ${index + 1}: Unclosed url() function - missing closing parenthesis`);
                    }

                    // Check for empty url()
                    if (urlContent.trim() === '') {
                        errors.push(`Line ${index + 1}: Empty url() function`);
                    }

                    // Check for unquoted URLs with spaces (spaces require quotes)
                    if (urlContent.includes(' ') && !urlContent.match(/^['"].*['"]$/)) {
                        warnings.push(`Line ${index + 1}: URL with spaces should be quoted (e.g., url("path with spaces.jpg"))`);
                    }
                }

                // Check for multiple consecutive semicolons
                if (/;;+/.test(trimmedLine)) {
                    errors.push(`Line ${index + 1}: Multiple consecutive semicolons (;;)`);
                }

                // Check for space in property names
                // Property names should be single words with hyphens, not spaces
                const propertyWithSpace = trimmedLine.match(/^([a-z]+)\s+([a-z\-]+)\s*:/i);
                if (propertyWithSpace && !trimmedLine.startsWith('/*')) {
                    const possibleProperty = propertyWithSpace[1] + propertyWithSpace[2];
                    // Common properties that might be split
                    const commonSplitProperties = {
                        'background color': 'background-color',
                        'background image': 'background-image',
                        'border radius': 'border-radius',
                        'border color': 'border-color',
                        'border width': 'border-width',
                        'border style': 'border-style',
                        'font size': 'font-size',
                        'font family': 'font-family',
                        'font weight': 'font-weight',
                        'font style': 'font-style',
                        'text align': 'text-align',
                        'text decoration': 'text-decoration',
                        'text transform': 'text-transform',
                        'line height': 'line-height',
                        'letter spacing': 'letter-spacing',
                        'word spacing': 'word-spacing',
                        'max width': 'max-width',
                        'max height': 'max-height',
                        'min width': 'min-width',
                        'min height': 'min-height',
                        'z index': 'z-index',
                        'box shadow': 'box-shadow',
                        'text shadow': 'text-shadow'
                    };

                    const splitKey = (propertyWithSpace[1] + ' ' + propertyWithSpace[2]).toLowerCase();
                    if (commonSplitProperties[splitKey]) {
                        errors.push(`Line ${index + 1}: Property name cannot contain spaces - did you mean "${commonSplitProperties[splitKey]}"?`);
                    } else {
                        errors.push(`Line ${index + 1}: Property name cannot contain spaces`);
                    }
                }

                // Check for missing commas in multi-value properties
                if (propValueMatch) {
                    const propertyName = propValueMatch[1].toLowerCase();
                    const propertyValue = propValueMatch[2].trim();

                    // Properties that require commas between multiple values
                    const commaRequiredProps = ['font-family', 'font', 'transition', 'animation'];

                    if (commaRequiredProps.includes(propertyName)) {
                        // Check if value has multiple words that should be separated by commas
                        // font-family: Arial Helvetica sans-serif (WRONG)
                        // font-family: Arial, Helvetica, sans-serif (CORRECT)

                        if (propertyName === 'font-family' || propertyName === 'font') {
                            // Remove quoted strings first
                            const withoutQuotes = propertyValue.replace(/(['"])(?:(?=(\\?))\2.)*?\1/g, 'QUOTED');

                            // Check for multiple font names without commas
                            // Common fonts that should be separated
                            const commonFonts = ['arial', 'helvetica', 'times', 'courier', 'verdana', 'georgia', 'palatino', 'garamond', 'bookman', 'comic sans', 'trebuchet', 'impact', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'];

                            let fontCount = 0;
                            let commaCount = (withoutQuotes.match(/,/g) || []).length;

                            commonFonts.forEach(font => {
                                if (new RegExp('\\b' + font + '\\b', 'i').test(withoutQuotes)) {
                                    fontCount++;
                                }
                            });

                            // If we have multiple fonts but no commas, that's likely an error
                            if (fontCount > 1 && commaCount === 0) {
                                warnings.push(`Line ${index + 1}: Multiple font names should be separated by commas (e.g., "Arial, Helvetica, sans-serif")`);
                            }
                        }
                    }
                }

                // Check for invalid !important usage
                if (trimmedLine.includes('!')) {
                    // Check for common !important typos
                    const importantTypos = [
                        { pattern: /!importnt\b/i, correct: '!important' },
                        { pattern: /!imprtant\b/i, correct: '!important' },
                        { pattern: /!imporant\b/i, correct: '!important' },
                        { pattern: /!importat\b/i, correct: '!important' },
                        { pattern: /!impotant\b/i, correct: '!important' },
                        { pattern: /!\s+important\b/i, correct: '!important' }
                    ];

                    importantTypos.forEach(typo => {
                        if (typo.pattern.test(trimmedLine)) {
                            errors.push(`Line ${index + 1}: Invalid !important syntax - did you mean "${typo.correct}"?`);
                        }
                    });

                    // Check for !important before the value (wrong position)
                    // e.g., "color: !important red;" should be "color: red !important;"
                    if (/:\s*!important\s+[^;]+/.test(trimmedLine)) {
                        errors.push(`Line ${index + 1}: !important should come after the value, not before`);
                    }
                }

                // Check for zero values with units (warning - optimization)
                if (propValueMatch) {
                    const propertyName = propValueMatch[1].toLowerCase();
                    const propertyValue = propValueMatch[2].trim();

                    // Check for 0 with units (e.g., 0px, 0em, 0%)
                    // BUT: Don't warn if inside calc() - units on zero are sometimes needed there
                    if (!propertyValue.includes('calc(')) {
                        const zeroWithUnit = propertyValue.match(/\b0(px|em|rem|%|vh|vw|vmin|vmax|pt|pc|in|cm|mm|ex|ch)\b/gi);
                        if (zeroWithUnit) {
                            zeroWithUnit.forEach(match => {
                                warnings.push(`Line ${index + 1}: Unnecessary unit on zero value "${match}" - can be simplified to "0"`);
                            });
                        }
                    }

                    // Check for negative values on properties that don't accept them
                    const noNegativeProps = {
                        'width': true,
                        'height': true,
                        'max-width': true,
                        'max-height': true,
                        'min-width': true,
                        'min-height': true,
                        'padding': true,
                        'padding-top': true,
                        'padding-right': true,
                        'padding-bottom': true,
                        'padding-left': true,
                        'border-width': true,
                        'border-top-width': true,
                        'border-right-width': true,
                        'border-bottom-width': true,
                        'border-left-width': true,
                        'outline-width': true,
                        'opacity': true
                    };

                    if (noNegativeProps[propertyName]) {
                        // Check for negative values
                        if (/-\d+/.test(propertyValue)) {
                            errors.push(`Line ${index + 1}: Property "${propertyName}" does not accept negative values`);
                        }
                    }

                    // Check for invalid percentage values on properties that don't accept them
                    const noPercentageProps = {
                        'z-index': true,
                        'opacity': true,
                        'font-weight': true,
                        'border-width': true,
                        'border-top-width': true,
                        'border-right-width': true,
                        'border-bottom-width': true,
                        'border-left-width': true,
                        'outline-width': true
                    };

                    if (noPercentageProps[propertyName]) {
                        if (/\d+%/.test(propertyValue)) {
                            errors.push(`Line ${index + 1}: Property "${propertyName}" does not accept percentage values`);
                        }
                    }

                    // Check for invalid shorthand property values
                    // Border shorthand: should be width style color (not color width style)
                    if (propertyName === 'border' || propertyName.startsWith('border-') && propertyName.match(/^border-(top|right|bottom|left)$/)) {
                        // Common mistake: putting color first
                        // e.g., "border: red 1px solid" instead of "border: 1px solid red"
                        // Valid border styles to exclude: none, hidden, dotted, dashed, solid, double, groove, ridge, inset, outset
                        const validBorderStyles = ['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset', 'initial', 'inherit', 'unset'];

                        // Check if it starts with a color (hex or named color) followed by a number
                        const startsWithColor = /^(#[0-9a-f]{3,8}|rgb|rgba)\s+\d+/i.test(propertyValue);

                        // Check for named colors followed by numbers (but exclude border styles)
                        const words = propertyValue.split(/\s+/);
                        if (words.length >= 2 && !validBorderStyles.includes(words[0].toLowerCase())) {
                            const firstIsColor = /^[a-z]+$/i.test(words[0]) && /^\d+/.test(words[1]);
                            // Additional check: make sure it's not something like "0 solid"
                            if (firstIsColor && !/^\d+$/.test(words[0])) {
                                warnings.push(`Line ${index + 1}: Border shorthand typically follows order: width style color (e.g., "1px solid red" not "red 1px solid")`);
                            }
                        }

                        if (startsWithColor) {
                            warnings.push(`Line ${index + 1}: Border shorthand typically follows order: width style color (e.g., "1px solid red" not "red 1px solid")`);
                        }
                    }

                    // Margin/Padding shorthand: check for too many values
                    if (['margin', 'padding'].includes(propertyName)) {
                        const values = propertyValue.split(/\s+/).filter(v => v && !v.includes('!important'));
                        if (values.length > 4) {
                            errors.push(`Line ${index + 1}: "${propertyName}" shorthand accepts maximum 4 values, got ${values.length}`);
                        }
                    }

                    // Background shorthand: check for invalid order/values
                    if (propertyName === 'background') {
                        // Check for position values without size (e.g., "top" without "center" or coordinate)
                        const positionKeywords = ['top', 'bottom', 'left', 'right'];
                        const hasPositionKeyword = positionKeywords.some(kw =>
                            new RegExp('\\b' + kw + '\\b', 'i').test(propertyValue)
                        );

                        // If has position keyword, should have proper format
                        if (hasPositionKeyword) {
                            // This is complex to validate fully, so just check for obvious mistakes
                            const soloPosition = /^(top|bottom|left|right)$/i.test(propertyValue.trim());
                            if (soloPosition) {
                                warnings.push(`Line ${index + 1}: Background position keyword should typically be paired (e.g., "center top" not just "top")`);
                            }
                        }
                    }

                    // === GROUP 4: ADVANCED CSS FEATURES ===

                    // Check for invalid Grid/Flexbox values
                    const gridFlexProps = {
                        'display': {
                            gridFlexValues: ['flex', 'inline-flex', 'grid', 'inline-grid']
                        },
                        'justify-content': {
                            validValues: ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'start', 'end', 'left', 'right', 'stretch', 'inherit', 'initial', 'unset']
                        },
                        'align-items': {
                            validValues: ['flex-start', 'flex-end', 'center', 'baseline', 'stretch', 'start', 'end', 'self-start', 'self-end', 'inherit', 'initial', 'unset']
                        },
                        'align-content': {
                            validValues: ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly', 'stretch', 'start', 'end', 'inherit', 'initial', 'unset']
                        },
                        'flex-direction': {
                            validValues: ['row', 'row-reverse', 'column', 'column-reverse', 'inherit', 'initial', 'unset']
                        },
                        'flex-wrap': {
                            validValues: ['nowrap', 'wrap', 'wrap-reverse', 'inherit', 'initial', 'unset']
                        },
                        'grid-template-columns': {
                            checkFrUnit: true
                        },
                        'grid-template-rows': {
                            checkFrUnit: true
                        }
                    };

                    if (gridFlexProps[propertyName]) {
                        const rule = gridFlexProps[propertyName];
                        const cleanValue = propertyValue.replace(/!important/i, '').trim().toLowerCase();

                        if (rule.validValues) {
                            if (!rule.validValues.includes(cleanValue) && !cleanValue.includes('var(')) {
                                errors.push(`Line ${index + 1}: Invalid value "${cleanValue}" for "${propertyName}" - must be one of: ${rule.validValues.slice(0, 5).join(', ')}...`);
                            }
                        }

                        if (rule.checkFrUnit) {
                            // Check for common typo: "pr" instead of "fr"
                            if (/\d+pr\b/i.test(propertyValue)) {
                                errors.push(`Line ${index + 1}: Invalid unit "pr" in grid template - did you mean "fr" (fractional unit)?`);
                            }
                        }
                    }

                    // Check for invalid gradient syntax
                    if (propertyName === 'background' || propertyName === 'background-image') {
                        const linearGradientMatches = findCssFunctionCalls(propertyValue, 'linear-gradient');
                        for (const linearGradientMatch of linearGradientMatches) {
                            const gradientContent = linearGradientMatch.content;
                            const gradientSegments = splitTopLevel(gradientContent, ',');

                            // Must have at least 2 colors
                            if (gradientSegments.length < 2) {
                                errors.push(`Line ${index + 1}: linear-gradient requires at least 2 colors separated by commas`);
                            }

                            // Special case: direction with only one color after comma
                            if (gradientSegments.length && isGradientDirectionSegment(gradientSegments[0])) {
                                if (gradientSegments.length < 3) {
                                    errors.push(`Line ${index + 1}: linear-gradient with direction requires at least 2 colors after the direction`);
                                }
                            }

                            // Check for colors separated by spaces instead of commas (common mistake)
                            // Pattern: color word/hex followed by space and another color without comma
                            const hasSpaceSeparatedColors = /\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey)\s+(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey)\b/i.test(gradientContent) ||
                                                          /#[0-9a-fA-F]{3,6}\s+#[0-9a-fA-F]{3,6}/.test(gradientContent) ||
                                                          /rgb\([^)]+\)\s+rgb\([^)]+\)/.test(gradientContent) ||
                                                          /rgba\([^)]+\)\s+rgba\([^)]+\)/.test(gradientContent);

                            if (hasSpaceSeparatedColors) {
                                errors.push(`Line ${index + 1}: linear-gradient colors must be separated by commas, not spaces`);
                            }

                            // Check for missing direction separator
                            // If starts with direction keyword (to, deg, etc.), should have comma after it
                            if (gradientSegments.length && isGradientDirectionSegment(gradientSegments[0])) {
                                if (gradientSegments.length < 2) {
                                    errors.push(`Line ${index + 1}: linear-gradient with direction must have comma after direction`);
                                }
                            }
                        }

                        const radialGradientMatches = findCssFunctionCalls(propertyValue, 'radial-gradient');
                        for (const radialGradientMatch of radialGradientMatches) {
                            const gradientContent = radialGradientMatch.content;
                            const gradientSegments = splitTopLevel(gradientContent, ',');

                            // Must have at least 2 colors
                            if (gradientSegments.length < 2) {
                                errors.push(`Line ${index + 1}: radial-gradient requires at least 2 colors separated by commas`);
                            }

                            // Check for space-separated colors in radial gradient too
                            const hasSpaceSeparatedColors = /\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey)\s+(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey)\b/i.test(gradientContent) ||
                                                          /#[0-9a-fA-F]{3,6}\s+#[0-9a-fA-F]{3,6}/.test(gradientContent);

                            if (hasSpaceSeparatedColors) {
                                errors.push(`Line ${index + 1}: radial-gradient colors must be separated by commas, not spaces`);
                            }
                        }
                    }

                    // Check for invalid transform functions
                    if (propertyName === 'transform') {
                        // Check for unclosed parentheses in transform functions
                        const transformFunctions = ['translate', 'translateX', 'translateY', 'translateZ', 'translate3d', 'scale', 'scaleX', 'scaleY', 'scaleZ', 'scale3d', 'rotate', 'rotateX', 'rotateY', 'rotateZ', 'rotate3d', 'skew', 'skewX', 'skewY', 'matrix', 'matrix3d', 'perspective'];

                        transformFunctions.forEach(func => {
                            const regex = new RegExp(func + '\\(', 'i');
                            if (regex.test(propertyValue)) {
                                // Check if there's a matching closing parenthesis
                                const funcStart = propertyValue.toLowerCase().indexOf(func.toLowerCase() + '(');
                                if (funcStart !== -1) {
                                    let parenCount = 1; // Start with 1 for the opening paren
                                    let foundClose = false;
                                    // Start AFTER the function name AND the opening paren
                                    for (let i = funcStart + func.length + 1; i < propertyValue.length; i++) {
                                        if (propertyValue[i] === '(') {
                                            parenCount++;
                                        } else if (propertyValue[i] === ')') {
                                            parenCount--;
                                            if (parenCount === 0) {
                                                foundClose = true;
                                                break;
                                            }
                                        }
                                    }
                                    if (!foundClose) {
                                        errors.push(`Line ${index + 1}: Unclosed ${func}() function in transform`);
                                    }
                                }
                            }
                        });

                        // Check for missing units in transform functions
                        if (/translate[XY]?\(\s*\d+\s*\)/i.test(propertyValue)) {
                            warnings.push(`Line ${index + 1}: translate functions typically require units (e.g., "translateX(10px)" not "translateX(10)")`);
                        }
                    }

                    // Check for invalid animation/transition syntax
                    if (propertyName === 'transition' || propertyName === 'animation') {
                        // Check if duration is missing (required for both)
                        const hasDuration = /\d+(\.\d+)?(s|ms)\b/.test(propertyValue);

                        if (!hasDuration && !propertyValue.toLowerCase().includes('none') && !propertyValue.includes('var(')) {
                            errors.push(`Line ${index + 1}: ${propertyName} requires a duration (e.g., "0.3s" or "300ms")`);
                        }

                        // Check for invalid timing functions
                        const invalidTimingFunctions = ['easy', 'ease-inn', 'ease-outt', 'liner', 'ease-in-outt'];
                        invalidTimingFunctions.forEach(invalid => {
                            if (new RegExp('\\b' + invalid + '\\b', 'i').test(propertyValue)) {
                                const correct = {
                                    'easy': 'ease',
                                    'ease-inn': 'ease-in',
                                    'ease-outt': 'ease-out',
                                    'liner': 'linear',
                                    'ease-in-outt': 'ease-in-out'
                                };
                                errors.push(`Line ${index + 1}: Invalid timing function "${invalid}" - did you mean "${correct[invalid] || 'ease'}"?`);
                            }
                        });
                    }

                    // === GROUP 5: ADVANCED FEATURES ===

                    // Check for CSS variable (custom property) issues
                    if (propertyName.startsWith('--')) {
                        // Custom property declaration - check if truly empty (not just whitespace)
                        // Need to get the raw value after the colon, including potential empty string
                        const rawMatch = trimmedLine.match(/^--[^:]+:\s*(.*)$/);
                        if (rawMatch) {
                            const rawValue = rawMatch[1].replace(/;$/, '').trim();
                            if (rawValue === '') {
                                errors.push(`Line ${index + 1}: CSS custom property "${propertyName}" has no value`);
                            }
                        }
                    }

                    // Check var() usage
                    if (propertyValue.includes('var(')) {
                        const varMatches = findCssFunctionCalls(propertyValue, 'var');
                        for (const varMatch of varMatches) {
                            const varContent = varMatch.content.trim();

                            // Check for empty var()
                            if (!varContent) {
                                errors.push(`Line ${index + 1}: Empty var() function`);
                                continue;
                            }

                            // Split by comma to get variable name and fallback
                            const parts = splitTopLevel(varContent, ',');
                            const varName = parts[0];

                            // Variable name must start with --
                            if (!varName.startsWith('--')) {
                                errors.push(`Line ${index + 1}: CSS variable name "${varName}" must start with "--"`);
                            }

                            // Check for invalid characters in variable name (only letters, numbers, hyphens, underscores)
                            if (!/^--[a-zA-Z0-9\-_]+$/.test(varName)) {
                                errors.push(`Line ${index + 1}: Invalid characters in CSS variable name "${varName}"`);
                            }

                            // Check for too many parts - better detection
                            // If there are nested var(), the comma count will be higher
                            // Simple approach: count commas that are NOT inside nested parentheses
                            let depth = 0;
                            let topLevelCommaCount = 0;
                            for (let char of varContent) {
                                if (char === '(') depth++;
                                if (char === ')') depth--;
                                if (char === ',' && depth === 0) topLevelCommaCount++;
                            }

                            if (topLevelCommaCount > 1) {
                                warnings.push(`Line ${index + 1}: var() function should have only variable name and optional fallback value`);
                            }
                        }
                    }

                    // Check for unnecessary or missing vendor prefixes
                    const needsPrefixCheck = {
                        'appearance': true,
                        'user-select': true,
                        'backdrop-filter': true,
                        'clip-path': true
                    };

                    if (needsPrefixCheck[propertyName]) {
                        warnings.push(`Line ${index + 1}: Property "${propertyName}" may need vendor prefixes (-webkit-, -moz-, -ms-) for older browser support`);
                    }

                    // Check for outdated vendor prefixes that are no longer needed
                    const outdatedPrefixes = {
                        '-webkit-border-radius': 'border-radius',
                        '-moz-border-radius': 'border-radius',
                        '-webkit-box-shadow': 'box-shadow',
                        '-moz-box-shadow': 'box-shadow',
                        '-webkit-transform': 'transform (check browser support)',
                        '-moz-transform': 'transform (check browser support)',
                        '-webkit-transition': 'transition (check browser support)',
                        '-moz-transition': 'transition (check browser support)',
                        '-webkit-animation': 'animation (check browser support)',
                        '-moz-animation': 'animation (check browser support)'
                    };

                    if (outdatedPrefixes[propertyName]) {
                        warnings.push(`Line ${index + 1}: Vendor prefix "${propertyName}" may be outdated - consider using standard "${outdatedPrefixes[propertyName]}"`);
                    }

                    // Advanced calc() validation - unit mixing issues
                    if (propertyValue.includes('calc(')) {
                        const calcMatches = propertyValue.matchAll(/calc\(([^)]+)\)/g);
                        for (const calcMatch of calcMatches) {
                            const calcContent = calcMatch[1];

                            // Check for mixing incompatible units in multiplication/division
                            // e.g., calc(10px * 20px) is invalid - one must be unitless
                            // BUT: calc(100% * 50%) should only warn, not error (it's technically valid)
                            const multiplyDivide = /(\d+\.?\d*)([a-z%]+)\s*[*\/]\s*(\d+\.?\d*)([a-z%]+)/i;
                            if (multiplyDivide.test(calcContent)) {
                                const match = calcContent.match(multiplyDivide);
                                if (match) {
                                    const unit1 = match[2];
                                    const unit2 = match[4];

                                    // If both are percentages, it's technically valid but warn (handled separately)
                                    // Otherwise, it's an error
                                    if (!(unit1 === '%' && unit2 === '%')) {
                                        errors.push(`Line ${index + 1}: calc() multiplication/division requires one unitless value, got "${match[1]}${unit1}" and "${match[3]}${unit2}"`);
                                    }
                                }
                            }

                            // Check for percentage in multiplication/division with another percentage
                            // Only warn if BOTH are percentages, not just one
                            // Valid: calc(100% * 0.5), calc(100% / 3)
                            // Invalid/Warning: calc(100% * 50%)
                            if (/\d+%\s*[*\/]\s*\d+%/.test(calcContent)) {
                                warnings.push(`Line ${index + 1}: calc() with percentage in multiplication/division - use decimal instead (e.g., 0.5 instead of 50%)`);
                            }

                            // Check for invalid unit mixing in addition/subtraction
                            const addSubtract = /(\d+\.?\d*)(px|em|rem|%|vh|vw|vmin|vmax|pt|cm|mm|in)\s*[\+\-]\s*(\d+\.?\d*)(px|em|rem|%|vh|vw|vmin|vmax|pt|cm|mm|in)/i;
                            const addMatch = calcContent.match(addSubtract);
                            if (addMatch) {
                                const unit1 = addMatch[2];
                                const unit4 = addMatch[4];

                                // Check if units are from incompatible categories
                                const lengthUnits = ['px', 'em', 'rem', 'pt', 'cm', 'mm', 'in'];
                                const viewportUnits = ['vh', 'vw', 'vmin', 'vmax'];
                                const percentUnits = ['%'];

                                const unit1IsLength = lengthUnits.includes(unit1);
                                const unit4IsLength = lengthUnits.includes(unit4);
                                const unit1IsViewport = viewportUnits.includes(unit1);
                                const unit4IsViewport = viewportUnits.includes(unit4);
                                const unit1IsPercent = percentUnits.includes(unit1);
                                const unit4IsPercent = percentUnits.includes(unit4);

                                // Warn for viewport + percent mixing (uncommon pattern)
                                if ((unit1IsViewport && unit4IsPercent) || (unit1IsPercent && unit4IsViewport)) {
                                    warnings.push(`Line ${index + 1}: calc() mixing different unit types (${unit1} and ${unit4}) - verify this is intended`);
                                }

                                // Don't warn for length + percent or length + viewport - these are very common and valid
                                // calc(100% - 20px) is extremely common
                                // calc(100vh - 10px) is very common
                            }
                        }
                    }

                    // === GROUP 6: MEDIA QUERIES & AT-RULES ===

                    // This section handles validation of CSS at-rules (@media, @keyframes, @import, @font-face, etc.)
                    // Note: These are typically full-line or multi-line declarations, so we check the trimmed line

                }
            }

            // Check for @media query validation (after property checks since these are line-level)
            if (trimmedLine.startsWith('@media')) {
                // Extract media query
                const mediaQuery = trimmedLine.match(/@media\s+(.+?)\s*\{?$/);
                if (mediaQuery) {
                    const query = mediaQuery[1].trim();

                    // Check for common typos in media types
                    const invalidMediaTypes = /\b(scren|screan|screeen|prit|printt)\b/i;
                    if (invalidMediaTypes.test(query)) {
                        errors.push(`Line ${index + 1}: Invalid media type - check spelling (screen, print, etc.)`);
                    }

                    // Check for missing 'and' between conditions
                    if (/\([^)]+\)\s+\([^)]+\)/.test(query) && !query.includes(' and ')) {
                        errors.push(`Line ${index + 1}: Multiple media conditions must be joined with "and"`);
                    }

                    // Check for invalid property names in media queries
                    const commonProps = ['min-width', 'max-width', 'min-height', 'max-height', 'orientation', 'aspect-ratio', 'min-resolution', 'max-resolution'];
                    const propMatch = query.match(/\(([a-z\-]+):/i);
                    if (propMatch) {
                        const prop = propMatch[1];
                        // Check for common typos
                        if (prop === 'width' || prop === 'height') {
                            warnings.push(`Line ${index + 1}: Use "min-width" or "max-width" instead of "${prop}" in media queries`);
                        }
                        // Check for invalid properties
                        if (prop.includes('_') || /[A-Z]/.test(prop)) {
                            errors.push(`Line ${index + 1}: Invalid media feature "${prop}" - use lowercase with hyphens`);
                        }
                    }

                    // Check for missing units in width/height queries
                    if (/\((?:min-|max-)?(?:width|height):\s*\d+\s*\)/.test(query)) {
                        errors.push(`Line ${index + 1}: Media query width/height values require units (e.g., 768px, not 768)`);
                    }

                    // Check for invalid comparison operators (people sometimes use =, <, >)
                    if (/:\s*[<>=]/.test(query)) {
                        errors.push(`Line ${index + 1}: Media queries use "min-" and "max-" prefixes, not comparison operators`);
                    }
                }
            }

            // Check for @keyframes validation
            if (trimmedLine.startsWith('@keyframes') || trimmedLine.startsWith('@-webkit-keyframes') || trimmedLine.startsWith('@-moz-keyframes')) {
                const keyframesMatch = trimmedLine.match(/@(?:-webkit-|-moz-)?keyframes\s+([^\s{]+)/);
                if (keyframesMatch) {
                    const animationName = keyframesMatch[1];

                    // Check for invalid animation names
                    if (/^\d/.test(animationName)) {
                        errors.push(`Line ${index + 1}: Animation name "${animationName}" cannot start with a number`);
                    }

                    if (/\s/.test(animationName)) {
                        errors.push(`Line ${index + 1}: Animation name "${animationName}" cannot contain spaces`);
                    }

                    // Warn about vendor-prefixed keyframes
                    if (trimmedLine.startsWith('@-webkit-keyframes') || trimmedLine.startsWith('@-moz-keyframes')) {
                        warnings.push(`Line ${index + 1}: Vendor-prefixed @keyframes may be unnecessary in modern browsers`);
                    }
                } else if (trimmedLine === '@keyframes' || trimmedLine === '@keyframes ') {
                    errors.push(`Line ${index + 1}: @keyframes requires an animation name`);
                }
            }

            // Check for keyframe percentage selectors (0%, 50%, 100%, from, to)
            if (trimmedLine.match(/^\d+%\s*\{?$/) || trimmedLine === 'from {' || trimmedLine === 'to {') {
                // Valid keyframe selector - no validation needed
            } else if (/^(\d+)%/.test(trimmedLine) && !trimmedLine.includes(':')) {
                // Check for invalid percentage format
                const percentMatch = trimmedLine.match(/^(\d+)%/);
                if (percentMatch) {
                    const percent = parseInt(percentMatch[1]);
                    if (percent > 100) {
                        errors.push(`Line ${index + 1}: Keyframe percentage "${percent}%" cannot exceed 100%`);
                    }
                }
            }

            // Check for @import validation
            if (trimmedLine.startsWith('@import')) {
                // @import should be at the beginning of the stylesheet
                if (index > 5) {
                    warnings.push(`Line ${index + 1}: @import should be placed at the beginning of the stylesheet`);
                }

                // Check for missing url() or quotes
                if (!trimmedLine.includes('url(') && !trimmedLine.includes('"') && !trimmedLine.includes("'")) {
                    errors.push(`Line ${index + 1}: @import requires url() or quoted string`);
                }

                // Check for missing semicolon
                if (!trimmedLine.endsWith(';')) {
                    errors.push(`Line ${index + 1}: @import statement missing semicolon`);
                }
            }

            // Check for @font-face validation
            if (trimmedLine.startsWith('@font-face')) {
                // Track if we're entering a font-face block (simple check)
                // Note: Full validation would require state tracking across multiple lines
                if (!trimmedLine.includes('{')) {
                    warnings.push(`Line ${index + 1}: @font-face should be followed by an opening brace`);
                }
            }

            // Check for @supports validation
            if (trimmedLine.startsWith('@supports')) {
                const supportsMatch = trimmedLine.match(/@supports\s+(.+?)\s*\{?$/);
                if (supportsMatch) {
                    const condition = supportsMatch[1].trim();

                    // Check for missing parentheses
                    if (!condition.includes('(') || !condition.includes(')')) {
                        errors.push(`Line ${index + 1}: @supports condition must be wrapped in parentheses`);
                    }

                    // Check for missing property:value format
                    if (condition.includes('(') && !condition.includes(':')) {
                        errors.push(`Line ${index + 1}: @supports condition requires property:value format`);
                    }
                }
            }

            // Check for invalid at-rules (common typos)
            const invalidAtRules = /@(midea|meida|keframes|keyframe|inport|imoprt|charst|font-fce)/i;
            if (invalidAtRules.test(trimmedLine)) {
                const match = trimmedLine.match(invalidAtRules);
                if (match) {
                    const typo = match[1];
                    const corrections = {
                        'midea': '@media',
                        'meida': '@media',
                        'keframes': '@keyframes',
                        'keyframe': '@keyframes',
                        'inport': '@import',
                        'imoprt': '@import',
                        'charst': '@charset',
                        'font-fce': '@font-face'
                    };
                    errors.push(`Line ${index + 1}: Invalid at-rule "@${typo}" - did you mean "${corrections[typo.toLowerCase()]}"?`);
                }
            }

            // Check for missing semicolons in property declarations
            if (trimmedLine.includes(':')) {
                // Skip lines that are just selectors with opening braces (e.g., ".class {")
                if (trimmedLine.match(/^[^:]+\{\s*$/)) {
                    return; // Just a selector line
                }

                // Skip @media and @supports declarations
                if (trimmedLine.startsWith('@media') || trimmedLine.startsWith('@supports')) {
                    return;
                }

                // Skip property lines that start a multi-line value (unclosed parentheses)
                const openParensCount = (trimmedLine.match(/\(/g) || []).length;
                const closeParensCount = (trimmedLine.match(/\)/g) || []).length;
                if (openParensCount > closeParensCount) {
                    return;
                }

                // For lines with opening brace, extract the part after the brace
                let lineToCheck = trimmedLine;

                if (trimmedLine.includes('{')) {
                    // Extract content after opening brace: ".b { width: 100px }" -> "width: 100px }"
                    const bracePos = trimmedLine.indexOf('{');
                    lineToCheck = trimmedLine.substring(bracePos + 1).trim();
                }

                // For lines with closing brace, check the part before the brace
                if (lineToCheck.includes('}')) {
                    // Extract the part before the closing brace: "width: 100px }" -> "width: 100px"
                    lineToCheck = lineToCheck.substring(0, lineToCheck.indexOf('}')).trim();
                }

                // Now check if this property declaration needs a semicolon
                if (lineToCheck && lineToCheck.includes(':') && !lineToCheck.endsWith(';')) {
                    const colonPos = lineToCheck.indexOf(':');
                    if (colonPos === -1) return; // Safety check

                    const beforeColon = lineToCheck.substring(0, colonPos).trim();
                    const afterColon = lineToCheck.substring(colonPos + 1).trim();

                    // Check if it looks like a CSS property (word-characters with hyphens)
                    // and has a value after the colon, and is not a pseudo-class/element
                    const isPseudoClass = beforeColon.match(/^[.#\w\s\-\[\]="]+$/) && afterColon.length === 0;
                    const isKeyframePercent = beforeColon.match(/^\d+%$/); // Handle "0%", "100%", etc.

                    if (!isPseudoClass && !isKeyframePercent && afterColon.length > 0 && beforeColon.match(/^[a-z\-]+$/i)) {
                        warnings.push(`Line ${index + 1}: Missing semicolon at end of declaration`);
                    }
                }
            }
        });

        // If native parser detected error but custom validators didn't catch it
        if (nativeParserFailed && errors.length === 0) {
            errors.push('CSS syntax error detected');
        }

        return {
            isValid: errors.length === 0,
            hasWarnings: warnings.length > 0,
            errors,
            warnings
        };
    }

    // ==================== SKIN NUMBER REPLACEMENT ====================
    function getSkinId() {
        const skinIdInput = document.getElementById('hdnSkinID');
        return skinIdInput ? skinIdInput.value : null;
    }

    function replaceSkinNumbers(text, skinId) {
        if (!skinId || skinId === '-1') return text;
        return text.replace(/\.skin\d+/g, '.skin' + skinId);
    }

    // ==================== FANCY BUTTON NUMBER REPLACEMENT ====================
    // Store the current button selector globally so we can access it on insert
    let currentFancyButtonSelector = null;
    
    function getFancyButtonId() {
        // Check if we're in the Fancy Button Builder modal
        const fancyButtonContainer = document.querySelector('.fancyButtonContainer a.fancyButton');
        if (!fancyButtonContainer) return null;

        const classes = fancyButtonContainer.className;
        if (!classes) return null;

        // Extract fancyButtonN from class list (e.g., "fancyButton fancyButton123" -> "123")
        const classList = classes.split(' ');
        for (const cls of classList) {
            const match = cls.match(/^fancyButton(\d+)$/);
            if (match && match[1]) {
                currentFancyButtonSelector = 'fancyButton' + match[1];
                return match[1];
            }
        }

        // Default to fancyButton1 if no number found
        currentFancyButtonSelector = 'fancyButton1';
        return '1';
    }

    function replaceFancyButtonNumbers(text, buttonId) {
        if (!buttonId || buttonId === '1') return text;
        // Replace any .fancyButton1 with the actual button ID
        return text.replace(/\.fancyButton1\b/g, '.fancyButton' + buttonId);
    }

    function restoreFancyButtonNumbers(text, buttonId) {
        if (!buttonId || buttonId === '1') return text;
        // Replace the actual button ID back to .fancyButton1 for editing
        return text.replace(new RegExp('\\.fancyButton' + buttonId + '\\b', 'g'), '.fancyButton1');
    }
    
    // Replace ALL fancyButton numbers with fancyButton1 for editing
    function normalizeToFancyButton1(text) {
        return text.replace(/\.fancyButton\d+\b/g, '.fancyButton1');
    }
    
    // Replace fancyButton1 with the actual selector
    function denormalizeFromFancyButton1(text, selector) {
        if (!selector || selector === 'fancyButton1') return text;
        return text.replace(/\.fancyButton1\b/g, '.' + selector);
    }

    // ==================== MODAL RESIZE ====================
    // ==================== EDITOR INITIALIZATION ====================
    function initializeEditor(textarea) {
        // Check if wrapper exists AND is properly initialized (has theme toggle button)
        // This must match the logic in findAndEnhanceTextareas() to avoid conflicts
        const isWrapped = textarea.parentElement && textarea.parentElement.classList.contains('css-editor-content');
        const existingWrapper = textarea.closest('.css-editor-wrapper');
        const hasThemeToggle = existingWrapper && existingWrapper.querySelector('.css-theme-toggle');
        
        if (isWrapped && hasThemeToggle) {
            // console.log(TOOLKIT_NAME + ' Editor already properly initialized for textarea #' + textarea.id + ', skipping...'); // Phase 3: Reduced logging
            return;
        }

        // console.log(TOOLKIT_NAME + ' Initializing CSS editor for textarea #' + textarea.id + '...'); // Phase 3: Reduced logging

        const skinId = getSkinId();
        const fancyButtonId = getFancyButtonId();
        const maxLength = parseInt(textarea.getAttribute('maxlength')) || 1000;
        // console.log(TOOLKIT_NAME + ' Skin ID: ' + skinId + ', Fancy Button ID: ' + fancyButtonId + ', Max Length: ' + maxLength); // Phase 3: Reduced logging

        // Initial text replacement for both skin and fancy button numbers
        let initialText = textarea.value;
        let wasModified = false;

        // Handle .skin replacement
        if (skinId && skinId !== '-1') {
            const replacedText = replaceSkinNumbers(initialText, skinId);
            if (initialText !== replacedText) {
                initialText = replacedText;
                wasModified = true;
                // console.log(TOOLKIT_NAME + ' Replaced initial .skin numbers with .skin' + skinId); // Phase 3: Reduced logging
            }
        }

        // Handle .fancyButton replacement (convert ALL fancyButtonN to .fancyButton1 for editing)
        if (fancyButtonId) {
            const replacedText = normalizeToFancyButton1(initialText);
            if (initialText !== replacedText) {
                initialText = replacedText;
                wasModified = true;
                // console.log(TOOLKIT_NAME + ' Normalized all .fancyButtonN to .fancyButton1 for editing (actual: ' + currentFancyButtonSelector + ')'); // Phase 3: Reduced logging
            }
        }

        if (wasModified) {
            textarea.value = initialText;
            // Trigger change event so CMS knows the value changed
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }

        textarea.setAttribute('spellcheck', 'false');
        textarea.setAttribute('autocomplete', 'off');
        textarea.setAttribute('autocorrect', 'off');
        textarea.setAttribute('autocapitalize', 'off');

        // CRITICAL: Capture original parent BEFORE moving textarea
        // After contentArea.appendChild(textarea), textarea.parentNode changes!
        const originalParent = textarea.parentNode;
        const originalNextSibling = textarea.nextElementSibling;

        const wrapper = document.createElement('div');
        wrapper.className = 'css-editor-wrapper valid';
        const container = document.createElement('div');
        container.className = 'css-editor-container';
        const lineNumbers = document.createElement('div');
        lineNumbers.className = 'css-line-numbers';
        const contentArea = document.createElement('div');
        contentArea.className = 'css-editor-content';
        const backdrop = document.createElement('div');
        backdrop.className = 'css-editor-backdrop';

        // Build structure completely BEFORE inserting into DOM
        // This prevents broken references for hidden elements
        contentArea.appendChild(backdrop);
        contentArea.appendChild(textarea);
        container.appendChild(lineNumbers);
        container.appendChild(contentArea);
        wrapper.appendChild(container);

        const validationIndicator = document.createElement('div');
        validationIndicator.className = 'css-validation-indicator valid';

        const showPseudoToggle = isThemeManagerPage();
        const pseudoToggleMarkup = showPseudoToggle
            ? `
            <button class="css-pseudo-toggle" title="Pseudo override" aria-label="Pseudo override" type="button" data-mode="legacy-fix">
                <span class="pseudo-label">::0</span>
            </button>
            `
            : '';

        // Build validation indicator with theme toggle INSIDE (no selector hint)
        validationIndicator.innerHTML = `
            <div class="css-validation-status">
                <span class="status-icon"></span>
                <span class="status-text">Valid CSS</span>
            </div>
            <div class="css-char-counter"><span class="current">0</span>/<span class="max">${maxLength}</span></div>
            <button class="css-theme-toggle" title="Toggle theme (Light → Dark → No-styles)" aria-label="Toggle editor theme" type="button">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
            </button>
            ${pseudoToggleMarkup}
            <div class="css-snippet-wrapper" style="position: relative;">
                <button class="css-code-toggle" title="CSS Snippets" aria-label="CSS Snippets" type="button">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="16 18 22 12 16 6"/>
                        <polyline points="8 6 2 12 8 18"/>
                    </svg>
                </button>
                <div class="css-code-popup"></div>
            </div>
        `;
        
        // Add event listeners to theme toggle
        const themeToggle = validationIndicator.querySelector('.css-theme-toggle');
        themeToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            cycleTheme();
        });
        themeToggle.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                cycleTheme();
            }
        });

        // Initialize pseudo override toggle (Theme Manager only)
        const pseudoToggle = validationIndicator.querySelector('.css-pseudo-toggle');
        if (pseudoToggle) {
            initializePseudoToggle(pseudoToggle);
        }

        // Initialize CSS Snippets (handled by css-snippets.js)
        const snippetWrapper = validationIndicator.querySelector('.css-snippet-wrapper');
        const codeToggle = snippetWrapper.querySelector('.css-code-toggle');
        const codePopup = snippetWrapper.querySelector('.css-code-popup');

        if (window.CPToolkit && window.CPToolkit.cssSnippets) {
            window.CPToolkit.cssSnippets.init(codeToggle, codePopup, textarea);
        } else {
            // Snippets script not loaded yet, wait for it
            const checkSnippets = setInterval(function() {
                if (window.CPToolkit && window.CPToolkit.cssSnippets) {
                    clearInterval(checkSnippets);
                    window.CPToolkit.cssSnippets.init(codeToggle, codePopup, textarea);
                }
            }, 100);
            // Stop checking after 5 seconds
            setTimeout(function() { clearInterval(checkSnippets); }, 5000);
        }

        wrapper.appendChild(validationIndicator);

        // NOW insert the complete wrapper into DOM using the ORIGINAL parent
        // (textarea.parentNode is now contentArea, not the original!)
        if (originalNextSibling) {
            originalParent.insertBefore(wrapper, originalNextSibling);
        } else {
            // Find the closing <p>} tag or append at end
            const closingP = originalParent.querySelector('p');
            if (closingP) {
                originalParent.insertBefore(wrapper, closingP);
            } else {
                originalParent.appendChild(wrapper);
            }

        }

        textarea.classList.add('css-editor-textarea');

        // Special handling for SearchBoxStyles - move label inside the flex div
        if (textarea.id === 'SearchBoxStyles') {
            const li = textarea.closest('li');
            if (li) {
                const label = li.querySelector('label[for="SearchBoxStyles"]');
                const flexDiv = li.querySelector(':scope > div');
                if (label && flexDiv && !flexDiv.contains(label)) {
                    // Move label to be the first child of the flex div
                    flexDiv.insertBefore(label, flexDiv.firstChild);
                }
            }
        }

        // Apply saved theme to this newly created editor
        const savedTheme = getSavedTheme();
        wrapper.setAttribute('data-theme', savedTheme);
        wrapper.classList.add('theme-' + savedTheme);
        
        backdrop.innerHTML = highlightCSS(textarea.value);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                updateLineNumbers(textarea, lineNumbers, backdrop);
            });
        });

        const charCounter = validationIndicator.querySelector('.css-char-counter');
        const currentChars = charCounter.querySelector('.current');

        function updateCharCounter(length) {
            currentChars.textContent = length;
            charCounter.classList.remove('warning', 'error');

            if (length >= maxLength) {
                charCounter.classList.add('error');
            } else if (length >= maxLength * 0.9) {
                charCounter.classList.add('warning');
            }
        }

        // Skin replacement: instant on normal typing/paste, debounced only on backspace/delete
        let replaceSkinsOnNextSync = false;
        let skinReplaceTimer = null;
        let lastInputWasDelete = false;
        let validationTimer = null;
        let validationRunId = 0;

        function applyValidationState(validation) {
            wrapper.classList.remove('valid', 'invalid', 'warning');
            validationIndicator.classList.remove('valid', 'invalid', 'warning');

            if (!validation.isValid) {
                wrapper.classList.add('invalid');
                validationIndicator.classList.add('invalid');
                validationIndicator.querySelector('.status-text').textContent = validation.errors[0];
            } else if (validation.hasWarnings) {
                wrapper.classList.add('warning');
                validationIndicator.classList.add('warning');
                validationIndicator.querySelector('.status-text').textContent = validation.warnings[0];
            } else {
                wrapper.classList.add('valid');
                validationIndicator.classList.add('valid');
                validationIndicator.querySelector('.status-text').textContent = 'Valid CSS';
            }
        }

        function scheduleValidation(immediate = false) {
            const runId = ++validationRunId;
            clearTimeout(validationTimer);

            const runValidation = function() {
                if (runId !== validationRunId) return;
                applyValidationState(validateCSS(textarea.value));
            };

            if (immediate) {
                runValidation();
            } else {
                validationTimer = setTimeout(runValidation, 120);
            }
        }

        function doSkinReplacement() {
            if (!skinId || skinId === '-1') return;
            let code = textarea.value;
            const beforeReplace = code;
            code = replaceSkinNumbers(code, skinId);
            if (beforeReplace !== code) {
                const cursorPos = textarea.selectionStart;
                textarea.value = code;
                const lengthDiff = code.length - beforeReplace.length;
                textarea.selectionStart = textarea.selectionEnd = cursorPos + lengthDiff;
                syncEditor();
            }
        }

        function syncEditor(options = {}) {
            let code = textarea.value;

            if (code.length > maxLength) {
                code = code.substring(0, maxLength);
                textarea.value = code;
            }

            // Handle .skin number replacement
            // Instant on paste/Ctrl+Enter/normal typing; skipped during backspace/delete
            if (skinId && skinId !== '-1' && !lastInputWasDelete) {
                if (replaceSkinsOnNextSync) {
                    replaceSkinsOnNextSync = false;
                    clearTimeout(skinReplaceTimer);
                }
                const beforeReplace = code;
                code = replaceSkinNumbers(code, skinId);
                if (beforeReplace !== code) {
                    const cursorPos = textarea.selectionStart;
                    textarea.value = code;
                    const lengthDiff = code.length - beforeReplace.length;
                    textarea.selectionStart = textarea.selectionEnd = cursorPos + lengthDiff;
                }
            }

            // Note: .fancyButton1 stays as-is during editing (for live preview)
            // Only converted to actual ID when clicking "Insert Fancy Button" or saving

            backdrop.innerHTML = highlightCSS(code);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    updateLineNumbers(textarea, lineNumbers, backdrop);
                });
            });

            updateCharCounter(code.length);
            lastKnownValue = textarea.value;
            scheduleValidation(!!options.immediateValidation);
        }

        function syncScroll() {
            backdrop.scrollTop = contentArea.scrollTop;
            backdrop.scrollLeft = contentArea.scrollLeft;
            lineNumbers.scrollTop = contentArea.scrollTop;
        }

        updateCharCounter(textarea.value.length);
        scheduleValidation(true);

        // Primary input handler
        textarea.addEventListener('input', function(e) {
            // Only debounce skin replacement on backspace/delete; instant otherwise
            lastInputWasDelete = (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward');
            syncEditor();
            lastInputWasDelete = false;

            // After backspace/delete, debounce replacement so it catches up once you stop deleting
            if (skinId && skinId !== '-1' && (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward')) {
                clearTimeout(skinReplaceTimer);
                skinReplaceTimer = setTimeout(doSkinReplacement, 1500);
            }
        });

        // Replace skin numbers on paste (immediate)
        textarea.addEventListener('paste', function() {
            replaceSkinsOnNextSync = true;
        });
        // Ctrl+Enter for manual skin replacement trigger
        textarea.addEventListener('keydown', function(e) {
            if ((e.key === 'Enter' || e.keyCode === 13) && (e.ctrlKey || e.metaKey)) {
                clearTimeout(skinReplaceTimer);
                doSkinReplacement();
            }
        });

        // Also sync on change events (for programmatic changes that trigger change)
        textarea.addEventListener('change', () => {
            syncEditor({ immediateValidation: true });
            if (skinId === '-1' && /\.skin\d+/.test(textarea.value)) {
                alert('You used a skin number. Save the skin first to get a number.');
            }
        });
        
        // Watch for programmatic value changes via property setter
        // This catches when the CMS sets textarea.value directly without firing events
        let lastKnownValue = textarea.value;
        const valueCheckInterval = setInterval(() => {
            if (!document.body.contains(textarea)) {
                // Textarea removed from DOM, stop checking
                clearInterval(valueCheckInterval);
                clearTimeout(validationTimer);
                return;
            }
            if (textarea.value !== lastKnownValue) {
                // console.log(TOOLKIT_NAME + ' Detected programmatic value change in #' + textarea.id); // Phase 3: Reduced logging
                lastKnownValue = textarea.value;
                syncEditor();
            }
        }, 250); // Check every 250ms

        contentArea.addEventListener('scroll', syncScroll);

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const value = textarea.value;
                textarea.value = value.substring(0, start) + '  ' + value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 2;
                textarea.dispatchEvent(new Event('input'));
            }
        });

        // ==================== DYNAMIC COLOR/GRADIENT PREVIEW ====================
        // Shows color preview on selection - uses backdrop for gradient support
        let selectionStyleElement = null;
        let hasGradientHighlight = false;
        
        function updateSelectionColor() {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  // Nothing selected -> clear
  if (start === end) {
    removeColorPreview();
    return;
  }

  const rawSelectedText = textarea.value.substring(start, end);
  const selectedText = rawSelectedText.trim();

  // Direct matches (unchanged behavior)
  const hexMatch = selectedText.match(/^#([0-9a-fA-F]{3,8})$/);
  const rgbMatch = selectedText.match(/^rgba?\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[0-9.]+)?\s*\)$/i);
  const hslMatch = selectedText.match(/^hsla?\s*\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%(?:\s*,\s*[0-9.]+)?\s*\)$/i);
  const isGradient = /^(linear|radial)-gradient\s*\(/i.test(selectedText);

  let colorValue = null;
  let isGradientValue = false;

  if (hexMatch || rgbMatch || hslMatch) {
    colorValue = selectedText;
  } else if (isGradient) {
    colorValue = selectedText.replace(/;$/, '').trim();
    isGradientValue = true;
  } else {
    // --- Stricter surrounding-hex detection: only accept if the selection is entirely inside the property that contains the #hex ---
    try {
      const full = textarea.value;
      const hexRegexGlobal = /#([0-9a-fA-F]{3,8})\b/g;
      let m;
      let found = null;

      while ((m = hexRegexGlobal.exec(full)) !== null) {
        const matchStart = m.index;
        const matchEnd = matchStart + m[0].length; // exclusive

        // If the selection overlaps this hex token at all, consider it as candidate
        if (!(end <= matchStart || start >= matchEnd)) {
          // Now find the property bounds that contain the match:
          // propertyStart: index after last newline or after last '{' or after last ';' before the match (whichever is greater)
          // propertyEnd: the next semicolon after the match (prefer), otherwise end of line
          const lastNewline = full.lastIndexOf('\n', matchStart);
          const lastBrace = full.lastIndexOf('{', matchStart);
          const lastSemicolon = full.lastIndexOf(';', matchStart);
          const propLineStart = Math.max(lastNewline, lastBrace, lastSemicolon) + 1; // start index of the property line/block

          // Prefer semicolon as property terminator (standard CSS), fallback to newline
          let propEndSemicolon = full.indexOf(';', matchEnd);
          if (propEndSemicolon === -1) {
            // no semicolon: end at next newline or end-of-file
            const nextNewline = full.indexOf('\n', matchEnd);
            propEndSemicolon = nextNewline === -1 ? full.length : nextNewline;
          } else {
            // include the semicolon in the propertyRange
            propEndSemicolon = propEndSemicolon + 1;
          }

          const propertyStart = propLineStart;
          const propertyEnd = propEndSemicolon; // exclusive end index

          // Now check selection containment:
          // Accept if selection does not extend outside the single property that contains the color.
          const selectionIsWithinProperty = (start >= propertyStart) && (end <= propertyEnd);

          if (selectionIsWithinProperty) {
            found = {
              hex: m[0],
              propertyStart,
              propertyEnd
            };
            break;
          } else {
            // if selection intersects the property but extends beyond it, we must NOT trigger.
            // continue searching in case there is another matching hex that fits the rule.
          }
        }
      }

      if (found) {
        colorValue = found.hex;
      }
    } catch (err) {
      console.warn('updateSelectionColor error detecting surrounding color token:', err);
      colorValue = null;
    }
  }

  if (colorValue) {
    applyColorPreview(colorValue, isGradientValue);
  } else {
    removeColorPreview();
  }
}


        
        function applyColorPreview(color, isGradient) {
            // Remove existing style
            if (selectionStyleElement) {
                selectionStyleElement.remove();
            }
            
            selectionStyleElement = document.createElement('style');
            selectionStyleElement.className = 'dynamic-selection-color';
            
            // Get contrast color for text visibility
            const textColor = getContrastColor(color, isGradient);
            
            if (isGradient) {
                // For gradients: style the native selection with first color extracted
                // and show a preview box
                const firstColor = extractFirstColor(color);
                
                selectionStyleElement.textContent = `
                    #${textarea.id}::selection {
                        background: ${firstColor || 'rgba(100,100,100,0.5)'} !important;
                        color: ${textColor} !important;
                        -webkit-text-fill-color: ${textColor} !important;
                    }
                    #${textarea.id}::-moz-selection {
                        background: ${firstColor || 'rgba(100,100,100,0.5)'} !important;
                        color: ${textColor} !important;
                    }
                `;
                
                // Show gradient preview box
                showGradientPreview(color);
            } else {
                // Solid color - use native ::selection
                selectionStyleElement.textContent = `
                    #${textarea.id}::selection {
                        background: ${color} !important;
                        color: ${textColor} !important;
                        -webkit-text-fill-color: ${textColor} !important;
                    }
                    #${textarea.id}::-moz-selection {
                        background: ${color} !important;
                        color: ${textColor} !important;
                    }
                `;
                hideGradientPreview();
            }
            
            document.head.appendChild(selectionStyleElement);
        }
        
        // Gradient preview box element
        let gradientPreviewBox = null;
        
        function showGradientPreview(gradient) {
            if (!gradientPreviewBox) {
                gradientPreviewBox = document.createElement('div');
                gradientPreviewBox.className = 'css-gradient-preview-box';
                wrapper.appendChild(gradientPreviewBox);
            }
            
            gradientPreviewBox.style.cssText = `
                position: absolute;
                top: 8px;
                right: 8px;
                width: 80px;
                height: 40px;
                background: ${gradient};
                border: 2px solid rgba(255,255,255,0.8);
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                z-index: 100;
                pointer-events: none;
            `;
            gradientPreviewBox.title = 'Gradient Preview';
        }
        
        function hideGradientPreview() {
            if (gradientPreviewBox) {
                gradientPreviewBox.remove();
                gradientPreviewBox = null;
            }
        }
        
        
        function extractFirstColor(gradientStr) {
            // Match hex colors
            const hexMatch = gradientStr.match(/#([0-9a-fA-F]{3,8})\b/);
            if (hexMatch) return hexMatch[0];
            
            // Match rgba()
            const rgbaMatch = gradientStr.match(/rgba?\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[0-9.]+)?\s*\)/i);
            if (rgbaMatch) return rgbaMatch[0];
            
            // Match hsla()
            const hslaMatch = gradientStr.match(/hsla?\s*\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%(?:\s*,\s*[0-9.]+)?\s*\)/i);
            if (hslaMatch) return hslaMatch[0];
            
            return null;
        }
        
        function removeColorPreview() {
            if (selectionStyleElement) {
                selectionStyleElement.remove();
                selectionStyleElement = null;
            }
            hideGradientPreview();
        }
        
        function getContrastColor(color, isGradient) {
            let testColor = color;
            
            // For gradients, extract first color for contrast calculation
            if (isGradient) {
                testColor = extractFirstColor(color) || '#888888';
            }
            
            let r, g, b;
            
            const tempDiv = document.createElement('div');
            tempDiv.style.color = testColor;
            tempDiv.style.display = 'none';
            document.body.appendChild(tempDiv);
            const computedColor = window.getComputedStyle(tempDiv).color;
            document.body.removeChild(tempDiv);
            
            const rgbExtract = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (rgbExtract) {
                r = parseInt(rgbExtract[1]);
                g = parseInt(rgbExtract[2]);
                b = parseInt(rgbExtract[3]);
            } else {
                return '#ffffff';
            }
            
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            return luminance > 0.5 ? '#000000' : '#ffffff';
        }
        
        // Listen for selection changes
        textarea.addEventListener('mouseup', updateSelectionColor);
        textarea.addEventListener('keyup', updateSelectionColor);
        textarea.addEventListener('select', updateSelectionColor);
        
        // Clean up on blur
        textarea.addEventListener('blur', removeColorPreview);

        // console.log(TOOLKIT_NAME + ' CSS editor initialized successfully for #' + textarea.id + '!'); // Phase 3: Reduced logging

        // If this is a Fancy Button textarea, set up the Insert button handler
        if (fancyButtonId && (textarea.id.includes('fancyButton') && textarea.id.includes('MiscStyles'))) {
            setupFancyButtonInsertion(fancyButtonId);
        }
    }
    

    // ==================== FANCY BUTTON INSERTION HANDLER ====================
    function setupFancyButtonInsertion(fancyButtonId) {
        // Wait for the Insert Fancy Button to be available
        const observer = new MutationObserver(() => {
            const insertBtn = document.querySelector('.insertFancy');
            if (insertBtn && !insertBtn.dataset.cpToolkitBound) {
                insertBtn.dataset.cpToolkitBound = 'true';
                
                // Get the actual selector fresh from the DOM
                function getActualSelector() {
                    const fancyButtonContainer = document.querySelector('.fancyButtonContainer a.fancyButton');
                    if (fancyButtonContainer) {
                        const classes = fancyButtonContainer.className;
                        if (classes) {
                            const classList = classes.split(' ');
                            for (const cls of classList) {
                                const match = cls.match(/^fancyButton(\d+)$/);
                                if (match && match[1]) {
                                    return 'fancyButton' + match[1];
                                }
                            }
                        }
                    }
                    // Default to fancyButton1
                    return 'fancyButton1';
                }
                
                const actualSelector = getActualSelector();
                // console.log(TOOLKIT_NAME + ' Setting up Insert Fancy Button handler for ' + actualSelector); // Phase 3: Reduced logging

                // Use jQuery to properly intercept the click handler like the original script
                if (typeof $ !== 'undefined' && typeof $._data === 'function') {
                    try {
                        const events = $._data(insertBtn, 'events');
                        if (events && events.click && events.click[0]) {
                            const oldInsertFancyButtonFunction = events.click[0].handler;
                            
                            function newInsertFancyButton(e) {
                                // Re-get the selector at click time in case it changed
                                const currentSelector = getActualSelector();
                                // console.log(TOOLKIT_NAME + ' Insert Fancy Button clicked - converting selectors to .' + currentSelector); // Phase 3: Reduced logging
                                
                                // Replace ALL .fancyButton1 (and any .fancyButtonN) with actual selector
                                $('textarea.autoUpdate').each(function() {
                                    let text = $(this).val();
                                    // Replace any fancyButton number with the actual selector
                                    text = text.replace(/\.fancyButton\d+\b/g, '.' + currentSelector);
                                    $(this).val(text);
                                    $(this).change();
                                });
                                
                                // Also update our enhanced textareas
                                document.querySelectorAll('textarea[id^="fancyButton"][id$="MiscStyles"]').forEach(textarea => {
                                    if (textarea.value) {
                                        const newText = textarea.value.replace(/\.fancyButton\d+\b/g, '.' + currentSelector);
                                        if (newText !== textarea.value) {
                                            textarea.value = newText;
                                            textarea.dispatchEvent(new Event('change', { bubbles: true }));
                                            // console.log(TOOLKIT_NAME + ' Converted selectors to .' + currentSelector + ' in #' + textarea.id); // Phase 3: Reduced logging
                                        }
                                    }
                                });
                                
                                // Call original handler
                                oldInsertFancyButtonFunction(e);
                                
                                // Fix the class on the button element
                                const buttonEl = $('.fancyButtonContainer a.fancyButton');
                                if (buttonEl.length) {
                                    const newClass = buttonEl.attr('class').replace(/fancyButton\d+/g, currentSelector);
                                    buttonEl.attr('class', newClass);
                                }
                            }
                            
                            // Unbind old and bind new
                            $('.insertFancy').unbind('click').click(newInsertFancyButton);
                            // console.log(TOOLKIT_NAME + ' Successfully rebound Insert Fancy Button click handler'); // Phase 3: Reduced logging
                        } else {
                            // console.log(TOOLKIT_NAME + ' No existing click handler found on .insertFancy, using addEventListener'); // Phase 3: Reduced logging
                            addInsertButtonListener(insertBtn, getActualSelector);
                        }
                    } catch (err) {
                        console.warn(TOOLKIT_NAME + ' Error setting up jQuery handler:', err);
                        addInsertButtonListener(insertBtn, getActualSelector);
                    }
                } else {
                    // console.log(TOOLKIT_NAME + ' jQuery not available, using addEventListener'); // Phase 3: Reduced logging
                    addInsertButtonListener(insertBtn, getActualSelector);
                }
                
                observer.disconnect();
            }
        });

        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    // Fallback listener if jQuery method doesn't work
    function addInsertButtonListener(insertBtn, getSelectorFn) {
        insertBtn.addEventListener('click', function(e) {
            const actualSelector = typeof getSelectorFn === 'function' ? getSelectorFn() : getSelectorFn;
            // console.log(TOOLKIT_NAME + ' Insert Fancy Button clicked (addEventListener) - converting selectors to .' + actualSelector); // Phase 3: Reduced logging
            
            document.querySelectorAll('textarea[id^="fancyButton"][id$="MiscStyles"], textarea.autoUpdate').forEach(textarea => {
                if (textarea.value) {
                    const newText = textarea.value.replace(/\.fancyButton\d+\b/g, '.' + actualSelector);
                    if (newText !== textarea.value) {
                        textarea.value = newText;
                        textarea.dispatchEvent(new Event('change', { bubbles: true }));
                        // console.log(TOOLKIT_NAME + ' Converted selectors to .' + actualSelector + ' in #' + textarea.id); // Phase 3: Reduced logging
                    }
                }
            });
        }, true); // Capture phase
    }
    
    // ==================== FORCE RE-INITIALIZE EDITOR ====================
    // Completely removes and re-adds the CSS editor enhancement for a textarea
    function forceReinitializeEditor(textarea) {
        if (!textarea) return;
        
        // console.log(TOOLKIT_NAME + ' Force re-initializing editor for #' + textarea.id); // Phase 3: Reduced logging
        
        // Find existing wrapper
        const existingWrapper = textarea.closest('.css-editor-wrapper');
        
        if (existingWrapper) {
            // Get the original parent (wrapper's parent)
            const originalParent = existingWrapper.parentNode;
            
            // Move textarea back to original parent (before the wrapper)
            originalParent.insertBefore(textarea, existingWrapper);
            
            // Remove the wrapper completely
            existingWrapper.remove();
            
            // Clean up textarea classes
            textarea.classList.remove('css-editor-textarea');
            
            // console.log(TOOLKIT_NAME + ' Removed old wrapper for #' + textarea.id); // Phase 3: Reduced logging
        }
        
        // Small delay to let DOM settle, then re-initialize
        setTimeout(() => {
            initializeEditor(textarea);
            // console.log(TOOLKIT_NAME + ' Re-initialized editor for #' + textarea.id); // Phase 3: Reduced logging
        }, 50);
    }
    
    // ==================== FORCE RE-INITIALIZE ALL FANCY BUTTON EDITORS ====================
    function forceReinitializeAllFancyButtonEditors() {
        // console.log(TOOLKIT_NAME + ' Force re-initializing ALL fancy button editors...'); // Phase 3: Reduced logging
        
        // Find all fancy button related textareas
        const textareas = document.querySelectorAll(
            'textarea[id^="fancyButton"][id$="MiscStyles"]'
        );
        
        // console.log(TOOLKIT_NAME + ' Found ' + textareas.length + ' fancy button textareas to re-initialize'); // Phase 3: Reduced logging
        
        textareas.forEach((textarea, index) => {
            // Stagger the re-initialization to avoid race conditions
            setTimeout(() => {
                forceReinitializeEditor(textarea);
            }, index * 100);
        });
    }
    
    // ==================== SETUP ADD TEXT STYLE LISTENER ====================
    function setupAddTextStyleListener() {
        const observer = new MutationObserver(() => {
            const addTextStyleBtn = document.querySelector('.button.nextAction.addTextStyle, a.addTextStyle');
            if (addTextStyleBtn && !addTextStyleBtn.dataset.listenerAdded) {
                addTextStyleBtn.dataset.listenerAdded = 'true';
                addTextStyleBtn.addEventListener('click', function(e) {
                    // console.log(TOOLKIT_NAME + ' *** Add Text Style button clicked - will re-init all editors in 3 seconds ***'); // Phase 3: Reduced logging
                    
                    // Single re-init after 3 seconds to let CMS finish creating the new textarea
                    setTimeout(() => {
                        // console.log(TOOLKIT_NAME + ' Re-initializing all fancy button editors now...'); // Phase 3: Reduced logging
                        forceReinitializeAllFancyButtonEditors();
                    }, 1000);
                });
                // console.log(TOOLKIT_NAME + ' Hooked into Add Text Style button'); // Phase 3: Reduced logging
                observer.disconnect();
            }
        });
        
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    // ==================== SETUP TAB CHANGE LISTENER ====================
    function setupTabChangeListener() {
        // Listen for dropdown changes in fancy button modal
        document.addEventListener('change', function(e) {
            if (e.target.id === 'selectedTab' && e.target.closest('.fancyButtonBuilder')) {
                // console.log(TOOLKIT_NAME + ' Tab changed in Fancy Button Builder - checking for textareas'); // Phase 3: Reduced logging
                setTimeout(() => {
                    findAndEnhanceTextareas();
                }, 100);
            }
        });
        
        // Listen for clicks on tab links
        document.addEventListener('click', function(e) {
            const target = e.target.closest('a[href^="#fancyButton"]');
            if (target && target.closest('.fancyButtonBuilder')) {
                // console.log(TOOLKIT_NAME + ' Tab clicked in Fancy Button Builder - checking for textareas'); // Phase 3: Reduced logging
                setTimeout(() => {
                    findAndEnhanceTextareas();
                }, 100);
            }
        });
        
        // console.log(TOOLKIT_NAME + ' Tab change listeners set up'); // Phase 3: Reduced logging
    }

    // ==================== TEXT LIMIT ENFORCEMENT ====================
    function enforceTextLimits() {
        const isThemeManager = pageMatches(['/designcenter/themes/']);
        const isWidgetManager = pageMatches(['/designcenter/widgets/']);

        if (!isThemeManager && !isWidgetManager) return;

        // console.log(TOOLKIT_NAME + ' Enforcing text limits...'); // Phase 3: Reduced logging

        // CSP FIX: Use external script files instead of inline code
        // These files run in MAIN world to access CivicPlus page globals
        const helperFile = isThemeManager 
            ? 'css-editor-theme-manager-helper.js'
            : 'css-editor-widget-manager-helper.js';
        
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(`js/tools/on-load/helpers/${helperFile}`);
        (document.head || document.documentElement).appendChild(script);
        
        // console.log(TOOLKIT_NAME + ` Loaded external helper: ${helperFile}`); // Phase 3: Reduced logging
    }

    // ==================== FIND AND ENHANCE ALL TEXTAREAS ====================
    function findAndEnhanceTextareas() {
        // Look for CSS-related textareas in multiple CMS modules:
        // 1. Theme/Widget Manager: textarea with "MiscellaneousStyles" in ID
        // 2. Graphic Buttons Settings: #txtHeader and #txtFooter in Settings tab
        // 3. Fancy Button Builder Modal: #fancyButtonNormalMiscStyles and #fancyButtonHoverMiscStyles
        // 4. Graphic Links Admin Page: textarea.autoUpdate (for Fancy Buttons/Graphic Links)
        // 5. Dynamic text style textareas: fancyButton1NormalMiscStyles, fancyButton2NormalMiscStyles, etc.
        // 6. Site Styles: textarea#MiscStyles (body, .headline, etc.) and textarea.sitestyleupdate
        // 7. Search Box Styles: textarea#SearchBoxStyles
        // IMPORTANT: This includes textareas in HIDDEN tab panels!
        const textareas = document.querySelectorAll(
            'textarea[id*="MiscellaneousStyles"], ' +
            'textarea#txtHeader, ' +
            'textarea#txtFooter, ' +
            'textarea#fancyButtonNormalMiscStyles, ' +
            'textarea#fancyButtonHoverMiscStyles, ' +
            'textarea[id^="fancyButton"][id$="MiscStyles"], ' + // Catches fancyButton1NormalMiscStyles, etc.
            'textarea.autoUpdate.style, ' +  // Graphic Links page
            'textarea#MiscStyles, ' +  // Site styles (body, .headline, etc.)
            'textarea.sitestyleupdate, ' +  // Site style textareas
            'textarea#SearchBoxStyles'  // Search box styles
        );

        // Only log when textareas are actually found - Phase 3: Commented out
        // if (textareas.length > 0) {
        //     console.log(TOOLKIT_NAME + ' Found ' + textareas.length + ' textarea(s) matching CSS editor patterns');
        // }

        textareas.forEach(textarea => {
            // Skip if textarea is not in DOM or not visible at all
            if (!document.body.contains(textarea)) {
                return;
            }
            
            const isWrapped = textarea.parentElement && textarea.parentElement.classList.contains('css-editor-content');
            
            // Check if wrapper exists AND is properly initialized (has theme toggle button)
            const wrapper = textarea.closest('.css-editor-wrapper');
            const hasThemeToggle = !!(wrapper && wrapper.querySelector('.css-theme-toggle'));
            const hasPseudoToggle = !!(wrapper && wrapper.querySelector('.css-pseudo-toggle'));
            const requiresPseudoToggle = isThemeManagerPage();
            const isProperlyEnhanced = isWrapped && hasThemeToggle && (!requiresPseudoToggle || hasPseudoToggle);

            // Phase 3: Commented out verbose debug logging
            // if (textarea.id && textarea.id.includes('fancyButton')) {
            //     console.log(TOOLKIT_NAME + ' 🔍 Checking textarea:', {
            //         id: textarea.id,
            //         isInDOM: document.body.contains(textarea),
            //         isWrapped: isWrapped,
            //         hasWrapper: !!wrapper,
            //         hasThemeToggle: !!hasThemeToggle,
            //         isProperlyEnhanced: isProperlyEnhanced,
            //         willEnhance: !isProperlyEnhanced,
            //         parentElement: textarea.parentElement?.className || 'none',
            //         wrapperClass: wrapper?.className || 'none'
            //     });
            // }

            if (!isProperlyEnhanced) {
                // console.log(TOOLKIT_NAME + ' Enhancing textarea: #' + textarea.id); // Phase 3: Reduced logging
                initializeEditor(textarea);
            }
        });
    }

    // ==================== TAB PANEL VISIBILITY WATCHER ====================
    // Watches for hidden tab panels becoming visible and re-initializes textareas
    function watchTabPanelVisibility() {
        const tabPanels = document.querySelectorAll('.cpTabPanel');
        
        if (tabPanels.length === 0) {
            // console.log(TOOLKIT_NAME + ' No tab panels found to watch'); // Phase 3: Reduced logging
            return;
        }
        
        // console.log(TOOLKIT_NAME + ' Watching ' + tabPanels.length + ' tab panels for visibility changes'); // Phase 3: Reduced logging
        
        tabPanels.forEach(panel => {
            let wasVisible = panel.style.display !== 'none';
            
            const observer = new MutationObserver(() => {
                const isNowVisible = panel.style.display !== 'none';
                
                // Panel just became visible
                if (!wasVisible && isNowVisible) {
                    // console.log(TOOLKIT_NAME + ' Tab panel became visible:', panel.id); // Phase 3: Reduced logging
                    
                    // Find textareas in this panel
                    const textareas = panel.querySelectorAll('textarea[class*="autoUpdate"]');
                    
                    if (textareas.length > 0) {
                        // console.log(TOOLKIT_NAME + ' Re-checking ' + textareas.length + ' textareas in newly visible panel'); // Phase 3: Reduced logging
                        
                        // Small delay to ensure DOM is settled
                        setTimeout(() => {
                            textareas.forEach(textarea => {
                                const wrapper = textarea.closest('.css-editor-wrapper');
                                const hasThemeToggle = !!(wrapper?.querySelector('.css-theme-toggle'));
                                const hasPseudoToggle = !!(wrapper?.querySelector('.css-pseudo-toggle'));
                                const requiresPseudoToggle = isThemeManagerPage();
                                
                                if (wrapper && hasThemeToggle && (!requiresPseudoToggle || hasPseudoToggle)) {
                                    // Test if event listeners are actually working
                                    let listenerWorks = false;
                                    const testHandler = () => { listenerWorks = true; };
                                    
                                    textarea.addEventListener('input', testHandler, { once: true });
                                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                                    
                                    // Check if backdrop updated
                                    const backdrop = wrapper.querySelector('.css-editor-backdrop');
                                    const backdropHasContent = backdrop && backdrop.children.length > 0;
                                    
                                    if (listenerWorks && backdropHasContent) {
                                        // console.log(TOOLKIT_NAME + ' Textarea #' + textarea.id + ' is working correctly'); // Phase 3: Reduced logging
                                    } else {
                                        // console.log(TOOLKIT_NAME + ' Textarea #' + textarea.id + ' needs re-initialization'); // Phase 3: Reduced logging
                                        // Remove broken wrapper and re-init
                                        wrapper.remove();
                                        initializeEditor(textarea);
                                    }
                                } else {
                                    // No wrapper yet, initialize
                                    // console.log(TOOLKIT_NAME + ' Initializing textarea #' + textarea.id); // Phase 3: Reduced logging
                                    initializeEditor(textarea);
                                }
                            });
                        }, 100);
                    }
                }
                
                wasVisible = isNowVisible;
            });
            
            observer.observe(panel, { 
                attributes: true, 
                attributeFilter: ['style', 'class']
            });
        });
    }

    // ==================== FIND AND MAKE MODALS RESIZABLE ====================
    // ==================== MUTATION OBSERVER ====================
    function startObserving() {
        let debounceTimer = null;
        const observer = new MutationObserver((mutations) => {
            // Ignore mutations from our own editor (backdrop, line numbers, etc.)
            const isOurOwnChange = mutations.every(mutation => {
                const target = mutation.target;
                return target.classList && (
                    target.classList.contains('css-editor-backdrop') ||
                    target.classList.contains('css-line-numbers') ||
                    target.classList.contains('code-line') ||
                    target.closest('.css-editor-wrapper')
                );
            });
            
            if (isOurOwnChange) {
                return; // Skip our own changes
            }
            
            // Debounce to avoid running on every keystroke
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                findAndEnhanceTextareas();
                fixRenderedFancyButtonStyles();
            }, 300); // Wait 300ms after last change
        });

        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
        // console.log(TOOLKIT_NAME + ' Mutation observer started'); // Phase 3: Reduced logging

        // Watch for tab panels becoming visible
        watchTabPanelVisibility();

        findAndEnhanceTextareas();
    }

    // ==================== MAIN INITIALIZATION ====================
    async function initialize() {
        // console.log(TOOLKIT_NAME + ' Starting initialization...'); // Phase 3: Reduced logging
        const isCivicPlus = await isCivicPlusSite();
        if (!isCivicPlus) {
            console.log(TOOLKIT_NAME + ' Not a CivicPlus site. Script will not run.');
            return;
        }
        // console.log(TOOLKIT_NAME + ' CivicPlus site detected! Initializing CSS editor enhancement...'); // Phase 3: Reduced logging
        injectStyles();
        enforceTextLimits();
        startObserving();
        
        // Phase 2: Initialize theme system
        initializeTheme();
        
        // Phase 3: Fix rendered fancyButton styles on Graphic Links page
        fixRenderedFancyButtonStyles();
        
        // Phase 4: Setup listeners for fancy button features
        setupFancyButtonInsertion();
        setupAddTextStyleListener();
        setupTabChangeListener();
    }
    
    // ==================== FIX RENDERED FANCY BUTTON STYLES ====================
    function fixRenderedFancyButtonStyles() {
        // On Graphic Links page and in modals, styles are already rendered in <style> tags
        // We need to find .fancyButton1 in those tags and replace with the actual button number
        
        // console.log(TOOLKIT_NAME + ' Checking for rendered fancyButton styles to fix...'); // Phase 3: Reduced logging
        
        // Find all fancyButton elements on the page to determine their numbers
        const fancyButtons = document.querySelectorAll('a.fancyButton[class*="fancyButton"]');
        
        fancyButtons.forEach(button => {
            // Extract the button number from classes like "fancyButton fancyButton99"
            const classes = button.className.split(' ');
            const buttonClass = classes.find(c => c.match(/^fancyButton\d+$/));
            
            if (!buttonClass) return;
            
            const buttonNum = buttonClass.replace('fancyButton', '');
            if (buttonNum === '1') return; // Skip fancyButton1, that's the template
            
            // Find the associated <style> tag (could be in various locations)
            let styleTag = null;
            
            // Method 1: Check siblings of button
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
            
            // Method 3: Check parent's siblings (for modal structure)
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
                // Replace .fancyButton1 with .fancyButtonN
                const updatedCSS = originalCSS.replace(/\.fancyButton1\b/g, `.fancyButton${buttonNum}`);
                
                if (originalCSS !== updatedCSS) {
                    styleTag.textContent = updatedCSS;
                    // console.log(TOOLKIT_NAME + ' Fixed rendered styles: .fancyButton1 → .fancyButton' + buttonNum); // Phase 3: Reduced logging
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
        } catch (err) {
          console.warn("[CP Toolkit](" + thisTool + ") Error:", err);
        }
      } else {
        // console.log("[CP Toolkit] ○ Skipping " + thisTool + " (disabled in settings)"); // Phase 3: Reduced logging
      }
    });
  });
})();
