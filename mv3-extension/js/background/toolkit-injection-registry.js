// CivicPlus Toolkit - automatic injection inventory
// This file is intentionally data-first. Step 3 will use it to replace the
// broad manifest content-script chain with detector-triggered script loading.
(function(root) {
  'use strict';

  var LANES = Object.freeze({
    ADMIN: 'admin',
    LIVE_EDIT: 'live-edit',
    ALL_PAGES_CP_HOST_CSS: 'all-pages-cp-host-css',
    IDENTITY: 'identity',
    ON_DEMAND: 'on-demand'
  });

  var FRAME_TARGETS = Object.freeze({
    TOP: 'top',
    SELECTED_IMAGE_PICKER_FRAMES: 'selected-image-picker-frames',
    TOP_WITH_SERVICE_WORKER_FRAME_BRIDGE: 'top-with-service-worker-frame-bridge'
  });

  var WORLDS = Object.freeze({
    ISOLATED: 'ISOLATED',
    MAIN: 'MAIN'
  });

  var JQUERY = Object.freeze({
    NONE: 'none',
    REQUIRED: 'required',
    OPTIONAL: 'optional'
  });

  var TIMING_RISK = Object.freeze({
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    ORDER_CRITICAL: 'order-critical'
  });

  var CURRENT_STATIC_BOOTSTRAP = Object.freeze([
    'js/detect_cp_site.js',
    'js/external/jquery-3.3.1.min.js'
  ]);

  function freezeSpec(spec) {
    if (Array.isArray(spec.files)) Object.freeze(spec.files);
    if (Array.isArray(spec.lanes)) Object.freeze(spec.lanes);
    if (Array.isArray(spec.dependsOn)) Object.freeze(spec.dependsOn);
    if (Array.isArray(spec.notes)) Object.freeze(spec.notes);
    return Object.freeze(spec);
  }

  function freezeList(list) {
    list.forEach(freezeSpec);
    return Object.freeze(list);
  }

  var ON_LOAD_INJECTION_ORDER = freezeList([
    {
      id: 'title-changer',
      kind: 'tool',
      files: ['js/tools/on-load/title-changer.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.LOW
    },
    {
      id: 'keyboard-shortcuts',
      kind: 'tool',
      files: ['js/tools/on-load/keyboard-shortcuts.js'],
      lanes: [LANES.ADMIN, LANES.LIVE_EDIT],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.LOW,
      notes: ['Keep existing double-init guard.']
    },
    {
      id: 'auto-dismiss-help-welcome',
      kind: 'tool',
      files: ['js/tools/on-load/auto-dismiss-help-welcome.js'],
      lanes: [LANES.ADMIN, LANES.LIVE_EDIT],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.NONE,
      timingRisk: TIMING_RISK.LOW
    },
    {
      id: 'advanced-styles-limits',
      kind: 'dependency',
      files: ['js/tools/on-load/helpers/advanced-styles-limits.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.NONE,
      timingRisk: TIMING_RISK.ORDER_CRITICAL,
      notes: ['Must load before enforce-advanced-styles-text-limits and mini-ide.']
    },
    {
      id: 'enforce-advanced-styles-text-limits',
      kind: 'tool',
      files: ['js/tools/on-load/enforce-advanced-styles-text-limits.js'],
      lanes: [LANES.ADMIN],
      dependsOn: ['advanced-styles-limits'],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.NONE,
      timingRisk: TIMING_RISK.LOW
    },
    {
      id: 'theme-manager-enhancer',
      kind: 'tool',
      files: ['js/tools/on-load/theme-manager-enhancer.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.MEDIUM,
      notes: ['Late injection mainly risks visual flash.']
    },
    {
      id: 'theme-manager-skin-organizer',
      kind: 'tool',
      files: ['js/tools/on-load/theme-manager-skin-organizer.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.OPTIONAL,
      timingRisk: TIMING_RISK.LOW
    },
    {
      id: 'widget-skin-default-override',
      kind: 'tool',
      files: ['js/tools/on-load/widget-skin-default-override.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.MEDIUM,
      notes: ['Injects MAIN-world helper file for page DesignCenter access.']
    },
    {
      id: 'module-icons',
      kind: 'tool',
      files: ['js/tools/on-load/module-icons.js'],
      lanes: [LANES.ADMIN, LANES.LIVE_EDIT],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.LOW
    },
    {
      id: 'cp-MultipleCategoryUpload',
      kind: 'tool',
      files: ['js/tools/on-load/cp-MultipleCategoryUpload.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.LOW
    },
    {
      id: 'cp-MultipleQuickLinks',
      kind: 'tool',
      files: ['js/tools/on-load/cp-MultipleQuickLinks.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.LOW
    },
    {
      id: 'cp-InfoAdvancedImportExport',
      kind: 'tool',
      files: ['js/tools/on-load/cp-InfoAdvancedImportExport.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP_WITH_SERVICE_WORKER_FRAME_BRIDGE,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.NONE,
      timingRisk: TIMING_RISK.LOW,
      notes: ['Uses service worker frame bridge; do not blanket-inject every frame.']
    },
    {
      id: 'widget-skin-advanced-style-helper',
      kind: 'tool',
      files: ['js/tools/on-load/widget-skin-advanced-style-helper.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.MEDIUM,
      notes: ['Injects MAIN-world helper file; preserve helper relay.']
    },
    {
      id: 'graphic-link-advanced-style-helper',
      kind: 'tool',
      files: ['js/tools/on-load/graphic-link-advanced-style-helper.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.MEDIUM,
      notes: ['Needs scan-existing behavior before later injection to avoid missing .insertFancy.']
    },
    {
      id: 'option-set-importer',
      kind: 'tool',
      files: ['js/tools/on-load/option-set-importer.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.NONE,
      timingRisk: TIMING_RISK.LOW,
      notes: ['Widget Manager only; popup sends openOptionSetImporter message.']
    },
    {
      id: 'snippet-library',
      kind: 'dependency',
      files: [
        'js/shared/snippet-library-store.js',
        'js/shared/snippet-library-view.js'
      ],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.NONE,
      timingRisk: TIMING_RISK.ORDER_CRITICAL,
      notes: ['Must load before css-snippets.']
    },
    {
      id: 'css-snippets',
      kind: 'tool',
      files: ['js/tools/on-load/css-snippets.js'],
      lanes: [LANES.ADMIN],
      dependsOn: ['snippet-library'],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.NONE,
      timingRisk: TIMING_RISK.LOW,
      notes: ['Provides storage bridge used by MAIN-world on-demand tools.']
    },
    {
      id: 'mini-ide',
      kind: 'tool',
      files: ['js/tools/on-load/mini-ide.js'],
      lanes: [LANES.ADMIN],
      dependsOn: ['advanced-styles-limits', 'css-snippets'],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.MEDIUM,
      notes: ['Remove dead legacy HEAD probe when centralized detection lands.']
    },
    {
      id: 'custom-css-deployer',
      kind: 'tool',
      files: ['js/tools/on-load/custom-css-deployer.js'],
      lanes: [LANES.ADMIN, LANES.ALL_PAGES_CP_HOST_CSS],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.NONE,
      timingRisk: TIMING_RISK.MEDIUM,
      notes: ['All-pages lane should load only this minimal CSS applicator, not the full toolkit.']
    },
    {
      id: 'prevent-timeout',
      kind: 'tool',
      files: ['js/tools/on-load/prevent-timeout.js'],
      lanes: [LANES.ADMIN, LANES.LIVE_EDIT],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.LOW
    },
    {
      id: 'graphic-link-autofill',
      kind: 'tool',
      files: ['js/tools/on-load/graphic-link-autofill.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.LOW
    },
    {
      id: 'quick-link-autofill',
      kind: 'tool',
      files: ['js/tools/on-load/quick-link-autofill.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.LOW
    },
    {
      id: 'input-focus',
      kind: 'tool',
      files: ['js/tools/on-load/input-focus.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.LOW
    },
    {
      id: 'xml-change-alerts',
      kind: 'tool',
      files: ['js/tools/on-load/xml-change-alerts.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.LOW
    },
    {
      id: 'download-xml-css',
      kind: 'tool',
      files: ['js/tools/on-load/download-xml-css.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.NONE,
      timingRisk: TIMING_RISK.LOW
    },
    {
      id: 'layout-manager-sorter',
      kind: 'tool',
      files: ['js/tools/on-load/layout-manager-sorter.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.OPTIONAL,
      timingRisk: TIMING_RISK.LOW
    },
    {
      id: 'fancy-button-library',
      kind: 'dependency',
      files: ['js/shared/fancy-button-library.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.NONE,
      timingRisk: TIMING_RISK.ORDER_CRITICAL,
      notes: ['Must load before cp-ImportFancyButton.']
    },
    {
      id: 'cp-ImportFancyButton',
      kind: 'tool',
      files: ['js/tools/on-load/cp-ImportFancyButton.js'],
      lanes: [LANES.ADMIN],
      dependsOn: ['fancy-button-library'],
      frameTarget: FRAME_TARGETS.TOP_WITH_SERVICE_WORKER_FRAME_BRIDGE,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.LOW,
      notes: ['Uses service worker frame bridge for upload/folder frames.']
    },
    {
      id: 'remember-image-picker-state',
      kind: 'tool',
      files: ['js/tools/on-load/remember-image-picker-state.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.SELECTED_IMAGE_PICKER_FRAMES,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.OPTIONAL,
      timingRisk: TIMING_RISK.HIGH,
      notes: ['Must run in selected image-picker frames, not top-frame only.']
    },
    {
      id: 'fix-copied-skin-references',
      kind: 'tool',
      files: ['js/tools/on-load/fix-copied-skin-references.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.NONE,
      timingRisk: TIMING_RISK.MEDIUM,
      notes: ['Injects MAIN-world helper file; preserve helper order.']
    },
    {
      id: 'adfs',
      kind: 'tool',
      files: ['js/tools/on-load/adfs.js'],
      lanes: [LANES.IDENTITY],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.HIGH,
      notes: ['Static identity/SAML lane. Prefer rewriting to vanilla JS before manifest narrowing so this lane does not need jQuery.']
    },
    {
      id: 'cp-MultipleInfoAdvancedItems',
      kind: 'tool',
      files: ['js/tools/on-load/cp-MultipleInfoAdvancedItems.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.REQUIRED,
      timingRisk: TIMING_RISK.LOW
    },
    {
      id: 'redesign-manager-skin-sorter',
      kind: 'tool',
      files: ['js/tools/on-load/redesign-manager-skin-sorter.js'],
      lanes: [LANES.ADMIN],
      frameTarget: FRAME_TARGETS.TOP,
      world: WORLDS.ISOLATED,
      jquery: JQUERY.NONE,
      timingRisk: TIMING_RISK.LOW
    }
  ]);

  function flattenFiles(entries) {
    var files = [];
    entries.forEach(function(entry) {
      entry.files.forEach(function(file) {
        files.push(file);
      });
    });
    return files;
  }

  function getEntriesForLane(lane) {
    return ON_LOAD_INJECTION_ORDER.filter(function(entry) {
      return entry.lanes.indexOf(lane) !== -1;
    });
  }

  function getFilesForLane(lane, options) {
    var includeJquery = !!(options && options.includeJquery);
    var files = includeJquery ? ['js/external/jquery-3.3.1.min.js'] : [];
    return files.concat(flattenFiles(getEntriesForLane(lane)));
  }

  root.CPToolkitInjectionRegistry = Object.freeze({
    version: '2026-07-14',
    lanes: LANES,
    frameTargets: FRAME_TARGETS,
    worlds: WORLDS,
    jquery: JQUERY,
    timingRisk: TIMING_RISK,
    currentStaticBootstrap: CURRENT_STATIC_BOOTSTRAP,
    onLoad: ON_LOAD_INJECTION_ORDER,
    getEntriesForLane: getEntriesForLane,
    getFilesForLane: getFilesForLane,
    onDemandSource: 'data/on-demand-tools.json',
    onLoadSettingsSource: 'data/on-load-tools.json'
  });
})(self);
