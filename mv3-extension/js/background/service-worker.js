// CivicPlus Toolkit - Service Worker (MV3)
// Version 1.1.0

console.log('[CP Toolkit] Service worker initializing...');

// Import modules
importScripts('context-menus.js');
importScripts('first-run.js');

console.log('[CP Toolkit] Service worker initialized');

var MCP_CAPTURE_KEY = 'mcp-capture-enabled';
var MCP_DEFAULT_COLLECT_URL = 'http://localhost:9001/collect';
var MCP_MAX_RECENT_CAPTURES = 25;
var MCP_CAPTURE_MAX_EVENTS_KEY = 'mcp-capture-max-events';
var MCP_CAPTURE_ALLOW_REMOTE_UPLOAD_KEY = 'mcp-capture-allow-remote-upload';
var MCP_CAPTURE_INCLUDE_RESPONSE_BODIES_KEY = 'mcp-capture-include-response-bodies';
var MCP_CAPTURE_CONFIG_DEFAULTS = {
  maxEvents: 800,
  allowRemoteUpload: false,
  includeResponseBodies: false
};
var _mcpCaptureConfig = {
  maxEvents: MCP_CAPTURE_CONFIG_DEFAULTS.maxEvents,
  allowRemoteUpload: MCP_CAPTURE_CONFIG_DEFAULTS.allowRemoteUpload,
  includeResponseBodies: MCP_CAPTURE_CONFIG_DEFAULTS.includeResponseBodies
};
var _mcpSessionsByTab = {};
var _mcpRecentCaptures = [];

function createCaptureId() {
  return 'cp-capture-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
}

function toIsoNow() {
  return new Date().toISOString();
}

function sanitizeMaxEvents(value) {
  var n = Number(value);
  if (!Number.isFinite(n)) return MCP_CAPTURE_CONFIG_DEFAULTS.maxEvents;
  n = Math.floor(n);
  if (n < 100) return 100;
  if (n > 5000) return 5000;
  return n;
}

function applyCaptureConfigFromSettings(settings) {
  _mcpCaptureConfig.maxEvents = sanitizeMaxEvents(settings[MCP_CAPTURE_MAX_EVENTS_KEY]);
  _mcpCaptureConfig.allowRemoteUpload = !!settings[MCP_CAPTURE_ALLOW_REMOTE_UPLOAD_KEY];
  _mcpCaptureConfig.includeResponseBodies = !!settings[MCP_CAPTURE_INCLUDE_RESPONSE_BODIES_KEY];
}

function loadCaptureConfig() {
  var keys = [
    MCP_CAPTURE_MAX_EVENTS_KEY,
    MCP_CAPTURE_ALLOW_REMOTE_UPLOAD_KEY,
    MCP_CAPTURE_INCLUDE_RESPONSE_BODIES_KEY
  ];
  chrome.storage.local.get(keys, function(settings) {
    applyCaptureConfigFromSettings(settings || {});
  });
}

function isLocalCollectorEndpoint(endpoint) {
  try {
    var parsed = new URL(endpoint);
    var host = (parsed.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch (e) {
    return false;
  }
}

function getOrCreateCaptureSession(tabId, page) {
  if (!_mcpSessionsByTab[tabId]) {
    _mcpSessionsByTab[tabId] = {
      captureId: createCaptureId(),
      tabId: tabId,
      startedAt: toIsoNow(),
      lastEventAt: null,
      page: {
        url: page && page.url ? page.url : '',
        title: page && page.title ? page.title : ''
      },
      events: []
    };
  } else if (page && page.url) {
    _mcpSessionsByTab[tabId].page.url = page.url;
    if (page.title) _mcpSessionsByTab[tabId].page.title = page.title;
  }
  return _mcpSessionsByTab[tabId];
}

function appendCaptureEvent(tabId, event, page) {
  var session = getOrCreateCaptureSession(tabId, page);
  session.lastEventAt = toIsoNow();

  if (!event || typeof event !== 'object') return session;
  session.events.push(event);
  if (session.events.length > _mcpCaptureConfig.maxEvents) {
    session.events.shift();
  }
  return session;
}

function captureStats(events) {
  var stats = {
    eventCount: events.length,
    networkRequestCount: 0,
    networkErrorCount: 0,
    jsErrorCount: 0
  };

  for (var i = 0; i < events.length; i++) {
    var evtType = events[i] && events[i].type ? events[i].type : '';
    if (evtType === 'network-request') stats.networkRequestCount += 1;
    if (evtType === 'network-error') stats.networkErrorCount += 1;
    if (evtType === 'js-error' || evtType === 'js-unhandled-rejection') stats.jsErrorCount += 1;
  }

  return stats;
}

function buildCapturePayload(tabId) {
  var session = _mcpSessionsByTab[tabId];
  if (!session) {
    return {
      captureId: createCaptureId(),
      generatedAt: toIsoNow(),
      source: 'cp-toolkit-mv3',
      tab: { id: tabId || null, url: '', title: '' },
      session: { startedAt: null, lastEventAt: null },
      stats: captureStats([]),
      events: []
    };
  }

  var events = session.events.slice();
  var capture = {
    captureId: session.captureId,
    generatedAt: toIsoNow(),
    source: 'cp-toolkit-mv3',
    tab: {
      id: session.tabId,
      url: session.page && session.page.url ? session.page.url : '',
      title: session.page && session.page.title ? session.page.title : ''
    },
    session: {
      startedAt: session.startedAt,
      lastEventAt: session.lastEventAt
    },
    stats: captureStats(events),
    events: events
  };

  _mcpRecentCaptures.unshift({
    captureId: capture.captureId,
    generatedAt: capture.generatedAt,
    tabId: capture.tab.id,
    url: capture.tab.url,
    eventCount: capture.stats.eventCount
  });
  if (_mcpRecentCaptures.length > MCP_MAX_RECENT_CAPTURES) {
    _mcpRecentCaptures.pop();
  }

  return capture;
}

function encodeDownloadData(data) {
  return 'data:application/json;charset=utf-8,' + encodeURIComponent(data);
}

function buildCaptureFilename(captureId) {
  return 'cp-toolkit/' + captureId + '.json';
}

function injectMcpInstrumenter(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId: tabId },
    world: 'MAIN',
    files: ['js/inject/page-instrument.js']
  });
}

function setCaptureEnabled(enabled, tabId, callback) {
  var payload = {};
  payload[MCP_CAPTURE_KEY] = !!enabled;
  chrome.storage.local.set(payload, function() {
    if (!tabId || tabId === chrome.tabs.TAB_ID_NONE) {
      callback({ success: false, error: 'No tab selected' });
      return;
    }

    if (enabled) {
      injectMcpInstrumenter(tabId)
        .catch(function() {})
        .finally(function() {
          chrome.tabs.sendMessage(tabId, {
            action: 'cp-mcp-set-enabled',
            enabled: true,
            config: {
              includeResponseBodies: _mcpCaptureConfig.includeResponseBodies
            }
          }).catch(function() {});
          getOrCreateCaptureSession(tabId, null);
          callback({ success: true, enabled: true });
        });
    } else {
      chrome.tabs.sendMessage(tabId, {
        action: 'cp-mcp-set-enabled',
        enabled: false,
        config: {
          includeResponseBodies: _mcpCaptureConfig.includeResponseBodies
        }
      }).catch(function() {});
      callback({ success: true, enabled: false });
    }
  });
}

function getCaptureStatus(tabId, callback) {
  chrome.storage.local.get(MCP_CAPTURE_KEY, function(settings) {
    var enabled = !!settings[MCP_CAPTURE_KEY];
    var session = _mcpSessionsByTab[tabId];
    callback({
      success: true,
      enabled: enabled,
      sessionId: session ? session.captureId : null,
      eventCount: session ? session.events.length : 0,
      lastEventAt: session ? session.lastEventAt : null,
      recentCaptures: _mcpRecentCaptures.slice(0, 5)
    });
  });
}

function requestDomSnapshot(tabId) {
  return new Promise(function(resolve) {
    if (!tabId || tabId === chrome.tabs.TAB_ID_NONE) {
      resolve(false);
      return;
    }
    chrome.tabs.sendMessage(tabId, { action: 'cp-mcp-dom-snapshot' })
      .then(function() {
        setTimeout(function() { resolve(true); }, 350);
      })
      .catch(function() {
        resolve(false);
      });
  });
}

function uploadCapture(endpoint, capture) {
  return fetch(endpoint || MCP_DEFAULT_COLLECT_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ capture: capture })
  }).then(function(response) {
    return response.json().catch(function() { return null; }).then(function(payload) {
      return {
        ok: response.ok,
        status: response.status,
        payload: payload
      };
    });
  });
}

function resolveTabId(message, sender, callback) {
  if (message && message.tabId) {
    callback(message.tabId);
    return;
  }
  if (sender && sender.tab && sender.tab.id) {
    callback(sender.tab.id);
    return;
  }
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    callback(tabs && tabs[0] ? tabs[0].id : null);
  });
}

// Installation event - delegate to first-run handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[CP Toolkit] Extension installed/updated:', details.reason);
  
  // Use the first-run handler for install/update logic
  if (self.firstRunHandler && self.firstRunHandler.onInstalledHandler) {
    self.firstRunHandler.onInstalledHandler(details);
  } else {
    console.error('[CP Toolkit] First-run handler not loaded!');
  }
});

// Prevent-timeout alarm: fires every 2 minutes to notify content scripts.
// Uses chrome.alarms because content script setInterval gets throttled in background tabs (Chrome 88+).
// Content scripts check for the Session Timeout modal and click "Refresh Session" if visible.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cp-prevent-timeout') {
    chrome.storage.local.get('prevent-timeout', (settings) => {
      if (settings['prevent-timeout'] === false) return;

      chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
        for (const tab of tabs) {
          if (!tab.id || tab.id === chrome.tabs.TAB_ID_NONE) continue;
          chrome.tabs.sendMessage(tab.id, { action: 'cp-check-timeout' }).catch(() => {});
        }
      });
    });
  }
});

// Create the prevent-timeout alarm on startup (idempotent - won't duplicate)
chrome.alarms.get('cp-prevent-timeout', (existing) => {
  if (!existing) {
    chrome.alarms.create('cp-prevent-timeout', { periodInMinutes: 2 });
    console.log('[CP Toolkit] Created prevent-timeout alarm (every 2 min)');
  }
});

chrome.tabs.onRemoved.addListener(function(tabId) {
  if (_mcpSessionsByTab[tabId]) {
    delete _mcpSessionsByTab[tabId];
  }
});

loadCaptureConfig();
chrome.storage.onChanged.addListener(function(changes, areaName) {
  if (areaName !== 'local') return;

  if (
    Object.prototype.hasOwnProperty.call(changes, MCP_CAPTURE_MAX_EVENTS_KEY) ||
    Object.prototype.hasOwnProperty.call(changes, MCP_CAPTURE_ALLOW_REMOTE_UPLOAD_KEY) ||
    Object.prototype.hasOwnProperty.call(changes, MCP_CAPTURE_INCLUDE_RESPONSE_BODIES_KEY)
  ) {
    var settings = {};
    settings[MCP_CAPTURE_MAX_EVENTS_KEY] = Object.prototype.hasOwnProperty.call(changes, MCP_CAPTURE_MAX_EVENTS_KEY)
      ? changes[MCP_CAPTURE_MAX_EVENTS_KEY].newValue
      : _mcpCaptureConfig.maxEvents;
    settings[MCP_CAPTURE_ALLOW_REMOTE_UPLOAD_KEY] = Object.prototype.hasOwnProperty.call(changes, MCP_CAPTURE_ALLOW_REMOTE_UPLOAD_KEY)
      ? changes[MCP_CAPTURE_ALLOW_REMOTE_UPLOAD_KEY].newValue
      : _mcpCaptureConfig.allowRemoteUpload;
    settings[MCP_CAPTURE_INCLUDE_RESPONSE_BODIES_KEY] = Object.prototype.hasOwnProperty.call(changes, MCP_CAPTURE_INCLUDE_RESPONSE_BODIES_KEY)
      ? changes[MCP_CAPTURE_INCLUDE_RESPONSE_BODIES_KEY].newValue
      : _mcpCaptureConfig.includeResponseBodies;
    applyCaptureConfigFromSettings(settings);
  }
});

// Keep service worker alive (MV3 best practice)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[CP Toolkit] Message received:', message);

  // Ensure the MAIN world capture instrumenter is loaded in the current tab.
  if (message && message.action === 'cp-mcp-inject-instrumenter' && sender.tab && sender.tab.id) {
    injectMcpInstrumenter(sender.tab.id).then(function() {
      sendResponse({ success: true });
    }).catch(function(err) {
      sendResponse({ success: false, error: err.message });
    });
    return true; // async response
  }

  // Bridge startup ping from the content script.
  if (message && message.action === 'cp-mcp-bridge-ready' && sender.tab && sender.tab.id) {
    chrome.storage.local.get(MCP_CAPTURE_KEY, function(settings) {
      var enabled = !!settings[MCP_CAPTURE_KEY];
      if (enabled) {
        getOrCreateCaptureSession(sender.tab.id, message.page || { url: sender.tab.url || '', title: sender.tab.title || '' });
        injectMcpInstrumenter(sender.tab.id).catch(function() {});
      }
      chrome.tabs.sendMessage(sender.tab.id, {
        action: 'cp-mcp-set-enabled',
        enabled: enabled,
        config: {
          includeResponseBodies: _mcpCaptureConfig.includeResponseBodies
        }
      }).catch(function() {});
      sendResponse({ success: true, enabled: enabled });
    });
    return true;
  }

  // Event stream from page instrumenter -> content bridge -> service worker.
  if (message && message.action === 'cp-mcp-capture-event' && sender.tab && sender.tab.id) {
    appendCaptureEvent(
      sender.tab.id,
      message.event,
      message.page || { url: sender.tab.url || '', title: sender.tab.title || '' }
    );
    sendResponse({ success: true });
    return true;
  }

  // Popup toggle for capture mode.
  if (message && message.action === 'cp-mcp-capture-toggle') {
    resolveTabId(message, sender, function(tabId) {
      setCaptureEnabled(!!message.enabled, tabId, function(result) {
        sendResponse(result);
      });
    });
    return true; // async response
  }

  // Popup status request.
  if (message && message.action === 'cp-mcp-capture-status') {
    resolveTabId(message, sender, function(tabId) {
      getCaptureStatus(tabId, function(result) {
        sendResponse(result);
      });
    });
    return true; // async response
  }

  // Export current capture to Downloads as JSON.
  if (message && message.action === 'cp-mcp-capture-export') {
    resolveTabId(message, sender, function(tabId) {
      requestDomSnapshot(tabId).finally(function() {
        var capture = buildCapturePayload(tabId);
        var json = JSON.stringify(capture, null, 2);
        chrome.downloads.download({
          url: encodeDownloadData(json),
          filename: buildCaptureFilename(capture.captureId),
          saveAs: true
        }).then(function(downloadId) {
          sendResponse({
            success: true,
            captureId: capture.captureId,
            downloadId: downloadId,
            eventCount: capture.stats.eventCount
          });
        }).catch(function(err) {
          sendResponse({ success: false, error: err.message });
        });
      });
    });
    return true; // async response
  }

  // Upload capture to local collector endpoint.
  if (message && message.action === 'cp-mcp-capture-upload') {
    resolveTabId(message, sender, function(tabId) {
      var endpoint = message.endpoint || MCP_DEFAULT_COLLECT_URL;
      if (!_mcpCaptureConfig.allowRemoteUpload && !isLocalCollectorEndpoint(endpoint)) {
        sendResponse({
          success: false,
          error: 'Remote upload blocked by settings. Use localhost or enable remote uploads in settings.'
        });
        return;
      }

      requestDomSnapshot(tabId).finally(function() {
        var capture = buildCapturePayload(tabId);
        uploadCapture(endpoint, capture)
          .then(function(result) {
            sendResponse({
              success: result.ok,
              status: result.status,
              captureId: capture.captureId,
              response: result.payload
            });
          })
          .catch(function(err) {
            sendResponse({ success: false, error: err.message });
          });
      });
    });
    return true; // async response
  }

  // Show badge with refresh count from prevent-timeout
  if (message && message.action === 'cp-update-badge') {
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    chrome.action.setBadgeText({ text: message.text || '' });
  }

  // Open an extension page in a new tab (content scripts can't open chrome-extension:// URLs)
  if (message && message.action === 'cp-open-extension-page' && message.page) {
    chrome.tabs.create({ url: chrome.runtime.getURL(message.page) });
  }

  // Rebuild context menus (triggered when on-demand tools are enabled/disabled in options)
  if (message && message.action === 'cp-rebuild-context-menus') {
    initializeContextMenus(true);
  }

  // Execute arbitrary code in a specific iframe's MAIN world.
  // Used by tools that need to interact with page-level JS globals inside iframes
  // (e.g., Dropzone, saveChanges) which content scripts can't access directly.
  if (message && message.action === 'cp-execute-in-frame' && sender.tab) {
    chrome.webNavigation.getAllFrames({ tabId: sender.tab.id }).then(function(frames) {
      var targetFrame = frames.find(function(f) { return f.url.indexOf(message.urlMatch) > -1; });
      if (!targetFrame) {
        sendResponse({ error: 'Frame not found matching: ' + message.urlMatch });
        return;
      }
      chrome.scripting.executeScript({
        target: { tabId: sender.tab.id, frameIds: [targetFrame.frameId] },
        world: 'MAIN',
        func: function(codeStr) { return eval(codeStr); },
        args: [message.code]
      }).then(function(results) {
        sendResponse({ result: results[0] ? results[0].result : null });
      }).catch(function(err) {
        sendResponse({ error: err.message });
      });
    }).catch(function(err) {
      sendResponse({ error: err.message });
    });
    return true; // async response
  }

  // Execute arbitrary code in the top frame's MAIN world and return the result.
  // Used when content scripts need access to page-level JS globals (e.g. jQuery, page functions).
  if (message && message.action === 'cp-execute-in-main' && message.code && sender.tab) {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: 'MAIN',
      func: function(codeStr) { return eval(codeStr); },
      args: [message.code]
    }).then(function(results) {
      sendResponse({ result: results[0] ? results[0].result : null });
    }).catch(function(err) {
      sendResponse({ error: err.message });
    });
    return true; // async response
  }

  sendResponse({ received: true });
  return true;
});

// Service worker lifecycle logging
self.addEventListener('activate', (event) => {
  console.log('[CP Toolkit] Service worker activated');
});

self.addEventListener('deactivate', (event) => {
  console.log('[CP Toolkit] Service worker deactivated');
});
