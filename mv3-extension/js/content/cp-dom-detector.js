// CivicPlus Toolkit - bounded DOM marker detector
// Future manifest work will run this as the tiny static detector before loading
// jQuery or the full toolkit on approved origins.
(function(root) {
  'use strict';

  var LANES = Object.freeze({
    ADMIN: 'admin',
    LIVE_EDIT: 'live-edit',
    ALL_PAGES_CP_HOST_CSS: 'all-pages-cp-host-css',
    IDENTITY: 'identity'
  });

  var DEFAULT_TIMEOUT_MS = 7000;
  var TOOLKIT_PREFIX = 'cp-toolkit';
  var KNOWN_PLATFORM_SUFFIXES = [
    '.civicplus.com',
    '.civic.place',
    '.civicplus.pro',
    '.cpqa.ninja'
  ];
  var KNOWN_PLATFORM_HOSTS = [
    'civicplus.com',
    'civic.place',
    'civicplus.pro',
    'cpqa.ninja',
    'account.civicplus.com',
    'identityserver.cpqa.ninja'
  ];

  var SHELL_SELECTORS = [
    '#aspnetForm',
    'form[name="aspnetForm"]',
    '#ctl00_ctl00_adminHeader_headerTitle',
    '#adminHeader',
    '.cp-AdminWrap',
    '.cp-Toolbar',
    '.cp-Toolbar-menu',
    '.cp-AdminMenu',
    '.wayfinder',
    '.cp-UIMessage'
  ];

  var LIVE_EDIT_SELECTORS = [
    'body.liveEditOn',
    '#LiveEditCSS',
    '#liveEditToolbar',
    '.liveEditOn',
    '.liveEditToolbar',
    '[data-cprole]'
  ];

  var FORM_SELECTORS = [
    'input[name="__VIEWSTATE"]',
    'input[name="__EVENTVALIDATION"]',
    'input[name^="ctl00$"]',
    'input[name="cpAction"]',
    'input[name="intTriggeredFrom"]',
    'input[name="intWhatDisplay"]'
  ];

  var ASSET_PATTERNS = [
    /\/Assets\/Mystique\//i,
    /\/Assets\/Admin\//i,
    /\/DesignCenter\//i,
    /\/Admin\//i,
    /\/Scripts\/.*(?:CivicPlus|cp-)/i,
    /civicplus/i
  ];

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function normalizeHostname(hostname) {
    return String(hostname || '').toLowerCase().replace(/\.$/, '');
  }

  function isKnownPlatformHost(hostname) {
    var host = normalizeHostname(hostname);
    if (!host) return false;
    if (KNOWN_PLATFORM_HOSTS.indexOf(host) !== -1) return true;
    return KNOWN_PLATFORM_SUFFIXES.some(function(suffix) {
      return host.endsWith(suffix);
    });
  }

  function getLocationInfo(locationLike) {
    var pathname = String(locationLike && locationLike.pathname || '/');
    var normalizedPath = pathname.toLowerCase();
    var hostname = normalizeHostname(locationLike && locationLike.hostname);

    return {
      hostname: hostname,
      pathname: pathname,
      isAdminPath: /^\/admin(?:\/|$)/i.test(pathname),
      isDesignCenterPath: /^\/(?:admin\/)?designcenter(?:\/|$)/i.test(pathname),
      isSamlLoginPath: normalizedPath.indexOf('/admin/saml/logonrequest') === 0,
      isIdentityPath: (
        (hostname === 'account.civicplus.com' || hostname === 'identityserver.cpqa.ninja') &&
        normalizedPath.indexOf('/identity/') === 0
      ),
      isKnownPlatformHost: isKnownPlatformHost(hostname)
    };
  }

  function safeQueryAll(doc, selector) {
    if (!doc || typeof doc.querySelectorAll !== 'function') return [];
    try {
      return Array.prototype.slice.call(doc.querySelectorAll(selector));
    } catch (err) {
      return [];
    }
  }

  function getClassText(el) {
    if (!el) return '';
    if (typeof el.className === 'string') return el.className;
    if (el.className && typeof el.className.baseVal === 'string') return el.className.baseVal;
    return '';
  }

  function isToolkitOwnedElement(el) {
    if (!el) return false;
    var id = String(el.id || '').toLowerCase();
    var classText = getClassText(el).toLowerCase();
    if (id.indexOf(TOOLKIT_PREFIX) === 0 || classText.indexOf(TOOLKIT_PREFIX + '-') !== -1) {
      return true;
    }
    if (typeof el.closest === 'function') {
      try {
        return !!el.closest('[id^="' + TOOLKIT_PREFIX + '"], [class*="' + TOOLKIT_PREFIX + '-"]');
      } catch (err) {
        return false;
      }
    }
    return false;
  }

  function labelElement(el, fallback) {
    if (!el) return fallback;
    if (el.id) return '#' + el.id;
    var classText = getClassText(el).trim();
    if (classText) return String(el.tagName || 'element').toLowerCase() + '.' + classText.split(/\s+/).slice(0, 2).join('.');
    return String(el.tagName || fallback || 'element').toLowerCase();
  }

  function pushMarker(result, category, marker) {
    if (!result.markers[category]) result.markers[category] = [];
    if (result.categories.indexOf(category) === -1) result.categories.push(category);
    result.markers[category].push(marker);
  }

  function collectSelectorMarkers(result, doc, category, selectors) {
    selectors.forEach(function(selector) {
      var matches = safeQueryAll(doc, selector).filter(function(el) {
        return !isToolkitOwnedElement(el);
      });
      if (matches.length > 0) {
        pushMarker(result, category, {
          selector: selector,
          sample: labelElement(matches[0], selector),
          count: matches.length
        });
      }
    });
  }

  function collectAssetMarkers(result, doc) {
    safeQueryAll(doc, 'script[src], link[href], img[src]').forEach(function(el) {
      if (isToolkitOwnedElement(el)) return;
      var value = el.getAttribute('src') || el.getAttribute('href') || '';
      if (!value) return;
      var matched = ASSET_PATTERNS.some(function(pattern) {
        return pattern.test(value);
      });
      if (matched) {
        pushMarker(result, 'asset', {
          sample: labelElement(el, 'asset'),
          value: value.slice(0, 250)
        });
      }
    });
  }

  function addPathAndHostMarkers(result, locationInfo) {
    if (locationInfo.isKnownPlatformHost) {
      pushMarker(result, 'host', { hostname: locationInfo.hostname });
    }
    if (locationInfo.isAdminPath) {
      pushMarker(result, 'path', { type: 'admin', pathname: locationInfo.pathname });
    }
    if (locationInfo.isDesignCenterPath) {
      pushMarker(result, 'path', { type: 'design-center', pathname: locationInfo.pathname });
    }
    if (locationInfo.isSamlLoginPath) {
      pushMarker(result, 'path', { type: 'saml-login', pathname: locationInfo.pathname });
    }
    if (locationInfo.isIdentityPath) {
      pushMarker(result, 'path', { type: 'identity', pathname: locationInfo.pathname });
    }
  }

  function hasCategory(result, category) {
    return !!(result.markers[category] && result.markers[category].length > 0);
  }

  function addLane(result, lane) {
    if (result.lanes.indexOf(lane) === -1) result.lanes.push(lane);
  }

  function calculateLanes(result, locationInfo) {
    var hasPath = hasCategory(result, 'path');
    var hasShell = hasCategory(result, 'shell');
    var hasAsset = hasCategory(result, 'asset');
    var hasForm = hasCategory(result, 'form');
    var hasLiveEdit = hasCategory(result, 'liveEdit');
    var adminPath = locationInfo.isAdminPath || locationInfo.isDesignCenterPath;
    var identityPath = locationInfo.isSamlLoginPath || locationInfo.isIdentityPath;

    var adminScore = 0;
    if (adminPath) adminScore += 3;
    if (hasShell) adminScore += 3;
    if (hasAsset) adminScore += 2;
    if (hasForm) adminScore += 2;

    var liveEditScore = 0;
    if (hasLiveEdit) liveEditScore += 4;
    if (hasAsset) liveEditScore += 2;
    if (locationInfo.isKnownPlatformHost) liveEditScore += 1;
    if (hasForm) liveEditScore += 1;

    result.scores.admin = adminScore;
    result.scores.liveEdit = liveEditScore;
    result.scores.identity = identityPath ? 5 : 0;
    result.scores.allPagesCpHostCss = locationInfo.isKnownPlatformHost ? 1 : 0;

    if (identityPath) addLane(result, LANES.IDENTITY);
    if (adminPath && hasPath && (hasShell || hasAsset || hasForm) && adminScore >= 5) {
      addLane(result, LANES.ADMIN);
    }
    if (hasLiveEdit && (hasAsset || hasForm || locationInfo.isKnownPlatformHost) && liveEditScore >= 5) {
      addLane(result, LANES.LIVE_EDIT);
    }
    if (locationInfo.isKnownPlatformHost) addLane(result, LANES.ALL_PAGES_CP_HOST_CSS);

    result.fullToolkitDetected = (
      result.lanes.indexOf(LANES.ADMIN) !== -1 ||
      result.lanes.indexOf(LANES.LIVE_EDIT) !== -1 ||
      result.lanes.indexOf(LANES.IDENTITY) !== -1
    );
    result.detected = result.fullToolkitDetected;
  }

  function evaluatePage(context) {
    var doc = context && context.document || root.document;
    var loc = context && context.location || root.location || {};
    var locationInfo = getLocationInfo(loc);
    var result = {
      detected: false,
      fullToolkitDetected: false,
      lanes: [],
      categories: [],
      markers: {},
      scores: {},
      location: locationInfo
    };

    addPathAndHostMarkers(result, locationInfo);
    collectSelectorMarkers(result, doc, 'shell', SHELL_SELECTORS);
    collectSelectorMarkers(result, doc, 'liveEdit', LIVE_EDIT_SELECTORS);
    collectSelectorMarkers(result, doc, 'form', FORM_SELECTORS);
    collectAssetMarkers(result, doc);
    calculateLanes(result, locationInfo);
    return result;
  }

  function resultHasTargetLane(result, targetLanes) {
    return targetLanes.some(function(lane) {
      return result.lanes.indexOf(lane) !== -1;
    });
  }

  function waitForDetection(options) {
    options = options || {};
    var doc = options.document || root.document;
    var targetLanes = options.targetLanes || [LANES.ADMIN, LANES.LIVE_EDIT, LANES.IDENTITY];
    var timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : DEFAULT_TIMEOUT_MS;

    return new Promise(function(resolve) {
      if (!doc) {
        resolve(evaluatePage({ document: doc, location: options.location || root.location }));
        return;
      }

      var observer = null;
      var rafPending = false;
      var settled = false;
      var lastResult = null;

      function cleanup() {
        settled = true;
        if (observer) observer.disconnect();
      }

      function check() {
        rafPending = false;
        if (settled) return;

        lastResult = evaluatePage({
          document: doc,
          location: options.location || root.location
        });
        if (typeof options.onUpdate === 'function') options.onUpdate(lastResult);

        if (resultHasTargetLane(lastResult, targetLanes)) {
          cleanup();
          resolve(lastResult);
        }
      }

      function scheduleCheck() {
        if (rafPending || settled) return;
        rafPending = true;
        var raf = root.requestAnimationFrame || function(callback) { return setTimeout(callback, 16); };
        raf(check);
      }

      check();
      if (settled) return;

      if (typeof root.MutationObserver === 'function') {
        observer = new root.MutationObserver(scheduleCheck);
        observer.observe(doc.documentElement || doc, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ['class', 'id', 'src', 'href']
        });
      }

      setTimeout(function() {
        if (settled) return;
        cleanup();
        resolve(lastResult || evaluatePage({
          document: doc,
          location: options.location || root.location
        }));
      }, timeoutMs);
    });
  }

  root.CPToolkitDomDetector = Object.freeze({
    version: '2026-07-14',
    lanes: LANES,
    defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
    knownPlatformHosts: KNOWN_PLATFORM_HOSTS.slice(),
    knownPlatformSuffixes: KNOWN_PLATFORM_SUFFIXES.slice(),
    evaluatePage: evaluatePage,
    waitForDetection: waitForDetection,
    isKnownPlatformHost: isKnownPlatformHost
  });
})(typeof self !== 'undefined' ? self : globalThis);
