/**
 * Remember Image Picker State — Robust version
 * Improves reliability when image picker opens rapidly or tree loads slowly.
 *
 * Strategy:
 * - Wait for the Ant tree to be present and "stable" (no rapid DOM mutations).
 * - Use MutationObserver to detect when nodes appear/children load.
 * - Re-query DOM frequently (no cached node references).
 * - Use promises, small waits, and retries with limits.
 * - Trigger both native and jQuery events for clicks/selection changes.
 *
 * Keeps legacy Telerik handler largely unchanged (lightweight fallback).
 */
(function loadTool() {
  var thisTool = "remember-image-picker-state";

  // Skip hidden iframes created by the toolkit (folder lookup, upload flow)
  try {
    if (window.frameElement) {
      var frameStyle = window.frameElement.style;
      if (frameStyle && (parseInt(frameStyle.left) < -999 || parseInt(frameStyle.top) < -999 ||
          frameStyle.opacity === '0' || parseInt(frameStyle.width) <= 1)) {
        return;
      }
    }
  } catch (e) { /* cross-origin, safe to continue */ }

  var isImagePickerFrame =
    window.location.pathname
      .toLowerCase()
      .indexOf("/documentcenter/folderformodal") > -1 ||
    window.location.pathname.toLowerCase().indexOf("/admin/documentcenter") >
      -1;

  if (
    !isImagePickerFrame &&
    window.location.pathname.toLowerCase().indexOf("/admin") === -1
  ) {
    return;
  }

  chrome.storage.local.get(thisTool, function (settings) {
    if (chrome.runtime.lastError) {
      console.error(
        "[CP Toolkit] Error loading settings for " + thisTool + ":",
        chrome.runtime.lastError,
      );
      return;
    }
    detect_if_cp_site(function () {
      if (settings[thisTool]) {
        if (isImagePickerFrame) {
          console.log(
            "[CP Toolkit] Loaded " + thisTool + " (in image picker iframe)",
          );
        }
        initImagePickerState();
      }
    });
  });

  /* ---------- Utilities & Wait helpers ---------- */

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  // Resolve when an element matching selector exists or timeout
  function waitFor(selector, timeoutMs) {
    var start = Date.now();
    return new Promise(function (resolve, reject) {
      function check() {
        var el = document.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeoutMs)
          return reject(new Error("timeout waiting for " + selector));
        requestAnimationFrame(check);
      }
      check();
    });
  }

  // Wait until selector exists and DOM is stable (no subtree mutations) for stableMs
  function waitForStable(selector, timeoutMs, stableMs) {
    var start = Date.now();
    return new Promise(function (resolve, reject) {
      var el = document.querySelector(selector);
      var lastMutation = Date.now();
      var obs = null;

      function attemptResolveIfReady() {
        var node = document.querySelector(selector);
        if (!node) return false;
        if (Date.now() - lastMutation >= stableMs) {
          if (obs) obs.disconnect();
          return resolve(node);
        }
        return false;
      }

      if (attemptResolveIfReady()) return;

      obs = new MutationObserver(function (muts) {
        lastMutation = Date.now();
        // if selector node didn't exist yet but now does, update el
        if (!el) el = document.querySelector(selector);
        if (Date.now() - start > timeoutMs) {
          obs.disconnect();
          return reject(new Error("timeout waiting for stable " + selector));
        }
        // try to resolve after microtask
        setTimeout(attemptResolveIfReady, stableMs + 10);
      });

      obs.observe(document.documentElement || document.body, {
        subtree: true,
        childList: true,
        attributes: true,
      });
      // initial check loop to handle cases with no mutations
      var poll = setInterval(function () {
        if (Date.now() - start > timeoutMs) {
          clearInterval(poll);
          if (obs) obs.disconnect();
          return reject(new Error("timeout waiting for stable " + selector));
        }
        if (attemptResolveIfReady()) {
          clearInterval(poll);
        }
      }, 100);
    });
  }

  function dispatchClick(target) {
    try {
      if (!target) return;
      // Fire a single click only — multiple clicks cause Ant Design to toggle
      // selection off, leaving React state desynced from the visual state.
      target.click();
    } catch (e) {
      console.warn("[CP Toolkit](" + thisTool + ") dispatchClick error:", e);
    }
  }

  function getStorageKey() {
    var hostname;
    try {
      hostname = window.parent.location.hostname;
    } catch (e) {
      hostname = window.location.hostname;
    }
    return "cpToolkit_imagePicker_path_" + hostname;
  }

  function getAddFolderFlagKey() {
    return "cpToolkit_imagePicker_justAddedFolder";
  }

  // Check if we just added a folder (skip restore if so)
  function checkAndClearAddFolderFlag() {
    try {
      var flag = sessionStorage.getItem(getAddFolderFlagKey());
      if (flag) {
        sessionStorage.removeItem(getAddFolderFlagKey());
        console.log("[CP Toolkit](" + thisTool + ") Detected folder was just added, skipping restore");
        return true;
      }
    } catch (e) {}
    return false;
  }

  // Set flag when Add Folder is clicked
  function setupAddFolderListener() {
    document.addEventListener("click", function(e) {
      // Check for Add Folder button click
      var target = e.target;
      var addFolderSpan = target.closest(".AddFolder");
      var addFolderLink = target.closest("a[href*='FolderForModal/Add']");

      if (addFolderSpan || addFolderLink) {
        try {
          sessionStorage.setItem(getAddFolderFlagKey(), "true");
          console.log("[CP Toolkit](" + thisTool + ") Add Folder clicked, setting flag");
        } catch (e) {}
      }
    }, true); // Use capture phase to catch before navigation
  }

  /* ---------- Init ---------- */

  async function initImagePickerState() {
    try {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initImagePickerState);
        return;
      }

      // Set up listener for Add Folder clicks
      setupAddFolderListener();

      // Prefer Ant Design tree
      var antTree = document.querySelector(".ant-tree");
      var telerikTree = document.querySelector(".t-pane");

      if (antTree) {
        console.log("[CP Toolkit](" + thisTool + ") Ant Design tree detected");
        initAntTreeHandler();
      } else if (telerikTree) {
        console.log(
          "[CP Toolkit](" + thisTool + ") Telerik tree detected (legacy)",
        );
        initTelerikTreeHandler();
      } else {
        // If not present yet, wait and retry but with robust waiting
        try {
          // Wait up to 4s for the tree to appear and be stable for 150ms
          await waitForStable(".ant-tree, .t-pane", 4000, 150);
          initImagePickerState();
        } catch (e) {
          // Nothing found — retry more slowly if image picker frame
          if (isImagePickerFrame) {
            setTimeout(initImagePickerState, 500);
          }
        }
      }
    } catch (err) {
      console.warn("[CP Toolkit] Error in " + thisTool + " init:", err);
    }
  }

  /* ---------- Ant Tree Handler (robust) ---------- */

  function initAntTreeHandler() {
    var storageKey = getStorageKey();

    // Check if we just added a folder - skip restore if so
    if (checkAndClearAddFolderFlag()) {
      console.log("[CP Toolkit](" + thisTool + ") Skipping restore after folder creation");
      setupAntTreeObserver(storageKey);
      return;
    }

    var savedFolderPath = null;
    try {
      savedFolderPath = localStorage.getItem(storageKey);
    } catch (e) {
      console.warn("[CP Toolkit](" + thisTool + ") reading storage error:", e);
    }

    console.log("[CP Toolkit](" + thisTool + ") Storage key:", storageKey);
    console.log(
      "[CP Toolkit](" + thisTool + ") Saved folder path:",
      savedFolderPath,
    );

    setupAntTreeObserver(storageKey);

    if (savedFolderPath) {
      // Defer actual restore to avoid racing with other init actions.
      // Use a short delay and robust wait-for-stable before attempting.
      (async function deferredRestore() {
        try {
          // Wait until tree has at least one title and is stable
          await waitForStable(".ant-tree .ant-tree-title", 5000, 200);
          await restoreAntTreePath(savedFolderPath);
        } catch (e) {
          console.warn(
            "[CP Toolkit](" + thisTool + ") deferred restore failed:",
            e,
          );
          // As a fallback try once more after a short delay
          setTimeout(function () {
            restoreAntTreePath(savedFolderPath).catch(function (err) {
              console.warn(
                "[CP Toolkit](" + thisTool + ") fallback restore failed:",
                err,
              );
            });
          }, 700);
        }
      })();
    }
  }

  function setupAntTreeObserver(storageKey) {
    function saveCurrentSelection() {
      var selectedNode = document.querySelector(".ant-tree-treenode-selected");
      if (selectedNode) {
        var folderPath = getFolderPath(selectedNode);
        if (folderPath && folderPath.length > 0) {
          var pathString = JSON.stringify(folderPath);
          try {
            localStorage.setItem(storageKey, pathString);
            console.log(
              "[CP Toolkit](" + thisTool + ") Saved folder path:",
              folderPath,
            );
          } catch (e) {
            console.warn(
              "[CP Toolkit](" + thisTool + ") saving storage error:",
              e,
            );
          }
        }
      }
    }

    var tree = document.querySelector(".ant-tree");
    if (!tree) {
      // Try again later
      setTimeout(function () {
        setupAntTreeObserver(storageKey);
      }, 400);
      return;
    }

    var observer = new MutationObserver(function (mutations) {
      clearTimeout(observer.saveTimeout);
      observer.saveTimeout = setTimeout(saveCurrentSelection, 200);
    });

    observer.observe(tree, {
      attributes: true,
      attributeFilter: ["class"],
      subtree: true,
      childList: true,
    });

    document.addEventListener("click", function (e) {
      if (
        e.target.closest(".ant-tree-node-content-wrapper") ||
        e.target.closest(".ant-tree-switcher")
      ) {
        setTimeout(saveCurrentSelection, 300);
      }
    });

    window.addEventListener("beforeunload", saveCurrentSelection);
    window.addEventListener("pagehide", saveCurrentSelection);

    setTimeout(saveCurrentSelection, 500);
  }

  function getFolderPath(node) {
    var path = [];
    var current = node;

    while (
      current &&
      current.classList &&
      current.classList.contains("ant-tree-treenode")
    ) {
      var titleElement = current.querySelector(
        ":scope > .ant-tree-node-content-wrapper .ant-tree-title",
      );
      if (titleElement) {
        var title = titleElement.textContent.trim();
        if (title) {
          path.unshift(title);
        }
      }

      // Determine depth by counting indent-units
      var indent = current.querySelector(":scope > .ant-tree-indent");
      var currentDepth = indent
        ? indent.querySelectorAll(".ant-tree-indent-unit").length
        : 0;

      if (currentDepth === 0) break;

      var prev = current.previousElementSibling;
      var parentFound = false;
      while (prev) {
        if (prev.classList && prev.classList.contains("ant-tree-treenode")) {
          var prevIndent = prev.querySelector(":scope > .ant-tree-indent");
          var prevDepth = prevIndent
            ? prevIndent.querySelectorAll(".ant-tree-indent-unit").length
            : 0;
          if (prevDepth < currentDepth) {
            current = prev;
            parentFound = true;
            break;
          }
        }
        prev = prev.previousElementSibling;
      }
      if (!parentFound) break;
    }

    return path;
  }

  // Find a folder node by title (exact match), return the .ant-tree-treenode element
  function findFolderByNameLive(name) {
    var titleElements = document.querySelectorAll(".ant-tree-title");
    for (var i = 0; i < titleElements.length; i++) {
      if (titleElements[i].textContent.trim() === name) {
        return titleElements[i].closest(".ant-tree-treenode");
      }
    }
    return null;
  }

  // Wait until a node has children visible (simple heuristic)
  function hasVisibleChildren(node) {
    if (!node) return false;
    // children nodes are typically the next nested UL/LI; here we test for descendant treenode elements
    return (
      node.querySelectorAll(".ant-tree-treenode").length > 1 ||
      node.querySelector(".ant-tree-child-tree") !== null ||
      node.querySelector(".ant-tree-switcher") !== null
    );
  }

  // Restore saved path asynchronously with retries and waits
  async function restoreAntTreePath(savedPathString) {
    var path;
    try {
      path = JSON.parse(savedPathString);
    } catch (e) {
      console.warn(
        "[CP Toolkit](" + thisTool + ") Invalid saved path:",
        savedPathString,
      );
      return;
    }
    if (!Array.isArray(path) || path.length === 0) {
      console.log("[CP Toolkit](" + thisTool + ") No valid path to restore");
      return;
    }

    console.log("[CP Toolkit](" + thisTool + ") Restoring path:", path);
    var overlay = showLoadingOverlay("[CP Toolkit] Opening folder...");

    // Max attempts per folder to avoid infinite loops
    var MAX_ATTEMPTS = 6;
    var DELAY_AFTER_CLICK = 300; // ms to wait for children to render
    var DELAY_FIND_RETRY = 150; // ms between find retries

    try {
      for (var idx = 0; idx < path.length; idx++) {
        var folderName = path[idx];
        var attempts = 0;
        var found = false;

        while (attempts < MAX_ATTEMPTS && !found) {
          attempts++;
          var folderNode = findFolderByNameLive(folderName);

          if (folderNode) {
            found = true;
            var isLast = idx === path.length - 1;
            console.log(
              "[CP Toolkit](" +
                thisTool +
                ") Found folder '" +
                folderName +
                "' (index " +
                idx +
                ", " + (isLast ? "final" : "intermediate") +
                ") attempt " +
                attempts,
            );

            if (!isLast) {
              // Intermediate folder: only expand, do NOT select.
              // Selecting intermediate folders triggers React state changes
              // and folder content loads that can race with the final selection.
              var switcher = folderNode.querySelector(".ant-tree-switcher");
              var isExpanded =
                folderNode.classList.contains(
                  "ant-tree-treenode-switcher-open",
                ) ||
                folderNode.classList.contains("ant-tree-treenode-expanded") ||
                (switcher &&
                  switcher.classList.contains("ant-tree-switcher-open"));
              if (
                switcher &&
                !isExpanded &&
                !switcher.classList.contains("ant-tree-switcher-noop")
              ) {
                console.log(
                  "[CP Toolkit](" +
                    thisTool +
                    ") Expanding folder: " +
                    folderName,
                );
                dispatchClick(switcher);
              }
              // Wait for children to populate or tree to update
              await sleep(DELAY_AFTER_CLICK);
              // Wait a bit more and ensure the subtree has loaded; attempt small polls
              var childLoaded = false;
              for (var w = 0; w < 6; w++) {
                // re-find the node and check for visible children
                var reNode = findFolderByNameLive(folderName);
                if (reNode && hasVisibleChildren(reNode)) {
                  childLoaded = true;
                  break;
                }
                await sleep(DELAY_FIND_RETRY);
              }
              if (!childLoaded) {
                // Try observing the tree for mutations for a short window
                try {
                  await waitForStable(".ant-tree-title", 800, 100).catch(
                    function () {},
                  );
                } catch (e) {}
              }
            } else {
              // Final folder: select it with a single click
              var contentWrapper = folderNode.querySelector(
                ".ant-tree-node-content-wrapper",
              );
              if (contentWrapper) {
                dispatchClick(contentWrapper);
              }

              // Wait for React to process the selection and load folder contents
              var selectedOk = false;
              for (var poll = 0; poll < 10; poll++) {
                var sel = document.querySelector(
                  ".ant-tree-treenode-selected .ant-tree-title",
                );
                if (sel && sel.textContent.trim() === folderName) {
                  selectedOk = true;
                  break;
                }
                await sleep(120);
              }
              if (!selectedOk) {
                // Try one more click to ensure selection
                if (contentWrapper) {
                  dispatchClick(contentWrapper);
                }
                await sleep(200);
              }
              // Extra pause for React to finish loading the folder's contents
              await sleep(300);
            }
          } else {
            // Not found yet — small delay and retry
            await sleep(DELAY_FIND_RETRY);
          }
        } // end attempts loop

        if (!found) {
          // Folder not in this tree - expected when navigating to pages with different folder structures
          // continue to next path element (best-effort)
        }
      } // end for each folder
    } catch (e) {
      console.warn("[CP Toolkit](" + thisTool + ") restore error:", e);
    } finally {
      hideLoadingOverlay(overlay);
      console.log("[CP Toolkit](" + thisTool + ") Finished restoring path");
    }
  }

  /* ---------- Loading overlay helpers ---------- */

  function showLoadingOverlay(message) {
    try {
      var existing = document.getElementById("cp-toolkit-loading-overlay");
      if (existing) return existing;
      var overlay = document.createElement("div");
      overlay.id = "cp-toolkit-loading-overlay";
      overlay.style.cssText =
        "position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.85); z-index: 99999; display: flex; align-items: center; justify-content: center;";
      overlay.innerHTML =
        '<div style="text-align: center; font-family: Arial, sans-serif; background: #fff; padding: 14px 28px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.12); font-size: 14px; color: #333;">' +
        (message || "") +
        "</div>";
      document.body.appendChild(overlay);
      return overlay;
    } catch (e) {
      return null;
    }
  }

  function hideLoadingOverlay(overlay) {
    try {
      if (overlay && overlay.parentNode) overlay.remove();
      var existing = document.getElementById("cp-toolkit-loading-overlay");
      if (existing) existing.remove();
    } catch (e) {}
  }

  /* ---------- Legacy Telerik handler (lightweight fallback) ---------- */

  function initTelerikTreeHandler() {
    var jQ = window.jQuery || window.$;
    if (!jQ) {
      setTimeout(initTelerikTreeHandler, 300);
      return;
    }

    var storageKey = getStorageKey().replace("_path_", "_folders_");
    var loadingOverlay = null;
    function showTelerikLoadingOverlay(message) {
      if (loadingOverlay) return;
      loadingOverlay = showLoadingOverlay(message);
    }
    function hideTelerikLoadingOverlay() {
      if (loadingOverlay) {
        hideLoadingOverlay(loadingOverlay);
        loadingOverlay = null;
      }
    }

    showTelerikLoadingOverlay(
      "[CP Toolkit] Opening previously-opened folder...",
    );

    // Attempt a simple conservative restore: open the first saved folder found in list
    try {
      var foldersToOpen = localStorage.getItem(storageKey);
      if (!foldersToOpen) {
        hideTelerikLoadingOverlay();
        return;
      }
      var list = foldersToOpen.split(",").filter(Boolean);
      if (list.length === 0) {
        hideTelerikLoadingOverlay();
        return;
      }
      // Attempt to find input.t-input with matching value, click its parent
      setTimeout(function () {
        for (var i = 0; i < list.length; i++) {
          var val = list[i];
          var match = jQ("input.t-input")
            .filter(function () {
              return jQ(this).val() === val;
            })
            .first();
          if (match.length) {
            match
              .closest(".t-item")
              .find(".t-in, .t-icon")
              .first()
              .trigger("click");
            break;
          }
        }
        hideTelerikLoadingOverlay();
      }, 500);
    } catch (e) {
      console.warn("[CP Toolkit](" + thisTool + ") telerik restore error:", e);
      hideTelerikLoadingOverlay();
    }
  }
})();
