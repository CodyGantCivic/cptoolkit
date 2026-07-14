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
  var sentKeys = Object.create(null);
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

  function sendActivation(key, payload) {
    if (sentKeys[key]) return;
    sentKeys[key] = true;
    try {
      var response = chrome.runtime.sendMessage(payload);
      if (response && typeof response.catch === 'function') {
        response.catch(function() {});
      }
    } catch (err) {}
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

  detector.waitForDetection({
    targetLanes: [LANES.ADMIN, LANES.LIVE_EDIT, LANES.IDENTITY],
    timeoutMs: detector.defaultTimeoutMs
  }).then(function(result) {
    updateActivationResult(result);
    sendLaneActivations(result, 'detected');
  }).catch(function() {
    root._cpSiteDetected = false;
  });
})(typeof self !== 'undefined' ? self : window);
