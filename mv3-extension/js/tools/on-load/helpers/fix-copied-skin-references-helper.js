/**
 * Fix Copied Skin References - Helper (runs in MAIN world)
 *
 * This script runs in the page context to access DesignCenter API.
 */
(function() {
  var thisTool = "fix-copied-skin-references";
  var initialized = false;

  // ============================================================================
  // SKIN ID REPLACEMENT UTILITIES
  // ============================================================================

  /**
   * Replace skin ID references in CSS text
   */
  function replaceSkinIdInCss(text, fromSkinId, toSkinId) {
    if (!text || typeof text !== 'string') return text;
    if (!fromSkinId || !toSkinId) return text;

    var fromId = String(fromSkinId);
    var toId = String(toSkinId);

    // Replace .widget.skinXXX patterns
    var result = text.replace(
      new RegExp('\\.widget\\.skin' + fromId + '(?![0-9])', 'g'),
      '.widget.skin' + toId
    );

    // Replace standalone skinXXX patterns (but not in URLs or other contexts)
    // Use capturing group instead of lookbehind for broader compatibility
    result = result.replace(
      new RegExp('([^a-zA-Z])skin' + fromId + '(?![0-9])', 'g'),
      '$1skin' + toId
    );

    return result;
  }

  /**
   * Update all CSS-related fields in a component
   * Checks ALL string fields that might contain CSS (any field ending in "Styles")
   */
  function updateComponentSkinReferences(component, fromSkinId, toSkinId, debug) {
    if (!component) return 0;

    var changesCount = 0;
    var pattern = 'skin' + fromSkinId;

    // Check ALL string properties that might contain CSS
    Object.keys(component).forEach(function(field) {
      var value = component[field];
      if (value && typeof value === 'string' && value.indexOf(pattern) !== -1) {
        var original = value;
        var updated = replaceSkinIdInCss(original, fromSkinId, toSkinId);
        if (updated !== original) {
          if (debug) {
            console.log('[CP Toolkit](' + thisTool + ')     Field "' + field + '": found reference');
          }
          component[field] = updated;
          changesCount++;
        }
      }
    });

    return changesCount;
  }

  /**
   * Update all components in a skin
   */
  function updateSkinReferences(skin, fromSkinId) {
    if (!skin || !skin.Components) return 0;

    console.log('[CP Toolkit](' + thisTool + ') Checking', skin.Components.length, 'components for skin' + fromSkinId + ' references...');

    var totalChanges = 0;
    skin.Components.forEach(function(comp, idx) {
      var changes = updateComponentSkinReferences(comp, fromSkinId, skin.WidgetSkinID, true);
      if (changes > 0) {
        console.log('[CP Toolkit](' + thisTool + ')   Component', idx, '(type ' + comp.ComponentType + '):', changes, 'field(s) updated');
        totalChanges += changes;
      }
    });

    return totalChanges;
  }

  /**
   * Regenerate CSS for all components in a skin using direct API
   */
  function regenerateSkinCSS(skinId) {
    if (!window.DesignCenter || !DesignCenter.themeJSON) return false;

    var skin = DesignCenter.themeJSON.WidgetSkins.find(function(s) {
      return s.WidgetSkinID == skinId;
    });
    if (!skin) return false;

    var previousSkinID = DesignCenter.widgetSkinID;
    DesignCenter.widgetSkinID = skin.WidgetSkinID;

    var successCount = 0;
    skin.Components.forEach(function(comp, idx) {
      try {
        DesignCenter.writeThemeCSS.writeWidgetSkinComponentStyle(comp.ComponentType);
        successCount++;
      } catch (err) {
        console.error('[CP Toolkit](' + thisTool + ') Error regenerating CSS for component', idx, err);
      }
    });

    DesignCenter.widgetSkinID = previousSkinID;
    console.log('[CP Toolkit](' + thisTool + ') Regenerated CSS for', successCount, 'components');
    return successCount > 0;
  }

  // ============================================================================
  // COPY TRACKING
  // ============================================================================

  // Track pending copies: { sourceSkinId, timestamp }
  var pendingCopies = [];

  /**
   * Intercept clicks on "Copy Skin" button
   */
  function interceptCopyClicks() {
    document.addEventListener('click', function(e) {
      var target = e.target.closest('.createCopy');
      if (!target) return;

      // Find the parent with data-widgetskinid
      var copyContainer = target.closest('[data-widgetskinid]');
      if (!copyContainer) {
        console.warn('[CP Toolkit](' + thisTool + ') Could not find source skin ID');
        return;
      }

      var sourceSkinId = parseInt(copyContainer.getAttribute('data-widgetskinid'), 10);
      if (isNaN(sourceSkinId)) {
        console.warn('[CP Toolkit](' + thisTool + ') Invalid source skin ID');
        return;
      }

      console.log('[CP Toolkit](' + thisTool + ') Copy initiated for skin', sourceSkinId);

      // Track this copy operation
      pendingCopies.push({
        sourceSkinId: sourceSkinId,
        timestamp: Date.now()
      });

      // Clean up old entries (older than 5 minutes)
      var fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      while (pendingCopies.length > 0 && pendingCopies[0].timestamp < fiveMinutesAgo) {
        pendingCopies.shift();
      }
    }, true); // Use capture to intercept before other handlers
  }

  // ============================================================================
  // SAVE INTERCEPTION
  // ============================================================================

  // Track skins with ID = -1 before save
  var newSkinsBeforeSave = [];

  /**
   * Check for new skin IDs after save
   */
  function checkForNewSkinIds() {
    if (pendingCopies.length === 0) return;
    if (!window.DesignCenter || !DesignCenter.themeJSON) return;

    // Find skins that now have real IDs by matching their names
    newSkinsBeforeSave.forEach(function(savedSkin) {
      // Find the skin by name (more reliable than index which can shift)
      var skin = DesignCenter.themeJSON.WidgetSkins.find(function(s) {
        return s.Name === savedSkin.name && s.WidgetSkinID > 0;
      });

      if (!skin) {
        console.log('[CP Toolkit](' + thisTool + ') Could not find skin "' + savedSkin.name + '" with valid ID');
        return;
      }

      console.log('[CP Toolkit](' + thisTool + ') Skin "' + skin.Name + '" now has ID:', skin.WidgetSkinID);

      // Find the most recent pending copy that matches
      var pendingCopy = pendingCopies.shift();
      if (pendingCopy) {
        console.log('[CP Toolkit](' + thisTool + ') Fixing references from skin', pendingCopy.sourceSkinId,
          'to skin', skin.WidgetSkinID);

        // Update CSS references
        var changes = updateSkinReferences(skin, pendingCopy.sourceSkinId);

        if (changes > 0) {
          console.log('[CP Toolkit](' + thisTool + ') Updated', changes, 'CSS reference(s)');

          // Mark skin as modified so it gets saved
          skin.RecordStatus = DesignCenter.recordStatus.Modified;
          skin.Components.forEach(function(comp) {
            comp.RecordStatus = DesignCenter.recordStatus.Modified;
          });

          // Regenerate CSS
          regenerateSkinCSS(skin.WidgetSkinID);

          // Notify user
          showNotification(skin.Name, pendingCopy.sourceSkinId, skin.WidgetSkinID, changes);
        } else {
          console.log('[CP Toolkit](' + thisTool + ') No CSS references needed updating');
        }
      }
    });

    // Clear the list
    newSkinsBeforeSave = [];
  }

  /**
   * Wrap saveTheme to detect new skin IDs after save
   */
  function wrapSaveTheme() {
    if (!window.saveTheme || window.__FixCopiedSkin_saveWrapped) return;

    var originalSave = window.saveTheme;
    window.__FixCopiedSkin_saveWrapped = true;

    window.saveTheme = function() {
      // Find skins with temporary ID before save
      if (window.DesignCenter && DesignCenter.themeJSON && DesignCenter.themeJSON.WidgetSkins) {
        newSkinsBeforeSave = DesignCenter.themeJSON.WidgetSkins
          .filter(function(s) {
            return s.WidgetSkinID === -1 || s.RecordStatus === DesignCenter.recordStatus.New;
          })
          .map(function(s) {
            return {
              name: s.Name,
              index: DesignCenter.themeJSON.WidgetSkins.indexOf(s)
            };
          });

        if (newSkinsBeforeSave.length > 0) {
          console.log('[CP Toolkit](' + thisTool + ') Found', newSkinsBeforeSave.length, 'new skin(s) before save:',
            newSkinsBeforeSave.map(function(s) { return s.name; }).join(', '));
        }
      }

      // Call original save
      var result = originalSave.apply(this, arguments);

      // After save completes, check for new skin IDs
      setTimeout(checkForNewSkinIds, 2000);
      setTimeout(checkForNewSkinIds, 5000); // Retry in case first check was too early

      return result;
    };

    console.log('[CP Toolkit](' + thisTool + ') Wrapped saveTheme function');
  }

  // ============================================================================
  // USER NOTIFICATION
  // ============================================================================

  function showNotification(skinName, fromId, toId, changesCount) {
    // Create a notification element
    var notification = document.createElement('div');
    notification.style.cssText =
      'position: fixed;' +
      'bottom: 20px;' +
      'right: 20px;' +
      'background: #2ecc71;' +
      'color: white;' +
      'padding: 16px 24px;' +
      'border-radius: 8px;' +
      'box-shadow: 0 4px 12px rgba(0,0,0,0.3);' +
      'z-index: 999999;' +
      'font-family: Arial, sans-serif;' +
      'font-size: 14px;' +
      'max-width: 400px;' +
      'animation: cpToolkitSlideIn 0.3s ease-out;';

    notification.innerHTML =
      '<div style="font-weight: bold; margin-bottom: 8px;">' +
      '  &#10003; Skin Copy Fixed' +
      '</div>' +
      '<div style="font-size: 13px;">' +
      '  Updated ' + changesCount + ' CSS reference(s) in "' + skinName + '"<br>' +
      '  <span style="opacity: 0.9;">(skin' + fromId + ' &rarr; skin' + toId + ')</span>' +
      '</div>' +
      '<div style="font-size: 12px; margin-top: 8px; opacity: 0.9;">' +
      '  Click <strong>Save</strong> to keep these changes.' +
      '</div>';

    // Add animation keyframes
    if (!document.getElementById('cp-toolkit-fix-copied-skin-styles')) {
      var style = document.createElement('style');
      style.id = 'cp-toolkit-fix-copied-skin-styles';
      style.textContent =
        '@keyframes cpToolkitSlideIn {' +
        '  from { transform: translateX(100%); opacity: 0; }' +
        '  to { transform: translateX(0); opacity: 1; }' +
        '}' +
        '@keyframes cpToolkitSlideOut {' +
        '  from { transform: translateX(0); opacity: 1; }' +
        '  to { transform: translateX(100%); opacity: 0; }' +
        '}';
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Remove after 8 seconds
    setTimeout(function() {
      notification.style.animation = 'cpToolkitSlideOut 0.3s ease-in forwards';
      setTimeout(function() { notification.remove(); }, 300);
    }, 8000);

    // Click to dismiss
    notification.addEventListener('click', function() {
      notification.style.animation = 'cpToolkitSlideOut 0.3s ease-in forwards';
      setTimeout(function() { notification.remove(); }, 300);
    });
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  function initTool() {
    // Wait for DesignCenter to be available
    if (!window.DesignCenter || !DesignCenter.themeJSON) {
      setTimeout(initTool, 500);
      return;
    }

    interceptCopyClicks();
    wrapSaveTheme();

    if (!initialized) {
      initialized = true;
      console.log('[CP Toolkit] Loaded ' + thisTool + ' (helper)');
    }

    // Debug function to find all skin references in a skin
    function debugSkinReferences(skinId) {
      var skin = DesignCenter.themeJSON.WidgetSkins.find(function(s) {
        return s.WidgetSkinID == skinId;
      });
      if (!skin) {
        console.log('Skin not found:', skinId);
        return;
      }
      console.log('=== Checking skin "' + skin.Name + '" (ID: ' + skin.WidgetSkinID + ') ===');
      skin.Components.forEach(function(comp, idx) {
        console.log('Component', idx, '(type ' + comp.ComponentType + '):');
        Object.keys(comp).forEach(function(field) {
          var value = comp[field];
          if (value && typeof value === 'string' && value.indexOf('skin') !== -1) {
            console.log('  ' + field + ':', value.substring(0, 100) + (value.length > 100 ? '...' : ''));
          }
        });
      });
    }

    // Expose utilities for manual use
    window.CPToolkitFixCopiedSkin = {
      replaceSkinIdInCss: replaceSkinIdInCss,
      updateComponentSkinReferences: updateComponentSkinReferences,
      updateSkinReferences: updateSkinReferences,
      regenerateSkinCSS: regenerateSkinCSS,
      pendingCopies: pendingCopies,
      debugSkinReferences: debugSkinReferences
    };
  }

  // Start initialization
  initTool();
})();
