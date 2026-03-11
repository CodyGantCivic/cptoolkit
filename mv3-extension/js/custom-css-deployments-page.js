(function customCssDeploymentsPage() {
  "use strict";

  var TOOL_ID = "custom-css-deployer";
  var STORAGE_KEY = "cp-toolkit-custom-css-rules";
  var DEFAULT_SCOPE = "admin-only";
  var DEFAULT_MATCH_TYPE = "path-prefix";
  var modalState = {
    editingId: null
  };
  var appState = {
    rules: [],
    toolEnabled: true
  };

  var matchHints = {
    "path-prefix": "Example: /Admin/DesignCenter/Themes",
    "path-exact": "Example: /Admin/DesignCenter/Layouts",
    "path-contains": "Example: /DesignCenter/",
    "url-contains": "Example: themeID=1",
    "regex-path": "Example: ^/Admin/DesignCenter/Layouts(/|$)"
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function showToast(message, isError) {
    var toast = byId("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = "block";
    toast.style.background = isError ? "#7d2530" : "#22324d";
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function() {
      toast.style.display = "none";
    }, 2200);
  }

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

  function createRuleId() {
    return "css-rule-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function normalizeRule(raw, index) {
    raw = raw || {};
    var fallbackName = "Rule " + String((index || 0) + 1);
    var id = String(raw.id || "").trim() || createRuleId();

    return {
      id: id,
      name: String(raw.name || fallbackName).trim() || fallbackName,
      enabled: raw.enabled !== false,
      scope: sanitizeScope(raw.scope),
      matchType: sanitizeMatchType(raw.matchType),
      matchValue: String(raw.matchValue || "").trim(),
      css: String(raw.css || "")
    };
  }

  function normalizeRules(rawRules) {
    if (!Array.isArray(rawRules)) return [];
    var list = [];
    for (var i = 0; i < rawRules.length; i++) {
      var rule = normalizeRule(rawRules[i], i);
      if (!rule.matchValue) continue;
      if (!rule.css.trim()) continue;
      list.push(rule);
    }
    return ensureUniqueIds(list);
  }

  function ensureUniqueIds(rules) {
    var seen = {};
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (!rule.id || seen[rule.id]) {
        rule.id = createRuleId();
      }
      seen[rule.id] = true;
    }
    return rules;
  }

  function readFileAsText(file) {
    return new Promise(function(resolve, reject) {
      if (!file) {
        reject(new Error("No file selected."));
        return;
      }
      var reader = new FileReader();
      reader.onload = function() {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function() {
        reject(new Error("Could not read file."));
      };
      reader.readAsText(file);
    });
  }

  function downloadTextFile(filename, text, type) {
    var blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function() {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  function formatMatchType(matchType) {
    switch (matchType) {
      case "path-exact":
        return "Exact Path";
      case "path-contains":
        return "Path Contains";
      case "url-contains":
        return "URL Contains";
      case "regex-path":
        return "Regex Path";
      case "path-prefix":
      default:
        return "Path Prefix";
    }
  }

  function formatScope(scope) {
    return scope === "all-pages" ? "All Pages" : "Admin Only";
  }

  function updateMatchHint() {
    var select = byId("rule-match-type");
    var hint = byId("rule-match-hint");
    if (!select || !hint) return;
    var value = sanitizeMatchType(select.value);
    hint.innerHTML = "Example: <code>" + (matchHints[value] || "/Admin/") + "</code>";
  }

  function saveRules(callback) {
    chrome.storage.local.set({ [STORAGE_KEY]: appState.rules }, function() {
      if (callback) callback();
    });
  }

  function renderToolStatus() {
    var text = byId("tool-status-text");
    var enableBtn = byId("enable-tool-btn");

    if (!text || !enableBtn) return;

    if (appState.toolEnabled) {
      text.textContent = "Tool status: enabled. Matching rules apply immediately on page load.";
      enableBtn.style.display = "none";
      return;
    }

    text.textContent = "Tool status: disabled. Rules are saved, but none will deploy until enabled.";
    enableBtn.style.display = "";
  }

  function renderRules() {
    var listEl = byId("rules-list");
    var emptyEl = byId("empty-state");
    if (!listEl || !emptyEl) return;

    listEl.innerHTML = "";

    if (!appState.rules.length) {
      emptyEl.style.display = "";
      return;
    }

    emptyEl.style.display = "none";

    for (var i = 0; i < appState.rules.length; i++) {
      var rule = appState.rules[i];
      var card = document.createElement("article");
      card.className = "rule-card";

      var head = document.createElement("div");
      head.className = "rule-head";

      var name = document.createElement("h3");
      name.className = "rule-name";
      name.textContent = rule.name;
      head.appendChild(name);

      var enabledPill = document.createElement("span");
      enabledPill.className = "rule-pill " + (rule.enabled ? "on" : "off");
      enabledPill.textContent = rule.enabled ? "Enabled" : "Disabled";
      head.appendChild(enabledPill);

      var scopePill = document.createElement("span");
      scopePill.className = "rule-pill scope";
      scopePill.textContent = formatScope(rule.scope);
      head.appendChild(scopePill);

      var matchPill = document.createElement("span");
      matchPill.className = "rule-pill match";
      matchPill.textContent = formatMatchType(rule.matchType);
      head.appendChild(matchPill);

      card.appendChild(head);

      var body = document.createElement("div");
      body.className = "rule-body";

      var target = document.createElement("p");
      target.className = "rule-target";
      target.textContent = "Match value: " + rule.matchValue;
      body.appendChild(target);

      var pre = document.createElement("pre");
      pre.className = "rule-css-preview";
      var maxLen = 900;
      pre.textContent = rule.css.length > maxLen ? rule.css.slice(0, maxLen) + "\n/* ...trimmed preview... */" : rule.css;
      body.appendChild(pre);

      var actions = document.createElement("div");
      actions.className = "rule-actions";

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "toolbar-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", (function(ruleId) {
        return function() {
          openRuleModal(ruleId);
        };
      })(rule.id));
      actions.appendChild(editBtn);

      var duplicateBtn = document.createElement("button");
      duplicateBtn.type = "button";
      duplicateBtn.className = "toolbar-btn";
      duplicateBtn.textContent = "Duplicate";
      duplicateBtn.addEventListener("click", (function(currentRule) {
        return function() {
          var copy = normalizeRule({
            name: currentRule.name + " (Copy)",
            enabled: currentRule.enabled,
            scope: currentRule.scope,
            matchType: currentRule.matchType,
            matchValue: currentRule.matchValue,
            css: currentRule.css
          }, appState.rules.length);
          appState.rules.push(copy);
          saveRules(function() {
            renderRules();
            showToast("Rule duplicated.");
          });
        };
      })(rule));
      actions.appendChild(duplicateBtn);

      var exportBtn = document.createElement("button");
      exportBtn.type = "button";
      exportBtn.className = "toolbar-btn";
      exportBtn.textContent = "Export";
      exportBtn.addEventListener("click", (function(currentRule) {
        return function() {
          var safeName = (currentRule.name || "rule").toLowerCase().replace(/[^a-z0-9]+/g, "-");
          var payload = JSON.stringify({ rules: [currentRule] }, null, 2);
          downloadTextFile("cp-custom-css-" + safeName + ".json", payload, "application/json");
        };
      })(rule));
      actions.appendChild(exportBtn);

      var deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "toolbar-btn danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", (function(ruleId) {
        return function() {
          if (!confirm("Delete this deployment rule?")) return;
          appState.rules = appState.rules.filter(function(item) {
            return item.id !== ruleId;
          });
          saveRules(function() {
            renderRules();
            showToast("Rule deleted.");
          });
        };
      })(rule.id));
      actions.appendChild(deleteBtn);

      body.appendChild(actions);
      card.appendChild(body);
      listEl.appendChild(card);
    }
  }

  function getRuleById(ruleId) {
    for (var i = 0; i < appState.rules.length; i++) {
      if (appState.rules[i].id === ruleId) return appState.rules[i];
    }
    return null;
  }

  function openRuleModal(ruleId, draftRule) {
    var overlay = byId("rule-modal-overlay");
    var title = byId("rule-modal-title");
    var deleteBtn = byId("rule-delete-btn");
    if (!overlay || !title || !deleteBtn) return;

    var rule = draftRule || getRuleById(ruleId);
    var isEdit = !!(rule && !draftRule);
    modalState.editingId = isEdit ? rule.id : null;

    title.textContent = isEdit ? "Edit Deployment Rule" : "New Deployment Rule";
    deleteBtn.style.display = isEdit ? "" : "none";

    byId("rule-name").value = rule ? rule.name : "";
    byId("rule-enabled").checked = rule ? rule.enabled !== false : true;
    byId("rule-scope").value = rule ? sanitizeScope(rule.scope) : DEFAULT_SCOPE;
    byId("rule-match-type").value = rule ? sanitizeMatchType(rule.matchType) : DEFAULT_MATCH_TYPE;
    byId("rule-match-value").value = rule ? String(rule.matchValue || "") : "";
    byId("rule-css").value = rule ? String(rule.css || "") : "";
    updateMatchHint();

    overlay.style.display = "flex";
    setTimeout(function() {
      byId("rule-name").focus();
    }, 30);
  }

  function closeRuleModal() {
    var overlay = byId("rule-modal-overlay");
    if (overlay) {
      overlay.style.display = "none";
    }
    modalState.editingId = null;
  }

  function collectModalRule() {
    var name = String(byId("rule-name").value || "").trim();
    var enabled = !!byId("rule-enabled").checked;
    var scope = sanitizeScope(byId("rule-scope").value);
    var matchType = sanitizeMatchType(byId("rule-match-type").value);
    var matchValue = String(byId("rule-match-value").value || "").trim();
    var css = String(byId("rule-css").value || "");

    if (!name) {
      showToast("Rule name is required.", true);
      byId("rule-name").focus();
      return null;
    }
    if (!matchValue) {
      showToast("Match value is required.", true);
      byId("rule-match-value").focus();
      return null;
    }
    if (!css.trim()) {
      showToast("CSS cannot be empty.", true);
      byId("rule-css").focus();
      return null;
    }

    if (matchType === "regex-path") {
      try {
        new RegExp(matchValue);
      } catch (err) {
        showToast("Regex is invalid: " + err.message, true);
        byId("rule-match-value").focus();
        return null;
      }
    }

    return {
      id: modalState.editingId || createRuleId(),
      name: name,
      enabled: enabled,
      scope: scope,
      matchType: matchType,
      matchValue: matchValue,
      css: css
    };
  }

  function saveModalRule() {
    var newRule = collectModalRule();
    if (!newRule) return;

    if (modalState.editingId) {
      for (var i = 0; i < appState.rules.length; i++) {
        if (appState.rules[i].id === modalState.editingId) {
          appState.rules[i] = newRule;
          break;
        }
      }
    } else {
      appState.rules.push(newRule);
    }

    saveRules(function() {
      closeRuleModal();
      renderRules();
      showToast("Rule saved.");
    });
  }

  function deleteModalRule() {
    if (!modalState.editingId) return;
    if (!confirm("Delete this deployment rule?")) return;

    var id = modalState.editingId;
    appState.rules = appState.rules.filter(function(rule) {
      return rule.id !== id;
    });

    saveRules(function() {
      closeRuleModal();
      renderRules();
      showToast("Rule deleted.");
    });
  }

  function setToolEnabled(enabled) {
    chrome.storage.local.set({ [TOOL_ID]: !!enabled }, function() {
      appState.toolEnabled = !!enabled;
      renderToolStatus();
      showToast(enabled ? "Tool enabled." : "Tool disabled.");
    });
  }

  function bindToolbarEvents() {
    byId("new-rule-btn").addEventListener("click", function() {
      openRuleModal(null, null);
    });

    byId("export-json-btn").addEventListener("click", function() {
      if (!appState.rules.length) {
        showToast("Nothing to export yet.", true);
        return;
      }
      var payload = JSON.stringify({ rules: appState.rules }, null, 2);
      downloadTextFile("cp-custom-css-rules.json", payload, "application/json");
      showToast("Exported JSON.");
    });

    byId("import-json-btn").addEventListener("click", function() {
      byId("import-json-file").click();
    });

    byId("import-css-btn").addEventListener("click", function() {
      byId("import-css-file").click();
    });

    byId("import-json-file").addEventListener("change", function(event) {
      var file = event.target.files && event.target.files[0];
      event.target.value = "";
      if (!file) return;

      readFileAsText(file)
        .then(function(text) {
          var parsed;
          try {
            parsed = JSON.parse(text);
          } catch (err) {
            throw new Error("Invalid JSON file.");
          }

          var rawRules = Array.isArray(parsed) ? parsed : parsed.rules;
          var imported = normalizeRules(rawRules);
          if (!imported.length) {
            throw new Error("No valid rules found in import file.");
          }

          var replaceExisting = confirm("Click OK to replace all current rules.\nClick Cancel to merge imported rules.");
          if (replaceExisting) {
            appState.rules = imported;
          } else {
            appState.rules = ensureUniqueIds(appState.rules.concat(imported));
          }

          saveRules(function() {
            renderRules();
            showToast("Imported " + imported.length + " rule(s).");
          });
        })
        .catch(function(err) {
          showToast(err.message || "Import failed.", true);
        });
    });

    byId("import-css-file").addEventListener("change", function(event) {
      var file = event.target.files && event.target.files[0];
      event.target.value = "";
      if (!file) return;

      readFileAsText(file)
        .then(function(text) {
          var name = (file.name || "Custom CSS").replace(/\.css$/i, "");
          var newRule = normalizeRule({
            name: name,
            enabled: true,
            scope: DEFAULT_SCOPE,
            matchType: DEFAULT_MATCH_TYPE,
            matchValue: "/Admin/",
            css: text
          }, appState.rules.length);

          appState.rules.push(newRule);
          saveRules(function() {
            renderRules();
            openRuleModal(newRule.id);
            showToast("CSS file imported. Set your page match and save.");
          });
        })
        .catch(function(err) {
          showToast(err.message || "CSS import failed.", true);
        });
    });
  }

  function bindModalEvents() {
    byId("rule-modal-close").addEventListener("click", closeRuleModal);
    byId("rule-cancel-btn").addEventListener("click", closeRuleModal);
    byId("rule-save-btn").addEventListener("click", saveModalRule);
    byId("rule-delete-btn").addEventListener("click", deleteModalRule);
    byId("rule-match-type").addEventListener("change", updateMatchHint);
    byId("enable-tool-btn").addEventListener("click", function() {
      setToolEnabled(true);
    });

    byId("modal-import-css-btn").addEventListener("click", function() {
      byId("modal-import-css-file").click();
    });

    byId("modal-import-css-file").addEventListener("change", function(event) {
      var file = event.target.files && event.target.files[0];
      event.target.value = "";
      if (!file) return;
      readFileAsText(file)
        .then(function(text) {
          byId("rule-css").value = text;
          var nameInput = byId("rule-name");
          if (!String(nameInput.value || "").trim()) {
            nameInput.value = (file.name || "Imported CSS").replace(/\.css$/i, "");
          }
          showToast("Loaded CSS into editor.");
        })
        .catch(function(err) {
          showToast(err.message || "CSS load failed.", true);
        });
    });

    byId("rule-modal-overlay").addEventListener("click", function(event) {
      if (event.target === event.currentTarget) {
        closeRuleModal();
      }
    });

    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape") {
        closeRuleModal();
      }
    });
  }

  function bindStorageSyncListener() {
    if (!chrome.storage || !chrome.storage.onChanged) return;
    chrome.storage.onChanged.addListener(function(changes, areaName) {
      if (areaName !== "local") return;
      if (changes[TOOL_ID]) {
        appState.toolEnabled = changes[TOOL_ID].newValue !== false;
        renderToolStatus();
      }
      if (changes[STORAGE_KEY]) {
        appState.rules = normalizeRules(changes[STORAGE_KEY].newValue);
        renderRules();
      }
    });
  }

  function initialize() {
    chrome.storage.local.get([TOOL_ID, STORAGE_KEY], function(result) {
      appState.toolEnabled = result[TOOL_ID] !== false;
      appState.rules = normalizeRules(result[STORAGE_KEY]);
      renderToolStatus();
      renderRules();
    });

    bindToolbarEvents();
    bindModalEvents();
    bindStorageSyncListener();
    updateMatchHint();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
