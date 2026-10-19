// CivicPlus Toolkit - automatic approval popup for vanity domains
//
// On a site the extension has no access to, the only signal available without
// injecting anything is the URL. When a tab lands on a CivicPlus admin or Design
// Center path on an unapproved https site, open the toolbar popup so the user
// can approve or deny the domain before anything runs there.
//
// Chrome closes an extension popup the moment it loses focus (for example when
// the user alt-tabs), and that cannot be prevented. So "handled" is decided by
// the user's own answer (Trust or "Don't ask again"), not by the popup having
// opened. A popup that closed unanswered is reopened when the user comes back
// to the tab or window, a limited number of times.
(function(root) {
  'use strict';

  var DISMISSED_KEY = 'cp-toolkit-vanity-dismissed-hosts';   // local: user chose never ask
  var CONTEXT_KEY = 'cp-toolkit-vanity-popup-context';       // session: { [tabId]: { url, host } }
  var ATTEMPTS_KEY = 'cp-toolkit-vanity-popup-attempts';     // session: { [host]: { count, lastAt } }

  var MAX_AUTO_OPENS_PER_HOST = 3;   // per browser session
  var MIN_GAP_MS = 15000;            // between automatic opens for the same host
  var ADMIN_PATH = /^\/(?:admin|designcenter)(?:\/|$)/i;

  var KNOWN_PLATFORM_SUFFIXES = ['.civicplus.com', '.civic.place', '.civicplus.pro', '.cpqa.ninja'];
  var KNOWN_PLATFORM_HOSTS = [
    'civicplus.com', 'civic.place', 'civicplus.pro', 'cpqa.ninja',
    'account.civicplus.com', 'identityserver.cpqa.ninja'
  ];

  var inFlightTabs = {};

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

  function sessionStore() {
    return chrome.storage.session || chrome.storage.local;
  }

  function readMap(storage, key) {
    return storage.get(key).then(function(settings) {
      var value = settings && settings[key];
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    });
  }

  function writeMap(storage, key, value) {
    return storage.set({ [key]: value });
  }

  function isDismissed(host) {
    return chrome.storage.local.get(DISMISSED_KEY).then(function(settings) {
      var list = settings && settings[DISMISSED_KEY];
      return Array.isArray(list) && list.indexOf(host) !== -1;
    });
  }

  // Remember which URL each tab is on. An automatically opened popup has no
  // activeTab grant, so Chrome hides the tab's URL from it; this is how the
  // popup and the trust step learn the URL. It lasts as long as the tab does.
  function recordContext(tabId, candidate, url) {
    var store = sessionStore();
    return readMap(store, CONTEXT_KEY).then(function(map) {
      map[String(tabId)] = { url: url, host: candidate.host };
      return writeMap(store, CONTEXT_KEY, map);
    });
  }

  function clearContext(tabId) {
    var store = sessionStore();
    return readMap(store, CONTEXT_KEY).then(function(map) {
      if (!map[String(tabId)]) return null;
      delete map[String(tabId)];
      return writeMap(store, CONTEXT_KEY, map);
    });
  }

  function getAttempt(host) {
    return readMap(sessionStore(), ATTEMPTS_KEY).then(function(map) {
      return map[host] || { count: 0, lastAt: 0 };
    });
  }

  function setAttempt(host, attempt) {
    var store = sessionStore();
    return readMap(store, ATTEMPTS_KEY).then(function(map) {
      map[host] = attempt;
      return writeMap(store, ATTEMPTS_KEY, map);
    });
  }

  // Open the popup for this tab if it still needs an answer and the browser
  // can show it right now (tab visible, window focused).
  function tryOpenForTab(tabId) {
    if (inFlightTabs[tabId]) return Promise.resolve(false);
    inFlightTabs[tabId] = true;

    return readMap(sessionStore(), CONTEXT_KEY).then(function(map) {
      var context = map[String(tabId)];
      var candidate = context && getCandidate(context.url);
      if (!candidate) return false;

      return chrome.permissions.contains({ origins: [candidate.originPattern] }).then(function(granted) {
        if (granted) return false;
        return isDismissed(candidate.host).then(function(dismissed) {
          if (dismissed) return false;
          return getAttempt(candidate.host).then(function(attempt) {
            var now = Date.now();
            if (attempt.count >= MAX_AUTO_OPENS_PER_HOST) return false;
            if (now - attempt.lastAt < MIN_GAP_MS) return false;

            return chrome.tabs.get(tabId).then(function(tab) {
              // openPopup targets the active tab of a window.
              if (!tab || !tab.active) return false;
              return chrome.windows.get(tab.windowId).then(function(win) {
                if (!win || !win.focused) return false;

                // Count the attempt first so overlapping triggers can't open
                // it twice, and give it back if Chrome refuses to open it.
                return setAttempt(candidate.host, { count: attempt.count + 1, lastAt: now }).then(function() {
                  return chrome.action.openPopup({ windowId: tab.windowId }).then(function() {
                    return true;
                  }, function(error) {
                    return setAttempt(candidate.host, attempt).then(function() {
                      throw error;
                    });
                  });
                });
              });
            });
          });
        });
      });
    }).catch(function(error) {
      console.log('[CP Toolkit] Vanity approval popup not opened:', error && error.message ? error.message : error);
      return false;
    }).then(function(opened) {
      delete inFlightTabs[tabId];
      return opened;
    });
  }

  function handleNavigation(details) {
    if (details.frameId !== 0) return;

    var candidate = getCandidate(details.url);
    if (!candidate) {
      // The tab moved away from an admin-looking page; nothing to ask about.
      clearContext(details.tabId).catch(function() {});
      return;
    }

    recordContext(details.tabId, candidate, details.url).then(function() {
      return tryOpenForTab(details.tabId);
    }).catch(function(error) {
      console.log('[CP Toolkit] Vanity approval popup not opened:', error && error.message ? error.message : error);
    });
  }

  function tryOpenForActiveTab(windowId) {
    if (typeof windowId !== 'number' || windowId < 0) return;
    chrome.tabs.query({ active: true, windowId: windowId }).then(function(tabs) {
      if (tabs && tabs[0] && typeof tabs[0].id === 'number') tryOpenForTab(tabs[0].id);
    }).catch(function() {});
  }

  if (chrome.webNavigation && chrome.action && chrome.action.openPopup) {
    var navigationFilter = { url: [{ schemes: ['https'], pathPrefix: '/' }] };

    // A full page load, and in-page navigations that never reload the page.
    chrome.webNavigation.onCompleted.addListener(handleNavigation, navigationFilter);
    if (chrome.webNavigation.onHistoryStateUpdated) {
      chrome.webNavigation.onHistoryStateUpdated.addListener(handleNavigation, navigationFilter);
    }

    // Come back to an unanswered prompt: switching to the tab, or returning to
    // the browser window after alt-tabbing away.
    if (chrome.tabs && chrome.tabs.onActivated) {
      chrome.tabs.onActivated.addListener(function(info) {
        tryOpenForTab(info.tabId);
      });
    }
    if (chrome.windows && chrome.windows.onFocusChanged) {
      chrome.windows.onFocusChanged.addListener(tryOpenForActiveTab);
    }
    if (chrome.tabs && chrome.tabs.onRemoved) {
      chrome.tabs.onRemoved.addListener(function(tabId) {
        delete inFlightTabs[tabId];
        clearContext(tabId).catch(function() {});
      });
    }
  }

  root.CPToolkitVanityApprovalPopup = Object.freeze({
    getCandidate: getCandidate,
    DISMISSED_KEY: DISMISSED_KEY,
    CONTEXT_KEY: CONTEXT_KEY
  });
})(self);
