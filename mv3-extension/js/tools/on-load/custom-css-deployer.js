(function loadTool() {
  var thisTool = "custom-css-deployer";
  var RULES_KEY = "cp-toolkit-custom-css-rules";
  var STYLE_ID = "cp-toolkit-custom-css-deployer-style";
  var DEFAULT_MATCH_TYPE = "path-prefix";
  var DEFAULT_SCOPE = "admin-only";
  var initialized = false;
  var storageListenerBound = false;

  function sanitizeMatchType(value) {
    if (
      value === "path-prefix" ||
      value === "path-exact" ||
      value === "path-contains" ||
      value === "url-contains" ||
      value === "regex-path"
    ) {
      return value;
    }
    return DEFAULT_MATCH_TYPE;
  }

  function sanitizeScope(value) {
    if (value === "admin-only" || value === "all-pages") {
      return value;
    }
    return DEFAULT_SCOPE;
  }

  function normalizeRule(raw, index) {
    raw = raw || {};
    var fallbackName = "Rule " + String(index + 1);

    return {
      id: String(raw.id || ""),
      name: String(raw.name || fallbackName).trim() || fallbackName,
      enabled: raw.enabled !== false,
      matchType: sanitizeMatchType(raw.matchType),
      matchValue: String(raw.matchValue || "").trim(),
      scope: sanitizeScope(raw.scope),
      css: String(raw.css || "")
    };
  }

  function normalizeRules(rawRules) {
    if (!Array.isArray(rawRules)) return [];

    var normalized = [];
    for (var i = 0; i < rawRules.length; i++) {
      var rule = normalizeRule(rawRules[i], i);
      if (!rule.css.trim()) continue;
      if (!rule.matchValue) continue;
      normalized.push(rule);
    }
    return normalized;
  }

  function isAdminPath(pathname) {
    var path = String(pathname || "").toLowerCase();
    return path.indexOf("/admin") === 0 || path.indexOf("/designcenter") === 0;
  }

  function matchesRule(rule, locationRef) {
    var path = String(locationRef.pathname || "");
    var href = String(locationRef.href || "");
    var pathLower = path.toLowerCase();
    var hrefLower = href.toLowerCase();
    var testValue = String(rule.matchValue || "");
    var testValueLower = testValue.toLowerCase();

    if (!testValue) {
      return false;
    }

    switch (rule.matchType) {
      case "path-exact":
        return pathLower === testValueLower;
      case "path-contains":
        return pathLower.indexOf(testValueLower) !== -1;
      case "url-contains":
        return hrefLower.indexOf(testValueLower) !== -1;
      case "regex-path":
        try {
          return new RegExp(testValue, "i").test(path);
        } catch (err) {
          return false;
        }
      case "path-prefix":
      default:
        return pathLower.indexOf(testValueLower) === 0;
    }
  }

  function ensureStyleElement() {
    var styleElement = document.getElementById(STYLE_ID);
    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(styleElement);
    }
    return styleElement;
  }

  function removeStyleElement() {
    var styleElement = document.getElementById(STYLE_ID);
    if (styleElement && styleElement.parentNode) {
      styleElement.parentNode.removeChild(styleElement);
    }
  }

  function buildCssText(rules) {
    if (!rules.length) return "";

    var blocks = [];
    var locationRef = window.location;
    var onAdminPage = isAdminPath(locationRef.pathname);

    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (!rule.enabled) continue;
      if (rule.scope === "admin-only" && !onAdminPage) continue;
      if (!matchesRule(rule, locationRef)) continue;

      blocks.push(
        "/* [CP Toolkit Custom CSS] " + rule.name + " */\n" + rule.css
      );
    }

    return blocks.join("\n\n");
  }

  function applyRulesFromStorage() {
    chrome.storage.local.get([thisTool, RULES_KEY], function(settings) {
      if (chrome.runtime.lastError) {
        console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
        return;
      }

      if (settings[thisTool] === false) {
        removeStyleElement();
        return;
      }

      var rules = normalizeRules(settings[RULES_KEY]);
      var cssText = buildCssText(rules);

      if (!cssText) {
        removeStyleElement();
        return;
      }

      var styleElement = ensureStyleElement();
      styleElement.textContent = cssText;
    });
  }

  function bindStorageListener() {
    if (storageListenerBound || !chrome.storage || !chrome.storage.onChanged) {
      return;
    }

    chrome.storage.onChanged.addListener(function(changes, areaName) {
      if (areaName !== "local") return;
      if (!changes[thisTool] && !changes[RULES_KEY]) return;
      applyRulesFromStorage();
    });

    storageListenerBound = true;
  }

  function init() {
    if (initialized) return;
    initialized = true;

    applyRulesFromStorage();
    bindStorageListener();
    console.log("[CP Toolkit] Loaded " + thisTool);
  }

  detect_if_cp_site(function() {
    if (window.top !== window.self) {
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  });
})();
