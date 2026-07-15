// CivicPlus Toolkit - detector-triggered script activation
// Maps trusted detector lanes to fixed local extension files. Message payloads
// never provide script paths.
(function(root) {
  'use strict';

  var registry = root.CPToolkitInjectionRegistry;
  if (!registry) return;

  var LANES = registry.lanes;
  var ACTIVATION_ACTION = 'cp-toolkit-activation-detected';
  var REGISTER_TRUSTED_ORIGIN_ACTION = 'cp-toolkit-register-trusted-origin';
  var ACTIVATE_TRUSTED_TAB_ACTION = 'cp-toolkit-activate-trusted-tab';
  var TRUSTED_ORIGINS_KEY = 'cp-toolkit-trusted-vanity-origins';
  var TRUSTED_SCRIPT_ID_PREFIX = 'cp-toolkit-vanity-';
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

  function getHttpsOriginPattern(url) {
    try {
      var parsed = new URL(url);
      var hostname = normalizeHostname(parsed.hostname);
      if (parsed.protocol !== 'https:' || !hostname || hostname.indexOf('*') !== -1) return null;
      return 'https://' + hostname + '/*';
    } catch (err) {
      return null;
    }
  }

  function isExactHttpsOriginPattern(originPattern) {
    if (typeof originPattern !== 'string') return false;
    if (!/^https:\/\/[^/*?#]+\/\*$/.test(originPattern)) return false;
    return getHttpsOriginPattern(originPattern.slice(0, -2)) === originPattern;
  }

  function hashString(value) {
    var hash = 2166136261;
    for (var index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(36);
  }

  function getTrustedContentScriptId(originPattern) {
    return TRUSTED_SCRIPT_ID_PREFIX + hashString(originPattern);
  }

  function getTrustedOrigins() {
    return chrome.storage.local.get(TRUSTED_ORIGINS_KEY).then(function(settings) {
      return asArray(settings[TRUSTED_ORIGINS_KEY]).filter(isExactHttpsOriginPattern);
    });
  }

  function storeTrustedOrigin(originPattern) {
    return getTrustedOrigins().then(function(origins) {
      uniquePush(origins, originPattern);
      return chrome.storage.local.set({ [TRUSTED_ORIGINS_KEY]: origins }).then(function() {
        return origins;
      });
    });
  }

  function removeTrustedOrigin(originPattern) {
    return getTrustedOrigins().then(function(origins) {
      var nextOrigins = origins.filter(function(storedOrigin) {
        return storedOrigin !== originPattern;
      });
      return chrome.storage.local.set({ [TRUSTED_ORIGINS_KEY]: nextOrigins }).then(function() {
        return nextOrigins;
      });
    });
  }

  function hasOriginPermission(originPattern) {
    if (!isExactHttpsOriginPattern(originPattern)) return Promise.resolve(false);
    return chrome.permissions.contains({ origins: [originPattern] });
  }

  function isApprovedActivationUrl(url) {
    if (isKnownPlatformUrl(url)) return Promise.resolve(true);
    var originPattern = getHttpsOriginPattern(url);
    if (!originPattern) return Promise.resolve(false);
    return hasOriginPermission(originPattern);
  }

  function registerTrustedOriginContentScript(originPattern) {
    if (!isExactHttpsOriginPattern(originPattern)) {
      return Promise.reject(new Error('Invalid trusted origin pattern'));
    }

    var id = getTrustedContentScriptId(originPattern);
    var spec = {
      id: id,
      matches: [originPattern],
      allFrames: true,
      js: registry.currentStaticBootstrap.slice(),
      runAt: 'document_start',
      persistAcrossSessions: true
    };

    return chrome.scripting.getRegisteredContentScripts({ ids: [id] }).then(function(existing) {
      if (existing && existing.length > 0) {
        return chrome.scripting.updateContentScripts([spec]);
      }
      return chrome.scripting.registerContentScripts([spec]);
    }).then(function() {
      return { id: id, originPattern: originPattern };
    });
  }

  function unregisterTrustedOriginContentScript(originPattern) {
    return chrome.scripting.unregisterContentScripts({
      ids: [getTrustedContentScriptId(originPattern)]
    }).catch(function() {});
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

  function dispatchActivation(target, activationKind, lanes) {
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

  function handleActivation(message, sender) {
    if (sender && sender.id && sender.id !== chrome.runtime.id) {
      return Promise.resolve({ skipped: 'sender-id-mismatch' });
    }

    var target = getSenderTarget(sender);
    if (!target) return Promise.resolve({ skipped: 'missing-sender-tab' });

    return isApprovedActivationUrl(sender && sender.url).then(function(approved) {
      if (!approved) return { skipped: 'sender-url-not-approved-host' };

      var activationKind = typeof message.activationKind === 'string' ? message.activationKind : '';
      var lanes = sanitizeLanes(message.lanes);
      return dispatchActivation(target, activationKind, lanes);
    });
  }

  function handleRegisterTrustedOrigin(message) {
    var originPattern = typeof message.originPattern === 'string' ? message.originPattern : '';
    if (!isExactHttpsOriginPattern(originPattern)) {
      return Promise.resolve({ skipped: 'invalid-origin-pattern' });
    }

    return hasOriginPermission(originPattern).then(function(granted) {
      if (!granted) return { skipped: 'origin-permission-not-granted' };

      return storeTrustedOrigin(originPattern).then(function() {
        return registerTrustedOriginContentScript(originPattern);
      }).then(function(registered) {
        return {
          registered: true,
          id: registered.id,
          originPattern: originPattern
        };
      });
    });
  }

  function handleActivateTrustedTab(message) {
    var tabId = typeof message.tabId === 'number' ? message.tabId : null;
    if (tabId === null) return Promise.resolve({ skipped: 'missing-tab-id' });

    return chrome.tabs.get(tabId).then(function(tab) {
      return isApprovedActivationUrl(tab && tab.url).then(function(approved) {
        if (!approved) return { skipped: 'tab-url-not-approved-host' };

        var target = { tabId: tabId, frameId: 0 };
        var lanes = sanitizeLanes(message.lanes);
        var activationPromises = [];

        return executeFilesOnce(
          target,
          'trusted-origin-bootstrap',
          registry.currentStaticBootstrap.slice()
        ).then(function(bootstrapResult) {
          if (lanes.indexOf(LANES.ADMIN) !== -1 || lanes.indexOf(LANES.LIVE_EDIT) !== -1) {
            activationPromises.push(handleFullToolkit(target, lanes));
            activationPromises.push(handleCssLane(target, [LANES.ALL_PAGES_CP_HOST_CSS]));
          }

          if (lanes.indexOf(LANES.IDENTITY) !== -1) {
            activationPromises.push(handleIdentityLane(target, lanes));
          }

          if (activationPromises.length === 0) {
            return {
              bootstrap: bootstrapResult,
              skipped: 'no-supported-lanes'
            };
          }

          return Promise.all(activationPromises).then(function(results) {
            return {
              activated: true,
              bootstrap: bootstrapResult,
              results: results
            };
          });
        });
      });
    });
  }

  function registerStoredTrustedOrigins() {
    getTrustedOrigins().then(function(origins) {
      origins.forEach(function(originPattern) {
        hasOriginPermission(originPattern).then(function(granted) {
          if (!granted) {
            unregisterTrustedOriginContentScript(originPattern);
            return;
          }
          registerTrustedOriginContentScript(originPattern).catch(function(error) {
            console.warn('[CP Toolkit] Could not register trusted origin content script:', originPattern, error);
          });
        });
      });
    }).catch(function(error) {
      console.warn('[CP Toolkit] Could not restore trusted origin content scripts:', error);
    });
  }

  root.CPToolkitActivation = Object.freeze({
    handleMessage: function(message, sender, sendResponse) {
      if (!message) return false;

      var handler = null;
      var logName = message.action;

      if (message.action === ACTIVATION_ACTION) {
        handler = function() { return handleActivation(message, sender); };
        logName = message.activationKind;
      } else if (message.action === REGISTER_TRUSTED_ORIGIN_ACTION) {
        handler = function() { return handleRegisterTrustedOrigin(message); };
      } else if (message.action === ACTIVATE_TRUSTED_TAB_ACTION) {
        handler = function() { return handleActivateTrustedTab(message); };
      }

      if (!handler) return false;

      handler().then(function(result) {
        log('handled ' + logName, result);
        sendResponse({ result: result });
      }).catch(function(error) {
        console.error('[CP Toolkit] Activation failed:', error);
        sendResponse({ error: error && error.message ? error.message : String(error) });
      });

      return true;
    }
  });

  registerStoredTrustedOrigins();

  if (chrome.permissions && chrome.permissions.onRemoved) {
    chrome.permissions.onRemoved.addListener(function(permissions) {
      asArray(permissions && permissions.origins).filter(isExactHttpsOriginPattern).forEach(function(originPattern) {
        unregisterTrustedOriginContentScript(originPattern);
        removeTrustedOrigin(originPattern).catch(function(error) {
          console.warn('[CP Toolkit] Could not remove revoked trusted origin:', originPattern, error);
        });
      });
    });
  }
})(self);
