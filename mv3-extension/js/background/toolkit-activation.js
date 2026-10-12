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
  var PREPARE_TRUSTED_ORIGIN_ACTION = 'cp-toolkit-prepare-trusted-origin';
  var CLEAR_PENDING_TRUST_ACTION = 'cp-toolkit-clear-pending-trusted-origin';
  var TRUSTED_ORIGINS_KEY = 'cp-toolkit-trusted-vanity-origins';
  var PENDING_TRUST_RECORDS_KEY = 'cp-toolkit-pending-trusted-origins';
  var TRUSTED_SCRIPT_ID_PREFIX = 'cp-toolkit-vanity-';
  var PENDING_INJECTION_TIMEOUT_MS = 15000;
  var PENDING_TRUST_TTL_MS = 120000;
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

  function getPendingTrustStorage() {
    return chrome.storage && chrome.storage.session
      ? chrome.storage.session
      : chrome.storage.local;
  }

  function getPendingTrustRecords() {
    return getPendingTrustStorage().get(PENDING_TRUST_RECORDS_KEY).then(function(settings) {
      var records = settings && settings[PENDING_TRUST_RECORDS_KEY];
      return records && typeof records === 'object' && !Array.isArray(records)
        ? records
        : {};
    });
  }

  function prunePendingTrustRecords(records, now) {
    var pruned = {};
    Object.keys(records || {}).forEach(function(originPattern) {
      var record = records[originPattern];
      if (
        isExactHttpsOriginPattern(originPattern) &&
        record &&
        typeof record === 'object' &&
        now - Number(record.createdAt || 0) <= PENDING_TRUST_TTL_MS
      ) {
        pruned[originPattern] = record;
      }
    });
    return pruned;
  }

  function storePendingTrustRecord(record) {
    var storage = getPendingTrustStorage();
    return getPendingTrustRecords().then(function(records) {
      var nextRecords = prunePendingTrustRecords(records, Date.now());
      nextRecords[record.originPattern] = record;
      return storage.set({ [PENDING_TRUST_RECORDS_KEY]: nextRecords }).then(function() {
        return record;
      });
    });
  }

  function consumePendingTrustRecord(originPattern) {
    var storage = getPendingTrustStorage();
    return getPendingTrustRecords().then(function(records) {
      var nextRecords = prunePendingTrustRecords(records, Date.now());
      var record = nextRecords[originPattern] || null;
      delete nextRecords[originPattern];
      return storage.set({ [PENDING_TRUST_RECORDS_KEY]: nextRecords }).then(function() {
        return record;
      });
    });
  }

  function clearPendingTrustRecord(originPattern, tabId) {
    var storage = getPendingTrustStorage();
    return getPendingTrustRecords().then(function(records) {
      var nextRecords = prunePendingTrustRecords(records, Date.now());
      var record = nextRecords[originPattern];
      if (record && (typeof tabId !== 'number' || record.tabId === tabId)) {
        delete nextRecords[originPattern];
      }
      return storage.set({ [PENDING_TRUST_RECORDS_KEY]: nextRecords }).then(function() {
        return { cleared: !nextRecords[originPattern] };
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
    }).catch(function(error) {
      // The popup and permissions.onAdded can both reach this operation after
      // the user grants access. If another caller registered the same script
      // between our read and write, converge on the desired registration.
      return chrome.scripting.getRegisteredContentScripts({ ids: [id] }).then(function(existing) {
        if (!existing || existing.length === 0) throw error;
        return chrome.scripting.updateContentScripts([spec]);
      });
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

  function getFullToolkitFiles(lanes, url) {
    var files = ['js/external/jquery-3.3.1.min.js'];
    registry.onLoad.forEach(function(entry) {
      if (!entryMatchesAnyLane(entry, lanes)) return;
      if (!registry.entryMatchesUrl(entry, url)) return;
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

  function getErrorMessage(error) {
    return error && error.message ? error.message : String(error || '');
  }

  function isTransientInjectionTargetError(error) {
    var message = getErrorMessage(error);
    return /No tab with id|No frame with id|Frame with ID .* was removed|Frame with ID .* is showing error page|The tab was closed|The frame was removed|Cannot find frame/i.test(message);
  }

  function isInjectionAccessError(error) {
    var message = getErrorMessage(error);
    return /Cannot access contents of the page|Extension manifest must request permission|Cannot access a chrome:|The extensions gallery cannot be scripted|Cannot script a chrome/i.test(message);
  }

  function skippedTransientTarget(error, files) {
    return {
      injected: false,
      skipped: 'target-unavailable',
      message: getErrorMessage(error),
      files: files || []
    };
  }

  function skippedMissingHostPermission(error, files) {
    return {
      injected: false,
      skipped: 'missing-host-permission',
      message: getErrorMessage(error),
      files: files || []
    };
  }

  function skippedActivationError(error) {
    if (isTransientInjectionTargetError(error)) {
      return {
        skipped: 'target-unavailable',
        message: getErrorMessage(error)
      };
    }
    if (isInjectionAccessError(error)) {
      return {
        skipped: 'missing-host-permission',
        message: getErrorMessage(error)
      };
    }
    return null;
  }

  function claimInjection(injectionKey, activationId, pendingTimeoutMs) {
    var globalRoot = typeof globalThis !== 'undefined' ? globalThis : window;
    var now = Date.now();
    globalRoot.__cpToolkitInjectionStates = globalRoot.__cpToolkitInjectionStates || {};
    var current = globalRoot.__cpToolkitInjectionStates[injectionKey];

    if (current && current.status === 'complete') {
      return { claimed: false, status: 'complete', activationId: current.activationId || '' };
    }
    if (
      current &&
      current.status === 'pending' &&
      now - Number(current.startedAt || 0) < pendingTimeoutMs
    ) {
      return {
        claimed: false,
        status: 'pending',
        activationId: current.activationId || '',
        pendingAgeMs: now - Number(current.startedAt || now)
      };
    }

    globalRoot.__cpToolkitInjectionStates[injectionKey] = {
      status: 'pending',
      activationId: activationId,
      startedAt: now
    };
    return { claimed: true, status: 'pending', activationId: activationId };
  }

  function updateInjectionState(injectionKey, activationId, status, errorMessage) {
    var globalRoot = typeof globalThis !== 'undefined' ? globalThis : window;
    globalRoot.__cpToolkitInjectionStates = globalRoot.__cpToolkitInjectionStates || {};
    var current = globalRoot.__cpToolkitInjectionStates[injectionKey];

    if (status === 'clear') {
      if (!current || !current.activationId || current.activationId === activationId) {
        delete globalRoot.__cpToolkitInjectionStates[injectionKey];
        return { cleared: true };
      }
      return { cleared: false, status: current.status, activationId: current.activationId || '' };
    }

    globalRoot.__cpToolkitInjectionStates[injectionKey] = {
      status: status,
      activationId: activationId,
      startedAt: current && current.startedAt ? current.startedAt : Date.now(),
      completedAt: status === 'complete' ? Date.now() : 0,
      error: errorMessage || ''
    };
    return globalRoot.__cpToolkitInjectionStates[injectionKey];
  }

  function executeInjectionClaim(target, injectionKey, activationId) {
    return chrome.scripting.executeScript({
      target: {
        tabId: target.tabId,
        frameIds: [target.frameId]
      },
      func: claimInjection,
      args: [injectionKey, activationId, PENDING_INJECTION_TIMEOUT_MS]
    }).then(function(results) {
      return results && results[0] && results[0].result
        ? results[0].result
        : { claimed: false, status: 'unknown' };
    });
  }

  function setInjectionState(target, injectionKey, activationId, status, errorMessage) {
    return chrome.scripting.executeScript({
      target: {
        tabId: target.tabId,
        frameIds: [target.frameId]
      },
      func: updateInjectionState,
      args: [injectionKey, activationId, status, errorMessage || '']
    });
  }

  function executeFilesOnce(target, injectionKey, files, requestedActivationId) {
    if (!files || files.length === 0) return Promise.resolve({ injected: false, files: [] });
    var activationId = requestedActivationId || [
      'worker',
      Date.now().toString(36),
      Math.random().toString(36).slice(2, 8)
    ].join('-');

    return executeInjectionClaim(target, injectionKey, activationId).then(function(claim) {
      if (!claim.claimed && claim.status === 'complete') {
        return { injected: false, duplicate: true, state: 'complete', files: files };
      }
      if (!claim.claimed && claim.status === 'pending') {
        return {
          injected: false,
          pending: true,
          state: 'pending',
          pendingAgeMs: claim.pendingAgeMs || 0,
          files: files
        };
      }
      if (!claim.claimed) {
        return { injected: false, pending: true, state: claim.status || 'unknown', files: files };
      }

      return chrome.scripting.executeScript({
        target: {
          tabId: target.tabId,
          frameIds: [target.frameId]
        },
        files: files
      }).then(function() {
        return setInjectionState(target, injectionKey, activationId, 'complete', '').then(function() {
          return { injected: true, state: 'complete', activationId: activationId, files: files };
        });
      }).catch(function(error) {
        return setInjectionState(
          target,
          injectionKey,
          activationId,
          'clear',
          getErrorMessage(error)
        ).catch(function() {}).then(function() {
          throw error;
        });
      });
    }).catch(function(error) {
      if (isTransientInjectionTargetError(error)) {
        return skippedTransientTarget(error, files);
      }
      if (isInjectionAccessError(error)) {
        return skippedMissingHostPermission(error, files);
      }
      throw error;
    });
  }

  function handleFullToolkit(target, lanes, activationId, url) {
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
      getFullToolkitFiles(fullToolkitLanes, url),
      activationId
    );
  }

  function handleCssLane(target, lanes, activationId) {
    if (target.frameId !== 0) {
      return Promise.resolve({ skipped: 'css-top-frame-only' });
    }
    if (!includes(lanes, LANES.ALL_PAGES_CP_HOST_CSS)) {
      return Promise.resolve({ skipped: 'css-no-valid-lane' });
    }

    return executeFilesOnce(
      target,
      'tool:' + SPECIAL_TOOL_IDS.CUSTOM_CSS_DEPLOYER,
      getFilesForEntryId(SPECIAL_TOOL_IDS.CUSTOM_CSS_DEPLOYER),
      activationId
    );
  }

  function handleIdentityLane(target, lanes, activationId) {
    if (!includes(lanes, LANES.IDENTITY)) {
      return Promise.resolve({ skipped: 'identity-no-valid-lane' });
    }

    return executeFilesOnce(
      target,
      'tool:' + SPECIAL_TOOL_IDS.ADFS,
      getFilesForEntryId(SPECIAL_TOOL_IDS.ADFS),
      activationId
    );
  }

  function handleImagePickerFrame(target, activationId) {
    return executeFilesOnce(
      target,
      'tool:' + SPECIAL_TOOL_IDS.REMEMBER_IMAGE_PICKER_STATE,
      getFilesForEntryId(SPECIAL_TOOL_IDS.REMEMBER_IMAGE_PICKER_STATE),
      activationId
    );
  }

  function dispatchActivation(target, activationKind, lanes, activationId, url) {
    if (activationKind === ACTIVATION_KINDS.FULL_TOOLKIT) {
      return handleFullToolkit(target, lanes, activationId, url);
    }
    if (activationKind === ACTIVATION_KINDS.CSS) {
      return handleCssLane(target, lanes, activationId);
    }
    if (activationKind === ACTIVATION_KINDS.IDENTITY) {
      return handleIdentityLane(target, lanes, activationId);
    }
    if (activationKind === ACTIVATION_KINDS.IMAGE_PICKER_FRAME) {
      return handleImagePickerFrame(target, activationId);
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
      var activationId = typeof message.activationId === 'string' ? message.activationId : '';
      return dispatchActivation(target, activationKind, lanes, activationId, sender && sender.url);
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
          if (bootstrapResult && bootstrapResult.skipped === 'target-unavailable') {
            return {
              activated: false,
              skipped: 'target-unavailable',
              bootstrap: bootstrapResult,
              message: bootstrapResult.message
            };
          }
          if (bootstrapResult && bootstrapResult.skipped === 'missing-host-permission') {
            return {
              activated: false,
              skipped: 'missing-host-permission',
              bootstrap: bootstrapResult,
              message: bootstrapResult.message
            };
          }

          if (lanes.indexOf(LANES.ADMIN) !== -1 || lanes.indexOf(LANES.LIVE_EDIT) !== -1) {
            activationPromises.push(handleFullToolkit(target, lanes, '', tab && tab.url));
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
            var targetUnavailable = results.find(function(result) {
              return result && result.skipped === 'target-unavailable';
            });
            if (targetUnavailable) {
              return {
                activated: false,
                skipped: 'target-unavailable',
                bootstrap: bootstrapResult,
                results: results,
                message: targetUnavailable.message
              };
            }
            var missingHostPermission = results.find(function(result) {
              return result && result.skipped === 'missing-host-permission';
            });
            if (missingHostPermission) {
              return {
                activated: false,
                skipped: 'missing-host-permission',
                bootstrap: bootstrapResult,
                results: results,
                message: missingHostPermission.message
              };
            }

            return {
              activated: true,
              bootstrap: bootstrapResult,
              results: results
            };
          });
        });
      });
    }).catch(function(error) {
      if (isTransientInjectionTargetError(error)) {
        return {
          activated: false,
          skipped: 'target-unavailable',
          message: getErrorMessage(error)
        };
      }
      if (isInjectionAccessError(error)) {
        return {
          activated: false,
          skipped: 'missing-host-permission',
          message: getErrorMessage(error)
        };
      }
      throw error;
    });
  }

  function getAutoOpenedTabUrl(tabId) {
    var key = 'cp-toolkit-vanity-popup-context';
    var storage = chrome.storage && chrome.storage.session ? chrome.storage.session : chrome.storage.local;
    return storage.get(key).then(function(settings) {
      var context = settings && settings[key];
      if (
        context &&
        context.tabId === tabId &&
        typeof context.url === 'string' &&
        Date.now() - Number(context.createdAt || 0) < PENDING_TRUST_TTL_MS
      ) {
        return context.url;
      }
      return '';
    }).catch(function() { return ''; });
  }

  function handlePrepareTrustedOrigin(message) {
    var originPattern = typeof message.originPattern === 'string' ? message.originPattern : '';
    var tabId = typeof message.tabId === 'number' ? message.tabId : null;
    var lanes = sanitizeLanes(message.lanes).filter(function(lane) {
      return lane === LANES.ADMIN || lane === LANES.LIVE_EDIT || lane === LANES.IDENTITY;
    });

    if (!isExactHttpsOriginPattern(originPattern)) {
      return Promise.resolve({ skipped: 'invalid-origin-pattern' });
    }
    if (tabId === null) {
      return Promise.resolve({ skipped: 'missing-tab-id' });
    }
    if (lanes.length === 0) {
      return Promise.resolve({ skipped: 'missing-activating-lane' });
    }

    return Promise.all([chrome.tabs.get(tabId), getAutoOpenedTabUrl(tabId)]).then(function(values) {
      // An automatically opened popup has no activeTab grant, so Chrome hides
      // the tab URL until access is granted; use the URL recorded when the
      // popup was opened for this same tab.
      var tab = values[0];
      var tabUrl = (tab && tab.url) || values[1];
      if (getHttpsOriginPattern(tabUrl) !== originPattern) {
        return { skipped: 'tab-origin-mismatch' };
      }

      return storePendingTrustRecord({
        originPattern: originPattern,
        tabId: tabId,
        lanes: lanes,
        createdAt: Date.now()
      }).then(function(record) {
        return {
          prepared: true,
          originPattern: record.originPattern,
          tabId: record.tabId,
          lanes: record.lanes
        };
      });
    });
  }

  function handleClearPendingTrust(message) {
    var originPattern = typeof message.originPattern === 'string' ? message.originPattern : '';
    var tabId = typeof message.tabId === 'number' ? message.tabId : null;
    if (!isExactHttpsOriginPattern(originPattern)) {
      return Promise.resolve({ skipped: 'invalid-origin-pattern' });
    }
    return clearPendingTrustRecord(originPattern, tabId);
  }

  function activatePendingTrustTab(originPattern, record) {
    return chrome.tabs.get(record.tabId).then(function(tab) {
      if (getHttpsOriginPattern(tab && tab.url) !== originPattern) {
        return {
          tabId: record.tabId,
          skipped: 'tab-origin-mismatch'
        };
      }

      return executeFilesOnce(
        { tabId: record.tabId, frameId: 0 },
        'trusted-origin-bootstrap',
        registry.currentStaticBootstrap.slice()
      ).then(function(result) {
        return {
          tabId: record.tabId,
          url: tab.url,
          lanes: record.lanes,
          bootstrap: result
        };
      });
    });
  }

  function handleAddedPermissions(permissions) {
    var origins = asArray(permissions && permissions.origins).filter(isExactHttpsOriginPattern);
    if (origins.length === 0) return Promise.resolve([]);

    return Promise.all(origins.map(function(originPattern) {
      return consumePendingTrustRecord(originPattern).then(function(record) {
        if (!record) {
          return {
            originPattern: originPattern,
            skipped: 'no-pending-trust-intent'
          };
        }

        return storeTrustedOrigin(originPattern).then(function() {
          return registerTrustedOriginContentScript(originPattern);
        }).then(function(registered) {
          return activatePendingTrustTab(originPattern, record).then(function(activation) {
            return {
              registered: registered,
              activation: activation
            };
          });
        });
      });
    }));
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
    handleAddedPermissions: handleAddedPermissions,
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
      } else if (message.action === PREPARE_TRUSTED_ORIGIN_ACTION) {
        handler = function() { return handlePrepareTrustedOrigin(message); };
      } else if (message.action === CLEAR_PENDING_TRUST_ACTION) {
        handler = function() { return handleClearPendingTrust(message); };
      }

      if (!handler) return false;

      handler().then(function(result) {
        log('handled ' + logName, result);
        sendResponse({ result: result });
      }).catch(function(error) {
        var skipped = skippedActivationError(error);
        if (skipped) {
          log('skipped ' + logName, skipped);
          sendResponse({ result: skipped });
          return;
        }
        console.error('[CP Toolkit] Activation failed:', error);
        sendResponse({ error: error && error.message ? error.message : String(error) });
      });

      return true;
    }
  });

  registerStoredTrustedOrigins();

  if (chrome.permissions && chrome.permissions.onAdded) {
    chrome.permissions.onAdded.addListener(function(permissions) {
      handleAddedPermissions(permissions).then(function(results) {
        var completed = results.filter(function(result) {
          return result && !result.skipped;
        });
        if (completed.length > 0) {
          log('trusted origin permission granted; initiating tab bootstrapped', completed);
        }
      }).catch(function(error) {
        console.warn('[CP Toolkit] Could not activate newly trusted origin:', error);
      });
    });
  }

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
