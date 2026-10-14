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
  var originalSaveTheme = null;
  var finalizationSaveScheduled = false;

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
      var pendingCopy = {
        sourceSkinId: sourceSkinId,
        timestamp: Date.now(),
        skin: null
      };
      pendingCopies.push(pendingCopy);
      bindCopyToNewSkin(pendingCopy);

      // Clean up old entries (older than 5 minutes). A copy whose skin is still
      // unsaved is kept however long it takes to finish copying other skins.
      var fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      for (var i = 0; i < pendingCopies.length;) {
        var entry = pendingCopies[i];
        if (entry.timestamp < fiveMinutesAgo && !isStillUnsaved(entry.skin)) {
          pendingCopies.splice(i, 1);
        } else {
          i++;
        }
      }
    }, true); // Use capture to intercept before other handlers
  }

  function isTemporarySkin(skin) {
    return !!(skin && (
      skin.WidgetSkinID === -1 ||
      (window.DesignCenter && DesignCenter.recordStatus && skin.RecordStatus === DesignCenter.recordStatus.New)
    ));
  }

  function isStillUnsaved(skin) {
    return !!skin && isTemporarySkin(skin) &&
      !!(window.DesignCenter && DesignCenter.themeJSON && DesignCenter.themeJSON.WidgetSkins &&
        DesignCenter.themeJSON.WidgetSkins.indexOf(skin) !== -1);
  }

  /**
   * Remember which unsaved skin this copy created, so several copies can be
   * made before a single save and each one still gets its own fix afterwards.
   * The CMS adds the copied skin shortly after the click, so look a few times.
   */
  function bindCopyToNewSkin(pendingCopy) {
    [300, 1500, 4000].forEach(function(delay) {
      setTimeout(function() {
        if (pendingCopy.skin) return;
        if (!window.DesignCenter || !DesignCenter.themeJSON || !DesignCenter.themeJSON.WidgetSkins) return;

        var claimed = pendingCopies.map(function(pc) { return pc.skin; });
        var candidates = DesignCenter.themeJSON.WidgetSkins.filter(function(skin) {
          return isTemporarySkin(skin) && claimed.indexOf(skin) === -1;
        });
        // Bind only when exactly one new unsaved skin exists; anything else is
        // ambiguous and falls back to the count-based matching at save time.
        if (candidates.length === 1) pendingCopy.skin = candidates[0];
      }, delay);
    });
  }

  // ============================================================================
  // SAVE INTERCEPTION
  // ============================================================================

  // Track skins with ID = -1 before save
  var newSkinsBeforeSave = [];

  /**
   * Persist regenerated component CSS without routing the follow-up save back
   * through copy detection. The CMS copy save assigns the real skin ID first;
   * this second save persists the CSS regenerated for that real ID.
   */
  function scheduleFinalizationSave() {
    if (!originalSaveTheme || finalizationSaveScheduled) return;
    finalizationSaveScheduled = true;

    setTimeout(function() {
      try {
        originalSaveTheme.call(window);
        console.log('[CP Toolkit](' + thisTool + ') Saved regenerated copied-skin styles');
      } catch (err) {
        console.error('[CP Toolkit](' + thisTool + ') Could not save regenerated copied-skin styles', err);
      } finally {
        finalizationSaveScheduled = false;
      }
      // Two saves in a row can leave the CMS's dark modal backdrop showing
      // with no modal on top of it, blocking the page until a refresh.
      setTimeout(releaseOrphanedModalBackdrop, 2000);
      setTimeout(releaseOrphanedModalBackdrop, 5000);
    }, 0);
  }

  /**
   * Hide the CMS modal backdrop (#mvcModal_backgroundElement, class
   * .modalBackground) only when its modal container is not showing, so a
   * legitimately open modal is never affected.
   */
  function releaseOrphanedModalBackdrop() {
    var backdrop = document.getElementById('mvcModal_backgroundElement');
    if (!backdrop) return;

    var modal = document.getElementById('mvcModal_mainElement');
    var modalVisible = false;
    if (modal) {
      var display = modal.style && modal.style.display;
      if (typeof window.getComputedStyle === 'function') {
        display = window.getComputedStyle(modal).display;
      }
      modalVisible = display !== 'none';
    }
    if (!modalVisible) backdrop.style.display = 'none';
  }

  /**
   * Resolve only the skin created by this save. Never select an existing skin
   * merely because it has the same name.
   */
  function resolveCopiedSkin(savedSkin) {
    var skins = DesignCenter.themeJSON.WidgetSkins;
    var existingIds = savedSkin.existingIds || {};

    function isNewlyAssigned(candidate) {
      return !!(
        candidate &&
        candidate.WidgetSkinID > 0 &&
        !existingIds[String(candidate.WidgetSkinID)]
      );
    }

    // Most CMS saves update the same object with its assigned ID.
    if (
      savedSkin.reference &&
      skins.indexOf(savedSkin.reference) !== -1 &&
      isNewlyAssigned(savedSkin.reference)
    ) {
      return savedSkin.reference;
    }

    // If the CMS replaced the array/object, require both the captured position
    // and name, plus an ID that did not exist before this save.
    var indexedCandidate = skins[savedSkin.index];
    if (
      isNewlyAssigned(indexedCandidate) &&
      indexedCandidate.Name === savedSkin.name
    ) {
      return indexedCandidate;
    }

    // Position can shift after a response merge. A name fallback is allowed
    // only when exactly one newly assigned candidate exists.
    var candidates = skins.filter(function(candidate) {
      return isNewlyAssigned(candidate) && candidate.Name === savedSkin.name;
    });
    return candidates.length === 1 ? candidates[0] : null;
  }

  /**
   * Check for new skin IDs after save
   */
  function checkForNewSkinIds() {
    if (pendingCopies.length === 0) return;
    if (!window.DesignCenter || !DesignCenter.themeJSON) return;

    var unresolvedSkins = [];
    var finalizedCopies = 0;

    // Find skins that now have real IDs by matching their names
    newSkinsBeforeSave.forEach(function(savedSkin) {
      var skin = resolveCopiedSkin(savedSkin);

      if (!skin) {
        console.log(
          '[CP Toolkit](' + thisTool + ') Could not uniquely resolve newly copied skin "' +
          savedSkin.name + '"; no skin was modified'
        );
        unresolvedSkins.push(savedSkin);
        return;
      }

      console.log('[CP Toolkit](' + thisTool + ') Skin "' + skin.Name + '" now has ID:', skin.WidgetSkinID);

      // Use the copy operation bound to this temporary skin before the save.
      // Do not consume a generic queue head during a delayed retry.
      var pendingCopy = savedSkin.pendingCopy;
      if (pendingCopy) {
        var pendingIndex = pendingCopies.indexOf(pendingCopy);
        if (pendingIndex !== -1) pendingCopies.splice(pendingIndex, 1);

        console.log('[CP Toolkit](' + thisTool + ') Fixing references from skin', pendingCopy.sourceSkinId,
          'to skin', skin.WidgetSkinID);

        // Update CSS references
        var changes = updateSkinReferences(skin, pendingCopy.sourceSkinId);

        if (changes > 0) {
          console.log('[CP Toolkit](' + thisTool + ') Updated', changes, 'CSS reference(s)');
        } else {
          console.log('[CP Toolkit](' + thisTool + ') No skin ID references needed updating');
        }

        // A copied component's advanced-style text can be correct while its
        // generated CSS remains stale. Always mark and regenerate every copied
        // component; do not mutate MiscellaneousStyles merely to trigger this.
        skin.RecordStatus = DesignCenter.recordStatus.Modified;
        skin.Components.forEach(function(comp) {
          comp.RecordStatus = DesignCenter.recordStatus.Modified;
        });

        var regenerated = regenerateSkinCSS(skin.WidgetSkinID);
        if (regenerated) finalizedCopies++;

        showNotification(
          skin.Name,
          pendingCopy.sourceSkinId,
          skin.WidgetSkinID,
          changes,
          skin.Components.length,
          regenerated
        );
      }
    });

    // Retain unresolved names for the scheduled five-second retry.
    newSkinsBeforeSave = unresolvedSkins;
    if (finalizedCopies > 0) scheduleFinalizationSave();
  }

  /**
   * Wrap saveTheme to detect new skin IDs after save
   */
  function wrapSaveTheme() {
    if (!window.saveTheme || window.__FixCopiedSkin_saveWrapped) return;

    var originalSave = window.saveTheme;
    originalSaveTheme = originalSave;
    window.__FixCopiedSkin_saveWrapped = true;

    window.saveTheme = function() {
      // Find skins with temporary ID before save
      if (window.DesignCenter && DesignCenter.themeJSON && DesignCenter.themeJSON.WidgetSkins) {
        var existingIds = {};
        DesignCenter.themeJSON.WidgetSkins.forEach(function(skin) {
          if (skin.WidgetSkinID > 0) existingIds[String(skin.WidgetSkinID)] = true;
        });

        var temporarySkins = DesignCenter.themeJSON.WidgetSkins
          .filter(function(s) {
            return s.WidgetSkinID === -1 || s.RecordStatus === DesignCenter.recordStatus.New;
          });
        // Prefer the copy bound to each unsaved skin when it was made, so
        // several copies (or a copy mixed with a brand-new skin) all resolve
        // correctly. Without any such binding, fall back to matching by count.
        var identityBindings = temporarySkins.map(function(skin) {
          for (var p = 0; p < pendingCopies.length; p++) {
            if (pendingCopies[p].skin === skin) return pendingCopies[p];
          }
          return null;
        });
        var hasIdentityBindings = identityBindings.some(function(binding) { return !!binding; });
        var copyBindings = hasIdentityBindings
          ? identityBindings
          : (temporarySkins.length === pendingCopies.length ? pendingCopies.slice() : []);
        if (!hasIdentityBindings && temporarySkins.length !== pendingCopies.length) {
          console.warn(
            '[CP Toolkit](' + thisTool + ') Copy/new-skin counts are ambiguous; ' +
            'advanced-style finalization will not target an unbound skin'
          );
        }

        newSkinsBeforeSave = temporarySkins
          .map(function(s, index) {
            return {
              name: s.Name,
              index: DesignCenter.themeJSON.WidgetSkins.indexOf(s),
              reference: s,
              existingIds: existingIds,
              pendingCopy: copyBindings[index] || null
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

  function showNotification(skinName, fromId, toId, changesCount, componentCount, regenerated) {
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
      '  Regenerated ' + componentCount + ' advanced-style component(s) in "' + skinName + '"<br>' +
      '  <span style="opacity: 0.9;">(skin' + fromId + ' &rarr; skin' + toId + ')</span>' +
      '</div>' +
      '<div style="font-size: 12px; margin-top: 8px; opacity: 0.9;">' +
      (changesCount > 0 ? '  Updated ' + changesCount + ' copied skin-ID reference(s).<br>' : '') +
      (regenerated ? '  The regenerated styles will be saved automatically.' : '  Some component styles could not be regenerated; review the console.') +
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
