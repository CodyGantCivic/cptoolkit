// CivicPlus Toolkit - detector-triggered script activation
// Maps trusted detector lanes to fixed local extension files. Message payloads
// never provide script paths.
(function(root) {
  'use strict';

  var registry = root.CPToolkitInjectionRegistry;
  if (!registry) return;

  var LANES = registry.lanes;
  var ACTIVATION_ACTION = 'cp-toolkit-activation-detected';
  var ACTIVATION_KINDS = Object.freeze({
    FULL_TOOLKIT: 'full-toolkit',
    CSS: 'all-pages-cp-host-css',
    IDENTITY: 'identity',
    IMAGE_PICKER_FRAME: 'image-picker-frame'
  });
  var SPECIAL_TOOL_IDS = Object.freeze({
    CUSTOM_CSS_DEPLOYER: 'custom-css-deployer',
    ADFS: 'adfs',
    REMEMBER_IMAGE_PICKER_STATE: 'remember-image-picker-state'
  });
  var FULL_TOOLKIT_EXCLUDED_IDS = Object.freeze([
    SPECIAL_TOOL_IDS.CUSTOM_CSS_DEPLOYER,
    SPECIAL_TOOL_IDS.ADFS,
    SPECIAL_TOOL_IDS.REMEMBER_IMAGE_PICKER_STATE
  ]);
  var FULL_TOOLKIT_LANES = Object.freeze([
    LANES.ADMIN,
    LANES.LIVE_EDIT
  ]);
  var KNOWN_PLATFORM_SUFFIXES = Object.freeze([
    '.civicplus.com',
    '.civic.place',
    '.civicplus.pro',
    '.cpqa.ninja'
  ]);
  var KNOWN_PLATFORM_HOSTS = Object.freeze([
    'civicplus.com',
    'civic.place',
    'civicplus.pro',
    'cpqa.ninja',
    'account.civicplus.com',
    'identityserver.cpqa.ninja'
  ]);
  var VALID_LANES = Object.freeze([
    LANES.ADMIN,
    LANES.LIVE_EDIT,
    LANES.ALL_PAGES_CP_HOST_CSS,
    LANES.IDENTITY
  ]);

  function log(message, details) {
    if (details) {
      console.log('[CP Toolkit] Activation:', message, details);
    } else {
      console.log('[CP Toolkit] Activation:', message);
    }
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function includes(list, value) {
    return list.indexOf(value) !== -1;
  }

  function uniquePush(list, value) {
    if (list.indexOf(value) === -1) list.push(value);
  }

  function normalizeHostname(hostname) {
    return String(hostname || '').toLowerCase().replace(/\.$/, '');
  }

  function isKnownPlatformHost(hostname) {
    var host = normalizeHostname(hostname);
    if (!host) return false;
    if (includes(KNOWN_PLATFORM_HOSTS, host)) return true;
    return KNOWN_PLATFORM_SUFFIXES.some(function(suffix) {
      return host.endsWith(suffix);
    });
  }

  function isKnownPlatformUrl(url) {
    try {
      return isKnownPlatformHost(new URL(url).hostname);
    } catch (err) {
      return false;
    }
  }

  function sanitizeLanes(lanes) {
    var sanitized = [];
    asArray(lanes).forEach(function(lane) {
      if (includes(VALID_LANES, lane)) uniquePush(sanitized, lane);
    });
    return sanitized;
  }

  function getEntryById(id) {
    for (var index = 0; index < registry.onLoad.length; index++) {
      if (registry.onLoad[index].id === id) return registry.onLoad[index];
    }
    return null;
  }

  function getFilesForEntryId(id) {
    var entry = getEntryById(id);
    return entry ? entry.files.slice() : [];
  }

  function entryMatchesAnyLane(entry, lanes) {
    for (var index = 0; index < lanes.length; index++) {
      if (entry.lanes.indexOf(lanes[index]) !== -1) return true;
    }
    return false;
  }

  function getFullToolkitFiles(lanes) {
    var files = ['js/external/jquery-3.3.1.min.js'];
    registry.onLoad.forEach(function(entry) {
      if (!entryMatchesAnyLane(entry, lanes)) return;
      if (includes(FULL_TOOLKIT_EXCLUDED_IDS, entry.id)) return;
      entry.files.forEach(function(file) {
        uniquePush(files, file);
      });
    });
    return files;
  }

  function getSenderTarget(sender) {
    if (!sender || !sender.tab || typeof sender.tab.id !== 'number') return null;
    return {
      tabId: sender.tab.id,
      frameId: typeof sender.frameId === 'number' ? sender.frameId : 0
    };
  }

  function markInjected(injectionKey) {
    var globalRoot = typeof globalThis !== 'undefined' ? globalThis : window;
    globalRoot.__cpToolkitInjectedKeys = globalRoot.__cpToolkitInjectedKeys || {};
    if (globalRoot.__cpToolkitInjectedKeys[injectionKey]) return false;
    globalRoot.__cpToolkitInjectedKeys[injectionKey] = true;
    return true;
  }

  function executeInjectionMarker(target, injectionKey) {
    return chrome.scripting.executeScript({
      target: {
        tabId: target.tabId,
        frameIds: [target.frameId]
      },
      func: markInjected,
      args: [injectionKey]
    }).then(function(results) {
      return !!(results && results[0] && results[0].result);
    });
  }

  function executeFilesOnce(target, injectionKey, files) {
    if (!files || files.length === 0) return Promise.resolve({ injected: false, files: [] });

    return executeInjectionMarker(target, injectionKey).then(function(shouldInject) {
      if (!shouldInject) return { injected: false, duplicate: true, files: files };

      return chrome.scripting.executeScript({
        target: {
          tabId: target.tabId,
          frameIds: [target.frameId]
        },
        files: files
      }).then(function() {
        return { injected: true, files: files };
      });
    });
  }

  function handleFullToolkit(target, lanes) {
    if (target.frameId !== 0) {
      return Promise.resolve({ skipped: 'full-toolkit-top-frame-only' });
    }

    var fullToolkitLanes = lanes.filter(function(lane) {
      return includes(FULL_TOOLKIT_LANES, lane);
    });
    if (fullToolkitLanes.length === 0) {
      return Promise.resolve({ skipped: 'full-toolkit-no-valid-lane' });
    }

    return executeFilesOnce(
      target,
      'full-toolkit:' + fullToolkitLanes.join(','),
      getFullToolkitFiles(fullToolkitLanes)
    );
  }

  function handleCssLane(target, lanes) {
    if (target.frameId !== 0) {
      return Promise.resolve({ skipped: 'css-top-frame-only' });
    }
    if (!includes(lanes, LANES.ALL_PAGES_CP_HOST_CSS)) {
      return Promise.resolve({ skipped: 'css-no-valid-lane' });
    }

    return executeFilesOnce(
      target,
      'tool:' + SPECIAL_TOOL_IDS.CUSTOM_CSS_DEPLOYER,
      getFilesForEntryId(SPECIAL_TOOL_IDS.CUSTOM_CSS_DEPLOYER)
    );
  }

  function handleIdentityLane(target, lanes) {
    if (!includes(lanes, LANES.IDENTITY)) {
      return Promise.resolve({ skipped: 'identity-no-valid-lane' });
    }

    return executeFilesOnce(
      target,
      'tool:' + SPECIAL_TOOL_IDS.ADFS,
      getFilesForEntryId(SPECIAL_TOOL_IDS.ADFS)
    );
  }

  function handleImagePickerFrame(target) {
    return executeFilesOnce(
      target,
      'tool:' + SPECIAL_TOOL_IDS.REMEMBER_IMAGE_PICKER_STATE,
      getFilesForEntryId(SPECIAL_TOOL_IDS.REMEMBER_IMAGE_PICKER_STATE)
    );
  }

  function handleActivation(message, sender) {
    if (sender && sender.id && sender.id !== chrome.runtime.id) {
      return Promise.resolve({ skipped: 'sender-id-mismatch' });
    }
    if (!isKnownPlatformUrl(sender && sender.url)) {
      return Promise.resolve({ skipped: 'sender-url-not-approved-host' });
    }

    var target = getSenderTarget(sender);
    if (!target) return Promise.resolve({ skipped: 'missing-sender-tab' });

    var activationKind = typeof message.activationKind === 'string' ? message.activationKind : '';
    var lanes = sanitizeLanes(message.lanes);

    if (activationKind === ACTIVATION_KINDS.FULL_TOOLKIT) {
      return handleFullToolkit(target, lanes);
    }
    if (activationKind === ACTIVATION_KINDS.CSS) {
      return handleCssLane(target, lanes);
    }
    if (activationKind === ACTIVATION_KINDS.IDENTITY) {
      return handleIdentityLane(target, lanes);
    }
    if (activationKind === ACTIVATION_KINDS.IMAGE_PICKER_FRAME) {
      return handleImagePickerFrame(target);
    }

    return Promise.resolve({ skipped: 'unknown-activation-kind' });
  }

  root.CPToolkitActivation = Object.freeze({
    handleMessage: function(message, sender, sendResponse) {
      if (!message || message.action !== ACTIVATION_ACTION) return false;

      handleActivation(message, sender).then(function(result) {
        log('handled ' + message.activationKind, result);
        sendResponse({ result: result });
      }).catch(function(error) {
        console.error('[CP Toolkit] Activation failed:', error);
        sendResponse({ error: error && error.message ? error.message : String(error) });
      });

      return true;
    }
  });
})(self);
