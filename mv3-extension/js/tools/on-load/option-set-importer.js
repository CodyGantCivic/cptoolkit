(function loadTool() {
  if (window !== window.top) return;

  var thisTool = "option-set-importer";
  var initialized = false;

  chrome.storage.local.get(thisTool, function(settings) {
    if (chrome.runtime.lastError) {
      console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
      return;
    }

    detect_if_cp_site(function() {
      if (settings[thisTool] !== false) {
        try {
          initOptionSetImporter();
        } catch (err) {
          console.warn("[CP Toolkit](" + thisTool + ") Error:", err);
        }
      }
    }, thisTool);
  });

  function initOptionSetImporter() {
    if (initialized) return;
    initialized = true;

    var TOOLKIT_NAME = "[CP Option Set Importer]";
    var STORAGE_KEY = "cp-toolkit-option-set-library";
    var EXPORT_TYPE = "cp-toolkit-option-set-library";
    var EXPORT_VERSION = 1;
    var DRAWER_ID = "cp-toolkit-option-set-importer-drawer";
    var STYLE_ID = "cp-toolkit-option-set-importer-style";
    var CLEAR_FIELDS = [
      "headerImageClear",
      "footerImageClear",
      "viewAllImageClear",
      "notifyMeLinkImageClear",
      "rssImageClear",
      "feed1ImageClear",
      "feed2ImageClear",
      "feed3ImageClear",
      "feed4ImageClear",
      "feed5ImageClear",
      "feed6ImageClear",
      "feed7ImageClear",
      "feed8ImageClear",
      "feed9ImageClear",
      "feed10ImageClear",
      "feed11ImageClear",
      "feed12ImageClear",
      "feed13ImageClear",
      "feed14ImageClear",
      "feed15ImageClear",
      "feed16ImageClear",
      "buttonHoverImageClear",
      "buttonImageClear"
    ];

    function isWidgetManagerPage() {
      return /\/designcenter\/widgets(?:\/|$)/i.test(window.location.pathname);
    }

    function isPlainObject(value) {
      return !!value && typeof value === "object" && !Array.isArray(value);
    }

    function normalizeText(value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    }

    function normalizeNumericID(value) {
      var text = String(value == null ? "" : value).trim();
      return /^\d+$/.test(text) ? text : "";
    }

    function normalizeComparableName(value) {
      return normalizeText(value).replace(/\s*\(Default\)\s*$/i, "").toLowerCase();
    }

    function escapeHtml(value) {
      var div = document.createElement("div");
      div.textContent = value == null ? "" : String(value);
      return div.innerHTML;
    }

    function slugify(value, fallback) {
      var slug = String(value || fallback || "option-set")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return slug || String(fallback || "option-set");
    }

    function createKey(name) {
      return [
        "option-set",
        slugify(name, "option-set"),
        Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      ].join("-");
    }

    function storageGet() {
      return new Promise(function(resolve) {
        if (!chrome.runtime || !chrome.runtime.id) {
          resolve({});
          return;
        }

        chrome.storage.local.get(STORAGE_KEY, function(result) {
          if (chrome.runtime.lastError) {
            console.warn(TOOLKIT_NAME + " Could not load option set library:", chrome.runtime.lastError);
            resolve({});
            return;
          }

          resolve(normalizeLibrary(result[STORAGE_KEY]));
        });
      });
    }

    function storageSet(library) {
      return new Promise(function(resolve, reject) {
        if (!chrome.runtime || !chrome.runtime.id) {
          resolve();
          return;
        }

        var payload = {};
        payload[STORAGE_KEY] = normalizeLibrary(library);
        chrome.storage.local.set(payload, function() {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          resolve();
        });
      });
    }

    function normalizeSaveJson(value) {
      if (isPlainObject(value) && typeof value.saveJson === "string") {
        return JSON.stringify({ saveJson: value.saveJson });
      }

      if (typeof value !== "string") {
        return JSON.stringify({ saveJson: "" });
      }

      var trimmed = value.trim();
      if (!trimmed) return JSON.stringify({ saveJson: "" });

      try {
        var parsed = JSON.parse(trimmed);
        if (isPlainObject(parsed) && typeof parsed.saveJson === "string") {
          return JSON.stringify({ saveJson: parsed.saveJson });
        }
      } catch (err) {
        // Raw splitter strings from older hand-built templates are accepted.
      }

      return JSON.stringify({ saveJson: trimmed });
    }

    function getSaveJsonInner(saveJson) {
      try {
        var parsed = JSON.parse(saveJson || "{}");
        return typeof parsed.saveJson === "string" ? parsed.saveJson : "";
      } catch (err) {
        return "";
      }
    }

    function countFields(saveJson) {
      var inner = getSaveJsonInner(saveJson);
      if (!inner) return 0;
      return inner.split("CPStringSplitter").filter(function(part) {
        return part.indexOf("-CPSplitter-") !== -1;
      }).length;
    }

    function normalizeOptionSetRecord(record, fallbackKey) {
      var source = isPlainObject(record) ? record : {};
      var name = normalizeText(source.name || source.optionSetName || fallbackKey) || "Option Set";
      var moduleWidgetID = normalizeNumericID(source.moduleWidgetID);
      var widgetName = normalizeText(source.widgetName) || (moduleWidgetID ? "Widget " + moduleWidgetID : "Widget");
      var now = new Date().toISOString();

      return {
        type: "optionSet",
        version: source.version || 1,
        name: name,
        moduleWidgetID: moduleWidgetID,
        widgetName: widgetName,
        category: normalizeText(source.category) || widgetName,
        defaultOptionSetID: normalizeNumericID(source.defaultOptionSetID),
        saveJson: normalizeSaveJson(source.saveJson),
        sourceSite: normalizeText(source.sourceSite || source.site || window.location.hostname),
        sourceUrl: String(source.sourceUrl || ""),
        sourceOptionSetID: normalizeNumericID(source.sourceOptionSetID),
        sourceSkinID: normalizeNumericID(source.sourceSkinID),
        notes: normalizeText(source.notes),
        savedAt: source.savedAt || source.createdAt || now,
        updatedAt: source.updatedAt || ""
      };
    }

    function normalizeLibrary(raw) {
      var source = isPlainObject(raw) ? raw : {};
      var items = source.optionSets && isPlainObject(source.optionSets) ? source.optionSets : source;
      var normalized = {};

      Object.keys(items || {}).forEach(function(key) {
        var record = items[key];
        if (!isPlainObject(record)) return;
        if (source.optionSets || record.saveJson || record.type === "optionSet") {
          normalized[key] = normalizeOptionSetRecord(record, key);
        }
      });

      return normalized;
    }

    function buildExportPayload(library) {
      return {
        type: EXPORT_TYPE,
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        optionSets: normalizeLibrary(library)
      };
    }

    function getWidgetSidebars() {
      return Array.prototype.slice.call(document.querySelectorAll(".sideBarWidgetParent"));
    }

    function getWidgetNameFromSidebar(sidebar, moduleWidgetID) {
      if (!sidebar) return moduleWidgetID ? "Widget " + moduleWidgetID : "Widget";
      var control = sidebar.querySelector(".cpExpandCollapseControl");
      var text = control ? normalizeText(control.textContent) : "";
      if (text) return text;

      var label = sidebar.querySelector("h2,h3,h4,.widgetTitle,.sideBarTitle");
      text = label ? normalizeText(label.textContent) : "";
      if (text) return text;

      return moduleWidgetID ? "Widget " + moduleWidgetID : "Widget";
    }

    function findWidgetSidebar(moduleWidgetID) {
      var id = String(moduleWidgetID || "");
      if (!id) return null;

      var sidebars = getWidgetSidebars();
      for (var i = 0; i < sidebars.length; i++) {
        if (sidebars[i].querySelector('.sideBarOptionSet[data-modulewidgetid="' + id + '"], .sideBarAddNewOptionSet[data-modulewidgetid="' + id + '"]')) {
          return sidebars[i];
        }
      }

      return document.getElementById("sideBarWidgetParent" + id);
    }

    function getOptionSetName(element) {
      if (!element) return "";
      return normalizeText(element.getAttribute("data-name") || element.textContent).replace(/\s*\(Default\)\s*$/i, "");
    }

    function getActiveOptionSet() {
      var active = document.querySelector(".sideBarOptionSet.active");
      if (!active) active = document.querySelector(".sideBarOptionSet");
      if (!active) return null;

      var moduleWidgetID = String(active.getAttribute("data-modulewidgetid") || "");
      var sidebar = findWidgetSidebar(moduleWidgetID) || active.closest(".sideBarWidgetParent");
      return {
        element: active,
        optionSetID: String(active.id || ""),
        name: getOptionSetName(active),
        moduleWidgetID: moduleWidgetID,
        widgetName: getWidgetNameFromSidebar(sidebar, moduleWidgetID),
        defaultOptionSetID: getDefaultOptionSetID(moduleWidgetID),
        sourceSkinID: getCurrentSkinID()
      };
    }

    function getDefaultOptionSetID(moduleWidgetID) {
      var sidebar = findWidgetSidebar(moduleWidgetID);
      if (!sidebar) return "";
      var optionSets = Array.prototype.slice.call(sidebar.querySelectorAll(".sideBarOptionSet"));
      var defaultItem = optionSets.find(function(item) {
        return /\(Default\)/i.test(normalizeText(item.textContent));
      });

      if (defaultItem && defaultItem.id) return String(defaultItem.id);
      return optionSets[0] && optionSets[0].id ? String(optionSets[0].id) : "";
    }

    function getCurrentSkinID() {
      var select = document.getElementById("skins");
      return select ? String(select.value || "") : "";
    }

    function findExistingOptionSet(moduleWidgetID, name) {
      var sidebar = findWidgetSidebar(moduleWidgetID);
      if (!sidebar) return null;
      var target = normalizeComparableName(name);
      var optionSets = Array.prototype.slice.call(sidebar.querySelectorAll(".sideBarOptionSet"));

      return optionSets.find(function(item) {
        return normalizeComparableName(getOptionSetName(item)) === target;
      }) || null;
    }

    function buildSaveJsonFromCurrentForm() {
      var fields = Array.prototype.slice.call(document.querySelectorAll(".update[name]"));
      var names = [];
      var groups = {};

      fields.forEach(function(field) {
        var name = field.name;
        if (!name) return;
        if (!groups[name]) {
          groups[name] = [];
          names.push(name);
        }
        groups[name].push(field);
      });

      var inner = names.map(function(name) {
        return name + "-CPSplitter-" + getSerializedFieldValue(groups[name]) + "CPStringSplitter";
      }).join("");

      return JSON.stringify({ saveJson: inner });
    }

    function getSerializedFieldValue(elements) {
      if (!elements || !elements.length) return "";
      var first = elements[0];
      var type = String(first.type || "").toLowerCase();

      if (type === "radio") {
        var checkedRadio = elements.find(function(item) { return item.checked; });
        return checkedRadio ? String(checkedRadio.value || "") : "";
      }

      if (type === "checkbox") {
        if (elements.length > 1) {
          var checkedValues = elements
            .filter(function(item) { return item.checked; })
            .map(function(item) { return String(item.value || ""); })
            .filter(Boolean);
          return checkedValues.length ? checkedValues.join(",") + "," : "";
        }
        return first.checked ? "true" : "false";
      }

      var value = first.value == null ? "" : String(first.value);
      var unitSelect = null;
      if (first.id) unitSelect = document.getElementById(first.id + "Units");
      if (!unitSelect && first.name) unitSelect = document.getElementById(first.name + "Units");
      if (value && unitSelect && unitSelect.tagName === "SELECT") {
        value += unitSelect.value || "";
      }
      return value;
    }

    function createCurrentRecord(customName, category, notes) {
      var active = getActiveOptionSet();
      if (!active) {
        throw new Error("Select an option set in Widget Manager first.");
      }

      var name = normalizeText(customName) || active.name;
      if (!name) {
        throw new Error("Option set name is required.");
      }

      return normalizeOptionSetRecord({
        name: name,
        moduleWidgetID: active.moduleWidgetID,
        widgetName: active.widgetName,
        category: normalizeText(category) || active.widgetName,
        defaultOptionSetID: active.defaultOptionSetID,
        saveJson: (function() {
          var saveJson = buildSaveJsonFromCurrentForm();
          if (countFields(saveJson) === 0) {
            throw new Error("No option-set settings were found. Select an option set and wait for its settings form to load.");
          }
          return saveJson;
        })(),
        sourceSite: window.location.hostname,
        sourceUrl: window.location.href,
        sourceOptionSetID: active.optionSetID,
        sourceSkinID: active.sourceSkinID,
        notes: notes
      });
    }

    function postForm(url, data) {
      var body = new URLSearchParams();
      Object.keys(data).forEach(function(key) {
        body.set(key, data[key] == null ? "" : String(data[key]));
      });

      return fetch(window.location.origin + url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: body.toString()
      }).then(function(response) {
        return response.text().then(function(text) {
          if (!response.ok) {
            throw new Error("Request failed: " + response.status + " " + response.statusText);
          }
          return text;
        });
      });
    }

    async function createOptionSet(name, moduleWidgetID) {
      var text = await postForm("/DesignCenter/OptionSet/Add", {
        setName: name,
        pageID: "",
        moduleWidgetID: moduleWidgetID
      });

      var response;
      try {
        response = JSON.parse(text);
      } catch (err) {
        throw new Error("Create response was not JSON.");
      }

      var id = response && response.ID;
      if (!id || parseInt(id, 10) <= 0) {
        throw new Error("CMS did not return a valid option set ID.");
      }

      return String(id);
    }

    async function saveOptionSet(record, optionSetID, optionSetName) {
      var moduleWidgetID = String(record.moduleWidgetID || "");
      var defaultOptionSetID = getDefaultOptionSetID(moduleWidgetID) || record.defaultOptionSetID;
      var skinID = getCurrentSkinID() || record.sourceSkinID || "";
      var data = {
        defaultOptionSetID: defaultOptionSetID,
        pageID: "",
        moduleWidgetID: moduleWidgetID,
        optionSetName: optionSetName,
        skinID: skinID,
        saveJson: normalizeSaveJson(record.saveJson),
        optionSetID: optionSetID
      };

      CLEAR_FIELDS.forEach(function(field) {
        data[field] = "";
      });

      await postForm("/DesignCenter/Widgets/Save", data);
    }

    async function importOptionSet(record, requestedName) {
      var normalized = normalizeOptionSetRecord(record);
      var name = normalizeText(requestedName || normalized.name);
      if (!name) throw new Error("Option set name is required.");

      if (!normalized.moduleWidgetID) {
        throw new Error("Saved option set is missing a moduleWidgetID.");
      }

      if (!findWidgetSidebar(normalized.moduleWidgetID)) {
        throw new Error("Widget type " + normalized.moduleWidgetID + " was not found on this Widget Manager page.");
      }

      if (findExistingOptionSet(normalized.moduleWidgetID, name)) {
        throw new Error('An option set named "' + name + '" already exists for this widget type. Rename it before importing.');
      }

      var optionSetID = await createOptionSet(name, normalized.moduleWidgetID);
      await saveOptionSet(normalized, optionSetID, name);
      return optionSetID;
    }

    function addStyles() {
      if (document.getElementById(STYLE_ID)) return;

      var style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = [
        ".cp-os-drawer-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.26);z-index:10000000;display:flex;justify-content:flex-end;font-family:Segoe UI,Arial,sans-serif;color:#243043}",
        ".cp-os-drawer{width:min(520px,100vw);height:100vh;background:#fff;box-shadow:-12px 0 32px rgba(17,24,39,.28);display:flex;flex-direction:column}",
        ".cp-os-header{background:#af282f;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}",
        ".cp-os-header h2{font-size:17px;line-height:1.2;margin:0;font-weight:700}",
        ".cp-os-close{width:32px;height:32px;margin:0;border:1px solid rgba(255,255,255,.45);background:transparent;color:#fff;border-radius:4px;font-size:22px;line-height:1;cursor:pointer}",
        ".cp-os-tabs{display:flex;border-bottom:1px solid #d9e0ea;background:#f6f8fb}",
        ".cp-os-tab{flex:1;height:38px;margin:0;border:0;border-right:1px solid #d9e0ea;background:#f6f8fb;color:#334155;font-size:12px;font-weight:700;cursor:pointer}",
        ".cp-os-tab.active{background:#fff;color:#af282f;border-bottom:2px solid #af282f}",
        ".cp-os-body{padding:14px 16px;overflow:auto;flex:1}",
        ".cp-os-panel{display:none}",
        ".cp-os-panel.active{display:block}",
        ".cp-os-field{display:grid;gap:5px;margin-bottom:10px}",
        ".cp-os-field label,.cp-os-label{font-size:11px;font-weight:700;color:#4b5c74;text-transform:uppercase;letter-spacing:.02em}",
        ".cp-os-field input,.cp-os-field textarea,.cp-os-row input{border:1px solid #c8d3e1;border-radius:4px;padding:8px 9px;font-size:13px;color:#243043;box-sizing:border-box;width:100%;background:#fff}",
        ".cp-os-field textarea{min-height:56px;resize:vertical}",
        ".cp-os-current,.cp-os-row,.cp-os-empty,.cp-os-note{border:1px solid #dbe3ee;background:#f8fafc;border-radius:8px;padding:10px;margin-bottom:10px}",
        ".cp-os-current-title,.cp-os-row-title{font-weight:700;font-size:13px;color:#233044;margin-bottom:4px}",
        ".cp-os-category-section{margin:0 0 14px}",
        ".cp-os-category-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px;padding:7px 9px;border:1px solid #d5dfeb;border-radius:6px;background:#eef4fb;color:#233044;font-size:12px;font-weight:800}",
        ".cp-os-category-header span{font-size:11px;font-weight:700;color:#64748b}",
        ".cp-os-json-list{display:grid;gap:5px;margin-top:9px}",
        ".cp-os-json-item{display:flex;justify-content:space-between;gap:8px;border:1px solid #dbe3ee;border-radius:5px;background:#fff;padding:6px 8px;font-size:12px;color:#334155}",
        ".cp-os-json-item span{color:#64748b;font-size:11px;white-space:nowrap}",
        ".cp-os-meta{font-size:11px;color:#64748b;display:flex;flex-wrap:wrap;gap:6px}",
        ".cp-os-meta span{background:#eef2f7;border:1px solid #d9e1ec;border-radius:999px;padding:2px 7px}",
        ".cp-os-note{font-size:12px;line-height:1.4;color:#475569;background:#fffaf0;border-color:#f3d38b}",
        ".cp-os-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:10px}",
        ".cp-os-button{width:auto;margin:0;border:1px solid #b8c4d4;border-radius:4px;background:#fff;color:#26364d;font-size:12px;font-weight:700;padding:8px 11px;cursor:pointer}",
        ".cp-os-button.primary{border-color:#af282f;background:#af282f;color:#fff}",
        ".cp-os-button.danger{border-color:#c2414b;color:#9f1d28;background:#fff5f6}",
        ".cp-os-button:disabled{cursor:not-allowed;opacity:.55}",
        ".cp-os-button:not(:disabled):hover{border-color:#af282f;color:#af282f;background:#fff7f8}",
        ".cp-os-button.primary:not(:disabled):hover{background:#8c2026;color:#fff}",
        ".cp-os-row{display:grid;gap:8px}",
        ".cp-os-row-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}",
        ".cp-os-row-name{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}",
        ".cp-os-status{font-size:12px;min-height:18px;color:#475569;margin-top:8px}",
        ".cp-os-status.success{color:#1f7a3f}",
        ".cp-os-status.error{color:#b4232f}",
        ".cp-os-empty{font-size:12px;color:#64748b;text-align:center;padding:18px 10px}",
        ".cp-os-file{display:none}",
        ".cp-os-footer{border-top:1px solid #d9e0ea;padding:10px 16px;background:#f8fafc;font-size:11px;color:#64748b}"
      ].join("\n");
      document.documentElement.appendChild(style);
    }

    async function openDrawer() {
      if (!isWidgetManagerPage()) {
        alert("Option Set Importer can only run on Widget Manager.");
        return;
      }

      await waitForBody();
      addStyles();

      var existing = document.getElementById(DRAWER_ID);
      if (existing) existing.remove();

      var library = await storageGet();
      var active = getActiveOptionSet();

      var backdrop = document.createElement("div");
      backdrop.id = DRAWER_ID;
      backdrop.className = "cp-os-drawer-backdrop";
      backdrop.innerHTML = [
        '<aside class="cp-os-drawer" role="dialog" aria-modal="true" aria-label="Option Set Importer">',
        '  <div class="cp-os-header">',
        "    <h2>Option Set Importer</h2>",
        '    <button type="button" class="cp-os-close" aria-label="Close">&times;</button>',
        "  </div>",
        '  <div class="cp-os-tabs">',
        '    <button type="button" class="cp-os-tab active" data-tab="save">Save Current</button>',
        '    <button type="button" class="cp-os-tab" data-tab="import">Import Saved</button>',
        '    <button type="button" class="cp-os-tab" data-tab="json">Import / Export</button>',
        "  </div>",
        '  <div class="cp-os-body">',
        '    <section class="cp-os-panel active" data-panel="save"></section>',
        '    <section class="cp-os-panel" data-panel="import"></section>',
        '    <section class="cp-os-panel" data-panel="json"></section>',
        "  </div>",
        '  <div class="cp-os-footer">Creates new option sets first, then applies saved settings. Existing exact-name matches are not overwritten.</div>',
        "</aside>"
      ].join("");

      document.body.appendChild(backdrop);

      function renderAll() {
        renderSavePanel(backdrop, active, library);
        renderImportPanel(backdrop, library);
        renderJsonPanel(backdrop, library);
      }

      backdrop.querySelector(".cp-os-close").addEventListener("click", function() {
        backdrop.remove();
      });

      backdrop.addEventListener("click", function(e) {
        if (e.target === backdrop) backdrop.remove();
      });

      backdrop.querySelectorAll(".cp-os-tab").forEach(function(tab) {
        tab.addEventListener("click", function() {
          var name = tab.getAttribute("data-tab");
          backdrop.querySelectorAll(".cp-os-tab").forEach(function(item) {
            item.classList.toggle("active", item === tab);
          });
          backdrop.querySelectorAll(".cp-os-panel").forEach(function(panel) {
            panel.classList.toggle("active", panel.getAttribute("data-panel") === name);
          });
        });
      });

      backdrop.addEventListener("cp-option-set-library-updated", async function() {
        library = await storageGet();
        active = getActiveOptionSet();
        renderAll();
      });

      renderAll();
    }

    function renderSavePanel(root, active, library) {
      var panel = root.querySelector('[data-panel="save"]');
      if (!active) {
        panel.innerHTML = '<div class="cp-os-empty">Select an option set in Widget Manager before saving it to the library.</div>';
        return;
      }

      panel.innerHTML = [
        '<div class="cp-os-current">',
        '  <div class="cp-os-current-title">' + escapeHtml(active.name || "Selected Option Set") + "</div>",
        '  <div class="cp-os-meta">',
        "    <span>" + escapeHtml(active.widgetName) + "</span>",
        "    <span>moduleWidgetID " + escapeHtml(active.moduleWidgetID) + "</span>",
        "    <span>optionSetID " + escapeHtml(active.optionSetID) + "</span>",
        "  </div>",
        "</div>",
        '<div class="cp-os-note">Category IDs and image references are saved as-is from the current site. Review imported option sets when moving between sites with different module categories.</div>',
        '<div class="cp-os-field">',
        "  <label>Name in library</label>",
        '  <input type="text" class="cp-os-save-name" value="' + escapeHtml(active.name) + '" />',
        "</div>",
        '<div class="cp-os-field">',
        "  <label>Category</label>",
        '  <input type="text" class="cp-os-save-category" value="' + escapeHtml(active.widgetName) + '" />',
        "</div>",
        '<div class="cp-os-field">',
        "  <label>Notes</label>",
        '  <textarea class="cp-os-save-notes" placeholder="Optional context for teammates"></textarea>',
        "</div>",
        '<div class="cp-os-actions">',
        '  <button type="button" class="cp-os-button primary cp-os-save-current">Save Current Option Set</button>',
        "</div>",
        '<div class="cp-os-status"></div>'
      ].join("");

      panel.querySelector(".cp-os-save-current").addEventListener("click", async function() {
        var status = panel.querySelector(".cp-os-status");
        try {
          var name = panel.querySelector(".cp-os-save-name").value;
          var category = panel.querySelector(".cp-os-save-category").value;
          var notes = panel.querySelector(".cp-os-save-notes").value;
          var record = createCurrentRecord(name, category, notes);
          var key = createKey(record.name);
          var next = Object.assign({}, library);
          next[key] = record;
          await storageSet(next);
          status.className = "cp-os-status success";
          status.textContent = 'Saved "' + record.name + '" with ' + countFields(record.saveJson) + " setting fields.";
          root.dispatchEvent(new CustomEvent("cp-option-set-library-updated"));
        } catch (err) {
          status.className = "cp-os-status error";
          status.textContent = err.message || String(err);
        }
      });
    }

    function renderImportPanel(root, library) {
      var panel = root.querySelector('[data-panel="import"]');
      var rows = Object.keys(library || {}).map(function(key) {
        return {
          key: key,
          record: normalizeOptionSetRecord(library[key], key)
        };
      }).sort(function(a, b) {
        var aCategory = a.record.category || a.record.widgetName || "";
        var bCategory = b.record.category || b.record.widgetName || "";
        return String(aCategory + a.record.widgetName + a.record.name).localeCompare(String(bCategory + b.record.widgetName + b.record.name));
      });

      if (!rows.length) {
        panel.innerHTML = '<div class="cp-os-empty">No saved option sets yet. Use Save Current or import a library JSON file.</div>';
        return;
      }

      var groups = [];
      rows.forEach(function(row) {
        var category = row.record.category || row.record.widgetName || "Uncategorized";
        var group = groups.find(function(item) { return item.category === category; });
        if (!group) {
          group = { category: category, rows: [] };
          groups.push(group);
        }
        group.rows.push(row);
      });

      panel.innerHTML = groups.map(function(group) {
        return [
          '<section class="cp-os-category-section">',
          '  <div class="cp-os-category-header">' + escapeHtml(group.category) + '<span>' + group.rows.length + " option set" + (group.rows.length === 1 ? "" : "s") + "</span></div>",
          group.rows.map(function(row) {
            var key = row.key;
            var record = row.record;
            var sidebar = findWidgetSidebar(record.moduleWidgetID);
            var existing = sidebar ? findExistingOptionSet(record.moduleWidgetID, record.name) : null;
            return [
              '<div class="cp-os-row" data-key="' + escapeHtml(key) + '">',
              '  <div class="cp-os-row-header">',
              "    <div>",
              '      <div class="cp-os-row-title">' + escapeHtml(record.name) + "</div>",
              '      <div class="cp-os-meta">',
              "        <span>" + escapeHtml(record.widgetName) + "</span>",
              "        <span>moduleWidgetID " + escapeHtml(record.moduleWidgetID) + "</span>",
              "        <span>" + countFields(record.saveJson) + " fields</span>",
              record.sourceSite ? "        <span>" + escapeHtml(record.sourceSite) + "</span>" : "",
              "      </div>",
              "    </div>",
              '    <button type="button" class="cp-os-button danger cp-os-delete">Delete</button>',
              "  </div>",
              '  <div class="cp-os-row-name">',
              '    <input type="text" class="cp-os-import-name" value="' + escapeHtml(record.name) + '" />',
              '    <button type="button" class="cp-os-button primary cp-os-import" ' + (!sidebar || existing ? "disabled" : "") + ">Import</button>",
              "  </div>",
              '  <div class="cp-os-status ' + (!sidebar || existing ? "error" : "") + '">' +
                (!sidebar ? "Widget type not found on this page." : existing ? "Exact name already exists. Rename before importing." : "") +
              "</div>",
              "</div>"
            ].join("");
          }).join(""),
          "</section>"
        ].join("");
      }).join("");

      panel.querySelectorAll(".cp-os-row").forEach(function(row) {
        var key = row.getAttribute("data-key");
        var record = normalizeOptionSetRecord(library[key], key);
        var input = row.querySelector(".cp-os-import-name");
        var button = row.querySelector(".cp-os-import");
        var status = row.querySelector(".cp-os-status");

        input.addEventListener("input", function() {
          var sidebar = findWidgetSidebar(record.moduleWidgetID);
          var exists = sidebar ? findExistingOptionSet(record.moduleWidgetID, input.value) : null;
          button.disabled = !sidebar || !normalizeText(input.value) || !!exists;
          status.className = "cp-os-status" + (exists || !sidebar ? " error" : "");
          status.textContent = !sidebar ? "Widget type not found on this page." : exists ? "Exact name already exists. Rename before importing." : "";
        });

        button.addEventListener("click", async function() {
          button.disabled = true;
          status.className = "cp-os-status";
          status.textContent = "Creating option set...";
          try {
            var newID = await importOptionSet(record, input.value);
            status.className = "cp-os-status success";
            status.textContent = 'Imported as optionSetID ' + newID + ". Reload Widget Manager to see it in the sidebar.";
          } catch (err) {
            status.className = "cp-os-status error";
            status.textContent = err.message || String(err);
            button.disabled = false;
          }
        });

        row.querySelector(".cp-os-delete").addEventListener("click", async function() {
          if (!confirm('Delete "' + record.name + '" from the local option set library?')) return;
          var next = Object.assign({}, library);
          delete next[key];
          await storageSet(next);
          root.dispatchEvent(new CustomEvent("cp-option-set-library-updated"));
        });
      });

      var actions = document.createElement("div");
      actions.className = "cp-os-actions";
      actions.innerHTML = '<button type="button" class="cp-os-button cp-os-reload">Reload Widget Manager</button>';
      panel.appendChild(actions);
      actions.querySelector(".cp-os-reload").addEventListener("click", function() {
        window.location.reload();
      });
    }

    function renderJsonPanel(root, library) {
      var panel = root.querySelector('[data-panel="json"]');
      var savedItems = Object.keys(library || {}).map(function(key) {
        return normalizeOptionSetRecord(library[key], key);
      }).sort(function(a, b) {
        return String((a.category || "") + a.name).localeCompare(String((b.category || "") + b.name));
      });
      var count = savedItems.length;
      var itemHtml = savedItems.length
        ? '<div class="cp-os-json-list">' + savedItems.map(function(record) {
            return '<div class="cp-os-json-item">' + escapeHtml(record.name) + '<span>' + escapeHtml(record.category || record.widgetName || "Uncategorized") + '</span></div>';
          }).join("") + "</div>"
        : "";

      panel.innerHTML = [
        '<div class="cp-os-current">',
        '  <div class="cp-os-current-title">Import / Export Local Library</div>',
        '  <div class="cp-os-meta"><span>' + count + " saved option set" + (count === 1 ? "" : "s") + "</span></div>",
        '  <div class="cp-os-note">This is the Option Set Importer library saved in this browser. It is separate from Widget Manager and only contains option sets you saved or imported into the toolkit.</div>',
        itemHtml,
        "</div>",
        '<div class="cp-os-actions">',
        '  <button type="button" class="cp-os-button cp-os-import-json">Import JSON</button>',
        '  <button type="button" class="cp-os-button primary cp-os-export-json">Export JSON</button>',
        "</div>",
        '<input type="file" class="cp-os-file" accept=".json,application/json" />',
        '<div class="cp-os-status"></div>'
      ].join("");

      var fileInput = panel.querySelector(".cp-os-file");
      var status = panel.querySelector(".cp-os-status");

      panel.querySelector(".cp-os-export-json").addEventListener("click", function() {
        if (!count) {
          status.className = "cp-os-status error";
          status.textContent = "No saved option sets to export.";
          return;
        }

        var payload = buildExportPayload(library);
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "cp-toolkit-option-set-library.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
      });

      panel.querySelector(".cp-os-import-json").addEventListener("click", function() {
        fileInput.click();
      });

      fileInput.addEventListener("change", async function(e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;

        try {
          var text = await file.text();
          var parsed = JSON.parse(text);
          var incoming = normalizeLibrary(parsed.type === EXPORT_TYPE ? parsed : parsed.optionSets ? parsed : parsed);
          var keys = Object.keys(incoming);
          if (!keys.length) {
            throw new Error("No option sets found in that file.");
          }

          var next = Object.assign({}, library);
          keys.forEach(function(key) {
            var record = normalizeOptionSetRecord(incoming[key], key);
            next[createKey(record.name)] = record;
          });
          await storageSet(next);
          status.className = "cp-os-status success";
          status.textContent = "Imported " + keys.length + " option set" + (keys.length === 1 ? "" : "s") + ".";
          root.dispatchEvent(new CustomEvent("cp-option-set-library-updated"));
        } catch (err) {
          status.className = "cp-os-status error";
          status.textContent = err.message || String(err);
        } finally {
          fileInput.value = "";
        }
      });
    }

    function waitForBody() {
      return new Promise(function(resolve) {
        if (document.body) {
          resolve();
          return;
        }
        document.addEventListener("DOMContentLoaded", function() { resolve(); }, { once: true });
      });
    }

    if (chrome.runtime && chrome.runtime.id) {
      chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        if (!message || message.action !== "openOptionSetImporter") return;

        openDrawer()
          .then(function() {
            sendResponse({ success: true });
          })
          .catch(function(err) {
            console.warn(TOOLKIT_NAME + " Could not open:", err);
            sendResponse({ success: false, error: err.message || String(err) });
          });
        return true;
      });
    }

    console.log(TOOLKIT_NAME + " Ready");
  }
})();
