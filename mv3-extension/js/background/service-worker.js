// CivicPlus Toolkit - Service Worker (MV3)
// Version 1.1.0

console.log('[CP Toolkit] Service worker initializing...');

// Import modules
importScripts('context-menus.js');
importScripts('first-run.js');

console.log('[CP Toolkit] Service worker initialized');

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

// Keep service worker alive (MV3 best practice)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[CP Toolkit] Message received:', message);

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
