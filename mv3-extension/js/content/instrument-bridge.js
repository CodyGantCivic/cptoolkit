(function() {
  var SETTING_KEY = "mcp-capture-enabled";
  var CONFIG_KEY = "mcp-capture-include-response-bodies";
  var initialized = false;
  var currentEnabled = false;
  var currentConfig = {
    includeResponseBodies: false
  };

  if (window.top !== window) {
    return;
  }

  function sendToPage(type, extra) {
    var payload = {
      source: "cp-mcp-bridge",
      type: type
    };
    if (extra && typeof extra === "object") {
      Object.keys(extra).forEach(function(key) {
        payload[key] = extra[key];
      });
    }
    window.postMessage(payload, "*");
  }

  function injectInstrumenter(callback) {
    if (!chrome.runtime || !chrome.runtime.id) {
      if (callback) callback(false);
      return;
    }
    chrome.runtime.sendMessage({ action: "cp-mcp-inject-instrumenter" }, function(response) {
      if (chrome.runtime.lastError) {
        console.warn("[CP Toolkit](mcp-capture) Instrumenter injection failed:", chrome.runtime.lastError.message);
        if (callback) callback(false);
        return;
      }
      if (callback) callback(response && response.success !== false);
    });
  }

  function applyEnabledState(enabled, configOverride) {
    currentEnabled = !!enabled;
    if (configOverride && typeof configOverride === "object") {
      currentConfig.includeResponseBodies = !!configOverride.includeResponseBodies;
    }
    injectInstrumenter(function() {
      sendToPage("set-config", { config: currentConfig });
      sendToPage("set-enabled", { enabled: currentEnabled });
      if (currentEnabled) {
        sendToPage("capture-page-context");
      }
    });
  }

  function handlePageMessage(event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.source !== "cp-mcp-capture") return;

    if (data.kind === "instrument-ready") {
      sendToPage("set-config", { config: currentConfig });
      sendToPage("set-enabled", { enabled: currentEnabled });
      if (currentEnabled) {
        sendToPage("capture-page-context");
      }
      return;
    }

    if (data.kind === "capture-event" && data.event) {
      chrome.runtime.sendMessage(
        {
          action: "cp-mcp-capture-event",
          event: data.event,
          page: {
            url: window.location.href,
            title: document.title || ""
          }
        },
        function() {}
      );
    }
  }

  function initCaptureBridge() {
    if (initialized) return;
    initialized = true;

    window.addEventListener("message", handlePageMessage, false);

    chrome.storage.local.get([SETTING_KEY, CONFIG_KEY], function(settings) {
      var enabled = !!settings[SETTING_KEY];
      currentConfig.includeResponseBodies = !!settings[CONFIG_KEY];
      applyEnabledState(enabled, currentConfig);
      chrome.runtime.sendMessage(
        {
          action: "cp-mcp-bridge-ready",
          page: {
            url: window.location.href,
            title: document.title || ""
          }
        },
        function() {}
      );
    });

    chrome.storage.onChanged.addListener(function(changes, areaName) {
      if (areaName !== "local") return;
      if (Object.prototype.hasOwnProperty.call(changes, CONFIG_KEY)) {
        currentConfig.includeResponseBodies = !!changes[CONFIG_KEY].newValue;
        sendToPage("set-config", { config: currentConfig });
      }
      if (Object.prototype.hasOwnProperty.call(changes, SETTING_KEY)) {
        applyEnabledState(!!changes[SETTING_KEY].newValue, currentConfig);
      }
    });
  }

  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (!message || !message.action) return;

    if (message.action === "cp-mcp-set-enabled") {
      applyEnabledState(!!message.enabled, message.config || null);
      sendResponse({ success: true });
      return true;
    }

    if (message.action === "cp-mcp-dom-snapshot") {
      sendToPage("request-dom-snapshot");
      sendResponse({ success: true });
      return true;
    }
  });

  if (typeof detect_if_cp_site === "function") {
    detect_if_cp_site(function() {
      initCaptureBridge();
    });
  } else {
    initCaptureBridge();
  }
})();
