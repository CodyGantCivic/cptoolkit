(function loadTool() {
  var thisTool = "module-icons";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool]) {
        console.log("[CP Toolkit] Loaded " + thisTool);
        try {
          $.getJSON(chrome.runtime.getURL("/data/modules.json"), function(modules) {
            // Counter to check number of attempts to load
            var attemptToLoadIconsCounter = 0;

            // Function to check if the tabs panel is on the current page
            function checkIfTabsPanel() {
              if ($(".cp-ModuleList-item").length) {
                // If the tabs panel is on the current page, load Font Awesome
                (function() {
                  if ($("#fontawesome_css").length == 0) {
                    var css = document.createElement("link");
                    css.id = "fontawesome_css";
                    css.href = chrome.runtime.getURL("/css/external/fontawesome-all.min.css");
                    css.rel = "stylesheet";
                    css.type = "text/css";
                    document.getElementsByTagName("head")[0].appendChild(css);
                    // console.log("[CP Toolkit] ✓ FontAwesome loaded for module icons"); // Phase 3: Reduced logging
                  }
                })();
                addIconsToModules();
              } else {
                // Retry 10 times
                if (attemptToLoadIconsCounter < 20) {
                  setTimeout(checkIfTabsPanel, 200);
                } else {
                  // console.log("[CP Toolkit](" + thisTool + ") This page appears to not have a module list."); // Phase 3: Reduced logging
                }
                attemptToLoadIconsCounter++;
              }
            }

            // Function to loop through and add all icons
            function addIconsToModules() {
              // console.log("[CP Toolkit](" + thisTool + ") Checking for module icons to add..."); // Phase 3: Reduced logging
              
              var addedModules = {}; // Track which modules already have icons
              
              // First, add user's custom favorite icons from storage
              chrome.storage.sync.get(null, function(result) {
                if (chrome.runtime.lastError) {
                  console.warn("[CP Toolkit](" + thisTool + ") Error loading favorites:", chrome.runtime.lastError);
                  result = {}; // Continue with defaults even if sync fails
                }
                
                var customFavoriteCount = 0;
                $.each(result, function(moduleClassKey, moduleClassValue) {
                  $.each(moduleClassValue, function(key, value) {
                    var moduleKey = moduleClassKey + ":" + key;
                    if (!addedModules[moduleKey]) {
                      addIconToModule(key, moduleClassKey, value);
                      addedModules[moduleKey] = true;
                      customFavoriteCount++;
                    }
                  });
                });
                
                // Phase 3: Reduced logging - comment out verbose icon count logs
                // if (customFavoriteCount > 0) {
                //   console.log("[CP Toolkit](" + thisTool + ") Added " + customFavoriteCount + " custom favorite module icons.");
                // }
                
                // Then, add default icons for modules with default-icon set (deduplicated)
                var defaultIconCount = 0;
                $.each(modules, function(moduleClass, moduleList) {
                  $.each(moduleList, function(moduleName, moduleData) {
                    var moduleKey = moduleClass + ":" + moduleName;
                    if (moduleData["default-icon"] && moduleData["default-icon"] !== "" && !addedModules[moduleKey]) {
                      addIconToModule(moduleName, moduleClass, moduleData["default-icon"]);
                      addedModules[moduleKey] = true;
                      defaultIconCount++;
                    }
                  });
                });
                
                // Phase 3: Reduced logging - comment out verbose icon count logs
                // if (defaultIconCount > 0) {
                //   console.log("[CP Toolkit](" + thisTool + ") Added " + defaultIconCount + " default module icons.");
                // } else if (customFavoriteCount === 0) {
                //   console.log("[CP Toolkit](" + thisTool + ") No icons to add (no favorites or defaults configured).");
                // }
              });
            }

            // Function to add an individual icon
            function addIconToModule(moduleName, moduleClass, faClass) {
              var urlOfModule = modules[moduleClass][moduleName].url;
              $(".cp-Tabs-panel")
                .find(".cp-ModuleList-itemLink[href*='" + urlOfModule + "']")
                .each(function() {
                  var link = this;
                  var $link = $(link);

                  if (!moduleLinkAlreadyHasIcon(link)) {
                    var icon = document.createElement("i");
                    icon.className = faClass + " cp-toolkit-module-icon";
                    icon.setAttribute("aria-hidden", "true");
                    icon.setAttribute("data-cp-toolkit-module-icon", "true");

                    var spacer = document.createTextNode("\u00a0\u00a0\u00a0");
                    link.insertBefore(spacer, link.firstChild);
                    link.insertBefore(icon, spacer);
                  }

                  $link.css("font-weight", "bold");
                });
            }

            function moduleLinkAlreadyHasIcon(link) {
              if ($(link).children(".cp-toolkit-module-icon, [data-cp-toolkit-module-icon='true']").length) {
                return true;
              }

              var childNodes = link.childNodes || [];
              for (var i = 0; i < childNodes.length; i++) {
                var node = childNodes[i];
                if (node.nodeType === Node.TEXT_NODE) {
                  if (node.nodeValue.replace(/[\s\u00a0]/g, "") === "") {
                    continue;
                  }
                  return false;
                }

                if (node.nodeType !== Node.ELEMENT_NODE) {
                  continue;
                }

                return isIconElement(node);
              }

              return false;
            }

            function isIconElement(node) {
              var tagName = node.tagName.toLowerCase();
              var className = String(node.getAttribute("class") || "").toLowerCase();

              return tagName === "svg" ||
                tagName === "img" ||
                (tagName === "i" && (className.indexOf("fa") !== -1 || className.indexOf("icon") !== -1)) ||
                className.indexOf("icon") !== -1 ||
                className.indexOf("moduleicon") !== -1 ||
                className.indexOf("module-icon") !== -1;
            }
            $(document).ready(function() {
              checkIfTabsPanel();
            });
          });
        } catch (err) {
          console.warn("[CP Toolkit] Error in " + thisTool + ":", err);
        }
      } else {
        // console.log("[CP Toolkit] ○ Skipping " + thisTool + " (disabled in settings)");
      }
    });
  });
})();
