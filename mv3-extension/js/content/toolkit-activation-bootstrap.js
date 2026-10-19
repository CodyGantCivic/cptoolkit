// CivicPlus Toolkit - detector bootstrap and compatibility shim
// Runs as the tiny static content script on approved CivicPlus hosts.
(function(root) {
  'use strict';

  if (root.__cpToolkitActivationBootstrapLoaded) return;
  root.__cpToolkitActivationBootstrapLoaded = true;

  var detector = root.CPToolkitDomDetector;
  if (!detector) return;

  var LANES = detector.lanes;
  var activationResult = null;
  var compatibleDetected = false;
  var compatibilityCallbacks = [];
  var activationStates = Object.create(null);
  var ACTIVATION_RETRY_DELAYS_MS = [0, 100, 300, 1000, 2000];
  var documentActivationId = [
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 8)
  ].join('-');
  var isTopFrame = false;

  try {
    isTopFrame = root.top === root.self;
  } catch (err) {
    isTopFrame = false;
  }

  function hasLane(result, lane) {
    return !!(result && Array.isArray(result.lanes) && result.lanes.indexOf(lane) !== -1);
  }

  function isIdentityHost() {
    var host = String(root.location && root.location.hostname || '').toLowerCase();
    return host === 'account.civicplus.com' || host === 'identityserver.cpqa.ninja';
  }

  function isImagePickerFrame() {
    if (isTopFrame) return false;
    var path = String(root.location && root.location.pathname || '').toLowerCase();
    return path.indexOf('/documentcenter/folderformodal') > -1 ||
      path.indexOf('/admin/documentcenter') > -1;
  }

  function isHiddenToolkitFrame() {
    try {
      if (!root.frameElement) return false;
      var frameStyle = root.frameElement.style;
      return !!(frameStyle && (
        parseInt(frameStyle.left, 10) < -999 ||
        parseInt(frameStyle.top, 10) < -999 ||
        frameStyle.opacity === '0' ||
        parseInt(frameStyle.width, 10) <= 1
      ));
    } catch (err) {
      return false;
    }
  }

  function runWhenBodyReady(callback) {
    if (typeof callback !== 'function') return;
    if (document.body || document.readyState !== 'loading') {
      callback();
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        callback();
      }, { once: true });
    }
  }

  function flushCompatibilityCallbacks() {
    if (!compatibleDetected) return;
    var callbacks = compatibilityCallbacks.splice(0);
    callbacks.forEach(function(callback) {
      runWhenBodyReady(callback);
    });
  }

  root.detect_if_cp_site = function(callback) {
    if (compatibleDetected) {
      runWhenBodyReady(callback);
      return;
    }
    if (typeof callback === 'function') compatibilityCallbacks.push(callback);
  };

  function markCompatible(result) {
    activationResult = result || activationResult;
    compatibleDetected = true;
    root._cpSiteDetected = true;
    root.__cpToolkitActivationResult = activationResult || null;
    flushCompatibilityCallbacks();
  }

  function updateActivationResult(result) {
    activationResult = result || activationResult;
    root.__cpToolkitActivationResult = activationResult || null;
    compatibleDetected = !!(
      (isImagePickerFrame() && !isHiddenToolkitFrame()) ||
      hasLane(activationResult, LANES.ADMIN) ||
      hasLane(activationResult, LANES.LIVE_EDIT) ||
      hasLane(activationResult, LANES.IDENTITY) ||
      hasLane(activationResult, LANES.ALL_PAGES_CP_HOST_CSS)
    );
    root._cpSiteDetected = compatibleDetected;
    flushCompatibilityCallbacks();
  }

  function classifyActivationResponse(response) {
    if (!response) return { status: 'retry', reason: 'missing-response' };
    if (response.error) return { status: 'retry', reason: response.error };

    var result = response.result || {};
    if (result.injected || result.duplicate || result.activated || result.registered) {
      return { status: 'complete', result: result };
    }
    if (result.pending) {
      return { status: 'retry', reason: 'injection-pending', result: result };
    }

    var skipped = result.skipped || '';
    if (skipped === 'target-unavailable') {
      return { status: 'retry', reason: skipped, result: result };
    }
    if (skipped) {
      return { status: 'terminal', reason: skipped, result: result };
    }

    return { status: 'retry', reason: 'unrecognized-response', result: result };
  }

  function exposeActivationState(key, state) {
    root.__cpToolkitActivationDeliveryState = root.__cpToolkitActivationDeliveryState || {};
    root.__cpToolkitActivationDeliveryState[key] = {
      status: state.status,
      attempt: state.attempt,
      reason: state.reason || '',
      lanes: state.payload && state.payload.lanes ? state.payload.lanes.slice() : [],
      activationId: documentActivationId
    };
  }

  function sendActivationAttempt(key) {
    var state = activationStates[key];
    if (!state || state.status === 'complete' || state.status === 'terminal') return;

    var delay = ACTIVATION_RETRY_DELAYS_MS[state.attempt];
    if (typeof delay !== 'number') {
      state.status = 'exhausted';
      state.reason = state.reason || 'retry-limit-reached';
      exposeActivationState(key, state);
      console.warn('[CP Toolkit] Activation delivery exhausted:', key, state.reason);
      return;
    }

    state.status = state.attempt === 0 ? 'sending' : 'retrying';
    exposeActivationState(key, state);

    state.timer = root.setTimeout(function() {
      state.timer = null;
      state.attempt += 1;

      var response;
      try {
        response = chrome.runtime.sendMessage(state.payload);
      } catch (err) {
        state.reason = err && err.message ? err.message : String(err || 'send-failed');
        exposeActivationState(key, state);
        sendActivationAttempt(key);
        return;
      }

      Promise.resolve(response).then(function(value) {
        var outcome = classifyActivationResponse(value);
        state.status = outcome.status;
        state.reason = outcome.reason || '';
        state.result = outcome.result || null;
        exposeActivationState(key, state);

        if (outcome.status === 'retry') {
          sendActivationAttempt(key);
        }
      }).catch(function(error) {
        state.status = 'retry';
        state.reason = error && error.message ? error.message : String(error || 'send-failed');
        exposeActivationState(key, state);
        sendActivationAttempt(key);
      });
    }, delay);
  }

  function sendActivation(key, payload) {
    var existing = activationStates[key];
    if (existing && existing.status !== 'exhausted') return;

    var nextPayload = Object.assign({}, payload, {
      activationId: documentActivationId
    });
    activationStates[key] = {
      status: 'pending',
      attempt: 0,
      reason: '',
      payload: nextPayload,
      timer: null,
      result: null
    };
    exposeActivationState(key, activationStates[key]);
    sendActivationAttempt(key);
  }

  function sendLaneActivations(result, reason) {
    if (!result || !Array.isArray(result.lanes)) return;

    if (isImagePickerFrame() && !isHiddenToolkitFrame()) {
      markCompatible(result);
      sendActivation('image-picker-frame', {
        action: 'cp-toolkit-activation-detected',
        activationKind: 'image-picker-frame',
        lanes: [],
        reason: reason || 'image-picker-frame'
      });
      return;
    }

    if (!isTopFrame) return;

    if (hasLane(result, LANES.IDENTITY)) {
      sendActivation('identity', {
        action: 'cp-toolkit-activation-detected',
        activationKind: 'identity',
        lanes: [LANES.IDENTITY],
        reason: reason || 'identity'
      });
    }

    if (hasLane(result, LANES.ALL_PAGES_CP_HOST_CSS) && !isIdentityHost()) {
      sendActivation('all-pages-cp-host-css', {
        action: 'cp-toolkit-activation-detected',
        activationKind: 'all-pages-cp-host-css',
        lanes: [LANES.ALL_PAGES_CP_HOST_CSS],
        reason: reason || 'all-pages-cp-host-css'
      });
    }

    var fullLanes = [];
    if (hasLane(result, LANES.ADMIN)) fullLanes.push(LANES.ADMIN);
    if (hasLane(result, LANES.LIVE_EDIT)) fullLanes.push(LANES.LIVE_EDIT);
    if (fullLanes.length > 0) {
      sendActivation('full-toolkit', {
        action: 'cp-toolkit-activation-detected',
        activationKind: 'full-toolkit',
        lanes: fullLanes,
        reason: reason || 'full-toolkit'
      });
    }
  }

  var immediateResult = detector.evaluatePage();
  updateActivationResult(immediateResult);
  sendLaneActivations(immediateResult, 'initial');

  // On admin and Design Center URLs, wait for the Admin lane specifically.
  // A single Live Edit marker (e.g. the "Live Edit is Off" nav item) is enough
  // to detect Live Edit as soon as the top of the page parses, which can
  // happen before the Admin evidence does. Resolving on that alone loads only
  // the Live Edit tool set and never reconsiders, so Admin-only tools go
  // missing on some refreshes. If Admin never shows up, the detector's
  // deadline still returns whatever lanes are present.
  var pageLocation = (immediateResult && immediateResult.location) || {};
  var expectsAdminLane = !!(pageLocation.isAdminPath || pageLocation.isDesignCenterPath);
  var waitTargetLanes = expectsAdminLane
    ? [LANES.ADMIN, LANES.IDENTITY]
    : [LANES.ADMIN, LANES.LIVE_EDIT, LANES.IDENTITY];

  detector.waitForDetection({
    targetLanes: waitTargetLanes,
    timeoutMs: detector.defaultTimeoutMs
  }).then(function(result) {
    updateActivationResult(result);
    sendLaneActivations(result, 'detected');
  }).catch(function() {
    root._cpSiteDetected = false;
  });
})(typeof self !== 'undefined' ? self : window);
