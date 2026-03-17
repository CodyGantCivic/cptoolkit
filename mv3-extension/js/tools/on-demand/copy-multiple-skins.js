/**
 * Copy Multiple Skins
 * On-Demand Tool for CivicPlus Internal Toolkit
 *
 * Two-tab modal:
 *   Export — Save skins from the current site to the tool's storage
 *   Import — Apply saved skins to skins on the current site (or create new)
 *
 * Runs in MAIN world. Uses a generic storage bridge (content script)
 * to read/write chrome.storage.local under its own key.
 */
(function() {
  'use strict';

  var TOOLKIT_NAME = '[CP Copy Multiple Skins]';
  var STORAGE_KEY  = 'cp-toolkit-multi-skins';
  var MAX_CREATE_NEW = 8;

  // ==================== STORAGE BRIDGE ====================
  // Content script (css-snippets.js) listens for these and relays to chrome.storage.local

  function storageGet() {
    return new Promise(function(resolve) {
      var requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      function onResp(e) {
        if (e.detail && e.detail.requestId === requestId) {
          document.removeEventListener('cp-toolkit-storage-response', onResp);
          resolve(e.detail.data || {});
        }
      }
      document.addEventListener('cp-toolkit-storage-response', onResp);
      document.dispatchEvent(new CustomEvent('cp-toolkit-storage-get', {
        detail: { requestId: requestId, key: STORAGE_KEY }
      }));
      setTimeout(function() {
        document.removeEventListener('cp-toolkit-storage-response', onResp);
        resolve({});
      }, 3000);
    });
  }

  function storageSet(data) {
    return new Promise(function(resolve) {
      var requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      function onResp(e) {
        if (e.detail && e.detail.requestId === requestId) {
          document.removeEventListener('cp-toolkit-storage-response', onResp);
          resolve(true);
        }
      }
      document.addEventListener('cp-toolkit-storage-response', onResp);
      document.dispatchEvent(new CustomEvent('cp-toolkit-storage-set', {
        detail: { requestId: requestId, key: STORAGE_KEY, value: data }
      }));
      setTimeout(function() {
        document.removeEventListener('cp-toolkit-storage-response', onResp);
        resolve(false);
      }, 3000);
    });
  }

  // ==================== DESIGN CENTER ====================

  function getSiteSkins() {
    if (typeof DesignCenter === 'undefined' || !DesignCenter.themeJSON || !DesignCenter.themeJSON.WidgetSkins) return [];
    return DesignCenter.themeJSON.WidgetSkins.filter(function(s) {
      return s.Name && s.WidgetSkinID && s.Components;
    });
  }

  var COMPONENT_TYPES = [
    { index: 0, name: 'Wrapper', view: 'items' },
    { index: 1, name: 'Header', view: 'items' },
    { index: 2, name: 'Item List', view: 'items' },
    { index: 3, name: 'Item', view: 'items' },
    { index: 4, name: 'Item Title', view: 'items' },
    { index: 5, name: 'Item Secondary Text', view: 'items' },
    { index: 6, name: 'Item Bullets', view: 'items' },
    { index: 7, name: 'Item Link', view: 'items' },
    { index: 8, name: 'Read On', view: 'items' },
    { index: 9, name: 'View All', view: 'items' },
    { index: 10, name: 'RSS', view: 'items' },
    { index: 11, name: 'Footer', view: 'items' },
    { index: 12, name: 'Tab List', view: 'tabbed' },
    { index: 13, name: 'Tab', view: 'tabbed' },
    { index: 14, name: 'Tab Panel', view: 'tabbed' },
    { index: 15, name: 'Column Seperator', view: 'columns' },
    { index: 16, name: 'Calendar Header', view: 'calendar' },
    { index: 17, name: 'Cal Grid', view: 'calendar' },
    { index: 18, name: 'Cal Day Headers', view: 'calendar' },
    { index: 19, name: 'Cal Day', view: 'calendar' },
    { index: 20, name: 'Cal Event Link', view: 'calendar' },
    { index: 21, name: 'Cal Today', view: 'calendar' },
    { index: 22, name: 'Cal Day Not In Month', view: 'calendar' },
    { index: 23, name: 'Cal Wrapper', view: 'calendar' }
  ];

  function readSkinData(skin) {
    var components = [];
    for (var i = 0; i < 24; i++) {
      if (skin.Components[i]) {
        var compInfo = COMPONENT_TYPES[i];
        components.push({
          idx: i,
          type: compInfo ? compInfo.name : 'Component ' + i,
          view: compInfo ? compInfo.view : 'items',
          data: JSON.parse(JSON.stringify(skin.Components[i]))
        });
      }
    }
    return {
      name: skin.Name,
      sourceSkinID: skin.WidgetSkinID,
      sourceUrl: window.location.origin,
      savedAt: new Date().toISOString(),
      components: components
    };
  }

  function applySkinToTarget(targetSkinId, savedSkin) {
    if (!DesignCenter.themeJSON || !DesignCenter.themeJSON.WidgetSkins) {
      return { success: false, error: 'DesignCenter not available' };
    }
    var targetSkin = null;
    DesignCenter.themeJSON.WidgetSkins.forEach(function(s) {
      if (s.WidgetSkinID == targetSkinId && s.Components) targetSkin = s;
    });
    if (!targetSkin) return { success: false, error: 'Target skin not found' };
    if (!savedSkin || !savedSkin.components) return { success: false, error: 'No component data to apply' };

    var copiedCount = 0;
    var copiedIndexes = [];
    var fromId = String(savedSkin.sourceSkinID);
    var toId = String(targetSkinId);

    savedSkin.components.forEach(function(comp) {
      var idx = comp.idx;
      if (typeof idx !== 'number' || idx < 0 || idx >= 24 || !comp.data) return;

      targetSkin.RecordStatus = DesignCenter.recordStatus.Modified;
      targetSkin.Components[idx] = JSON.parse(JSON.stringify(comp.data));
      targetSkin.Components[idx].WidgetSkinID = parseInt(targetSkinId, 10);
      targetSkin.Components[idx].RecordStatus = DesignCenter.recordStatus.Modified;

      // Fix skin ID references
      if (fromId !== toId) {
        Object.keys(targetSkin.Components[idx]).forEach(function(field) {
          var value = targetSkin.Components[idx][field];
          if (value && typeof value === 'string' && value.indexOf('skin' + fromId) !== -1) {
            var updated = value.replace(
              new RegExp('\\.widget\\.skin' + fromId + '(?![0-9])', 'g'),
              '.widget.skin' + toId
            );
            updated = updated.replace(
              new RegExp('([^a-zA-Z])skin' + fromId + '(?![0-9])', 'g'),
              '$1skin' + toId
            );
            if (updated !== value) targetSkin.Components[idx][field] = updated;
          }
        });
      }

      copiedIndexes.push(idx);
      copiedCount++;
    });

    if (typeof window.CPToolkitTouchSkinAdvancedFor === 'function') {
      try { window.CPToolkitTouchSkinAdvancedFor(targetSkinId, copiedIndexes); } catch (e) {}
    }

    return { success: true, copiedCount: copiedCount, targetName: targetSkin.Name };
  }

  function createNewSkin(skinName) {
    return new Promise(function(resolve) {
      var themeID = DesignCenter.themeJSON.ThemeID;
      var newSkinID = DesignCenter.widgetSkinManager.newSkinID;

      // Intercept processNewSkin to add the skin data without opening
      // the CMS Manage Widget Skins modal or triggering UI refresh
      var originalProcess = DesignCenter.widgetSkinManager.processNewSkin;
      DesignCenter.widgetSkinManager.processNewSkin = function(response) {
        DesignCenter.themeJSON.WidgetSkins.push(response);
        DesignCenter.widgetSkinManager.newSkinID--;
      };

      $.ajax({
        url: '/DesignCenter/WidgetSkinAdd/Index',
        type: 'POST',
        data: JSON.stringify({ themeID: themeID, widgetSkinID: newSkinID, name: skinName }),
        contentType: 'application/json',
        cache: false,
        success: function(response) {
          DesignCenter.widgetSkinManager.processNewSkin(response);
          DesignCenter.widgetSkinManager.processNewSkin = originalProcess;
          resolve({ success: true, skin: response });
        },
        error: function(xhr) {
          DesignCenter.widgetSkinManager.processNewSkin = originalProcess;
          resolve({ success: false, error: xhr.statusText });
        }
      });
    });
  }

  // ==================== HELPERS ====================

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function generateKey(name) {
    var slug = (name || 'skin').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return slug + '-' + Date.now().toString(36);
  }

  // ==================== HELPERS (save/find) ====================

  function waitForSaveComplete() {
    return new Promise(function(resolve) {
      if (typeof $ !== 'undefined' && $ && $.fn) {
        $(document).one('ajaxStop', function() {
          setTimeout(resolve, 1000); // extra buffer after AJAX completes
        });
      } else {
        setTimeout(resolve, 5000); // fallback
      }
    });
  }

  function findSkinByName(name) {
    if (!DesignCenter.themeJSON || !DesignCenter.themeJSON.WidgetSkins) return null;
    var lowerName = name.toLowerCase();
    for (var i = 0; i < DesignCenter.themeJSON.WidgetSkins.length; i++) {
      var s = DesignCenter.themeJSON.WidgetSkins[i];
      if (s.Name && s.Name.toLowerCase() === lowerName && s.Components) return s;
    }
    return null;
  }

  // ==================== MODAL ====================

  async function showModal() {
    if (typeof DesignCenter === 'undefined' || !DesignCenter.themeJSON) {
      alert('This tool must be run on the Theme Manager page.');
      return;
    }

    var savedSkins = await storageGet();
    var siteSkins = getSiteSkins();

    // Build modal
    var overlay = document.createElement('div');
    overlay.id = 'cp-multi-skins-overlay';

    overlay.innerHTML =
      '<div class="cms-modal">' +
        '<div class="cms-header">' +
          '<h3>Copy Multiple Skins</h3>' +
          '<button class="cms-close">&times;</button>' +
        '</div>' +
        '<div class="cms-tabs">' +
          '<button class="cms-tab active" data-tab="export">Export</button>' +
          '<button class="cms-tab" data-tab="import">Import</button>' +
        '</div>' +
        '<div class="cms-tab-content cms-tab-export active">' +
          buildExportTab(siteSkins, savedSkins) +
        '</div>' +
        '<div class="cms-tab-content cms-tab-import">' +
          buildImportTab(savedSkins, siteSkins) +
        '</div>' +
        '<div class="cms-progress">' +
          '<div class="cms-progress-text">Starting...</div>' +
          '<div class="cms-progress-bar-wrap">' +
            '<div class="cms-progress-bar"></div>' +
          '</div>' +
          '<div class="cms-progress-log"></div>' +
        '</div>' +
        '<div class="cms-footer">' +
          '<div class="cms-status"></div>' +
          '<button class="cms-cancel-btn">Cancel</button>' +
          '<button class="cms-action-btn cms-export-btn">Save Selected</button>' +
          '<button class="cms-action-btn cms-import-btn" style="display:none;">Apply Selected</button>' +
        '</div>' +
      '</div>';

    addStyles();
    document.body.appendChild(overlay);
    wireEvents(overlay, savedSkins, siteSkins);
  }

  function buildExportTab(siteSkins, savedSkins) {
    var savedCount = Object.keys(savedSkins).length;

    var html = '<div class="cms-section-bar">' +
      '<span class="cms-section-label">' + siteSkins.length + ' skins on this site</span>' +
      '<div class="cms-section-actions">' +
        '<button class="cms-select-all-export">Select All</button>' +
        (savedCount > 0
          ? '<button class="cms-clear-saved-btn">' +
              'Clear Saved (' + savedCount + ')' +
            '</button>'
          : '') +
      '</div>' +
    '</div>';

    if (siteSkins.length === 0) {
      html += '<div class="cms-empty">No widget skins found on this site.</div>';
      return html;
    }

    html += '<div class="cms-rows">';
    siteSkins.forEach(function(skin) {
      html += '<div class="cms-row" data-skin-id="' + skin.WidgetSkinID + '">' +
        '<label class="cms-row-label">' +
          '<input type="checkbox" class="cms-export-check">' +
          '<div class="cms-row-info">' +
            '<div class="cms-row-name">' + escapeHtml(skin.Name) + '</div>' +
            '<div class="cms-row-meta">ID: ' + skin.WidgetSkinID + '</div>' +
          '</div>' +
        '</label>' +
      '</div>';
    });
    html += '</div>';

    return html;
  }

  function buildImportTab(savedSkins, siteSkins) {
    var keys = Object.keys(savedSkins);

    if (keys.length === 0) {
      return '<div class="cms-empty">No saved skins yet. Use the Export tab to save skins first.</div>';
    }

    // Target options
    var targetOptions = '<option value="">-- Select target --</option>' +
      '<option value="__create__">+ Create new skin</option>';
    siteSkins.forEach(function(s) {
      targetOptions += '<option value="' + s.WidgetSkinID + '">' + escapeHtml(s.Name) + '</option>';
    });

    var html = '<div class="cms-section-bar">' +
      '<span class="cms-section-label">' + keys.length + ' saved skin(s)</span>' +
      '<div class="cms-section-actions">' +
        '<button class="cms-select-all-import">Select All</button>' +
        '<button class="cms-auto-match-btn">Auto-Match</button>' +
      '</div>' +
    '</div>';

    html += '<div class="cms-rows">';
    keys.forEach(function(key) {
      var skin = savedSkins[key];
      var compCount = skin.components ? skin.components.length : 0;
      var sourceLabel = skin.sourceUrl ? skin.sourceUrl.replace(/^https?:\/\//, '') : '';

      html += '<div class="cms-row cms-import-row" data-skin-key="' + escapeHtml(key) + '">' +
        '<div class="cms-row-check"><input type="checkbox" class="cms-import-check" checked></div>' +
        '<div class="cms-row-info">' +
          '<div class="cms-row-name">' + escapeHtml(skin.name || 'Unnamed') + '</div>' +
          '<div class="cms-row-meta">' +
            '<span>' + compCount + ' components</span>' +
            (sourceLabel ? '<span class="cms-row-source">' + escapeHtml(sourceLabel) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="cms-row-arrow">&rarr;</div>' +
        '<div class="cms-row-target">' +
          '<select class="cms-target-select">' + targetOptions + '</select>' +
          '<input type="text" class="cms-new-name" placeholder="New skin name" value="' + escapeHtml(skin.name || '') + '" style="display:none;" />' +
        '</div>' +
      '</div>';
    });
    html += '</div>';

    return html;
  }

  // ==================== TARGET EXCLUSIVITY ====================

  function syncTargetSelects(overlay) {
    var selects = overlay.querySelectorAll('.cms-target-select');
    var taken = {};
    selects.forEach(function(sel) {
      if (sel.value && sel.value !== '__create__') {
        taken[sel.value] = true;
      }
    });
    selects.forEach(function(sel) {
      Array.from(sel.options).forEach(function(opt) {
        if (!opt.value || opt.value === '__create__') {
          opt.disabled = false;
          return;
        }
        opt.disabled = taken[opt.value] && opt.value !== sel.value;
      });
    });
  }

  // ==================== EVENTS ====================

  function wireEvents(overlay, savedSkins, siteSkins) {
    var closeModal = function() { overlay.remove(); };
    var status = overlay.querySelector('.cms-status');

    // Close
    overlay.querySelector('.cms-close').addEventListener('click', closeModal);
    overlay.querySelector('.cms-cancel-btn').addEventListener('click', closeModal);
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', onEsc); }
    });

    // Tabs
    var exportBtn = overlay.querySelector('.cms-export-btn');
    var importBtn = overlay.querySelector('.cms-import-btn');

    overlay.querySelectorAll('.cms-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        overlay.querySelectorAll('.cms-tab').forEach(function(t) { t.classList.remove('active'); });
        overlay.querySelectorAll('.cms-tab-content').forEach(function(c) { c.classList.remove('active'); });
        tab.classList.add('active');

        var target = tab.getAttribute('data-tab');
        overlay.querySelector('.cms-tab-' + target).classList.add('active');

        exportBtn.style.display = target === 'export' ? '' : 'none';
        importBtn.style.display = target === 'import' ? '' : 'none';
        status.textContent = '';
        status.className = 'cms-status';
      });
    });

    // Select All (Export)
    var selectAllExport = overlay.querySelector('.cms-select-all-export');
    if (selectAllExport) {
      selectAllExport.addEventListener('click', function() {
        var checks = overlay.querySelectorAll('.cms-export-check');
        var allChecked = Array.from(checks).every(function(c) { return c.checked; });
        checks.forEach(function(c) { c.checked = !allChecked; });
      });
    }

    // Select All (Import)
    var selectAllImport = overlay.querySelector('.cms-select-all-import');
    if (selectAllImport) {
      selectAllImport.addEventListener('click', function() {
        var checks = overlay.querySelectorAll('.cms-import-check');
        var allChecked = Array.from(checks).every(function(c) { return c.checked; });
        checks.forEach(function(c) {
          c.checked = !allChecked;
          c.closest('.cms-row').style.opacity = c.checked ? '' : '0.4';
        });
      });
    }

    // Auto-match
    var autoMatchBtn = overlay.querySelector('.cms-auto-match-btn');
    if (autoMatchBtn) {
      autoMatchBtn.addEventListener('click', function() {
        var rows = overlay.querySelectorAll('.cms-import-row');
        var matched = 0;

        rows.forEach(function(row) {
          var key = row.getAttribute('data-skin-key');
          var skin = savedSkins[key];
          if (!skin) return;

          var savedName = (skin.name || '').toLowerCase();
          var select = row.querySelector('.cms-target-select');
          var best = null;
          var bestScore = 0;

          Array.from(select.options).forEach(function(opt) {
            if (!opt.value || opt.value === '__create__') return;
            var n = opt.textContent.toLowerCase();
            if (n === savedName && bestScore < 100) { best = opt.value; bestScore = 100; }
            else if (n.indexOf(savedName) !== -1 && bestScore < 50) { best = opt.value; bestScore = 50; }
            else if (savedName.indexOf(n) !== -1 && bestScore < 40) { best = opt.value; bestScore = 40; }
          });

          if (best) { select.value = best; matched++; }
        });

        syncTargetSelects(overlay);

        status.textContent = matched + ' of ' + rows.length + ' matched by name.';
        status.className = 'cms-status';
      });
    }

    // Clear saved skins
    var clearBtn = overlay.querySelector('.cms-clear-saved-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', async function() {
        var count = Object.keys(savedSkins).length;
        if (!confirm('Delete all ' + count + ' saved skin(s)?\n\nThis cannot be undone.')) return;

        await storageSet({});
        savedSkins = {};

        // Refresh import tab
        overlay.querySelector('.cms-tab-import').innerHTML = buildImportTab({}, siteSkins);

        // Remove the clear button
        clearBtn.remove();

        status.textContent = 'Saved skins cleared.';
        status.className = 'cms-status';
      });
    }

    // Checkbox opacity toggle (import)
    overlay.querySelectorAll('.cms-import-check').forEach(function(cb) {
      cb.addEventListener('change', function() {
        cb.closest('.cms-row').style.opacity = cb.checked ? '' : '0.4';
      });
    });

    // Show/hide name input when "Create new skin" is selected, and sync target exclusivity
    overlay.querySelectorAll('.cms-target-select').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var nameInput = sel.closest('.cms-row-target').querySelector('.cms-new-name');
        if (nameInput) {
          nameInput.style.display = sel.value === '__create__' ? '' : 'none';
        }
        syncTargetSelects(overlay);
      });
    });

    // ==================== EXPORT (Save Selected) ====================
    exportBtn.addEventListener('click', async function() {
      var checked = overlay.querySelectorAll('.cms-export-check:checked');
      if (checked.length === 0) {
        status.textContent = 'Select at least one skin to save.';
        status.className = 'cms-status error';
        return;
      }

      exportBtn.disabled = true;
      exportBtn.textContent = 'Saving...';
      status.textContent = '';

      var allSiteSkins = getSiteSkins();
      var saved = 0;

      checked.forEach(function(cb) {
        var row = cb.closest('.cms-row');
        var skinId = parseInt(row.getAttribute('data-skin-id'), 10);
        var skin = allSiteSkins.find(function(s) { return s.WidgetSkinID === skinId; });

        if (skin) {
          var data = readSkinData(skin);
          var existingKey = null;
          Object.keys(savedSkins).forEach(function(k) {
            var s = savedSkins[k];
            if (s.sourceSkinID === data.sourceSkinID && s.sourceUrl === data.sourceUrl) {
              existingKey = k;
            }
          });
          var key = existingKey || generateKey(skin.Name);
          savedSkins[key] = data;
          row.classList.add('applied');
          saved++;
        }
      });

      await storageSet(savedSkins);

      // Refresh import tab with new data
      overlay.querySelector('.cms-tab-import').innerHTML = buildImportTab(savedSkins, siteSkins);
      // Re-wire import tab events
      wireImportRowEvents(overlay, savedSkins);

      // Update clear button
      var sectionActions = overlay.querySelector('.cms-tab-export .cms-section-actions');
      var existingClear = sectionActions.querySelector('.cms-clear-saved-btn');
      var totalSaved = Object.keys(savedSkins).length;
      if (!existingClear && totalSaved > 0) {
        var newClearBtn = document.createElement('button');
        newClearBtn.className = 'cms-clear-saved-btn';
        newClearBtn.textContent = 'Clear Saved (' + totalSaved + ')';
        sectionActions.appendChild(newClearBtn);
        newClearBtn.addEventListener('click', async function() {
          if (!confirm('Delete all ' + Object.keys(savedSkins).length + ' saved skin(s)?')) return;
          await storageSet({});
          savedSkins = {};
          overlay.querySelector('.cms-tab-import').innerHTML = buildImportTab({}, siteSkins);
          newClearBtn.remove();
          status.textContent = 'Saved skins cleared.';
          status.className = 'cms-status';
        });
      } else if (existingClear) {
        existingClear.textContent = 'Clear Saved (' + totalSaved + ')';
      }

      status.textContent = saved + ' skin(s) saved. Switch to Import tab to apply on another site.';
      status.className = 'cms-status success';
      exportBtn.disabled = false;
      exportBtn.textContent = 'Save Selected';
    });

    // ==================== IMPORT (Apply Selected) ====================
    importBtn.addEventListener('click', async function() {
      var rows = overlay.querySelectorAll('.cms-import-row');
      var toExisting = [];
      var toCreate = [];

      rows.forEach(function(row) {
        var cb = row.querySelector('.cms-import-check');
        var select = row.querySelector('.cms-target-select');
        var key = row.getAttribute('data-skin-key');
        if (cb && cb.checked && select && select.value && savedSkins[key]) {
          if (select.value === '__create__') {
            var nameInput = row.querySelector('.cms-new-name');
            var customName = (nameInput && nameInput.value.trim()) || savedSkins[key].name || 'Copied Skin';
            toCreate.push({ row: row, key: key, skinName: customName });
          } else {
            toExisting.push({ row: row, key: key, targetId: select.value });
          }
        }
      });

      if (toExisting.length === 0 && toCreate.length === 0) {
        status.textContent = 'Select at least one skin and choose a target.';
        status.className = 'cms-status error';
        return;
      }

      if (toCreate.length > MAX_CREATE_NEW) {
        status.textContent = 'You can create a maximum of ' + MAX_CREATE_NEW + ' new skins at once. You selected ' + toCreate.length + '.';
        status.className = 'cms-status error';
        return;
      }

      // --- Enter progress mode ---
      var progressSection = overlay.querySelector('.cms-progress');
      var progressText = overlay.querySelector('.cms-progress-text');
      var progressBar = overlay.querySelector('.cms-progress-bar');
      var progressLog = overlay.querySelector('.cms-progress-log');
      var headerTitle = overlay.querySelector('.cms-header h3');

      // Hide tabs and tab content, show progress
      overlay.querySelectorAll('.cms-tab-content').forEach(function(c) { c.style.display = 'none'; });
      overlay.querySelector('.cms-tabs').style.display = 'none';
      progressSection.style.display = 'block';

      // Set initial header based on what we're doing
      if (toCreate.length > 0 && toExisting.length === 0) {
        headerTitle.textContent = 'Creating Skins...';
      } else if (toCreate.length > 0 && toExisting.length > 0) {
        headerTitle.textContent = 'Applying Styles...';
      } else {
        headerTitle.textContent = 'Applying Styles...';
      }

      // Hide footer buttons, keep status
      importBtn.style.display = 'none';
      overlay.querySelector('.cms-cancel-btn').style.display = 'none';

      function tick() {
        return new Promise(function(r) { setTimeout(r, 0); });
      }

      function updateProgress(current, total, label) {
        var pct = Math.round((current / total) * 100);
        progressBar.style.width = pct + '%';
        progressText.textContent = label + ' (' + current + ' of ' + total + ')';
      }

      function logProgress(message, type) {
        var entry = document.createElement('div');
        if (type) entry.className = 'log-' + type;
        entry.textContent = message;
        progressLog.appendChild(entry);
        progressLog.scrollTop = progressLog.scrollHeight;
      }

      importBtn.disabled = true;
      window.cpToolkitSkipSkinDefaultOverride = true;

      var applied = 0;
      var failed = 0;
      var total = toExisting.length + toCreate.length;

      logProgress('Starting — ' + total + ' skin(s) to process');
      await tick();

      // Phase 1: Apply styles to existing skin targets
      for (var i = 0; i < toExisting.length; i++) {
        var item = toExisting[i];
        var skin = savedSkins[item.key];
        var skinLabel = skin.name || 'Skin ' + (i + 1);
        updateProgress(i + 1, total, 'Applying "' + skinLabel + '"');
        await tick();

        var result = applySkinToTarget(item.targetId, skin);
        if (result.success) {
          item.row.classList.add('applied');
          applied++;
          logProgress('Applied "' + skinLabel + '" → ' + (result.targetName || 'target'), 'success');
        } else {
          item.row.classList.add('error');
          failed++;
          logProgress('Failed "' + skinLabel + '": ' + (result.error || 'unknown error'), 'error');
        }
        await new Promise(function(r) { setTimeout(r, 150); });
      }

      // Phase 2: Create new skins → save → apply styles
      if (toCreate.length > 0) {
        // 2a: Create all new skins via API
        headerTitle.textContent = 'Creating Skins...';
        var createdItems = [];

        for (var j = 0; j < toCreate.length; j++) {
          var createItem = toCreate[j];
          updateProgress(toExisting.length + j + 1, total, 'Creating "' + createItem.skinName + '"');
          logProgress('Creating new skin "' + createItem.skinName + '"...');
          await tick();

          var createResult = await createNewSkin(createItem.skinName);
          if (createResult.success) {
            createdItems.push({ row: createItem.row, key: createItem.key, skinName: createItem.skinName });
            logProgress('Created "' + createItem.skinName + '"', 'success');
          } else {
            createItem.row.classList.add('error');
            failed++;
            logProgress('Failed to create "' + createItem.skinName + '": ' + (createResult.error || 'unknown error'), 'error');
          }
          await new Promise(function(r) { setTimeout(r, 300); });
        }

        if (createdItems.length > 0) {
          // 2b: Save theme to persist new skins to DB
          progressText.textContent = 'Saving new skins to database...';
          logProgress('Saving theme to persist new skins...');
          await tick();

          if (typeof saveTheme === 'function') {
            saveTheme();
          }
          await waitForSaveComplete();

          if (typeof ajaxPostBackEnd === 'function') {
            try { ajaxPostBackEnd(); } catch (e) {}
          }

          logProgress('Theme saved', 'success');
          logProgress('Skins created! Moving on to applying styles...', 'success');
          headerTitle.textContent = 'Applying Styles...';
          await tick();

          // 2c: Apply styles to created skins (find by name — IDs may have changed after save)
          for (var k = 0; k < createdItems.length; k++) {
            var ci = createdItems[k];
            var savedSkin = savedSkins[ci.key];
            var step = toExisting.length + k + 1;
            updateProgress(step, total, 'Applying styles to "' + ci.skinName + '"');
            await tick();

            var targetSkin = findSkinByName(ci.skinName);
            if (targetSkin) {
              var applyResult = applySkinToTarget(targetSkin.WidgetSkinID, savedSkin);
              if (applyResult.success) {
                ci.row.classList.add('applied');
                applied++;
                logProgress('Applied styles to "' + ci.skinName + '"', 'success');
              } else {
                ci.row.classList.add('error');
                failed++;
                logProgress('Failed to apply styles to "' + ci.skinName + '": ' + (applyResult.error || 'unknown'), 'error');
              }
            } else {
              ci.row.classList.add('error');
              failed++;
              logProgress('Could not find created skin "' + ci.skinName + '" after save', 'error');
            }
            await new Promise(function(r) { setTimeout(r, 150); });
          }
        }
      }

      delete window.cpToolkitSkipSkinDefaultOverride;

      if (typeof ajaxPostBackEnd === 'function') {
        try { ajaxPostBackEnd(); } catch (e) {}
      }

      // --- Completion state ---
      progressBar.style.width = '100%';

      var summary = applied + ' applied';
      if (failed > 0) summary += ', ' + failed + ' failed';

      if (failed === 0) {
        progressBar.style.background = '#4CAF50';
        headerTitle.textContent = 'Styles Applied!';
        logProgress('All ' + applied + ' skin(s) applied successfully', 'success');
      } else if (applied > 0) {
        progressBar.style.background = '#cc6600';
        headerTitle.textContent = 'Completed with Errors';
        logProgress(summary, 'error');
      } else {
        progressBar.style.background = '#c62828';
        headerTitle.textContent = 'Apply Failed';
        logProgress('All operations failed', 'error');
      }

      progressText.textContent = summary;
      status.textContent = summary;
      status.className = failed > 0 ? 'cms-status error' : 'cms-status success';

      // Final save and refresh
      if (applied > 0 && typeof saveTheme === 'function') {
        logProgress('Saving theme...');
        saveTheme();
      }

      progressText.textContent = summary + ' — Refreshing page...';
      logProgress('Refreshing page in 3 seconds...');
      setTimeout(function() {
        window.location.reload();
      }, 3000);
    });
  }

  // Re-wire import row checkbox events after tab rebuild
  function wireImportRowEvents(overlay, savedSkins) {
    overlay.querySelectorAll('.cms-import-check').forEach(function(cb) {
      cb.addEventListener('change', function() {
        cb.closest('.cms-row').style.opacity = cb.checked ? '' : '0.4';
      });
    });

    // Show/hide name input when "Create new skin" is selected, and sync target exclusivity
    overlay.querySelectorAll('.cms-target-select').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var nameInput = sel.closest('.cms-row-target').querySelector('.cms-new-name');
        if (nameInput) {
          nameInput.style.display = sel.value === '__create__' ? '' : 'none';
        }
        syncTargetSelects(overlay);
      });
    });

    var selectAllImport = overlay.querySelector('.cms-select-all-import');
    if (selectAllImport) {
      selectAllImport.addEventListener('click', function() {
        var checks = overlay.querySelectorAll('.cms-import-check');
        var allChecked = Array.from(checks).every(function(c) { return c.checked; });
        checks.forEach(function(c) {
          c.checked = !allChecked;
          c.closest('.cms-row').style.opacity = c.checked ? '' : '0.4';
        });
      });
    }

    var autoMatchBtn = overlay.querySelector('.cms-auto-match-btn');
    if (autoMatchBtn) {
      autoMatchBtn.addEventListener('click', function() {
        var rows = overlay.querySelectorAll('.cms-import-row');
        var matched = 0;

        rows.forEach(function(row) {
          var key = row.getAttribute('data-skin-key');
          var skin = savedSkins[key];
          if (!skin) return;

          var savedName = (skin.name || '').toLowerCase();
          var select = row.querySelector('.cms-target-select');
          var best = null;
          var bestScore = 0;

          Array.from(select.options).forEach(function(opt) {
            if (!opt.value || opt.value === '__create__') return;
            var n = opt.textContent.toLowerCase();
            if (n === savedName && bestScore < 100) { best = opt.value; bestScore = 100; }
            else if (n.indexOf(savedName) !== -1 && bestScore < 50) { best = opt.value; bestScore = 50; }
            else if (savedName.indexOf(n) !== -1 && bestScore < 40) { best = opt.value; bestScore = 40; }
          });

          if (best) { select.value = best; matched++; }
        });

        syncTargetSelects(overlay);

        var statusEl = overlay.querySelector('.cms-status');
        statusEl.textContent = matched + ' of ' + rows.length + ' matched.';
        statusEl.className = 'cms-status';
      });
    }
  }

  // ==================== STYLES ====================

  function addStyles() {
    if (document.getElementById('cp-multi-skins-style')) return;
    var style = document.createElement('style');
    style.id = 'cp-multi-skins-style';
    style.textContent =
      '#cp-multi-skins-overlay {' +
        'position: fixed; top: 0; left: 0; right: 0; bottom: 0;' +
        'z-index: 2147483647;' +
        'background: rgba(0,0,0,0.5);' +
        'display: flex; align-items: center; justify-content: center;' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;' +
      '}' +
      '.cms-modal {' +
        'background: #fff; border-radius: 8px;' +
        'width: 720px; max-width: 90vw; max-height: 90vh;' +
        'display: flex; flex-direction: column;' +
        'box-shadow: 0 10px 40px rgba(0,0,0,0.3);' +
      '}' +
      '.cms-header {' +
        'padding: 16px 20px; border-bottom: 1px solid #e0e0e0;' +
        'display: flex; align-items: center; justify-content: space-between;' +
      '}' +
      '.cms-header h3 { margin: 0; font-size: 18px; font-weight: 600; color: #333; }' +
      '.cms-close {' +
        'background: none; border: none; font-size: 24px; cursor: pointer;' +
        'color: #666; padding: 0 4px; line-height: 1;' +
      '}' +
      '.cms-close:hover { color: #333; }' +

      /* Tabs */
      '.cms-tabs {' +
        'display: flex; border-bottom: 2px solid #e0e0e0; padding: 0 20px;' +
      '}' +
      '.cms-tab {' +
        'padding: 10px 24px; border: none; background: none;' +
        'font-size: 14px; font-weight: 500; color: #666; cursor: pointer;' +
        'border-bottom: 2px solid transparent; margin-bottom: -2px;' +
        'transition: color 0.2s, border-color 0.2s; line-height: normal;' +
      '}' +
      '.cms-tab:hover { color: #af282f; }' +
      '.cms-tab.active { color: #af282f; border-bottom-color: #af282f; }' +

      /* Tab content */
      '.cms-tab-content { display: none; padding: 20px; overflow-y: auto; flex: 1; }' +
      '.cms-tab-content.active { display: block; }' +

      /* Section bar */
      '.cms-section-bar {' +
        'display: flex; align-items: center; justify-content: space-between;' +
        'margin-bottom: 12px;' +
      '}' +
      '.cms-section-label { font-size: 13px; color: #666; font-weight: 500; }' +
      '.cms-section-actions { display: flex; gap: 8px; }' +
      '.cms-section-actions button {' +
        'padding: 5px 12px; border: 1px solid #ccc; border-radius: 4px;' +
        'background: #f5f5f5; font-size: 12px; cursor: pointer; color: #333;' +
        'line-height: normal;' +
      '}' +
      '.cms-section-actions button:hover { background: #eee; border-color: #aaa; }' +
      '.cms-clear-saved-btn { color: #c62828 !important; border-color: #e0b0b0 !important; }' +
      '.cms-clear-saved-btn:hover { background: #fff5f5 !important; border-color: #c62828 !important; }' +

      /* Empty state */
      '.cms-empty {' +
        'text-align: center; padding: 40px 20px; color: #888; font-size: 14px;' +
      '}' +

      /* Rows */
      '.cms-rows { display: flex; flex-direction: column; gap: 6px; }' +
      '.cms-row {' +
        'display: flex; align-items: center; gap: 12px;' +
        'padding: 10px 14px; border: 1px solid #e0e0e0; border-radius: 6px;' +
        'background: #fafafa; transition: border-color 0.2s, background 0.2s;' +
      '}' +
      '.cms-row:hover { border-color: #ccc; background: #f5f5f5; }' +
      '.cms-row.applied { border-color: #4CAF50; background: #f1f8e9; }' +
      '.cms-row.error { border-color: #f44336; background: #fff5f5; }' +

      /* Export row — label wraps checkbox + info */
      '.cms-row-label {' +
        'display: flex; align-items: center; gap: 12px; cursor: pointer;' +
        'flex: 1; min-width: 0;' +
      '}' +
      '.cms-row-label input[type="checkbox"] {' +
        'width: 18px; height: 18px; cursor: pointer; accent-color: #af282f; flex-shrink: 0;' +
      '}' +

      /* Import row */
      '.cms-row-check { flex-shrink: 0; }' +
      '.cms-row-check input[type="checkbox"] {' +
        'width: 18px; height: 18px; cursor: pointer; accent-color: #af282f;' +
      '}' +
      '.cms-row-info { flex: 1; min-width: 0; }' +
      '.cms-row-name {' +
        'font-size: 14px; font-weight: 500; color: #333;' +
        'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;' +
      '}' +
      '.cms-row-meta {' +
        'display: flex; gap: 12px; font-size: 11px; color: #888; margin-top: 2px;' +
      '}' +
      '.cms-row-source { color: #af282f; }' +
      '.cms-row-arrow { font-size: 18px; color: #aaa; flex-shrink: 0; }' +
      '.cms-row-target { flex-shrink: 0; width: 220px; }' +
      '.cms-target-select {' +
        'width: 100%; padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px;' +
        'font-size: 13px; background: #fff; color: #333; cursor: pointer;' +
      '}' +
      '.cms-target-select:focus { border-color: #af282f; outline: none; }' +
      '.cms-target-select option:disabled { color: #aaa; }' +
      '.cms-new-name {' +
        'width: 100%; padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px;' +
        'font-size: 13px; background: #fff; color: #333; margin-top: 6px !important;' +
        'box-sizing: border-box;' +
      '}' +
      '.cms-new-name:focus { border-color: #af282f; outline: none; }' +

      /* Progress */
      '.cms-progress { display: none; padding: 0 20px 16px; }' +
      '.cms-progress-text { font-size: 13px; font-weight: 500; color: #333; margin-bottom: 4px; }' +
      '.cms-progress-bar-wrap { width: 100%; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; }' +
      '.cms-progress-bar { height: 100%; background: #af282f; border-radius: 4px; transition: width 0.3s; width: 0%; }' +
      '.cms-progress-log { background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; max-height: 200px; overflow-y: auto; font-family: Monaco, Consolas, monospace; font-size: 12px; color: #333; margin-top: 12px; }' +
      '.cms-progress-log div { padding: 2px 0; border-bottom: 1px solid #eee; }' +
      '.cms-progress-log div:last-child { border-bottom: none; }' +
      '.cms-progress-log .log-success { color: #2e7d32; }' +
      '.cms-progress-log .log-error { color: #c62828; }' +

      /* Footer */
      '.cms-footer {' +
        'padding: 16px 20px; border-top: 1px solid #e0e0e0;' +
        'display: flex; align-items: center; gap: 8px;' +
      '}' +
      '.cms-status { flex: 1; font-size: 13px; color: #666; }' +
      '.cms-status.success { color: #2e7d32; }' +
      '.cms-status.error { color: #c62828; }' +
      '.cms-cancel-btn {' +
        'padding: 10px 20px; border: none; border-radius: 4px;' +
        'font-size: 14px; font-weight: 500; cursor: pointer;' +
        'background: #e0e0e0; color: #333; line-height: normal;' +
      '}' +
      '.cms-cancel-btn:hover { background: #d0d0d0; }' +
      '.cms-action-btn {' +
        'padding: 10px 20px; border: none; border-radius: 4px;' +
        'font-size: 14px; font-weight: 500; cursor: pointer;' +
        'background: #af282f; color: #fff; line-height: normal;' +
      '}' +
      '.cms-action-btn:hover { background: #c42f37; }' +
      '.cms-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }';

    document.head.appendChild(style);
  }

  // ==================== RUN ====================
  showModal();

})();
