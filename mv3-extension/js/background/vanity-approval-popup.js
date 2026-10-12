// CivicPlus Toolkit - automatic approval popup for vanity domains
//
// On a site the extension has no access to, the only signal available without
// injecting anything is the URL. When a top-level navigation lands on a CivicPlus
// admin or Design Center path on an unapproved https site, open the toolbar
// popup so the user can approve or deny the domain before anything runs there.
(function(root) {
  'use strict';

  var DISMISSED_KEY = 'cp-toolkit-vanity-dismissed-hosts';
  var SNOOZED_KEY = 'cp-toolkit-vanity-snoozed-hosts';
  var ADMIN_PATH = /^\/(?:admin|designcenter)(?:\/|$)/i;

  var KNOWN_PLATFORM_SUFFIXES = ['.civicplus.com', '.civic.place', '.civicplus.pro', '.cpqa.ninja'];
  var KNOWN_PLATFORM_HOSTS = [
    'civicplus.com', 'civic.place', 'civicplus.pro', 'cpqa.ninja',
    'account.civicplus.com', 'identityserver.cpqa.ninja'
  ];

  function normalizeHostname(hostname) {
    return String(hostname || '').toLowerCase().replace(/\.$/, '');
  }

  function isKnownPlatformHost(host) {
    if (KNOWN_PLATFORM_HOSTS.indexOf(host) !== -1) return true;
    return KNOWN_PLATFORM_SUFFIXES.some(function(suffix) { return host.endsWith(suffix); });
  }

  // Returns { host, originPattern } when the URL is an admin-looking path on an
  // https site that isn't a known CivicPlus platform host; otherwise null.
  function getCandidate(url) {
    try {
      var parsed = new URL(url);
      var host = normalizeHostname(parsed.hostname);
      if (parsed.protocol !== 'https:' || !host || host.indexOf('*') !== -1) return null;
      if (isKnownPlatformHost(host)) return null;
      if (!ADMIN_PATH.test(parsed.pathname)) return null;
      return { host: host, originPattern: 'https://' + host + '/*' };
    } catch (err) {
      return null;
    }
  }

  function listContains(storage, key, host) {
    return storage.get(key).then(function(settings) {
      var list = settings && settings[key];
      return Array.isArray(list) && list.indexOf(host) !== -1;
    });
  }

  function shouldPrompt(candidate) {
    return chrome.permissions.contains({ origins: [candidate.originPattern] }).then(function(granted) {
      if (granted) return false;
      return listContains(chrome.storage.local, DISMISSED_KEY, candidate.host).then(function(dismissed) {
        if (dismissed) return false;
        var sessionStorage = chrome.storage.session || chrome.storage.local;
        return listContains(sessionStorage, SNOOZED_KEY, candidate.host).then(function(snoozed) {
          return !snoozed;
        });
      });
    });
  }

  function openApprovalPopup(details) {
    var candidate = getCandidate(details.url);
    if (!candidate) return;

    shouldPrompt(candidate).then(function(prompt) {
      if (!prompt) return null;
      return chrome.tabs.get(details.tabId).then(function(tab) {
        // openPopup targets the active tab of a window; skip background tabs.
        if (!tab || !tab.active) return null;
        return chrome.action.openPopup({ windowId: tab.windowId });
      });
    }).catch(function(error) {
      console.log('[CP Toolkit] Vanity approval popup not opened:', error && error.message ? error.message : error);
    });
  }

  if (chrome.webNavigation && chrome.webNavigation.onCompleted && chrome.action && chrome.action.openPopup) {
    chrome.webNavigation.onCompleted.addListener(function(details) {
      if (details.frameId !== 0) return;
      openApprovalPopup(details);
    }, { url: [{ schemes: ['https'], pathPrefix: '/' }] });
  }

  root.CPToolkitVanityApprovalPopup = Object.freeze({
    getCandidate: getCandidate,
    DISMISSED_KEY: DISMISSED_KEY,
    SNOOZED_KEY: SNOOZED_KEY
  });
})(self);
