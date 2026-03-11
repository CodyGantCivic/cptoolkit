(function() {
  var SOURCE = "cp-mcp-capture";
  var MAX_TEXT = 4000;
  var MAX_HTML = 20000;

  if (window.__cpToolkitMcpInstrumenterInstalled) {
    return;
  }
  window.__cpToolkitMcpInstrumenterInstalled = true;

  var state = {
    enabled: false,
    counter: 0,
    includeResponseBodies: false
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function trimText(value, maxLen) {
    if (value === null || value === undefined) return null;
    var text = String(value);
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + "... [truncated " + (text.length - maxLen) + " chars]";
  }

  function redactSecrets(text) {
    if (!text) return text;
    return String(text)
      .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, "$1[REDACTED]")
      .replace(/([A-Za-z0-9+/._=-]{40,})/g, "[REDACTED_TOKEN]");
  }

  function sanitizeHeaderValue(key, value) {
    var lower = String(key || "").toLowerCase();
    if (
      lower === "authorization" ||
      lower === "cookie" ||
      lower === "set-cookie" ||
      lower === "x-api-key"
    ) {
      return "[REDACTED]";
    }
    return trimText(redactSecrets(value), 512);
  }

  function headerMap(headersLike) {
    var out = {};
    if (!headersLike) return out;

    if (typeof Headers !== "undefined" && headersLike instanceof Headers) {
      headersLike.forEach(function(value, key) {
        out[key] = sanitizeHeaderValue(key, value);
      });
      return out;
    }

    if (Array.isArray(headersLike)) {
      headersLike.forEach(function(entry) {
        if (!Array.isArray(entry) || entry.length < 2) return;
        out[String(entry[0])] = sanitizeHeaderValue(entry[0], entry[1]);
      });
      return out;
    }

    if (typeof headersLike === "object") {
      Object.keys(headersLike).forEach(function(key) {
        out[key] = sanitizeHeaderValue(key, headersLike[key]);
      });
    }

    return out;
  }

  function serializeBody(body) {
    if (body === null || body === undefined) return null;

    try {
      if (typeof body === "string") {
        return trimText(redactSecrets(body), MAX_TEXT);
      }
      if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
        return trimText(redactSecrets(body.toString()), MAX_TEXT);
      }
      if (typeof FormData !== "undefined" && body instanceof FormData) {
        var parts = [];
        body.forEach(function(value, key) {
          if (typeof value === "string") {
            parts.push(key + "=" + trimText(redactSecrets(value), 200));
          } else if (value && typeof value.name === "string") {
            parts.push(key + "=[File:" + value.name + "]");
          } else {
            parts.push(key + "=[Binary]");
          }
        });
        return trimText(parts.join("&"), MAX_TEXT);
      }
      if (typeof Blob !== "undefined" && body instanceof Blob) {
        return "[Blob size=" + body.size + ", type=" + (body.type || "unknown") + "]";
      }
      if (ArrayBuffer.isView(body) || (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer)) {
        return "[Binary body]";
      }
      return trimText(redactSecrets(JSON.stringify(body)), MAX_TEXT);
    } catch (e) {
      return "[Unserializable body]";
    }
  }

  function emit(type, payload, force) {
    if (!state.enabled && force !== true) return;

    var event = {
      id: "evt-" + Date.now() + "-" + (++state.counter),
      time: nowIso(),
      type: type,
      url: window.location.href,
      payload: payload || {}
    };

    window.postMessage(
      {
        source: SOURCE,
        kind: "capture-event",
        event: event
      },
      "*"
    );
  }

  function buildElementSelector(el) {
    if (!el || !el.tagName) return null;
    var selector = el.tagName.toLowerCase();
    if (el.id) selector += "#" + el.id;
    if (el.className && typeof el.className === "string") {
      var classes = el.className.trim().split(/\s+/).slice(0, 2);
      if (classes.length) selector += "." + classes.join(".");
    }
    return selector;
  }

  function collectVisibleModals() {
    var modalSelectors = [
      "#popoverModal",
      ".modal",
      "[role='dialog']",
      ".cpPopover"
    ];
    var found = [];
    for (var i = 0; i < modalSelectors.length; i++) {
      var nodes = document.querySelectorAll(modalSelectors[i]);
      for (var j = 0; j < nodes.length; j++) {
        var node = nodes[j];
        var style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") continue;
        var rect = node.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        found.push({
          selector: buildElementSelector(node),
          text: trimText(node.textContent || "", 200)
        });
        if (found.length >= 5) return found;
      }
    }
    return found;
  }

  function buildDomSnapshot() {
    var docEl = document.documentElement;
    return {
      capturedAt: nowIso(),
      location: window.location.href,
      title: document.title || "",
      readyState: document.readyState,
      bodyClass: document.body ? document.body.className : "",
      activeElement: buildElementSelector(document.activeElement),
      visibleModals: collectVisibleModals(),
      htmlPreview: trimText(redactSecrets(docEl ? docEl.outerHTML : ""), MAX_HTML)
    };
  }

  function parseResponseHeaders(raw) {
    var headers = {};
    if (!raw) return headers;
    raw.trim().split(/[\r\n]+/).forEach(function(line) {
      var idx = line.indexOf(":");
      if (idx < 0) return;
      var key = line.slice(0, idx).trim();
      var value = line.slice(idx + 1).trim();
      headers[key] = sanitizeHeaderValue(key, value);
    });
    return headers;
  }

  async function captureFetchResponse(response) {
    var payload = {
      status: response.status,
      ok: response.ok,
      redirected: response.redirected,
      responseUrl: response.url || null,
      responseHeaders: headerMap(response.headers)
    };

    if (!state.includeResponseBodies) {
      payload.responseBodyPreview = "[disabled by capture settings]";
      return payload;
    }

    try {
      var contentType = response.headers.get("content-type") || "";
      if (/json|text|javascript|xml|html/i.test(contentType)) {
        var text = await response.clone().text();
        payload.responseBodyPreview = trimText(redactSecrets(text), MAX_TEXT);
      } else {
        payload.responseBodyPreview = "[Non-text body omitted]";
      }
    } catch (e) {
      payload.responseBodyPreview = "[Failed to read body: " + e.message + "]";
    }
    return payload;
  }

  function installFetchHook() {
    if (typeof window.fetch !== "function") return;
    var originalFetch = window.fetch;
    window.fetch = async function(input, init) {
      var requestId = "fetch-" + Date.now() + "-" + (++state.counter);
      var started = Date.now();

      var method = "GET";
      var url = "";
      var requestHeaders = {};
      var requestBody = null;

      try {
        if (typeof Request !== "undefined" && input instanceof Request) {
          method = input.method || method;
          url = input.url || "";
          requestHeaders = headerMap(input.headers);
        } else if (typeof input === "string") {
          url = input;
        }
        if (init && init.method) method = init.method;
        if (init && init.headers) {
          var initHeaders = headerMap(init.headers);
          requestHeaders = Object.assign({}, requestHeaders, initHeaders);
        }
        if (init && Object.prototype.hasOwnProperty.call(init, "body")) {
          requestBody = serializeBody(init.body);
        }
      } catch (e) {}

      emit("network-request", {
        requestId: requestId,
        transport: "fetch",
        method: method,
        requestUrl: url,
        requestHeaders: requestHeaders,
        requestBodyPreview: requestBody
      });

      try {
        var response = await originalFetch.apply(this, arguments);
        captureFetchResponse(response).then(function(responsePayload) {
          emit("network-response", {
            requestId: requestId,
            transport: "fetch",
            durationMs: Date.now() - started,
            method: method,
            requestUrl: url,
            status: responsePayload.status,
            ok: responsePayload.ok,
            redirected: responsePayload.redirected,
            responseUrl: responsePayload.responseUrl,
            responseHeaders: responsePayload.responseHeaders,
            responseBodyPreview: responsePayload.responseBodyPreview
          });
        });
        return response;
      } catch (error) {
        emit("network-error", {
          requestId: requestId,
          transport: "fetch",
          durationMs: Date.now() - started,
          method: method,
          requestUrl: url,
          error: error && error.message ? error.message : String(error)
        });
        throw error;
      }
    };
  }

  function installXhrHook() {
    if (!window.XMLHttpRequest || !window.XMLHttpRequest.prototype) return;

    var originalOpen = window.XMLHttpRequest.prototype.open;
    var originalSend = window.XMLHttpRequest.prototype.send;
    var originalSetRequestHeader = window.XMLHttpRequest.prototype.setRequestHeader;

    window.XMLHttpRequest.prototype.open = function(method, url) {
      this.__cpMcpMeta = {
        requestId: "xhr-" + Date.now() + "-" + (++state.counter),
        method: method || "GET",
        requestUrl: url || "",
        headers: {},
        started: 0
      };
      return originalOpen.apply(this, arguments);
    };

    window.XMLHttpRequest.prototype.setRequestHeader = function(key, value) {
      if (this.__cpMcpMeta) {
        this.__cpMcpMeta.headers[key] = sanitizeHeaderValue(key, value);
      }
      return originalSetRequestHeader.apply(this, arguments);
    };

    window.XMLHttpRequest.prototype.send = function(body) {
      var xhr = this;
      var meta = xhr.__cpMcpMeta || {
        requestId: "xhr-" + Date.now() + "-" + (++state.counter),
        method: "GET",
        requestUrl: "",
        headers: {},
        started: 0
      };

      meta.started = Date.now();

      emit("network-request", {
        requestId: meta.requestId,
        transport: "xhr",
        method: meta.method,
        requestUrl: meta.requestUrl,
        requestHeaders: meta.headers,
        requestBodyPreview: serializeBody(body)
      });

      xhr.addEventListener("loadend", function() {
        var payload = {
          requestId: meta.requestId,
          transport: "xhr",
          durationMs: Date.now() - meta.started,
          method: meta.method,
          requestUrl: meta.requestUrl,
          status: xhr.status,
          responseUrl: xhr.responseURL || null,
          responseHeaders: parseResponseHeaders(xhr.getAllResponseHeaders())
        };

        try {
          if (!state.includeResponseBodies) {
            payload.responseBodyPreview = "[disabled by capture settings]";
          } else if (xhr.responseType === "" || xhr.responseType === "text") {
            payload.responseBodyPreview = trimText(redactSecrets(xhr.responseText || ""), MAX_TEXT);
          } else {
            payload.responseBodyPreview = "[Non-text body omitted]";
          }
        } catch (e) {
          payload.responseBodyPreview = "[Failed to read responseText]";
        }

        if (xhr.status >= 200 && xhr.status < 400) {
          emit("network-response", payload);
        } else {
          payload.error = "HTTP " + xhr.status;
          emit("network-error", payload);
        }
      });

      return originalSend.apply(this, arguments);
    };
  }

  function installErrorHooks() {
    window.addEventListener(
      "error",
      function(event) {
        emit("js-error", {
          message: event.message || "Script error",
          filename: event.filename || null,
          line: event.lineno || null,
          column: event.colno || null,
          stack: trimText(event.error && event.error.stack ? event.error.stack : "", MAX_TEXT)
        });
      },
      true
    );

    window.addEventListener("unhandledrejection", function(event) {
      var reason = event.reason;
      var message = reason && reason.message ? reason.message : String(reason);
      emit("js-unhandled-rejection", {
        message: trimText(message, MAX_TEXT),
        stack: trimText(reason && reason.stack ? reason.stack : "", MAX_TEXT)
      });
    });
  }

  function handleBridgeMessages(event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.source !== "cp-mcp-bridge") return;

    if (data.type === "set-enabled") {
      state.enabled = !!data.enabled;
      emit("capture-state", { enabled: state.enabled }, true);
      return;
    }

    if (data.type === "set-config") {
      if (data.config && typeof data.config === "object") {
        state.includeResponseBodies = !!data.config.includeResponseBodies;
      }
      emit("capture-config", { includeResponseBodies: state.includeResponseBodies }, true);
      return;
    }

    if (data.type === "request-dom-snapshot") {
      emit("dom-snapshot", buildDomSnapshot(), true);
      return;
    }

    if (data.type === "capture-page-context") {
      emit(
        "page-context",
        {
          title: document.title || "",
          userAgent: navigator.userAgent || "",
          referrer: document.referrer || ""
        },
        true
      );
    }
  }

  installFetchHook();
  installXhrHook();
  installErrorHooks();
  window.addEventListener("message", handleBridgeMessages);

  window.postMessage(
    {
      source: SOURCE,
      kind: "instrument-ready",
      version: "0.1.0"
    },
    "*"
  );
})();
