(function loadTool() {
  var thisTool = "theme-manager-enhancer";
  var STYLE_ID = "cp-toolkit_theme-manager-enhancer";
  var PSEUDO_MODE_KEY = "theme-manager-enhancer-pseudo-mode";
  var PSEUDO_MODE_DEFAULT = "legacy-fix";
  var initialized = false;
  var storageListenerBound = false;
  var pseudoMode = PSEUDO_MODE_DEFAULT;

  function sanitizePseudoMode(value) {
    if (value === "legacy-fix" || value === "cms-default" || value === "off") {
      return value;
    }
    return PSEUDO_MODE_DEFAULT;
  }

  function getPageState() {
    var path = window.location.pathname.toLowerCase();
    var isThemeManager = path.startsWith("/designcenter/themes/");
    var isWidgetManager = path.startsWith("/designcenter/widgets/");
    var isAnimationManager = path.startsWith("/designcenter/animations/");

    return {
      isThemeManager: isThemeManager,
      isWidgetManager: isWidgetManager,
      isAnimationManager: isAnimationManager,
      isRelevantPage: isThemeManager || isWidgetManager || isAnimationManager
    };
  }

  function getPseudoOverrideCss(mode) {
    if (mode === "legacy-fix") {
      return `
/* Fix horizontal scroll bar (don't negative position cpComponents unless exploded) */
body:not(.exploded) .cpComponent:before {
    left: 0 !important;
    right: 0 !important;
}
`;
    }

    if (mode === "cms-default") {
      return `
/* Designer mode: restore CMS pseudo bounds for cpComponent */
body:not(.exploded) .cpComponent:before {
    left: -2px !important;
    right: -2px !important;
}
`;
    }

    return `
/* Pseudo override mode off: do not override .cpComponent:before bounds */
`;
  }

  function getBaseEnhancerCss() {
    return `
/* [CP Toolkit] Theme Manager Enhancer Styles */

/* Change outline when focused in exploded view */
.exploded [data-cprole$="Container"].focused {
    outline-style: dashed !important;
}

/* Unfix stickyStructural on exploded view */
.exploded .stickySticky {
    position: relative;
    top: auto !important;
}

/* Fix padding when unfixed stickySticky on exploded view */
.exploded #bodyWrapper {
    padding-top: 47px !important;
}

/* Fix z-index issue with stickyStructural hover (caused by cpComponent hover z-index) */
.stickyStructuralContainer.stickySticky:hover,
.stickyStructuralContainer.stickyCollapsed:hover {
    z-index: 100;
}

/* Fix Widget Skin cut-off */
.modalContainer.modalContainerCP.manageWidgetSkins .cpForm>li .status {
    position: static;
}

.modalContainer.modalContainerCP.manageWidgetSkins .cpForm>li .status:before {
    content: "The skin above is ";
}

.modalContainer.modalContainerCP.manageWidgetSkins .cpForm>li input[type=text] {
    padding-right: .5rem !important;
}

.currentWidgetSkins li.rename[data-active="False"] input {
    background: #DDD;
}

/* Fix horizontal scroll bar (don't negative position first structuralContainer when exploded) */
.exploded #bodyWrapper > .structuralContainer:before {
    left: 0 !important;
    right: 0 !important;
}
`;
  }

  function ensureStyleElement() {
    var styleElement = document.getElementById(STYLE_ID);
    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(styleElement);
    }
    return styleElement;
  }

  function removeStyles() {
    var styleElement = document.getElementById(STYLE_ID);
    if (styleElement && styleElement.parentNode) {
      styleElement.parentNode.removeChild(styleElement);
    }
  }

  function applyStyles() {
    if (!getPageState().isThemeManager) {
      return;
    }

    var styleElement = ensureStyleElement();
    styleElement.textContent = getBaseEnhancerCss() + getPseudoOverrideCss(pseudoMode);
    styleElement.setAttribute("data-pseudo-mode", pseudoMode);
  }

  chrome.storage.local.get([thisTool, PSEUDO_MODE_KEY], function(settings) {
    if (chrome.runtime.lastError) {
      console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
      return;
    }

    detect_if_cp_site(function() {
      var state = getPageState();
      var toolEnabled = settings[thisTool] !== false;
      pseudoMode = sanitizePseudoMode(settings[PSEUDO_MODE_KEY]);

      if (!toolEnabled || !state.isRelevantPage) {
        return;
      }

      function addLayoutManagerOption() {
        var currentViewSelect = $(".cpToolbar select#currentView");
        if (currentViewSelect.length) {
          if (currentViewSelect.find("option[value='Layouts']").length === 0) {
            var layoutManagerOption = $('<option value="Layouts">Layout Manager</option>');
            currentViewSelect.append(layoutManagerOption);
          }

          if (!currentViewSelect.data("cp-toolkit-layout-handler")) {
            currentViewSelect.data("cp-toolkit-layout-handler", true);
            currentViewSelect.on("change.cpToolkit", function() {
              if ($(this).val() === "Layouts") {
                window.location.href = "/Admin/DesignCenter/Layouts";
              }
            });
          }
        }
      }

      function bindStorageListener() {
        if (storageListenerBound || !chrome.storage || !chrome.storage.onChanged) {
          return;
        }

        chrome.storage.onChanged.addListener(function(changes, areaName) {
          if (areaName !== "local") {
            return;
          }

          if (changes[PSEUDO_MODE_KEY]) {
            pseudoMode = sanitizePseudoMode(changes[PSEUDO_MODE_KEY].newValue);
            if (getPageState().isThemeManager) {
              applyStyles();
            }
          }

          if (changes[thisTool]) {
            var nowEnabled = changes[thisTool].newValue !== false;
            if (!nowEnabled) {
              removeStyles();
            } else if (getPageState().isThemeManager) {
              applyStyles();
            }
          }
        });

        storageListenerBound = true;
      }

      function initEnhancer() {
        try {
          var currentState = getPageState();

          if (currentState.isThemeManager) {
            applyStyles();
          }

          if (currentState.isRelevantPage) {
            addLayoutManagerOption();
          }

          bindStorageListener();

          if (!initialized) {
            initialized = true;
            console.log("[CP Toolkit] Loaded " + thisTool);
          }
        } catch (err) {
          console.warn("[CP Toolkit](" + thisTool + ") Error:", err);
        }
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initEnhancer);
      } else {
        initEnhancer();
      }

      var observer = new MutationObserver(function() {
        var currentState = getPageState();

        if (currentState.isThemeManager && !document.getElementById(STYLE_ID)) {
          applyStyles();
        }

        if (currentState.isRelevantPage) {
          var currentViewSelect = $(".cpToolbar select#currentView");
          if (currentViewSelect.length && currentViewSelect.find("option[value='Layouts']").length === 0) {
            addLayoutManagerOption();
          }
        }
      });

      function startObserving() {
        if (document.body) {
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        } else {
          setTimeout(startObserving, 50);
        }
      }
      startObserving();

      var checkInterval = setInterval(function() {
        var currentState = getPageState();

        if (!currentState.isRelevantPage) {
          clearInterval(checkInterval);
          observer.disconnect();
          return;
        }

        if (currentState.isThemeManager && !document.getElementById(STYLE_ID)) {
          applyStyles();
        }
      }, 2000);
    });
  });
})();
