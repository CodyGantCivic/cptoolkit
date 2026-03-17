/**
 * Widget Skin Default Override Helper
 * Runs in MAIN world to override refreshContentContainersAsync
 *
 * When a new widget skin is created via "Add Widget Skin", this prompts the
 * user and applies the original default override values.
 */
(function() {
  'use strict';

  var toolName = 'widget-skin-default-override';

  // Track whether the last skin action was "Add" (not "Copy")
  var lastSkinAction = null;

  // Watch for clicks on Create Skin vs Copy Skin
  // "Add Widget Skin" opens a name input, then "Create Skin" (a.createNew) actually creates it
  // "Copy Widget Skin" opens a name input, then "Copy Skin" (a.createCopy) actually creates it
  document.addEventListener('click', function(e) {
    var target = e.target.closest('a');
    if (!target) return;

    // "Create Skin" button: <a href="#" class="button nextAction createNew">
    if (target.classList.contains('createNew')) {
      lastSkinAction = 'add';
      console.log('[CP Toolkit](' + toolName + ') Detected: Create Skin clicked');
    }

    // "Copy Skin" button: <a href="#" class="button nextAction createCopy">
    if (target.classList.contains('createCopy')) {
      lastSkinAction = 'copy';
      console.log('[CP Toolkit](' + toolName + ') Detected: Copy Skin clicked');
    }
  }, true);

  // Wait for refreshContentContainersAsync to be available
  var checkCount = 0;
  var maxChecks = 50;

  function waitForFunction() {
    checkCount++;

    if (typeof window.refreshContentContainersAsync === 'function') {
      console.log('[CP Toolkit](' + toolName + ') Hooking refreshContentContainersAsync...');
      hookRefreshFunction();
    } else if (checkCount < maxChecks) {
      setTimeout(waitForFunction, 200);
    } else {
      console.log('[CP Toolkit](' + toolName + ') refreshContentContainersAsync not found after ' + maxChecks + ' attempts');
    }
  }

  function hookRefreshFunction() {
    // Store original function
    var originalRefreshContentContainersfn = window.refreshContentContainersAsync;

    // Override with our version
    window.refreshContentContainersAsync = function(reset) {
      // Call original function first
      originalRefreshContentContainersfn(reset);

      // Check for newly created widget skins (negative IDs indicate unsaved)
      var foundSkin = false;

      if (!window.DesignCenter || !window.DesignCenter.themeJSON || !window.DesignCenter.themeJSON.WidgetSkins) {
        return;
      }

      var $ = window.$ || window.jQuery;
      if (!$) {
        console.warn('[CP Toolkit](' + toolName + ') jQuery not available');
        return;
      }

      var allSkins = window.DesignCenter.themeJSON.WidgetSkins;

      $.each(allSkins, function() {
        if (this.WidgetSkinID < 0) {
          // Check if another tool has requested to skip the override prompt
          // (e.g., apply-figma-styles.js when creating base skins in bulk)
          if (window.cpToolkitSkipSkinDefaultOverride === true) {
            console.log('[CP Toolkit](' + toolName + ') Skipping override prompt (disabled by another tool)');
            return true; // continue to next skin
          }

          // Only apply default overrides for "Add Widget Skin", not "Copy Widget Skin"
          if (lastSkinAction !== 'add') {
            console.log('[CP Toolkit](' + toolName + ') Skin created via ' + (lastSkinAction || 'unknown action') + ' - saving theme without overrides');
            // Still save the theme for copied skins
            if (lastSkinAction === 'copy' && typeof window.saveTheme === 'function') {
              window.saveTheme();
            }
            lastSkinAction = null;
            return true; // continue to next skin
          }

          foundSkin = true;
          var shouldSetDefaults = confirm("[CP Toolkit] Overriding Default New Widget Skin Options\n\nClick Cancel if you are copying a skin, or if you don't want to override the default new skin options. Click OK to override the default new skin options.");
          if (shouldSetDefaults) {
            console.log('[CP Toolkit](' + toolName + ') Overriding defaults.');
            if (this.Components && this.Components[0]) {
              this.Components[0].FontSize = null;
              this.Components[0].TextAlignment = 0;
            }
            if (this.Components && this.Components[13]) {
              var paddingEms = { Value: '0.5', Unit: '0' };
              this.Components[13].PaddingTop = paddingEms;
              this.Components[13].PaddingLeft = paddingEms;
              this.Components[13].PaddingBottom = paddingEms;
              this.Components[13].PaddingRight = paddingEms;
            }
          } else {
            console.log('[CP Toolkit](' + toolName + ') Not overriding defaults.');
          }
          lastSkinAction = null;
        }
      });

      if (foundSkin) {
        // Close modal and remove the backdrop.
        // The CMS close handler crashes on "ga is not defined" (Google Analytics),
        // leaving the modal and backdrop orphaned. Force-close both.
        $(".modalClose").click();
        $("#mvcModal_backgroundElement").hide();
        // Also close the modal container itself if .modalClose didn't work
        $("#mvcModal_mainElement").hide();

        if (typeof window.saveTheme === 'function') {
          window.saveTheme();
        }

        // Clean up backdrop after saveTheme in case it gets re-shown
        setTimeout(function() {
          $("#mvcModal_backgroundElement").hide();
          $("#mvcModal_mainElement").hide();
        }, 500);

        // Periodically try to remove the temporary skin indicator
        var clearSkin = setInterval(function() {
          $(".widget[class*='skin-'] .remove.widgetSkin").click();
        }, 100);

        setTimeout(function() {
          clearInterval(clearSkin);
        }, 5000);

        // NOTE: Previously we reopened the manage dialog here after 5s,
        // but saveTheme()'s completion callback already does that,
        // causing the modal to open twice. Removed to fix double-modal bug.
        // Original code:
        //   setTimeout(function() {
        //     clearInterval(clearSkin);
        //     $("a:contains('Manage Widget Skins')").click();
        //   }, 5000);
      }
    };

    console.log('[CP Toolkit](' + toolName + ') Successfully hooked refreshContentContainersAsync');
  }

  // Start waiting for the function
  waitForFunction();
})();
