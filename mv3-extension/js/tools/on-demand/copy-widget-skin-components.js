/**
 * Copy Widget Skin Components with Touch Functionality
 * On-Demand Tool for CivicPlus Internal Toolkit
 * 
 * Migrated from Tampermonkey version with enhanced features:
 * - Modal UI for skin selection
 * - Three modes: Local Copy, Export, Import
 * - Automatic "touch" functionality to refresh advanced styles
 * - Progress modal for batch operations
 * - Smart tab switching for different component types
 * - Queued touch operations after save
 * 
 * Updated: Fixed Calendar/Tab navigation with correct component mappings
 */

(function() {
  'use strict';

  // Component type definitions with view mappings
  const WIDGET_SKIN_COMPONENT_TYPES = [
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

  // Legacy array for backward compatibility
  const WIDGET_SKIN_COMPONENT_NAMES = WIDGET_SKIN_COMPONENT_TYPES.map(c => c.name);

  // View configuration for tab switching
  const VIEW_CONFIG = {
    items: {
      toggleSelector: 'ul.widgetSkinToggle a.items',
      dataView: 'superWidgetItems',
      hrefTarget: '#superWidgetItems',
      containerClass: 'superWidgetItems',
      displayName: 'Items'
    },
    columns: {
      toggleSelector: 'ul.widgetSkinToggle a.columns',
      dataView: 'superWidgetColumns',
      hrefTarget: '#superWidgetColumns',
      containerClass: 'superWidgetColumns',
      displayName: 'Columns'
    },
    calendar: {
      toggleSelector: 'ul.widgetSkinToggle a.miniCalendarIcon',
      dataView: 'superWidgetMiniCalendar',
      hrefTarget: '#superWidgetMiniCalendar',
      containerClass: 'superWidgetMiniCalendar',
      displayName: 'Mini Calendar'
    },
    tabbed: {
      toggleSelector: 'ul.widgetSkinToggle a.tabbed',
      dataView: 'superWidgetTabbed',
      hrefTarget: '#superWidgetTabbed',
      containerClass: 'superWidgetTabbed',
      displayName: 'Tabbed'
    }
  };

  // Click targets for opening the editor in each view
  const CLICK_TARGETS = {
    // Calendar targets (16-23)
    16: '.superWidgetMiniCalendar h3.miniCalendarHeader.cpComponent',
    17: '.superWidgetMiniCalendar table.cpComponent',
    18: '.superWidgetMiniCalendar thead th.cpComponent',
    19: '.superWidgetMiniCalendar tbody td > span.cpComponent',
    20: '.superWidgetMiniCalendar tbody td > a.cpComponent',
    21: '.superWidgetMiniCalendar tbody td.today span.cpComponent',
    22: '.superWidgetMiniCalendar tbody td.not span.cpComponent',
    23: '.superWidgetMiniCalendar .miniCalendar',
    
    // Tab targets (12-14)
    12: '.superWidgetTabbed ol.cpTabs.cpComponent',
    13: '.superWidgetTabbed ol.cpTabs li a.tabbedTab.cpComponent',
    14: '.superWidgetTabbed div.cpTabPanel.cpComponent',
    
    // Columns target (15)
    15: '.superWidgetColumns ol.semanticList.half.cpComponent'
  };

  /**
   * Get the view key for a component index
   */
  function getViewForComponent(componentIndex) {
    const idx = parseInt(componentIndex, 10);
    if (idx >= 16 && idx <= 23) return 'calendar';
    if (idx >= 12 && idx <= 14) return 'tabbed';
    if (idx === 15) return 'columns';
    return 'items';
  }

  // ============================================================================
  // SKIN ID REPLACEMENT - Fix CSS references when copying between skins
  // ============================================================================

  /**
   * Replace skin ID references in CSS text
   * Handles patterns like .widget.skin101, skin101, etc.
   */
  function replaceSkinIdInCss(text, fromSkinId, toSkinId) {
    if (!text || typeof text !== 'string') return text;
    if (!fromSkinId || !toSkinId) return text;

    const fromId = String(fromSkinId);
    const toId = String(toSkinId);

    // Replace .widget.skinXXX patterns
    let result = text.replace(
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
   * Update all CSS-related fields in a component to reference the new skin ID
   * Checks ALL string fields that might contain CSS (not just a hardcoded list)
   */
  function updateComponentSkinReferences(component, fromSkinId, toSkinId) {
    if (!component) return component;

    const pattern = 'skin' + fromSkinId;
    let changesCount = 0;

    // Check ALL string properties that might contain CSS
    Object.keys(component).forEach(field => {
      const value = component[field];
      if (value && typeof value === 'string' && value.indexOf(pattern) !== -1) {
        const original = value;
        const updated = replaceSkinIdInCss(original, fromSkinId, toSkinId);
        if (updated !== original) {
          component[field] = updated;
          changesCount++;
          console.log('[CPToolkit] Updated skin ID references in', field,
            '(skin' + fromSkinId + ' -> skin' + toSkinId + ')');
        }
      }
    });

    if (changesCount > 0) {
      console.log('[CPToolkit] Updated', changesCount, 'CSS field(s) with new skin ID references');
    }

    return component;
  }

  // ============================================================================
  // TOUCH API - Direct API approach (no UI automation needed!)
  // ============================================================================

  function initTouchAPI() {
    if (window.CPToolkitTouchSkinAdvancedFor && window.CPToolkit_touchApiReady) {
      console.log('[TouchSkin] Touch API already loaded.');
      return;
    }

    /**
     * Touch a single component using the direct DesignCenter API
     * This is MUCH faster and more reliable than UI automation
     */
    function touchComponentDirect(skinId, componentIndex) {
      const skin = DesignCenter.themeJSON.WidgetSkins.find(s => s.WidgetSkinID == skinId);
      if (!skin) {
        console.error('[TouchSkin] Skin not found:', skinId);
        return { skinID: skinId, componentIndex, success: false, error: 'Skin not found' };
      }

      const comp = skin.Components[componentIndex];
      if (!comp) {
        console.error('[TouchSkin] Component not found at index:', componentIndex);
        return { skinID: skinId, componentIndex, success: false, error: 'Component not found' };
      }

      try {
        // Touch the data (add a space to trigger change detection)
        comp.MiscellaneousStyles = (comp.MiscellaneousStyles || '') + ' ';
        comp.RecordStatus = DesignCenter.recordStatus.Modified;
        skin.RecordStatus = DesignCenter.recordStatus.Modified;

        // Set the skin ID and regenerate CSS using direct API
        const previousSkinID = DesignCenter.widgetSkinID;
        DesignCenter.widgetSkinID = skin.WidgetSkinID;

        DesignCenter.writeThemeCSS.writeWidgetSkinComponentStyle(comp.ComponentType);

        DesignCenter.widgetSkinID = previousSkinID;

        console.log('[TouchSkin] Touched component', componentIndex, '(type', comp.ComponentType, ') for skin', skinId);
        return { skinID: skinId, componentIndex, success: true };
      } catch (err) {
        console.error('[TouchSkin] Error touching component', componentIndex, err);
        return { skinID: skinId, componentIndex, success: false, error: String(err) };
      }
    }

    /**
     * Batch touch multiple components using direct API
     * Much faster than the old UI automation approach
     */
    function touchSkinAdvancedBatch(skinId, componentIndexes) {
      componentIndexes = Array.isArray(componentIndexes) ?
        componentIndexes.map((x) => parseInt(x, 10)).filter((n) => !isNaN(n)) : [componentIndexes];
      componentIndexes = Array.from(new Set(componentIndexes));

      if (componentIndexes.length === 0) return [];

      const skin = DesignCenter.themeJSON.WidgetSkins.find(s => s.WidgetSkinID == skinId);
      if (!skin) {
        console.error('[TouchSkin] Skin not found:', skinId);
        return componentIndexes.map(idx => ({
          skinID: skinId, componentIndex: idx, success: false, error: 'Skin not found'
        }));
      }

      console.log('[TouchSkin] Batch touching', componentIndexes.length, 'components for skin', skinId, '(' + skin.Name + ')');

      const results = [];
      const previousSkinID = DesignCenter.widgetSkinID;

      // Set skin ID once for all operations
      DesignCenter.widgetSkinID = skin.WidgetSkinID;
      skin.RecordStatus = DesignCenter.recordStatus.Modified;

      // Group by view for logging
      const byView = { items: [], tabbed: [], columns: [], calendar: [] };
      componentIndexes.forEach(idx => {
        byView[getViewForComponent(idx)].push(idx);
      });
      console.log('[TouchSkin] Components by view:', byView);

      // Process each component
      componentIndexes.forEach(idx => {
        const comp = skin.Components[idx];
        if (!comp) {
          results.push({ skinID: skinId, componentIndex: idx, success: false, error: 'Component not found' });
          return;
        }

        try {
          // Touch the data
          comp.MiscellaneousStyles = (comp.MiscellaneousStyles || '') + ' ';
          comp.RecordStatus = DesignCenter.recordStatus.Modified;

          // Regenerate CSS
          DesignCenter.writeThemeCSS.writeWidgetSkinComponentStyle(comp.ComponentType);

          results.push({ skinID: skinId, componentIndex: idx, success: true });
          console.log('[TouchSkin]   Touched component', idx, '(type', comp.ComponentType + ')');
        } catch (err) {
          console.error('[TouchSkin]   Error on component', idx, ':', err.message);
          results.push({ skinID: skinId, componentIndex: idx, success: false, error: err.message });
        }
      });

      // Restore previous skin ID
      DesignCenter.widgetSkinID = previousSkinID;

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      console.log('[TouchSkin] Batch complete:', successCount, 'success,', failCount, 'failed');

      return results;
    }

    // Expose API
    window.CPToolkitTouchSkinAdvancedFor = touchSkinAdvancedBatch;
    window.CPToolkitTouchComponentDirect = touchComponentDirect;
    window.CPToolkit_touchApiReady = true;

    // Also expose utilities for external use
    window.CPToolkitSkinNavigation = {
      getViewForComponent,
      VIEW_CONFIG,
      CLICK_TARGETS,
      WIDGET_SKIN_COMPONENT_TYPES,
      replaceSkinIdInCss,
      updateComponentSkinReferences
    };

    console.log('[TouchSkin] Touch API ready (direct API mode - fast & reliable)');
  }

  // ============================================================================
  // COPY WIDGET SKIN COMPONENTS - Main Logic
  // ============================================================================

  function initCopyScript() {
    // Safety guard: ensure theme JSON present
    if (!window.DesignCenter || !DesignCenter.themeJSON || !DesignCenter.themeJSON.WidgetSkins) {
      alert('Error: Design Center data not available. Please ensure you\'re in the Theme Manager.');
      return;
    }

    // Initialize global queues
    window.__CPToolkit_pendingTouchedSkins = window.__CPToolkit_pendingTouchedSkins || [];
    window.__CPToolkit_lastTouchedSkins = window.__CPToolkit_lastTouchedSkins || [];

    // Debug
    try {
      console.groupCollapsed('[CPToolkit] Detected DesignCenter.themeJSON.WidgetSkins');
      console.log(DesignCenter.themeJSON.WidgetSkins);
      console.groupEnd();
    } catch (e) {}

    // Get valid skins
    const validSkins = [];
    $.each(DesignCenter.themeJSON.WidgetSkins, function () {
      if (this.Name && this.WidgetSkinID && this.Components) {
        validSkins.push(this);
      }
    });

    if (validSkins.length === 0) {
      alert('Error: No valid widget skins found.');
      return;
    }

    // ========================================================================
    // MODAL UI for Skin Selection
    // ========================================================================

    const SKIN_MODAL_STYLE_ID = 'widget-skin-selector-style';
    
    function ensureSkinSelectionStyles() {
      if (document.getElementById(SKIN_MODAL_STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = SKIN_MODAL_STYLE_ID;
      style.textContent =
        '.widget-skin-modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:20px;}' +
        '.widget-skin-modal{background:#fff;color:#222;max-width:620px;width:100%;max-height:90vh;display:flex;flex-direction:column;border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,0.4);padding:20px;font-family:Arial,Helvetica,sans-serif;}' +
        '.widget-skin-modal h2{margin:0 0 8px;font-size:20px;}' +
        '.widget-skin-modal p{margin:0 0 12px;font-size:14px;line-height:1.4;}' +
        '.widget-skin-modal__select{width:100%;border:1px solid #c7c7c7;border-radius:4px;padding:6px;font-size:14px;min-height:220px;flex:1;box-sizing:border-box;}' +
        '.widget-skin-modal__meta{margin-top:8px;font-size:12px;color:#555;}' +
        '.widget-skin-modal__actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;}' +
        '.widget-skin-modal__actions button{padding:8px 16px;font-size:14px;border-radius:4px;border:none;cursor:pointer;}' +
        '.widget-skin-modal__actions button.primary{background:#af282f;color:#fff;}' +
        '.widget-skin-modal__actions button.secondary{background:#f2f2f2;color:#333;}' +
        '.widget-skin-modal__actions button:disabled{opacity:0.5;cursor:not-allowed;}';
      document.head.appendChild(style);
    }

    function showSkinSelectionModal(options) {
      ensureSkinSelectionStyles();
      options = options || {};
      const skins = Array.isArray(options.skins) ? options.skins : [];

      return new Promise(function (resolve) {
        const overlay = document.createElement('div');
        overlay.className = 'widget-skin-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'widget-skin-modal';

        const title = document.createElement('h2');
        title.textContent = options.title || 'Select Widget Skin';
        modal.appendChild(title);

        if (options.message) {
          const message = document.createElement('p');
          message.textContent = options.message;
          modal.appendChild(message);
        }

        const select = document.createElement('select');
        select.className = 'widget-skin-modal__select';
        const visibleCount = Math.min(skins.length, 18);
        select.size = skins.length >= 8 ? visibleCount : skins.length || 1;

        skins.forEach(function (skin) {
          const option = document.createElement('option');
          option.value = skin.WidgetSkinID;
          option.textContent = (skin.Name || 'Unnamed Skin') + ' (' + skin.WidgetSkinID + ')';
          select.appendChild(option);
        });

        modal.appendChild(select);

        const meta = document.createElement('div');
        meta.className = 'widget-skin-modal__meta';
        meta.textContent = skins.length + ' skin' + (skins.length === 1 ? '' : 's') + ' available';
        modal.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'widget-skin-modal__actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'secondary';
        cancelBtn.textContent = options.cancelText || 'Cancel';

        const selectBtn = document.createElement('button');
        selectBtn.type = 'button';
        selectBtn.className = 'primary';
        selectBtn.textContent = options.confirmText || 'Select';
        selectBtn.disabled = skins.length === 0;

        actions.appendChild(cancelBtn);
        actions.appendChild(selectBtn);
        modal.appendChild(actions);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        let resolved = false;
        function cleanup(value) {
          if (resolved) return;
          resolved = true;
          document.removeEventListener('keydown', handleKey, true);
          if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(value);
        }

        function handleKey(evt) {
          if (evt.key === 'Escape') {
            evt.preventDefault();
            cleanup(null);
          }
          if ((evt.key === 'Enter' || evt.key === 'NumpadEnter') && document.activeElement === select && select.value) {
            evt.preventDefault();
            cleanup(select.value);
          }
        }

        document.addEventListener('keydown', handleKey, true);

        select.addEventListener('change', function () {
          selectBtn.disabled = !select.value;
        });
        select.addEventListener('dblclick', function () {
          if (select.value) cleanup(select.value);
        });

        selectBtn.addEventListener('click', function () {
          if (!selectBtn.disabled && select.value) cleanup(select.value);
        });
        cancelBtn.addEventListener('click', function () {
          cleanup(null);
        });
        overlay.addEventListener('click', function (evt) {
          if (evt.target === overlay) cleanup(null);
        });

        setTimeout(function () {
          if (skins.length > 0) select.focus();
        }, 0);
      });
    }

    // ========================================================================
    // Confirmation Modal (replaces native confirm() to avoid truncation)
    // ========================================================================

    function showConfirmationModal(options) {
      ensureSkinSelectionStyles();
      options = options || {};

      return new Promise(function (resolve) {
        const overlay = document.createElement('div');
        overlay.className = 'widget-skin-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'widget-skin-modal';
        modal.style.maxWidth = '550px';

        const title = document.createElement('h2');
        title.textContent = options.title || 'Confirm';
        modal.appendChild(title);

        if (options.message) {
          const message = document.createElement('p');
          message.textContent = options.message;
          modal.appendChild(message);
        }

        // Component list container
        if (options.componentsByView) {
          const container = document.createElement('div');
          container.style.maxHeight = '300px';
          container.style.overflow = 'auto';
          container.style.border = '1px solid #c7c7c7';
          container.style.borderRadius = '4px';
          container.style.padding = '12px';
          container.style.marginBottom = '12px';
          container.style.fontSize = '13px';

          Object.entries(options.componentsByView).forEach(([viewKey, components]) => {
            if (components.length === 0) return;

            const viewConfig = VIEW_CONFIG[viewKey];
            const groupDiv = document.createElement('div');
            groupDiv.style.marginBottom = '10px';

            const groupHeader = document.createElement('div');
            groupHeader.style.fontWeight = 'bold';
            groupHeader.style.marginBottom = '4px';
            groupHeader.textContent = viewConfig ? viewConfig.displayName : viewKey;
            groupDiv.appendChild(groupHeader);

            const list = document.createElement('ul');
            list.style.margin = '0';
            list.style.paddingLeft = '20px';

            components.forEach(compName => {
              const li = document.createElement('li');
              li.textContent = compName;
              li.style.marginBottom = '2px';
              list.appendChild(li);
            });

            groupDiv.appendChild(list);
            container.appendChild(groupDiv);
          });

          modal.appendChild(container);
        }

        const actions = document.createElement('div');
        actions.className = 'widget-skin-modal__actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'secondary';
        cancelBtn.textContent = options.cancelText || 'Cancel';

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'primary';
        confirmBtn.textContent = options.confirmText || 'OK';

        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);
        modal.appendChild(actions);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        let resolved = false;
        function cleanup(value) {
          if (resolved) return;
          resolved = true;
          document.removeEventListener('keydown', handleKey, true);
          if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(value);
        }

        function handleKey(evt) {
          if (evt.key === 'Escape') {
            evt.preventDefault();
            cleanup(false);
          }
          if (evt.key === 'Enter') {
            evt.preventDefault();
            cleanup(true);
          }
        }

        document.addEventListener('keydown', handleKey, true);

        confirmBtn.addEventListener('click', function () {
          cleanup(true);
        });
        cancelBtn.addEventListener('click', function () {
          cleanup(false);
        });
        overlay.addEventListener('click', function (evt) {
          if (evt.target === overlay) cleanup(false);
        });

        setTimeout(function () {
          confirmBtn.focus();
        }, 0);
      });
    }

    // ========================================================================
    // Component Selection Modal with View Grouping
    // ========================================================================

    function showComponentSelectionModal(options) {
      ensureSkinSelectionStyles();
      options = options || {};

      return new Promise(function (resolve) {
        const overlay = document.createElement('div');
        overlay.className = 'widget-skin-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'widget-skin-modal';
        modal.style.maxWidth = '720px';

        const title = document.createElement('h2');
        title.textContent = options.title || 'Select Components';
        modal.appendChild(title);

        if (options.message) {
          const message = document.createElement('p');
          message.textContent = options.message;
          modal.appendChild(message);
        }

        // Create grouped checkboxes
        const container = document.createElement('div');
        container.style.maxHeight = '400px';
        container.style.overflow = 'auto';
        container.style.border = '1px solid #c7c7c7';
        container.style.borderRadius = '4px';
        container.style.padding = '12px';

        const groups = {
          items: { label: 'Items View', components: [] },
          tabbed: { label: 'Tabbed View', components: [] },
          columns: { label: 'Columns View', components: [] },
          calendar: { label: 'Calendar View', components: [] }
        };

        WIDGET_SKIN_COMPONENT_TYPES.forEach(comp => {
          groups[comp.view].components.push(comp);
        });

        const checkboxes = [];

        Object.entries(groups).forEach(([viewKey, group]) => {
          const groupDiv = document.createElement('div');
          groupDiv.style.marginBottom = '12px';

          const groupHeader = document.createElement('div');
          groupHeader.style.fontWeight = 'bold';
          groupHeader.style.marginBottom = '8px';
          groupHeader.style.display = 'flex';
          groupHeader.style.alignItems = 'center';
          groupHeader.style.gap = '6px';

          const selectAllCb = document.createElement('input');
          selectAllCb.type = 'checkbox';
          selectAllCb.id = 'group-' + viewKey;
          selectAllCb.style.margin = '0';
          
          const groupLabel = document.createElement('label');
          groupLabel.htmlFor = 'group-' + viewKey;
          groupLabel.textContent = group.label;
          groupLabel.style.cursor = 'pointer';

          groupHeader.appendChild(selectAllCb);
          groupHeader.appendChild(groupLabel);
          groupDiv.appendChild(groupHeader);

          const componentList = document.createElement('div');
          componentList.style.marginLeft = '20px';
          componentList.style.display = 'grid';
          componentList.style.gridTemplateColumns = 'repeat(2, 1fr)';
          componentList.style.gap = '4px';

          const groupCheckboxes = [];

          group.components.forEach(comp => {
            const itemDiv = document.createElement('div');
            itemDiv.style.display = 'flex';
            itemDiv.style.alignItems = 'center';
            itemDiv.style.gap = '6px';
            
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = comp.index;
            cb.id = 'comp-' + comp.index;
            cb.style.margin = '0';
            
            const label = document.createElement('label');
            label.htmlFor = 'comp-' + comp.index;
            label.textContent = comp.name;
            label.style.cursor = 'pointer';
            label.style.fontSize = '13px';

            itemDiv.appendChild(cb);
            itemDiv.appendChild(label);
            componentList.appendChild(itemDiv);
            
            checkboxes.push(cb);
            groupCheckboxes.push(cb);
          });

          // Select all functionality for group
          selectAllCb.addEventListener('change', function() {
            groupCheckboxes.forEach(cb => cb.checked = selectAllCb.checked);
          });

          groupDiv.appendChild(componentList);
          container.appendChild(groupDiv);
        });

        modal.appendChild(container);

        // Quick select buttons
        const quickSelect = document.createElement('div');
        quickSelect.style.marginTop = '8px';
        quickSelect.style.display = 'flex';
        quickSelect.style.gap = '8px';
        quickSelect.style.flexWrap = 'wrap';

        const selectAllBtn = document.createElement('button');
        selectAllBtn.type = 'button';
        selectAllBtn.className = 'secondary';
        selectAllBtn.textContent = 'Select All';
        selectAllBtn.style.fontSize = '12px';
        selectAllBtn.style.padding = '4px 8px';
        selectAllBtn.addEventListener('click', () => {
          checkboxes.forEach(cb => cb.checked = true);
          container.querySelectorAll('input[id^="group-"]').forEach(cb => cb.checked = true);
        });

        const selectNoneBtn = document.createElement('button');
        selectNoneBtn.type = 'button';
        selectNoneBtn.className = 'secondary';
        selectNoneBtn.textContent = 'Select None';
        selectNoneBtn.style.fontSize = '12px';
        selectNoneBtn.style.padding = '4px 8px';
        selectNoneBtn.addEventListener('click', () => {
          checkboxes.forEach(cb => cb.checked = false);
          container.querySelectorAll('input[id^="group-"]').forEach(cb => cb.checked = false);
        });

        quickSelect.appendChild(selectAllBtn);
        quickSelect.appendChild(selectNoneBtn);
        modal.appendChild(quickSelect);

        const actions = document.createElement('div');
        actions.className = 'widget-skin-modal__actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'secondary';
        cancelBtn.textContent = 'Cancel';

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.className = 'primary';
        confirmBtn.textContent = options.confirmText || 'Continue';

        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);
        modal.appendChild(actions);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        let resolved = false;
        function cleanup(value) {
          if (resolved) return;
          resolved = true;
          document.removeEventListener('keydown', handleKey, true);
          if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(value);
        }

        function handleKey(evt) {
          if (evt.key === 'Escape') {
            evt.preventDefault();
            cleanup(null);
          }
        }

        document.addEventListener('keydown', handleKey, true);

        confirmBtn.addEventListener('click', function () {
          const selected = checkboxes
            .filter(cb => cb.checked)
            .map(cb => parseInt(cb.value, 10));
          cleanup(selected.length > 0 ? selected : null);
        });
        
        cancelBtn.addEventListener('click', function () {
          cleanup(null);
        });
        
        overlay.addEventListener('click', function (evt) {
          if (evt.target === overlay) cleanup(null);
        });
      });
    }

    // ========================================================================
    // Helper Functions
    // ========================================================================

    function validateComponentIndexes(input, typesCount) {
      if (!input || typeof input !== 'string') return null;
      const trimmedInput = input.trim();

      // Special case: enter the count to select all
      if (trimmedInput === typesCount.toString()) {
        const allIndexes = [];
        for (let idx = 0; idx < typesCount; idx++) allIndexes.push(idx);
        return allIndexes;
      }

      const indexes = input
        .split(',')
        .map(function (idx) {
          return parseInt(idx.trim(), 10);
        })
        .filter(function (idx) {
          return !isNaN(idx) && idx >= 0 && idx < typesCount;
        });

      return indexes.length > 0 ? indexes : null;
    }

    function findSkinById(skinId) {
      if (!skinId) return null;
      let foundSkin = null;
      $.each(DesignCenter.themeJSON.WidgetSkins, function () {
        if (this.WidgetSkinID == skinId && this.Components) {
          foundSkin = this;
          return false;
        }
      });
      return foundSkin;
    }

    // Build payload from explicit indexes for touch queue
    function makeTouchedPayloadForIndexes(toSkin, indexes) {
      try {
        if (!toSkin || !toSkin.WidgetSkinID) return null;

        const normalized = Array.isArray(indexes)
          ? Array.from(new Set(indexes.map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n) && n >= 0)))
          : [];

        if (normalized.length === 0) return null;

        const changedComponents = normalized.map((idx) => {
          const comp = (toSkin.Components && toSkin.Components[idx]) || null;
          const snippet =
            comp && typeof comp.MiscellaneousStyles === 'string'
              ? comp.MiscellaneousStyles.slice(0, 300).replace(/\n/g, '\\n')
              : '';
          return { idx: idx, snippet: snippet };
        });

        return {
          skinID: toSkin.WidgetSkinID,
          skinName: toSkin.Name || '',
          changedComponents: changedComponents,
          queuedAt: new Date().toISOString(),
        };
      } catch (e) {
        console.error('[CPToolkit] makeTouchedPayloadForIndexes error', e);
        return null;
      }
    }

    // Enqueue touch payload
    function enqueueTouchedPayload(payload) {
      try {
        if (!payload || !payload.skinID) return;
        window.__CPToolkit_pendingTouchedSkins = window.__CPToolkit_pendingTouchedSkins || [];

        const existing = window.__CPToolkit_pendingTouchedSkins.find((p) => String(p.skinID) === String(payload.skinID));
        if (existing) {
          // Merge indexes without duplicates
          const idxSet = {};
          (existing.changedComponents || []).forEach((c) => {
            idxSet[c.idx] = true;
          });
          (payload.changedComponents || []).forEach((c) => {
            if (!idxSet[c.idx]) {
              existing.changedComponents.push(c);
              idxSet[c.idx] = true;
            }
          });
          existing.queuedAt = existing.queuedAt || payload.queuedAt;
          console.log('[CPToolkit] merged touched payload into existing queue for skin', payload.skinID);
        } else {
          window.__CPToolkit_pendingTouchedSkins.push(payload);
          console.groupCollapsed('[CPToolkit] queued touched skin: ' + payload.skinName + ' (' + payload.skinID + ')');
          console.table(payload.changedComponents || []);
          console.groupEnd();
        }
      } catch (e) {
        console.error('[CPToolkit] enqueueTouchedPayload error', e);
        window.__CPToolkit_pendingTouchedSkins = window.__CPToolkit_pendingTouchedSkins || [];
        window.__CPToolkit_pendingTouchedSkins.push(payload);
      }
    }

    // Inject slide-in animation keyframes (shared with fix-copied-skin-references)
    function ensureNotificationStyles() {
      if (document.getElementById('cp-toolkit-touch-notification-styles')) return;
      const style = document.createElement('style');
      style.id = 'cp-toolkit-touch-notification-styles';
      style.textContent =
        '@keyframes cpToolkitSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }' +
        '@keyframes cpToolkitSlideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }';
      document.head.appendChild(style);
    }

    // Create or get the bottom-right progress notification
    function createOrGetProgressNotification() {
      const id = 'cp-toolkit-touch-progress-notification';
      const existing = document.getElementById(id);
      if (existing) {
        existing.style.display = 'block';
        existing.style.animation = 'cpToolkitSlideIn 0.3s ease-out';
        return existing;
      }

      ensureNotificationStyles();

      const notification = document.createElement('div');
      notification.id = id;
      notification.style.cssText =
        'position: fixed;' +
        'bottom: 20px;' +
        'right: 20px;' +
        'background: #2c3e50;' +
        'color: white;' +
        'padding: 16px 24px;' +
        'border-radius: 8px;' +
        'box-shadow: 0 4px 12px rgba(0,0,0,0.3);' +
        'z-index: 999999;' +
        'font-family: Arial, sans-serif;' +
        'font-size: 14px;' +
        'max-width: 420px;' +
        'animation: cpToolkitSlideIn 0.3s ease-out;';

      notification.innerHTML =
        '<div id="cp-toolkit-touch-progress-title" style="font-weight: bold; margin-bottom: 8px;">Fixing Skin References...</div>' +
        '<div id="cp-toolkit-touch-progress-body" style="font-size: 13px;"></div>';

      // Click to dismiss
      notification.addEventListener('click', function () {
        notification.style.animation = 'cpToolkitSlideOut 0.3s ease-in forwards';
        setTimeout(function () { notification.style.display = 'none'; }, 300);
      });

      document.body.appendChild(notification);
      return notification;
    }

    // Dismiss the notification after a delay
    function dismissNotification(notification, delayMs) {
      setTimeout(function () {
        notification.style.animation = 'cpToolkitSlideOut 0.3s ease-in forwards';
        setTimeout(function () { notification.style.display = 'none'; }, 300);
      }, delayMs);
    }

    // Process queued items sequentially
    window.__CPToolkit_processingPending = false;

    async function processPendingQueueAndTouch() {
      if (window.__CPToolkit_processingPending) {
        console.log('[CPToolkit] Already processing pending queue, skipping duplicate call.');
        return { success: false, processed: 0, reason: 'Already processing' };
      }

      try {
        window.__CPToolkit_processingPending = true;

        const snapshot = (window.__CPToolkit_pendingTouchedSkins || []).slice();
        window.__CPToolkit_pendingTouchedSkins = [];

        if (snapshot.length === 0) {
          console.log('[CPToolkit] No pending touched skins to process.');
          window.__CPToolkit_processingPending = false;
          return { success: true, processed: 0 };
        }

        console.groupCollapsed('[CPToolkit] processPendingQueueAndTouch - pending:', snapshot.length);
        console.table(snapshot);
        console.groupEnd();

        // Wait for touch API to be ready
        for (let i = 0; i < 25; i++) {
          if (typeof window.CPToolkitTouchSkinAdvancedFor === 'function') break;
          console.log('[CPToolkit] Waiting for Touch API...');
          await new Promise((r) => setTimeout(r, 800));
        }
        if (typeof window.CPToolkitTouchSkinAdvancedFor !== 'function') {
          console.warn('[CPToolkit] Touch API not available. You can run window.__CPToolkit_pendingTouchedSkins manually later.');
          window.__CPToolkit_processingPending = false;
          return { success: false, processed: 0, reason: 'Touch API not available' };
        }

        const notification = createOrGetProgressNotification();
        const titleEl = notification.querySelector('#cp-toolkit-touch-progress-title');
        const bodyEl = notification.querySelector('#cp-toolkit-touch-progress-body');

        titleEl.textContent = 'Fixing Skin References...';
        bodyEl.innerHTML = '';

        const results = [];
        let totalSuccess = 0;
        let totalFail = 0;

        for (let i = 0; i < snapshot.length; i++) {
          const item = snapshot[i];
          const skinLabel = item.skinName || 'id:' + item.skinID;

          // Update notification with current skin
          titleEl.textContent = 'Fixing Skin References (' + (i + 1) + '/' + snapshot.length + ')';
          bodyEl.innerHTML = skinLabel + ' (' + item.skinID + ')';

          try {
            const compIndexes = item.changedComponents.map((c) => c.idx);
            const res = await window.CPToolkitTouchSkinAdvancedFor(item.skinID, compIndexes);
            results.push({ item: item, result: res });

            const successCount = res.filter(r => r.success).length;
            const failCount = res.filter(r => !r.success).length;
            totalSuccess += successCount;
            totalFail += failCount;
          } catch (err) {
            console.error('[CPToolkit] Error touching skin', item.skinID, err);
            results.push({ item: item, error: err });
            totalFail++;
          }
          await new Promise((r) => setTimeout(r, 300));
        }

        window.__CPToolkit_lastTouchedSkins = results;

        // Show completion summary
        const skinNames = snapshot.map(s => s.skinName || 'id:' + s.skinID).join(', ');
        notification.style.background = totalFail > 0 ? '#e67e22' : '#2ecc71';
        titleEl.innerHTML = '&#10003; Skin References Fixed';
        bodyEl.innerHTML =
          'Touched ' + totalSuccess + ' component(s) across ' + snapshot.length + ' skin(s)' +
          (totalFail > 0 ? '<br><span style="opacity:0.9">' + totalFail + ' failed</span>' : '') +
          '<br><span style="opacity:0.9">' + skinNames + '</span>';

        dismissNotification(notification, 10000);
        return { success: true, processed: results.length, results: results };
      } finally {
        window.__CPToolkit_processingPending = false;
      }
    }

    // Wrap saveTheme to monitor network requests
    (function wrapSaveThemeForCPToolkit() {
      if (!window.saveTheme || window.__CPToolkit_saveThemeWrapped) return;
      const origSave = window.saveTheme;
      window.__CPToolkit_saveThemeWrapped = true;

      window.saveTheme = function () {
        // If no pending touched skins, just call original directly — no monitoring needed
        if (!window.__CPToolkit_pendingTouchedSkins || window.__CPToolkit_pendingTouchedSkins.length === 0) {
          return origSave.apply(this, arguments);
        }

        console.log('[CPToolkit] saveTheme() wrapper invoked — monitoring network activity for server-confirmed completion.');

        const trackedPromises = [];
        const originalXHRSend = XMLHttpRequest.prototype.send;
        const originalFetch = window.fetch;

        // Patch XHR.send
        XMLHttpRequest.prototype.send = function () {
          try {
            const xhr = this;
            const p = new Promise(function (resolve) {
              const onState = function () {
                if (xhr.readyState === 4) {
                  resolve({ type: 'xhr', status: xhr.status, url: xhr.responseURL || null });
                }
              };
              xhr.addEventListener('readystatechange', onState);
              xhr.addEventListener('error', function () {
                resolve({ type: 'xhr', status: 'error' });
              });
              xhr.addEventListener('abort', function () {
                resolve({ type: 'xhr', status: 'abort' });
              });
            });
            trackedPromises.push(p);
          } catch (e) {}
          return originalXHRSend.apply(this, arguments);
        };

        // Patch fetch
        if (originalFetch) {
          window.fetch = function () {
            try {
              const fetchPromise = originalFetch.apply(this, arguments);
              const tracker = fetchPromise
                .then(function (resp) {
                  return { type: 'fetch', status: resp && resp.status };
                })
                .catch(function (err) {
                  return { type: 'fetch', status: 'error', error: err };
                });
              trackedPromises.push(tracker);
              return fetchPromise;
            } catch (e) {
              return originalFetch.apply(this, arguments);
            }
          };
        }

        let ret;
        try {
          ret = origSave.apply(this, arguments);
        } catch (e) {
          XMLHttpRequest.prototype.send = originalXHRSend;
          if (originalFetch) window.fetch = originalFetch;
          console.error('[CPToolkit] saveTheme() original threw an error:', e);
          throw e;
        }

        setTimeout(function () {
          const timeoutMs = 20000;
          const timeoutPromise = new Promise(function (resolve) {
            setTimeout(function () {
              resolve({ type: 'timeout' });
            }, timeoutMs);
          });
          Promise.race([Promise.all(trackedPromises), timeoutPromise])
            .then(function (results) {
              XMLHttpRequest.prototype.send = originalXHRSend;
              if (originalFetch) window.fetch = originalFetch;
              console.log('[CPToolkit] saveTheme network-waiter done (or timeout). Proceeding to process pending queue if any.');
              processPendingQueueAndTouch()
                .then(function (res) {
                  console.log('[CPToolkit] processPendingQueueAndTouch result:', res);
                })
                .catch(function (err) {
                  console.error('[CPToolkit] Error while processing pending queue:', err);
                });
            })
            .catch(function (err) {
              XMLHttpRequest.prototype.send = originalXHRSend;
              if (originalFetch) window.fetch = originalFetch;
              console.error('[CPToolkit] Unexpected error while waiting for save network requests:', err);
              processPendingQueueAndTouch();
            });
        }, 300);

        return ret;
      };
    })();

    // ========================================================================
    // Mode Selection Modal
    // ========================================================================

    function showModeSelectionModal() {
      ensureSkinSelectionStyles();
      return new Promise(function (resolve) {
        var overlay = document.createElement('div');
        overlay.className = 'widget-skin-modal-overlay';

        var modal = document.createElement('div');
        modal.className = 'widget-skin-modal';
        modal.style.maxWidth = '420px';

        var header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;';

        var title = document.createElement('h2');
        title.textContent = 'Copy Widget Skin Components';
        title.style.margin = '0';

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '\u00D7';
        closeBtn.style.cssText = 'background:none;border:none;font-size:24px;cursor:pointer;color:#666;padding:0;line-height:1;';
        closeBtn.addEventListener('mouseover', function() { closeBtn.style.color = '#333'; });
        closeBtn.addEventListener('mouseout', function() { closeBtn.style.color = '#666'; });

        header.appendChild(title);
        header.appendChild(closeBtn);
        modal.appendChild(header);

        var desc = document.createElement('p');
        desc.textContent = 'Select a mode:';
        desc.style.cssText = 'margin:0 0 16px;font-size:14px;color:#333;';
        modal.appendChild(desc);

        var modes = [
          { value: '1', label: 'Local Copy', detail: 'Copy components between skins on this site' },
          { value: '2', label: 'Export', detail: 'Copy skin data to clipboard for another site' },
          { value: '3', label: 'Import', detail: 'Paste skin data from clipboard' }
        ];

        var btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

        var resolved = false;
        function cleanup(value) {
          if (resolved) return;
          resolved = true;
          document.removeEventListener('keydown', handleKey, true);
          if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(value);
        }

        modes.forEach(function(m) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;padding:12px 16px;border:1px solid #e0e0e0;border-radius:4px;background:#fff;cursor:pointer;text-align:left;transition:border-color 0.15s,background 0.15s;';

          var labelSpan = document.createElement('span');
          labelSpan.textContent = m.label;
          labelSpan.style.cssText = 'font-size:14px;font-weight:600;color:#333;';

          var detailSpan = document.createElement('span');
          detailSpan.textContent = m.detail;
          detailSpan.style.cssText = 'font-size:12px;color:#666;margin-top:2px;';

          btn.appendChild(labelSpan);
          btn.appendChild(detailSpan);

          btn.addEventListener('mouseover', function() { btn.style.borderColor = '#af282f'; btn.style.background = '#fdf5f5'; });
          btn.addEventListener('mouseout', function() { btn.style.borderColor = '#e0e0e0'; btn.style.background = '#fff'; });
          btn.addEventListener('click', function() { cleanup(m.value); });

          btnContainer.appendChild(btn);
        });

        modal.appendChild(btnContainer);

        var actions = document.createElement('div');
        actions.className = 'widget-skin-modal__actions';
        actions.style.marginTop = '16px';

        var cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'secondary';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', function() { cleanup(null); });
        actions.appendChild(cancelBtn);

        modal.appendChild(actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        function handleKey(evt) {
          if (evt.key === 'Escape') {
            evt.preventDefault();
            cleanup(null);
          }
        }
        document.addEventListener('keydown', handleKey, true);

        closeBtn.addEventListener('click', function() { cleanup(null); });
      });
    }

    // ========================================================================
    // Main Interactive Flow
    // ========================================================================

    (async function mainFlow() {
      const mode = await showModeSelectionModal();

      if (!mode) {
        return;
      }

      // ======================================================================
      // MODE 1: Local Copy
      // ======================================================================
      if (mode.trim() === '1') {
        const skinToCopy = await showSkinSelectionModal({
          title: 'Select source widget skin',
          message: 'Choose the skin you would like to copy components from.',
          skins: validSkins,
          confirmText: 'Use skin',
        });
        if (!skinToCopy) {
          alert('Operation cancelled.');
          return;
        }

        const skinToEdit = await showSkinSelectionModal({
          title: 'Select destination widget skin',
          message: 'Choose the skin you would like to copy components to.',
          skins: validSkins,
          confirmText: 'Use skin',
        });
        if (!skinToEdit) {
          alert('Operation cancelled.');
          return;
        }

        const fromSkin = findSkinById(skinToCopy);
        const toSkin = findSkinById(skinToEdit);
        if (!fromSkin || !toSkin) {
          alert('Error: One or both selected skins not found.');
          return;
        }

        const correctSkinNames = await showConfirmationModal({
          title: 'Confirm Skins',
          message: "Copying from skin '" + fromSkin.Name + "' to '" + toSkin.Name + "'.",
          confirmText: 'Continue',
          cancelText: 'Cancel'
        });

        if (correctSkinNames && skinToCopy !== skinToEdit) {
          // Use new component selection modal
          const componentIndexes = await showComponentSelectionModal({
            title: 'Select Components to Copy',
            message: 'Choose which components to copy from "' + fromSkin.Name + '" to "' + toSkin.Name + '".',
            confirmText: 'Copy Selected'
          });

          if (!componentIndexes || componentIndexes.length === 0) {
            alert('No components selected. Operation cancelled.');
            return;
          }

          // Build summary of components to copy, grouped by view
          const byView = { items: [], tabbed: [], columns: [], calendar: [] };
          componentIndexes.forEach(idx => {
            if (fromSkin.Components[idx]) {
              const compInfo = WIDGET_SKIN_COMPONENT_TYPES[idx];
              byView[compInfo.view].push(compInfo.name);
            }
          });

          const confirmCopy = await showConfirmationModal({
            title: 'Confirm Copy',
            message: 'Copy ' + componentIndexes.length + ' component(s) from "' + fromSkin.Name + '" to "' + toSkin.Name + '"?',
            componentsByView: byView,
            confirmText: 'Copy All',
            cancelText: 'Cancel'
          });

          if (!confirmCopy) {
            alert('Operation cancelled.');
            return;
          }

          const copiedIndexes = [];

          $.each(componentIndexes, function (_, idx) {
            if (fromSkin.Components[idx]) {
              toSkin.RecordStatus = DesignCenter.recordStatus.Modified;
              toSkin.Components[idx] = Object.assign({}, fromSkin.Components[idx]);
              toSkin.Components[idx].WidgetSkinID = parseInt(skinToEdit, 10);
              toSkin.Components[idx].RecordStatus = DesignCenter.recordStatus.Modified;

              // Fix skin ID references in CSS fields (e.g., .widget.skin101 -> .widget.skin107)
              updateComponentSkinReferences(toSkin.Components[idx], fromSkin.WidgetSkinID, toSkin.WidgetSkinID);

              copiedIndexes.push(idx);
            }
          });

          if (copiedIndexes.length === 0) {
            alert('No components were copied.');
            return;
          }

          // Enqueue only copied indexes
          const payload = makeTouchedPayloadForIndexes(toSkin, copiedIndexes);
          if (payload) {
            enqueueTouchedPayload(payload);
          } else {
            console.log('[CPToolkit] No MiscellaneousStyles found on destination skin after copy - nothing to touch.');
          }

          saveTheme();
        } else if (skinToCopy === skinToEdit) {
          alert('You cannot copy to the same skin.');
        }
        return;
      }

      // ======================================================================
      // MODE 2: Export
      // ======================================================================
      if (mode.trim() === '2') {
        const skinToExport = await showSkinSelectionModal({
          title: 'Select skin to export from',
          message: 'Choose the skin whose components you would like to export.',
          skins: validSkins,
          confirmText: 'Export from this skin',
        });
        if (!skinToExport) {
          alert('Operation cancelled.');
          return;
        }

        const fromSkinExport = findSkinById(skinToExport);
        if (!fromSkinExport) {
          alert('Error: Selected skin not found.');
          return;
        }

        // Use new component selection modal
        const componentIndexesExport = await showComponentSelectionModal({
          title: 'Select Components to Export',
          message: 'Choose which components to export from "' + fromSkinExport.Name + '".',
          confirmText: 'Export Selected'
        });
        
        if (!componentIndexesExport || componentIndexesExport.length === 0) {
          alert('No components selected. Operation cancelled.');
          return;
        }

        const exportData = {
          version: '1.1',
          exportedAt: new Date().toISOString(),
          skinName: fromSkinExport.Name,
          skinID: fromSkinExport.WidgetSkinID,
          componentIndexes: componentIndexesExport,
          components: [],
        };

        $.each(componentIndexesExport, function (_, idx) {
          if (fromSkinExport.Components[idx] && fromSkinExport.Components[idx]) {
            const compInfo = WIDGET_SKIN_COMPONENT_TYPES[idx];
            exportData.components.push({ 
              idx: idx, 
              type: compInfo.name,
              view: compInfo.view,
              data: fromSkinExport.Components[idx] 
            });
          }
        });

        if (exportData.components.length === 0) {
          alert('Error: No valid components to export.');
          return;
        }

        const exportJson = JSON.stringify(exportData, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            await navigator.clipboard.writeText(exportJson);
            alert('Exported! Data copied to clipboard.\n\nPaste it on the destination site using Import mode.');
          } catch (err) {
            alert('Failed to copy to clipboard. You can manually copy the data from the next prompt.');
            prompt('Copy this data:', exportJson);
          }
        } else {
          prompt('Copy this data:', exportJson);
        }
        return;
      }

      // ======================================================================
      // MODE 3: Import
      // ======================================================================
      if (mode.trim() === '3') {
        // Step 1: Read import data from clipboard (with prompt fallback)
        let importJson;
        if (navigator.clipboard && navigator.clipboard.readText) {
          try {
            importJson = await navigator.clipboard.readText();
          } catch (err) {
            importJson = prompt('Paste the exported data here:');
          }
        } else {
          importJson = prompt('Paste the exported data here:');
        }

        if (!importJson || typeof importJson !== 'string') {
          alert('Error: No data provided.');
          return;
        }

        // Step 2: Parse and validate JSON
        let importData;
        try {
          importData = JSON.parse(importJson);
        } catch (e) {
          alert('Error: Invalid JSON data. Please ensure you copied the export data correctly.');
          return;
        }

        if (
          !importData ||
          typeof importData !== 'object' ||
          !importData.version ||
          !importData.components ||
          !Array.isArray(importData.components) ||
          !importData.componentIndexes ||
          !Array.isArray(importData.componentIndexes)
        ) {
          alert('Error: Invalid import data structure. Please ensure you\'re using data exported from this tool.');
          return;
        }

        if (importData.version !== '1.0' && importData.version !== '1.1') {
          if (!confirm('Warning: Import data is from a different version (' + importData.version + '). Continue anyway?')) return;
        }

        // Validate components
        const validComponents = [];
        const importByView = { items: [], tabbed: [], columns: [], calendar: [] };

        $.each(importData.components, function (_, componentData) {
          const idx = componentData.idx;
          if (typeof idx !== 'number' || idx < 0 || idx >= WIDGET_SKIN_COMPONENT_TYPES.length || !componentData.data) {
            console.warn('Skipping invalid component at index ' + idx);
            return;
          }
          const compInfo = WIDGET_SKIN_COMPONENT_TYPES[idx];
          importByView[compInfo.view].push(compInfo.name);
          validComponents.push(componentData);
        });

        if (validComponents.length === 0) {
          alert('No valid components to import.');
          return;
        }

        // Step 3: Select destination skin
        const skinToEditImport = await showSkinSelectionModal({
          title: 'Select destination widget skin',
          message: 'Importing ' + validComponents.length + ' component(s) from "' + (importData.skinName || 'Unknown') + '". Choose the destination skin.',
          skins: validSkins,
          confirmText: 'Import into this skin',
        });
        if (!skinToEditImport) {
          alert('Operation cancelled.');
          return;
        }

        const toSkinImport = findSkinById(skinToEditImport);
        if (!toSkinImport) {
          alert('Error: Destination skin not found.');
          return;
        }

        // Step 4: Confirm with component details
        const confirmImport = await showConfirmationModal({
          title: 'Confirm Import',
          message: 'Import ' + validComponents.length + ' component(s) from "' + (importData.skinName || 'Unknown') + '" into "' + toSkinImport.Name + '"?',
          componentsByView: importByView,
          confirmText: 'Import All',
          cancelText: 'Cancel'
        });

        if (!confirmImport) {
          alert('Operation cancelled.');
          return;
        }

        // Step 5: Apply components
        const copiedIndexes = [];

        $.each(validComponents, function (_, componentData) {
          const idx = componentData.idx;
          toSkinImport.RecordStatus = DesignCenter.recordStatus.Modified;
          toSkinImport.Components[idx] = Object.assign({}, componentData.data);
          toSkinImport.Components[idx].WidgetSkinID = parseInt(skinToEditImport, 10);
          toSkinImport.Components[idx].RecordStatus = DesignCenter.recordStatus.Modified;

          // Fix skin ID references in CSS fields (from source skin to destination skin)
          if (importData.skinID) {
            updateComponentSkinReferences(toSkinImport.Components[idx], importData.skinID, toSkinImport.WidgetSkinID);
          }

          copiedIndexes.push(idx);
        });

        if (copiedIndexes.length === 0) {
          alert('No components were imported.');
          return;
        }

        // Enqueue only copied indexes for touch
        const importPayload = makeTouchedPayloadForIndexes(toSkinImport, copiedIndexes);
        if (importPayload) {
          enqueueTouchedPayload(importPayload);
        }

        // Step 6: Save
        const shouldSaveImport = confirm(
          copiedIndexes.length +
            ' component(s) imported successfully. Click OK to save changes (script will run touch steps after server-confirmation).'
        );
        if (shouldSaveImport) {
          saveTheme();
          alert('Save initiated. Touch steps will run automatically after save completes.');
        } else {
          alert('Changes not saved. Refresh the page to cancel the changes.');
        }
        return;
      }
    })();
  }

  // ============================================================================
  // Initialize both APIs
  // ============================================================================

  initTouchAPI();
  initCopyScript();
})();