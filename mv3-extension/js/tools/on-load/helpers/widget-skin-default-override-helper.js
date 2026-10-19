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

  // Skins created by "Copy Skin" that haven't been saved yet.
  var copiedUnsavedSkins = [];

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

  // After a skin is created or copied, the CMS previews it on the widgets in
  // every content container with a temporary "remove skin" indicator. Keep the
  // preview in the main content container, where it is useful, and dismiss it
  // in the other content containers. A fixed-duration poll can lose the race
  // against the CMS's own post-save container refresh, so watch for the
  // indicators actually appearing instead.
  //
  // Dismissing a preview makes the CMS close the Manage Widget Skins modal and
  // can leave its dark backdrop (#mvcModal_backgroundElement, .modalBackground)
  // behind. Once the page settles, the modal is reopened (copy only) and the
  // backdrop is released if no modal is on screen.
  var previewCleanup = null;
  var OVERLAY_KEY = 'copy-cleanup';

  function startNewSkinPreviewCleanup($, options) {
    var wantsReopen = !!(options && options.reopenManageWidgetSkins);
    var WINDOW_MS = 15000;      // how long to keep watching for late previews
    var QUIET_MS = 800;         // page must be this quiet before settling
    var MIN_WORK_MS = 3000;     // wait at least this long if nothing needed dismissing

    // Cover the page while the CMS re-renders containers, so the previews
    // flickering in and out are never seen.
    if (wantsReopen && window.CPToolkitSkinOverlay) {
      window.CPToolkitSkinOverlay.show(
        OVERLAY_KEY,
        'Finishing your skin copy…',
        'Tidying up the page. This only takes a few seconds.'
      );
    }

    // A second copy while one cleanup is running restarts its round instead of
    // starting a competing observer.
    if (previewCleanup) {
      previewCleanup.reopen = previewCleanup.reopen || wantsReopen;
      previewCleanup.endAt = Date.now() + WINDOW_MS;
      previewCleanup.startedAt = Date.now();
      previewCleanup.lastActivity = Date.now();
      previewCleanup.dismissed = 0;
      previewCleanup.settled = false;
      return;
    }

    var now = Date.now();
    var state = {
      reopen: wantsReopen,
      endAt: now + WINDOW_MS,
      startedAt: now,
      lastActivity: now,
      dismissed: 0,
      settled: false,
      mainHadPreview: false,
      mainDisappearedLogged: false
    };
    previewCleanup = state;

    // One scoped selector instead of scanning every widget and walking up to
    // its container for each match; descendants of the main container are
    // excluded in a single cheap pass.
    var INDICATORS = "[data-cprole='contentContainer'] .widget[class*='skin-'] .remove.widgetSkin";
    var MAIN_INDICATORS = "[data-cprole='mainContentContainer'] .widget[class*='skin-'] .remove.widgetSkin";
    var IN_MAIN_CONTAINER = "[data-cprole='mainContentContainer'] *";

    function dismissTemporarySkinIndicators() {
      var $found = $(INDICATORS).not(IN_MAIN_CONTAINER);
      if ($found.length === 0) return;
      state.dismissed += $found.length;
      $found.click();
    }

    // Diagnostic only: the toolkit never clicks previews in the main container,
    // so if one that was showing disappears, something else removed it.
    function watchMainContainerPreview() {
      var mainCount = $(MAIN_INDICATORS).length;
      if (mainCount > 0) {
        state.mainHadPreview = true;
      } else if (state.mainHadPreview && !state.mainDisappearedLogged) {
        state.mainDisappearedLogged = true;
        console.warn('[CP Toolkit](' + toolName + ') Main container preview disappeared although the toolkit only dismisses ' +
          'other containers (dismissed so far: ' + state.dismissed + ')');
      }
    }

    function isModalShowing() {
      return $("#mvcModal_mainElement, #popoverModal, .modalContainer, .cpPopOver").filter(":visible").length > 0;
    }

    function releaseOrphanedModalBackdrop() {
      var $backdrop = $("#mvcModal_backgroundElement");
      if ($backdrop.length && $backdrop.is(":visible") && !isModalShowing()) $backdrop.hide();
    }

    function reopenManageWidgetSkins() {
      $("a").filter(function() {
        return /manage widget skins/i.test($(this).text());
      }).first().click();
    }

    // Runs once the page has been quiet after the work is done.
    function settle() {
      state.settled = true;
      var reopened = false;

      if (state.reopen && state.dismissed > 0) {
        state.reopen = false;
        if (!isModalShowing()) {
          reopenManageWidgetSkins();
          reopened = true;
        }
      }

      // After reopening, give the modal time to appear before judging whether
      // a backdrop is orphaned.
      if (reopened) {
        setTimeout(releaseOrphanedModalBackdrop, 1500);
      } else {
        releaseOrphanedModalBackdrop();
      }

      console.log('[CP Toolkit](' + toolName + ') Skin preview cleanup settled (dismissed ' + state.dismissed +
        ', reopened Manage Widget Skins: ' + reopened + ')');

      if (window.CPToolkitSkinOverlay) {
        setTimeout(function() { window.CPToolkitSkinOverlay.hide(OVERLAY_KEY); }, reopened ? 400 : 0);
      }
    }

    // The CMS re-renders containers in bursts of many DOM changes. Coalesce
    // them so the page is scanned a few times a second, not once per change.
    var scanScheduled = false;
    function scheduleScan() {
      if (scanScheduled) return;
      scanScheduled = true;
      setTimeout(function() {
        scanScheduled = false;
        state.lastActivity = Date.now();
        dismissTemporarySkinIndicators();
        watchMainContainerPreview();
      }, 60);
    }

    var observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });

    dismissTemporarySkinIndicators();
    watchMainContainerPreview();

    var poll = setInterval(function() {
      var current = Date.now();
      var quiet = current - state.lastActivity >= QUIET_MS;
      var workDone = state.dismissed > 0 || current - state.startedAt >= MIN_WORK_MS;

      if (!state.settled && quiet && workDone) settle();

      if (current >= state.endAt) {
        clearInterval(poll);
        observer.disconnect();
        if (!state.settled) settle();
        previewCleanup = null;
      }
    }, 250);
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
      var foundCopy = false;

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
          // A skin that was copied earlier and is still unsaved stays unsaved
          // until the user saves, so it must not be treated as a new skin here.
          if (copiedUnsavedSkins.indexOf(this) !== -1) {
            return true; // continue to next skin
          }

          // Check if another tool has requested to skip the override prompt
          // (e.g., apply-figma-styles.js when creating base skins in bulk)
          if (window.cpToolkitSkipSkinDefaultOverride === true) {
            console.log('[CP Toolkit](' + toolName + ') Skipping override prompt (disabled by another tool)');
            return true; // continue to next skin
          }

          // Only apply default overrides for "Add Widget Skin", not "Copy Widget Skin"
          if (lastSkinAction !== 'add') {
            console.log('[CP Toolkit](' + toolName + ') Skin created via ' + (lastSkinAction || 'unknown action') + ' - no overrides applied');
            // A copied skin is left unsaved so several skins can be copied in a
            // row. The next Save assigns real IDs, and Fix Copied Skin
            // References then repairs every copy's CSS in one pass.
            if (lastSkinAction === 'copy') {
              copiedUnsavedSkins.push(this);
              foundCopy = true;
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

      if (foundCopy && !foundSkin) {
        // The copy leaves the user in Manage Widget Skins, so put them back
        // there once the previews are cleaned up.
        startNewSkinPreviewCleanup($, { reopenManageWidgetSkins: true });
      }

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

        startNewSkinPreviewCleanup($);

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
