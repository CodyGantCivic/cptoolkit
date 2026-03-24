(function loadTool() {
  var thisTool = "cp-InfoAdvancedImportExport";
  var SCRIPT_REV = "iaie-2026-03-24-05";

  function hasExtensionContext() {
    try {
      return !!(
        chrome &&
        chrome.runtime &&
        chrome.runtime.id &&
        chrome.storage &&
        chrome.storage.local
      );
    } catch (_) {
      return false;
    }
  }

  function safeGet(keys, cb) {
    if (!hasExtensionContext()) {
      if (typeof cb === "function") cb({});
      return;
    }
    try {
      chrome.storage.local.get(keys, function(result) {
        if (!hasExtensionContext()) {
          if (typeof cb === "function") cb({});
          return;
        }
        if (chrome.runtime.lastError) {
          if (typeof cb === "function") cb({});
          return;
        }
        if (typeof cb === "function") cb(result || {});
      });
    } catch (_) {
      if (typeof cb === "function") cb({});
    }
  }

  function safeSet(value, cb) {
    if (!hasExtensionContext()) {
      if (typeof cb === "function") cb();
      return;
    }
    try {
      chrome.storage.local.set(value, function() {
        if (!hasExtensionContext()) {
          if (typeof cb === "function") cb();
          return;
        }
        if (chrome.runtime.lastError) {
          if (typeof cb === "function") cb();
          return;
        }
        if (typeof cb === "function") cb();
      });
    } catch (_) {
      if (typeof cb === "function") cb();
    }
  }

  function safeRemove(keys, cb) {
    if (!hasExtensionContext()) {
      if (typeof cb === "function") cb();
      return;
    }
    try {
      chrome.storage.local.remove(keys, function() {
        if (typeof cb === "function") cb();
      });
    } catch (_) {
      if (typeof cb === "function") cb();
    }
  }

  safeGet(thisTool, function(settings) {
    function boot() {
      if (settings[thisTool] === false) return;
      try {
        init();
      } catch (err) {
        console.warn("[CP Toolkit](" + thisTool + ") Error:", err);
      }
    }
    try {
      if (typeof detect_if_cp_site === "function") {
        detect_if_cp_site(function() {
          if (!hasExtensionContext()) return;
          boot();
        });
      } else {
        boot();
      }
    } catch (e) {
      if (!hasExtensionContext()) return;
      boot();
    }
  });

  function init() {
    if ((window.location.pathname || "").toLowerCase() !== "/admin/infoii.aspx") return;
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", init, { once: true });
      return;
    }
    if (window.__cpInfoAdvancedImportExportRev !== SCRIPT_REV) {
      window.__cpInfoAdvancedImportExportRev = SCRIPT_REV;
      console.info("[CP Toolkit][Info Advanced] Script active:", SCRIPT_REV);
    }

    var LIBRARY_KEY = "cp-info-advanced-item-library";
    var PENDING_EXPORT_KEY = "cp-pendingInfoAdvancedExport";
    var PENDING_IMPORT_KEY = "cp-pendingInfoAdvancedImport";
    var PENDING_RETURN_KEY = "cp-pendingInfoAdvancedCategoryReturn";
    var EXP_MODAL_ID = "cp-toolkit-info-export-modal";
    var IMP_MODAL_ID = "cp-toolkit-info-import-modal";
    var pendingImportNavAttemptAt = 0;
    var pendingExportRetryAttemptAt = 0;
    var domObserver = null;

    handlePendingReturn();
    handlePendingExport();
    handlePendingImport();
    addImportItemButton();
    injectExportOptions();

    setTimeout(function() {
      if (!hasExtensionContext()) return;
      addImportItemButton();
      injectExportOptions();
      handlePendingExport();
      handlePendingImport();
    }, 700);

    domObserver = new MutationObserver(function() {
      if (!hasExtensionContext()) {
        try { domObserver.disconnect(); } catch (_) {}
        return;
      }
      addImportItemButton();
      injectExportOptions();
      handlePendingExport();
      handlePendingImport();
    });
    domObserver.observe(document.body, { childList: true, subtree: true });

    function injectExportOptions() {
      if (!hasExtensionContext()) return;
      document.querySelectorAll('select[onchange*="linkDetails"]').forEach(function(sel) {
        if (sel.querySelector('option[value="ExportJSON"]')) return;
        var opt = document.createElement("option");
        opt.value = "ExportJSON";
        opt.textContent = "Export JSON";
        sel.appendChild(opt);
      });
      if (window.__cpInfoExportHooked) return;
      try {
        window.__cpInfoExportHooked = true;
      } catch (_) {
        return;
      }
      document.addEventListener("change", function(e) {
        if (!hasExtensionContext()) return;
        var sel = e.target;
        if (!sel || sel.tagName !== "SELECT" || sel.value !== "ExportJSON") return;
        sel.value = "choose";
        var m = (sel.getAttribute("onchange") || "").match(/linkDetails\((\d+)/);
        if (!m) return;
        startExport(m[1]);
      }, true);
    }

    function startExport(itemID) {
      safeSet({
        [PENDING_EXPORT_KEY]: {
          id: String(itemID),
          ts: Date.now(),
          returnUrl: window.location.href,
          categoryID: currentCategoryID()
        }
      }, function() {
        var form = document.forms["frmQLLinkList"];
        if (form) {
          setField(form, "strAction", "qlLinkModify");
          setField(form, "ysnSave", "0");
          setField(form, "ysnCopy", "0");
          setField(form, "intQLLinkID", String(itemID));
          form.submit();
          return;
        }
        if (typeof window.linkDetails === "function") window.linkDetails(String(itemID));
      });
    }

    function handlePendingExport() {
      safeGet(PENDING_EXPORT_KEY, function(data) {
        var pending = data[PENDING_EXPORT_KEY];
        if (!pending) return;
        if (pending.ts && Date.now() - pending.ts > 60000) {
          safeRemove(PENDING_EXPORT_KEY);
          return;
        }
        var form = infoForm();
        if (!isRealItemEditorForm(form)) {
          if (Date.now() - pendingExportRetryAttemptAt > 300) {
            pendingExportRetryAttemptAt = Date.now();
            setTimeout(handlePendingExport, 320);
          }
          return;
        }
        pendingExportRetryAttemptAt = 0;
        prepareEditorForExport(form, function() {
          if (!hasExtensionContext()) return;
          var activeForm = infoForm() || form;
          var payload = buildPayload(activeForm, pending.id);
          safeRemove(PENDING_EXPORT_KEY);
          showExportModal(payload, pending);
        });
      });
    }

    function prepareEditorForExport(form, done) {
      var attempts = 0;
      var maxAttempts = 14;

      function pass() {
        if (!hasExtensionContext()) return;
        var activeForm = infoForm() || form;
        activateContentTab(activeForm);
        forceOpenHtmlCodeView();
        attemptEnableCodeView(activeForm);

        var editors = captureRichEditors(activeForm);
        var hasMeaningful = editors.some(function(ed) { return ed && !isEmptyRichHtml(ed.html); });
        var hasAnySurface = editors.length > 0;

        if (hasMeaningful || attempts >= maxAttempts || (attempts >= 4 && hasAnySurface)) {
          try {
            console.info(
              "[CP Toolkit][Info Advanced] Export prep complete",
              { attempts: attempts, editorSources: editors.map(function(ed) { return ed.source; }), nonEmpty: editors.filter(function(ed) { return !isEmptyRichHtml(ed.html); }).length }
            );
          } catch (_) {}
          if (typeof done === "function") done();
          return;
        }

        attempts += 1;
        setTimeout(pass, 180);
      }

      pass();
    }

    function handlePendingReturn() {
      safeGet(PENDING_RETURN_KEY, function(data) {
        var pending = data[PENDING_RETURN_KEY];
        if (!pending) return;
        safeRemove(PENDING_RETURN_KEY);
        if (pending.ts && Date.now() - pending.ts > 25000) return;
        if (!pending.categoryID) return;
        if (typeof window.categoryDetails === "function") {
          try {
            window.categoryDetails(String(pending.categoryID), null);
            return;
          } catch (_) {}
        }
        var form = document.forms["frmQLCategoryList"];
        if (!form) return;
        setField(form, "strAction", "qlLinkList");
        setField(form, "intQLCategoryID", String(pending.categoryID));
        setField(form, "lngContainerID", "");
        setField(form, "ysnSave", "0");
        form.submit();
      });
    }

    function handlePendingImport() {
      safeGet(PENDING_IMPORT_KEY, function(data) {
        var pending = data[PENDING_IMPORT_KEY];
        if (!pending) return;
        if (pending.ts && Date.now() - pending.ts > 60000) {
          safeRemove(PENDING_IMPORT_KEY);
          return;
        }
        var form = infoForm();
        if (!isRealItemEditorForm(form)) {
          if (
            pending.categoryID &&
            Date.now() - pendingImportNavAttemptAt > 1500
          ) {
            pendingImportNavAttemptAt = Date.now();
            console.info("[CP Toolkit][Info Advanced] Pending import found on non-editor page; reopening Add Item flow.", pending.categoryID);
            openAddForCategory(String(pending.categoryID));
          }
          return;
        }
        applyPayload(form, pending.payload);
        safeRemove(PENDING_IMPORT_KEY);
        showToast("Imported JSON into new item form. Review and save.");
      });
    }

    function addImportItemButton() {
      var addBtn = findAddItemButton();
      if (!addBtn) return;
      var parsedCategoryID = parseCategoryFromAddItemButton(addBtn);
      if (parsedCategoryID) window.__cpInfoDefaultCategoryID = parsedCategoryID;
      if (document.querySelector("input[data-cp-info-import='1']")) return;
      var btn = document.createElement("input");
      btn.type = "button";
      btn.className = "cp-button";
      btn.value = "Import Item";
      btn.dataset.cpInfoImport = "1";
      btn.style.cssText = "background-color:#d3d657;border-bottom-color:#b3b64a;color:#333;margin-left:5px;line-height:41px;";
      btn.addEventListener("click", openImportModal);
      addBtn.insertAdjacentElement("afterend", btn);
    }

    function openImportModal() {
      var old = document.getElementById(IMP_MODAL_ID);
      if (old) old.remove();
      var overlay = document.createElement("div");
      overlay.id = IMP_MODAL_ID;
      overlay.innerHTML =
        '<style>#' + IMP_MODAL_ID + '{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif}' +
        '#' + IMP_MODAL_ID + ' .d{background:#fff;border-radius:8px;width:1060px;max-width:96vw;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.3)}' +
        '#' + IMP_MODAL_ID + ' .h{padding:16px 20px;border-bottom:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center}' +
        '#' + IMP_MODAL_ID + ' .h h3{margin:0;font-size:20px;font-weight:700;color:#1f2f3f}' +
        '#' + IMP_MODAL_ID + ' .x{background:none;border:none;font-size:24px;line-height:1;cursor:pointer}' +
        '#' + IMP_MODAL_ID + ' .tabs{display:flex;gap:0;border-bottom:1px solid #e0e0e0;padding:0 14px;background:#f9fbfd}' +
        '#' + IMP_MODAL_ID + ' .tab{border:none;background:transparent;padding:12px 14px;font-size:13px;font-weight:600;letter-spacing:.02em;color:#4d5f70;cursor:pointer}' +
        '#' + IMP_MODAL_ID + ' .tab.active{color:#133b5f;box-shadow:inset 0 -2px 0 #1f557f}' +
        '#' + IMP_MODAL_ID + ' .b{padding:14px;display:flex;flex-direction:column;gap:14px;overflow:hidden;flex:1 1 auto;min-height:0}' +
        '#' + IMP_MODAL_ID + ' .panel{display:none;min-height:0;flex:1 1 auto}' +
        '#' + IMP_MODAL_ID + ' .panel.active{display:flex;flex-direction:column}' +
        '#' + IMP_MODAL_ID + ' .lib{display:flex;flex-direction:column;min-height:0;flex:1 1 auto}' +
        '#' + IMP_MODAL_ID + ' .list{padding:4px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;overflow:auto;min-height:0;max-height:100%}' +
        '#' + IMP_MODAL_ID + ' .row{position:relative;border:1px solid #d0d8e0;border-radius:8px;background:#fff;box-shadow:0 2px 8px rgba(14,30,45,.06)}' +
        '#' + IMP_MODAL_ID + ' .row:hover{border-color:#b8c7d5;box-shadow:0 6px 14px rgba(14,30,45,.10)}' +
        '#' + IMP_MODAL_ID + ' .item{border:none;background:transparent;border-radius:8px;padding:48px 14px 14px;text-align:left;font-size:12px;cursor:pointer;display:flex;flex-direction:column;gap:6px;min-height:158px;width:100%}' +
        '#' + IMP_MODAL_ID + ' .item.is-dark{background:#1f2a36}' +
        '#' + IMP_MODAL_ID + ' .item.is-dark .item-name{color:#eef5fb}' +
        '#' + IMP_MODAL_ID + ' .item.is-dark .item-meta,#' + IMP_MODAL_ID + ' .item.is-dark .item-snippet{color:#c7d6e4}' +
        '#' + IMP_MODAL_ID + ' .item:focus{outline:2px solid #af282f;outline-offset:2px}' +
        '#' + IMP_MODAL_ID + ' .item-name{font-weight:700;color:#1f2f3f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '#' + IMP_MODAL_ID + ' .item-meta{font-size:11px;color:#4a5a68;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '#' + IMP_MODAL_ID + ' .item-snippet{font-size:11px;color:#6a7682;line-height:1.35;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:44px}' +
        '#' + IMP_MODAL_ID + ' .row-actions{position:absolute;top:8px;right:8px;display:flex;gap:6px;z-index:2}' +
        '#' + IMP_MODAL_ID + ' .act{min-width:28px;height:26px;border:1px solid #ccd6e0;background:#f6f9fc;color:#415569;border-radius:4px;cursor:pointer;line-height:1;font-size:11px;font-weight:600;padding:0 8px}' +
        '#' + IMP_MODAL_ID + ' .act.preview-pill{position:absolute;top:8px;left:8px;z-index:2;min-width:0;height:24px;padding:0 12px;border:none;background:#af282f;color:#fff;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.02em;box-shadow:0 2px 8px rgba(175,40,47,.35)}' +
        '#' + IMP_MODAL_ID + ' .act.preview-pill:hover{background:#c3343b}' +
        '#' + IMP_MODAL_ID + ' .act.active{background:#1f2a36;border-color:#1f2a36;color:#fff}' +
        '#' + IMP_MODAL_ID + ' .act:hover{background:#2b5f91;border-color:#2b5f91;color:#fff}' +
        '#' + IMP_MODAL_ID + ' .act.del:hover{background:#8f1f25;border-color:#8f1f25}' +
        '#' + IMP_MODAL_ID + ' .json-panel{display:flex;flex-direction:column;gap:8px;min-height:0;flex:1 1 auto}' +
        '#' + IMP_MODAL_ID + ' textarea{width:100%;height:320px;border:1px solid #cfd7df;border-radius:6px;padding:12px;font-family:Consolas,Monaco,Courier New,monospace;font-size:12px;box-sizing:border-box;resize:vertical}' +
        '#' + IMP_MODAL_ID + ' .s{margin-top:8px;font-size:12px;color:#555}' +
        '#' + IMP_MODAL_ID + ' .f{padding:16px 20px;border-top:1px solid #e0e0e0;display:flex;justify-content:flex-end;gap:8px}' +
        '#' + IMP_MODAL_ID + ' .btn{padding:8px 14px;border:none;border-radius:4px;font-size:14px;cursor:pointer;line-height:normal !important}' +
        '#' + IMP_MODAL_ID + ' .p{background:#af282f;color:#fff} .q{background:#e0e0e0;color:#333}</style>' +
        '<div class="d"><div class="h"><h3>Import Info Advanced Item JSON</h3><button class="x" id="cp-info-imp-x">&times;</button></div>' +
        '<div class="tabs"><button class="tab active" data-tab="library">Library</button><button class="tab" data-tab="paste">Paste JSON</button></div>' +
        '<div class="b"><div class="panel active" id="cp-info-imp-panel-library"><div class="lib"><div class="list" id="cp-info-imp-list"></div></div></div>' +
        '<div class="panel" id="cp-info-imp-panel-paste"><div class="json-panel"><textarea id="cp-info-imp-json" placeholder="Paste JSON here or select a saved library item."></textarea><div class="s" id="cp-info-imp-status">Tip: this can open Add Item and auto-apply values.</div></div></div></div>' +
        '<div class="f"><button class="btn q" id="cp-info-imp-save">Save to Library</button><button class="btn q" id="cp-info-imp-close">Close</button><button class="btn p" id="cp-info-imp-run">Import Item</button></div></div>';
      document.body.appendChild(overlay);

      var list = overlay.querySelector("#cp-info-imp-list");
      var ta = overlay.querySelector("#cp-info-imp-json");
      var status = overlay.querySelector("#cp-info-imp-status");
      var darkPrefsKey = "cp-info-library-darkbg";
      var darkPrefs = {};
      function setStatus(msg, isErr) {
        status.textContent = msg;
        status.style.color = isErr ? "#8f1f25" : "#555";
      }
      function switchTab(tab) {
        overlay.querySelectorAll(".tab").forEach(function(btn) {
          btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
        });
        overlay.querySelectorAll(".panel").forEach(function(panel) {
          panel.classList.toggle("active", panel.id === ("cp-info-imp-panel-" + tab));
        });
      }
      overlay.querySelectorAll(".tab").forEach(function(btn) {
        btn.addEventListener("click", function() {
          switchTab(btn.getAttribute("data-tab"));
        });
      });
      function close() { overlay.remove(); }
      overlay.querySelector("#cp-info-imp-x").addEventListener("click", close);
      overlay.querySelector("#cp-info-imp-close").addEventListener("click", close);
      overlay.addEventListener("click", function(e) { if (e.target === overlay) close(); });

      function normalizeVal(v) {
        if (Array.isArray(v)) return normalizeVal(v[0]);
        if (v == null) return "";
        return String(v);
      }

      function firstNonEmpty() {
        for (var i = 0; i < arguments.length; i++) {
          var val = normalizeVal(arguments[i]).trim();
          if (val) return val;
        }
        return "";
      }

      function htmlToText(html) {
        if (!html) return "";
        var tmp = document.createElement("div");
        tmp.innerHTML = String(html);
        return String(tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
      }

      function excerpt(text, max) {
        var value = String(text || "").trim();
        if (!value) return "";
        if (value.length <= max) return value;
        return value.substring(0, max - 1).trim() + "...";
      }

      function sanitizePreviewHtml(html) {
        if (!html) return "";
        var wrap = document.createElement("div");
        wrap.innerHTML = String(html);
        wrap.querySelectorAll("script,iframe,object,embed,link,meta,style,noscript").forEach(function(n) { n.remove(); });
        wrap.querySelectorAll("*").forEach(function(el) {
          Array.from(el.attributes || []).forEach(function(attr) {
            var n = String(attr.name || "").toLowerCase();
            var v = String(attr.value || "");
            if (n.indexOf("on") === 0) {
              el.removeAttribute(attr.name);
              return;
            }
            if ((n === "href" || n === "src" || n === "xlink:href") && /^\s*javascript:/i.test(v)) {
              el.removeAttribute(attr.name);
            }
          });
        });
        return wrap.innerHTML;
      }

      function getPayloadSummary(payload, fallbackName) {
        var fields = payload && payload.formFields && typeof payload.formFields === "object" ? payload.formFields : {};
        var item = payload && payload.item && typeof payload.item === "object" ? payload.item : {};
        var bodyHtml = preferredRichTextHtml(payload, fields) || "";
        var bodyText = htmlToText(bodyHtml);
        var title = firstNonEmpty(item.title, fields.txtLinkText, fields.txtName, fallbackName);
        var link = firstNonEmpty(item.link, fields.txtLink, fields.txtLinkURL);
        var itemID = firstNonEmpty(payload && payload.itemID, fields.intQLLinkID);
        return {
          title: title || "Untitled Item",
          link: link || "",
          itemID: itemID || "",
          bodyHtml: bodyHtml || "",
          bodyText: bodyText || "",
          previewStyleSnapshot: (payload && payload.previewStyleSnapshot) || null
        };
      }

      function applyInlineStyleMap(el, styleMap, options) {
        var opts = options || {};
        var allowColor = !!opts.allowColor;
        if (!el || !styleMap || typeof styleMap !== "object") return;
        Object.keys(styleMap).forEach(function(prop) {
          var val = styleMap[prop];
          if (val == null || val === "") return;
          var p = String(prop || "").toLowerCase();
          if (!allowColor && (p === "color" || p === "background-color")) return;
          try {
            el.style.setProperty(prop, String(val));
          } catch (_) {}
        });
      }

      function applyPreviewStyleSnapshot(container, snapshot) {
        if (!container || !snapshot || typeof snapshot !== "object") return;
        if (snapshot.root && typeof snapshot.root === "object") {
          applyInlineStyleMap(container, snapshot.root, { allowColor: false });
        }
        var tagStyles = snapshot.tagStyles && typeof snapshot.tagStyles === "object" ? snapshot.tagStyles : {};
        Object.keys(tagStyles).forEach(function(selector) {
          if (!selector) return;
          var styleMap = tagStyles[selector];
          if (!styleMap || typeof styleMap !== "object") return;
          try {
            container.querySelectorAll(selector).forEach(function(node) {
              applyInlineStyleMap(node, styleMap, { allowColor: true });
            });
          } catch (_) {}
        });
      }

      function openLibraryPreview(name, payload) {
        var existing = document.getElementById("cp-info-lib-preview-modal");
        if (existing) existing.remove();

        var info = getPayloadSummary(payload, name);
        var preview = document.createElement("div");
        preview.id = "cp-info-lib-preview-modal";
        preview.innerHTML =
          '<style>#cp-info-lib-preview-modal{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif}' +
          '#cp-info-lib-preview-modal .d{background:#fff;border-radius:8px;width:980px;max-width:95vw;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.3)}' +
          '#cp-info-lib-preview-modal .h{padding:14px 18px;border-bottom:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center}' +
          '#cp-info-lib-preview-modal .h h3{margin:0;font-size:17px;max-width:88%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
          '#cp-info-lib-preview-modal .x{background:none;border:none;font-size:24px;line-height:1;cursor:pointer}' +
          '#cp-info-lib-preview-modal .m{padding:14px 18px;color:#4b5a67;font-size:12px;border-bottom:1px solid #eef2f5;display:flex;gap:10px;flex-wrap:wrap}' +
          '#cp-info-lib-preview-modal .c{padding:16px 18px;overflow:auto;flex:1 1 auto}' +
          '#cp-info-lib-preview-modal .r{border:1px solid #d4dce3;border-radius:6px;background:#f8fafc;min-height:300px;padding:18px;line-height:1.45;color:#1e2c38;overflow:auto}' +
          '#cp-info-lib-preview-modal .r,#cp-info-lib-preview-modal .r *{box-sizing:border-box}' +
          '#cp-info-lib-preview-modal .r img{max-width:100% !important;height:auto !important;display:block}' +
          '#cp-info-lib-preview-modal .r table{max-width:100% !important}' +
          '#cp-info-lib-preview-modal .r a{word-break:break-word}' +
          '#cp-info-lib-preview-modal .e{color:#6d7882;font-size:12px;font-style:italic}' +
          '#cp-info-lib-preview-modal .f{padding:14px 18px;border-top:1px solid #e0e0e0;display:flex;justify-content:flex-end}' +
          '#cp-info-lib-preview-modal .btn{padding:8px 12px;border:none;border-radius:4px;font-size:14px;cursor:pointer;background:#e0e0e0;color:#333}</style>' +
          '<div class="d"><div class="h"><h3></h3><button class="x" id="cp-info-lib-prev-close">&times;</button></div>' +
          '<div class="m"><span id="cp-info-lib-prev-id"></span><span id="cp-info-lib-prev-link"></span></div>' +
          '<div class="c"><div class="r" id="cp-info-lib-prev-body"></div></div>' +
          '<div class="f"><button class="btn" id="cp-info-lib-prev-done">Close</button></div></div>';
        document.body.appendChild(preview);

        var titleEl = preview.querySelector(".h h3");
        var idEl = preview.querySelector("#cp-info-lib-prev-id");
        var linkEl = preview.querySelector("#cp-info-lib-prev-link");
        var bodyEl = preview.querySelector("#cp-info-lib-prev-body");

        titleEl.textContent = info.title;
        idEl.textContent = info.itemID ? ("Item ID: " + info.itemID) : "Item ID: (none)";
        linkEl.textContent = info.link ? ("Link: " + info.link) : "Link: (none)";
        if (info.bodyHtml) {
          bodyEl.innerHTML = sanitizePreviewHtml(info.bodyHtml);
          applyPreviewStyleSnapshot(bodyEl, info.previewStyleSnapshot);
        } else {
          bodyEl.innerHTML = '<div class="e">No rich text body found in this saved payload.</div>';
        }

        function closePreview() { preview.remove(); }
        preview.querySelector("#cp-info-lib-prev-close").addEventListener("click", closePreview);
        preview.querySelector("#cp-info-lib-prev-done").addEventListener("click", closePreview);
        preview.addEventListener("click", function(ev) { if (ev.target === preview) closePreview(); });
      }

      function renderLibraryList() {
        safeGet([LIBRARY_KEY, darkPrefsKey], function(data) {
          var lib = data[LIBRARY_KEY] || {};
          darkPrefs = data[darkPrefsKey] || {};
          var keys = Object.keys(lib).sort();
          list.innerHTML = "";
          if (!keys.length) {
            var empty = document.createElement("div");
            empty.textContent = "No saved items yet.";
            empty.style.cssText = "font-size:12px;color:#777;padding:4px;";
            list.appendChild(empty);
            return;
          }
          keys.forEach(function(k) {
            var row = document.createElement("div");
            row.className = "row";

            var itemName = k.replace(/_/g, " ");
            var payload = lib[k] || {};
            var summary = getPayloadSummary(payload, itemName);

            var card = document.createElement("button");
            card.type = "button";
            card.className = "item";
            if (darkPrefs[k]) card.classList.add("is-dark");

            var name = document.createElement("div");
            name.className = "item-name";
            name.textContent = summary.title;
            var meta = document.createElement("div");
            meta.className = "item-meta";
            var metaParts = [];
            if (summary.itemID) metaParts.push("ID " + summary.itemID);
            if (summary.link) metaParts.push(summary.link);
            meta.textContent = metaParts.length ? metaParts.join(" | ") : "No link metadata";
            var snippet = document.createElement("div");
            snippet.className = "item-snippet";
            snippet.textContent = summary.bodyText ? excerpt(summary.bodyText, 86) : "No body preview available";

            card.appendChild(name);
            card.appendChild(meta);
            card.appendChild(snippet);
            card.addEventListener("click", function() {
              ta.value = JSON.stringify(payload, null, 2);
              setStatus("Loaded '" + itemName + "' from library.", false);
            });

            var actions = document.createElement("div");
            actions.className = "row-actions";

            var previewBtn = document.createElement("button");
            previewBtn.type = "button";
            previewBtn.className = "act preview-pill";
            previewBtn.title = "Preview";
            previewBtn.setAttribute("aria-label", "Preview");
            previewBtn.textContent = "Preview";
            previewBtn.addEventListener("click", function(ev) {
              ev.preventDefault();
              ev.stopPropagation();
              openLibraryPreview(itemName, payload);
            });

            var editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "act";
            editBtn.title = "Rename";
            editBtn.setAttribute("aria-label", "Rename");
            editBtn.innerHTML = "&#9998;";
            editBtn.addEventListener("click", function(ev) {
              ev.preventDefault();
              ev.stopPropagation();
              var nextName = prompt("Rename saved item:", itemName);
              if (!nextName) return;
              var cleanName = nextName.trim();
              if (!cleanName) return;
              var newKey = cleanName.replace(/\s+/g, "_");
              if (newKey === k) return;
              safeGet([LIBRARY_KEY, darkPrefsKey], function(freshData) {
                var freshLib = freshData[LIBRARY_KEY] || {};
                var freshDark = freshData[darkPrefsKey] || {};
                if (Object.prototype.hasOwnProperty.call(freshLib, newKey)) {
                  if (!confirm("A saved item named '" + cleanName + "' already exists. Replace it?")) return;
                }
                freshLib[newKey] = freshLib[k];
                delete freshLib[k];
                if (Object.prototype.hasOwnProperty.call(freshDark, k)) {
                  freshDark[newKey] = freshDark[k];
                  delete freshDark[k];
                }
                safeSet({ [LIBRARY_KEY]: freshLib, [darkPrefsKey]: freshDark }, function() {
                  renderLibraryList();
                  setStatus("Renamed '" + itemName + "' to '" + cleanName + "'.", false);
                });
              });
            });

            var darkBtn = document.createElement("button");
            darkBtn.type = "button";
            darkBtn.className = "act";
            if (darkPrefs[k]) darkBtn.classList.add("active");
            darkBtn.title = "Toggle dark preview";
            darkBtn.setAttribute("aria-label", "Toggle dark preview");
            darkBtn.innerHTML = "&#9681;";
            darkBtn.addEventListener("click", function(ev) {
              ev.preventDefault();
              ev.stopPropagation();
              safeGet(darkPrefsKey, function(freshData) {
                var freshDark = freshData[darkPrefsKey] || {};
                freshDark[k] = !freshDark[k];
                safeSet({ [darkPrefsKey]: freshDark }, function() {
                  renderLibraryList();
                });
              });
            });

            var delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "act del";
            delBtn.title = "Delete";
            delBtn.setAttribute("aria-label", "Delete");
            delBtn.innerHTML = "&times;";
            delBtn.addEventListener("click", function(ev) {
              ev.preventDefault();
              ev.stopPropagation();
              if (!confirm("Delete saved item '" + itemName + "'?")) return;
              safeGet([LIBRARY_KEY, darkPrefsKey], function(freshData) {
                var freshLib = freshData[LIBRARY_KEY] || {};
                var freshDark = freshData[darkPrefsKey] || {};
                delete freshLib[k];
                delete freshDark[k];
                safeSet({ [LIBRARY_KEY]: freshLib, [darkPrefsKey]: freshDark }, function() {
                  renderLibraryList();
                  setStatus("Deleted '" + itemName + "'.", false);
                });
              });
            });

            actions.appendChild(editBtn);
            actions.appendChild(darkBtn);
            actions.appendChild(delBtn);

            row.appendChild(previewBtn);
            row.appendChild(card);
            row.appendChild(actions);
            list.appendChild(row);
          });
        });
      }

      renderLibraryList();

      overlay.querySelector("#cp-info-imp-save").addEventListener("click", function() {
        if (!ta.value.trim()) return setStatus("Paste JSON first.", true);
        var payload;
        try { payload = JSON.parse(ta.value); } catch (e) { return setStatus("Invalid JSON: " + e.message, true); }
        var suggested = (payload.formFields && (payload.formFields.txtLinkText || payload.formFields.txtName)) || "";
        var name = prompt("Save item as:", suggested);
        if (!name) return;
        var key = name.trim().replace(/\s+/g, "_");
        safeGet(LIBRARY_KEY, function(data) {
          var lib = data[LIBRARY_KEY] || {};
          lib[key] = payload;
          safeSet({ [LIBRARY_KEY]: lib }, function() {
            setStatus("Saved to library.", false);
            renderLibraryList();
          });
        });
      });

      overlay.querySelector("#cp-info-imp-run").addEventListener("click", function() {
        if (!ta.value.trim()) return setStatus("Paste JSON first.", true);
        var payload;
        try { payload = JSON.parse(ta.value); } catch (e) { return setStatus("Invalid JSON: " + e.message, true); }
        var form = infoForm();
        var canApplyDirectly = isRealItemEditorForm(form);
        if (canApplyDirectly) {
          applyPayload(form, payload);
          setStatus("Imported into current form. Review and save.", false);
          showToast("Imported JSON into current item form.");
          setTimeout(close, 700);
          return;
        }
        var cat = currentCategoryID();
        if (!cat) {
          var addBtn = findAddItemButton();
          var parsed = parseCategoryFromAddItemButton(addBtn);
          if (parsed) {
            cat = parsed;
            window.__cpInfoDefaultCategoryID = parsed;
          }
        }
        if (!cat) return setStatus("No selected category found.", true);
        safeSet({ [PENDING_IMPORT_KEY]: { payload: payload, ts: Date.now(), categoryID: cat } }, function() {
          console.info("[CP Toolkit][Info Advanced] Queued pending import for category:", cat);
          setStatus("Opening Add Item for category " + cat + "...", false);
          if (!openAddForCategory(cat)) {
            safeRemove(PENDING_IMPORT_KEY);
            console.warn("[CP Toolkit][Info Advanced] Failed to trigger Add Item flow for category:", cat);
            setStatus("Could not trigger Add Item flow. Open Add Item manually, then run Import Item again.", true);
          }
        });
      });
    }

    function showExportModal(payload, pending) {
      var old = document.getElementById(EXP_MODAL_ID);
      if (old) old.remove();
      var json = JSON.stringify(payload);
      var pretty = JSON.stringify(payload, null, 2);
      var overlay = document.createElement("div");
      overlay.id = EXP_MODAL_ID;
      overlay.innerHTML =
        '<style>#' + EXP_MODAL_ID + '{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif}' +
        '#' + EXP_MODAL_ID + ' .d{background:#fff;border-radius:8px;width:600px;max-width:90vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.3)}' +
        '#' + EXP_MODAL_ID + ' .h{padding:16px 20px;border-bottom:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center}' +
        '#' + EXP_MODAL_ID + ' .h h3{margin:0;font-size:18px}' +
        '#' + EXP_MODAL_ID + ' .x{background:none;border:none;font-size:24px;line-height:1;cursor:pointer}' +
        '#' + EXP_MODAL_ID + ' .b{padding:20px;overflow:auto;flex:1}' +
        '#' + EXP_MODAL_ID + ' textarea{width:100%;height:300px;border:1px solid #ccc;border-radius:4px;padding:12px;font-family:monospace;font-size:12px;box-sizing:border-box;resize:vertical}' +
        '#' + EXP_MODAL_ID + ' .f{padding:16px 20px;border-top:1px solid #e0e0e0;display:flex;justify-content:flex-end;gap:8px}' +
        '#' + EXP_MODAL_ID + ' .btn{padding:6px 12px;border:none;border-radius:4px;font-size:14px;cursor:pointer;line-height:normal !important}' +
        '#' + EXP_MODAL_ID + ' .p{background:#af282f;color:#fff} .q{background:#e0e0e0;color:#333}</style>' +
        '<div class="d"><div class="h"><h3>Export Info Advanced Item JSON</h3><button class="x" id="cp-info-exp-x">&times;</button></div>' +
        '<div class="b"><textarea id="cp-info-exp-json"></textarea></div>' +
        '<div class="f"><button class="btn q" id="cp-info-exp-close">Close</button><button class="btn q" id="cp-info-exp-download">Download</button><button class="btn q" id="cp-info-exp-save">Save to Library</button><button class="btn p" id="cp-info-exp-copy">Copy to Clipboard</button></div></div>';
      document.body.appendChild(overlay);
      var ta = overlay.querySelector("#cp-info-exp-json");
      ta.value = pretty;
      function close() {
        overlay.remove();
        if (!pending || !pending.returnUrl) return;
        if (pending.categoryID) {
          safeSet({ [PENDING_RETURN_KEY]: { categoryID: pending.categoryID, ts: Date.now() } }, function() {
            window.location.href = pending.returnUrl;
          });
        } else {
          window.location.href = pending.returnUrl;
        }
      }
      overlay.querySelector("#cp-info-exp-x").addEventListener("click", close);
      overlay.querySelector("#cp-info-exp-close").addEventListener("click", close);
      overlay.addEventListener("click", function(e) { if (e.target === overlay) close(); });
      overlay.querySelector("#cp-info-exp-copy").addEventListener("click", function() {
        navigator.clipboard.writeText(pretty).then(function() {
          overlay.querySelector("#cp-info-exp-copy").textContent = "Copied!";
          setTimeout(close, 900);
        });
      });
      overlay.querySelector("#cp-info-exp-download").addEventListener("click", function() {
        var blob = new Blob([pretty], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "info-advanced-item-" + String((pending && pending.id) || "export") + ".json";
        a.click();
        URL.revokeObjectURL(url);
      });
      overlay.querySelector("#cp-info-exp-save").addEventListener("click", function() {
        var suggested = (payload.formFields && (payload.formFields.txtLinkText || payload.formFields.txtName)) || "";
        var name = prompt("Save item as:", suggested);
        if (!name) return;
        var key = name.trim().replace(/\s+/g, "_");
        safeGet(LIBRARY_KEY, function(data) {
          var lib = data[LIBRARY_KEY] || {};
          lib[key] = JSON.parse(json);
          safeSet({ [LIBRARY_KEY]: lib }, function() {
            overlay.querySelector("#cp-info-exp-save").textContent = "Saved!";
          });
        });
      });
    }

    function buildPayload(form, itemID) {
      var fields = {};
      form.querySelectorAll("input[name],select[name],textarea[name]").forEach(function(el) {
        if (!el.name || el.disabled || skipField(el.name, el.type)) return;
        var t = (el.type || "").toLowerCase();
        if (t === "radio" && !el.checked) return;
        var v = t === "checkbox" ? !!el.checked : el.value;
        if (Object.prototype.hasOwnProperty.call(fields, el.name)) {
          if (!Array.isArray(fields[el.name])) fields[el.name] = [fields[el.name]];
          fields[el.name].push(v);
        } else fields[el.name] = v;
      });
      var editors = captureRichEditors(form);
      var editorHtml = editors.map(function(ed) {
        return ed && typeof ed.html === "string" ? ed.html : "";
      });
      var firstEditorHtml = editors.length ? editors[0].html : "";
      var firstMeaningfulEditorHtml = "";
      for (var e = 0; e < editors.length; e++) {
        if (!isEmptyRichHtml(editors[e].html)) {
          firstMeaningfulEditorHtml = editors[e].html;
          break;
        }
      }
      var previewStyleSnapshot = capturePreviewStyleSnapshot(form);
      var bodyFallback = "";
      if (typeof fields.txtBody === "string" && !isEmptyRichHtml(fields.txtBody)) bodyFallback = fields.txtBody;
      else if (typeof fields.txtPageContent === "string" && !isEmptyRichHtml(fields.txtPageContent)) bodyFallback = fields.txtPageContent;
      return {
        type: "cp-toolkit-info-advanced-item",
        version: 1,
        exportedAt: new Date().toISOString(),
        itemID: itemID ? String(itemID) : "",
        categoryID: currentCategoryID(),
        pageUrl: window.location.href,
        item: {
          title: fields.txtLinkText || fields.txtName || "",
          link: fields.txtLink || fields.txtLinkURL || "",
          openInNewWindow: !!fields.ysnNewWindow,
          startDate: fields.dtiStartDate || fields.dtiBeginningDate || "",
          endDate: fields.dtiEndDate || fields.dtiEndingDate || "",
          bodyHtml: firstMeaningfulEditorHtml || bodyFallback || firstEditorHtml || fields.txtBody || ""
        },
        formFields: fields,
        editorHtml: editorHtml,
        froalaEditors: editors,
        previewStyleSnapshot: previewStyleSnapshot,
        editorDebug: {
          sources: editors.map(function(ed) { return ed && ed.source ? ed.source : "unknown"; }),
          nonEmptyCount: editors.filter(function(ed) { return ed && !isEmptyRichHtml(ed.html); }).length,
          hasPreviewStyleSnapshot: !!previewStyleSnapshot
        }
      };
    }

    function applyPayload(form, payload) {
      var fields = payload && payload.formFields ? payload.formFields : payload;
      if ((!fields || typeof fields !== "object" || Array.isArray(fields)) && payload && payload.item) {
        fields = {};
      }
      if (payload && payload.item && (!payload.formFields || typeof payload.formFields !== "object")) {
        if (payload.item.title != null) fields.txtLinkText = payload.item.title;
        if (payload.item.link != null) fields.txtLink = payload.item.link;
        if (payload.item.openInNewWindow != null) fields.ysnNewWindow = !!payload.item.openInNewWindow;
        if (payload.item.startDate != null) {
          fields.dtiStartDate = payload.item.startDate;
          fields.dtiBeginningDate = payload.item.startDate;
        }
        if (payload.item.endDate != null) {
          fields.dtiEndDate = payload.item.endDate;
          fields.dtiEndingDate = payload.item.endDate;
        }
      }
      Object.keys(fields || {}).forEach(function(name) {
        if (!name || skipField(name, "")) return;
        if (isSystemControlField(name)) return;
        var val = fields[name];
        var els = form.querySelectorAll('[name="' + esc(name) + '"]');
        var targets = Array.from(els).filter(function(el) {
          if (!el || el.disabled) return false;
          var t = (el.type || "").toLowerCase();
          // Avoid stomping hidden routing/state fields on save.
          if (t === "hidden") return false;
          return true;
        });
        targets.forEach(function(el) {
          var t = (el.type || "").toLowerCase();
          if (t === "radio") el.checked = String(el.value) === String(Array.isArray(val) ? val[0] : val);
          else if (t === "checkbox") el.checked = toBool(val, el.value);
          else if (el.tagName === "SELECT" && el.multiple) {
            var arr = Array.isArray(val) ? val : [val];
            Array.from(el.options).forEach(function(o) { o.selected = arr.indexOf(o.value) > -1; });
          } else el.value = Array.isArray(val) ? val[0] : val;
          dispatch(el);
        });
      });
      applyRichTextPayload(form, payload, fields);
    }

    function applyRichTextPayload(form, payload, fields) {
      var html = preferredRichTextHtml(payload, fields);
      if (html == null) return;

      activateContentTab(form);

      var attempt = 0;
      var maxAttempts = 12;

      function applyAttempt() {
        if (!hasExtensionContext()) return;
        var applied = applyRichTextOnce(form, payload, fields, html);
        if (!applied && attempt < maxAttempts) {
          attempt += 1;
          setTimeout(applyAttempt, 180);
        }
      }

      applyAttempt();
    }

    function applyRichTextOnce(form, payload, fields, html) {
      var appliedViaApi = setFroalaHtmlViaApi(form, html);
      var appliedViaContentEditable = setVisibleContentEditableHtml(form, html);
      var appliedViaIframe = setVisibleIframeEditorHtml(html);
      syncOpenCodeViewEditors(html);

      var snapshotApplied = false;
      if (Array.isArray(payload && payload.froalaEditors) && payload.froalaEditors.length) {
        var targets = visibleFroalaEditors();
        payload.froalaEditors.forEach(function(ed, i) {
          var idx = typeof ed.index === "number" ? ed.index : i;
          var t = targets[idx];
          if (!t) return;
          t.innerHTML = ed && typeof ed.html === "string" ? ed.html : "";
          dispatch(t);
          snapshotApplied = true;
        });
      }

      if (!snapshotApplied && !appliedViaApi && !appliedViaContentEditable && !appliedViaIframe) {
        var candidates = visibleFroalaEditors();
        var primary = candidates[0] || form.querySelector(".fr-element.fr-view[contenteditable='true']") || form.querySelector(".fr-element.fr-view");
        if (primary) {
          primary.innerHTML = html;
          dispatch(primary);
          snapshotApplied = true;
        }
      }

      syncBodyFields(form, fields, html);
      syncLikelyHtmlFields(form, html);
      return !!(appliedViaApi || appliedViaContentEditable || appliedViaIframe || snapshotApplied);
    }

    function isSystemControlField(name) {
      var n = String(name || "").toLowerCase();
      if (!n) return true;
      if (n === "__requestverificationtoken") return true;
      if (n.indexOf("__viewstate") === 0 || n.indexOf("__event") === 0 || n.indexOf("__prevpage") === 0) return true;

      var exact = {
        straction: true,
        stractionsubmit: true,
        ysnsave: true,
        ysncopy: true,
        intqlcategoryid: true,
        intqllinkid: true,
        txtcategoryidlistsave: true,
        lngcontainerid: true,
        lngresourceid: true,
        strresourcetype: true,
        scope: true,
        strpage: true,
        oldscope: true
      };
      if (exact[n]) return true;

      // IDs and routing fields coming from master forms should not be imported.
      if (/^(?:ctl00\$|lng[a-z0-9_]*id|int[a-z0-9_]*id|aid|hid|rid|cpaction|targetagid|targetaiid|cnclagid|cnclaiid|relloc|por|catparentid|inttriggeredfrom|intwhatdisplay)$/i.test(n)) {
        // Keep date fields (dti*) and explicitly editable text IDs out of this rule.
        if (n.indexOf("dti") === 0) return false;
        if (/^txt(?:link|linktext|title|name|body|pagecontent|content|description|longdescription)/i.test(n)) return false;
        return true;
      }

      return false;
    }

    function triggerUiAction(el) {
      if (!el) return false;
      var href = "";
      try { href = String(el.getAttribute && el.getAttribute("href") || ""); } catch (_) {}
      var isJavascriptHref = /^\s*javascript:/i.test(href);

      try {
        if (isJavascriptHref && typeof el.onclick === "function") {
          var clickEvt = new MouseEvent("click", { bubbles: true, cancelable: true, view: window });
          el.onclick(clickEvt);
          return true;
        }
      } catch (_) {}

      try {
        if (!isJavascriptHref && typeof el.click === "function") {
          el.click();
          return true;
        }
      } catch (_) {}

      if (isJavascriptHref) return false;

      try {
        var evt = new MouseEvent("click", { bubbles: true, cancelable: true, view: window });
        return !!el.dispatchEvent(evt);
      } catch (_) {}

      return false;
    }

    function activateContentTab(form) {
      var scope = (form && form.closest && form.closest(".adminWrap,.newCP,.cpTabs,.cpTabPanel")) || document;
      var tabs = Array.from(scope.querySelectorAll("a,button,input[type='button'],input[type='submit'],li"));
      for (var i = 0; i < tabs.length; i++) {
        var el = tabs[i];
        if (!isVisibleElement(el)) continue;
        var text = String(el.textContent || el.value || "").trim().toLowerCase();
        if (text !== "content") continue;
        try {
          triggerUiAction(el);
          return true;
        } catch (_) {}
      }
      return false;
    }

    function attemptEnableCodeView(form) {
      if (hasVisibleCodeView()) return true;

      var scope = form || document;
      var direct = Array.from(
        scope.querySelectorAll(
          ".fr-command[data-cmd='html'],.fr-command[data-cmd='codeView'],button[title*='Code'],a[title*='Code'],button[aria-label*='Code'],a[aria-label*='Code'],button[title*='HTML'],a[title*='HTML'],button[aria-label*='HTML'],a[aria-label*='HTML'],[id*='Mode_html'],[class*='Mode_html'],[data-mode='html']",
        ),
      );

      var clicked = false;
      direct.forEach(function(btn) {
        if (!btn || !isVisibleElement(btn)) return;
        try {
          if (!btn.dataset.cpInfoClickedCodeView) {
            btn.dataset.cpInfoClickedCodeView = "1";
            if (triggerUiAction(btn)) clicked = true;
          }
        } catch (_) {}
      });

      if (hasVisibleCodeView()) return true;
      if (clicked) return true;

      var fuzzy = Array.from(scope.querySelectorAll("a,button,[role='button'],span[role='button']"));
      for (var i = 0; i < fuzzy.length; i++) {
        var el = fuzzy[i];
        if (!el || !isVisibleElement(el)) continue;
        var label = (
          String(el.textContent || "") + " " +
          String(el.getAttribute("title") || "") + " " +
          String(el.getAttribute("aria-label") || "")
        ).toLowerCase();
        if (label.indexOf("code view") === -1 && label.indexOf("html") === -1 && label.indexOf("source") === -1) continue;
        if (label.indexOf("help") > -1) continue;
        try {
          if (!el.dataset.cpInfoClickedCodeView) {
            el.dataset.cpInfoClickedCodeView = "1";
            if (triggerUiAction(el)) return true;
          }
        } catch (_) {}
      }

      return false;
    }

    function forceOpenHtmlCodeView() {
      var htmlBtn = document.getElementById("html-1");
      if (htmlBtn && isVisibleElement(htmlBtn)) {
        try {
          if (triggerUiAction(htmlBtn)) return true;
        } catch (_) {}
      }

      var htmlButtons = Array.from(document.querySelectorAll("[id^='html-'],button[id*='html-'],a[id*='html-']"));
      for (var i = 0; i < htmlButtons.length; i++) {
        var btn = htmlButtons[i];
        if (!btn || !isVisibleElement(btn)) continue;
        try {
          if (triggerUiAction(btn)) return true;
        } catch (_) {}
      }

      return false;
    }

    function hasVisibleCodeView() {
      var codeAreas = Array.from(document.querySelectorAll("textarea.fr-code,.fr-code textarea,textarea[data-f-id][class*='fr-'],textarea[id*='content'],textarea[name*='content']"));
      for (var i = 0; i < codeAreas.length; i++) {
        var el = codeAreas[i];
        if (!el) continue;
        if (!isVisibleElement(el)) continue;
        if (el.closest("#" + IMP_MODAL_ID) || el.closest("#" + EXP_MODAL_ID)) continue;
        return true;
      }
      return false;
    }

    function preferredRichTextHtml(payload, fields) {
      var candidates = [];

      if (Array.isArray(payload && payload.editorHtml)) {
        payload.editorHtml.forEach(function(v) {
          if (typeof v === "string") candidates.push(v);
        });
      }

      if (Array.isArray(payload && payload.froalaEditors)) {
        payload.froalaEditors.forEach(function(ed) {
          if (ed && typeof ed.html === "string") candidates.push(ed.html);
        });
      }

      if (payload && payload.item && typeof payload.item.bodyHtml === "string") {
        candidates.push(payload.item.bodyHtml);
      }

      if (fields && typeof fields === "object") {
        ["txtBody", "txtPageContent", "txtContent", "txtLongDescription"].forEach(function(k) {
          var v = fields[k];
          if (typeof v === "string") candidates.push(v);
          else if (Array.isArray(v) && typeof v[0] === "string") candidates.push(v[0]);
        });
      }

      var meaningful = null;
      for (var i = 0; i < candidates.length; i++) {
        if (!isEmptyRichHtml(candidates[i])) {
          meaningful = String(candidates[i]);
          break;
        }
      }

      if (meaningful !== null) return meaningful;
      if (candidates.length) return String(candidates[0] || "");
      return null;
    }

    function captureRichEditors(form) {
      var collected = [];
      var seen = {};

      function add(editor) {
        if (!editor || typeof editor.html !== "string") return;
        var key = String(editor.source || "unknown") + "::" + String(editor.html || "");
        if (seen[key]) return;
        seen[key] = true;
        collected.push({
          index: typeof editor.index === "number" ? editor.index : collected.length,
          source: String(editor.source || "unknown"),
          html: String(editor.html || "")
        });
      }

      captureCodeViewEditors().forEach(add);
      captureFroalaEditors(form).forEach(add);
      captureIframeEditors().forEach(add);
      captureContentEditableEditors(form).forEach(add);

      return collected;
    }

    function capturePreviewStyleSnapshot(form) {
      var surface = resolvePreviewStyleSurface(form);
      if (!surface) return null;

      var snapshot = {
        root: pickComputedTextStyles(surface),
        tagStyles: {}
      };

      var tags = ["p", "a", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "span", "blockquote"];
      tags.forEach(function(tag) {
        try {
          var node = surface.querySelector(tag);
          if (!node) return;
          var styles = pickComputedTextStyles(node);
          if (Object.keys(styles).length) snapshot.tagStyles[tag] = styles;
        } catch (_) {}
      });

      // Add a few class-aware selectors to improve fidelity when templates style classes.
      try {
        var classNodes = Array.from(surface.querySelectorAll("[class]")).slice(0, 20);
        classNodes.forEach(function(node) {
          var tag = String((node.tagName || "div")).toLowerCase();
          var classes = String(node.className || "")
            .split(/\s+/)
            .map(function(c) { return c.trim(); })
            .filter(function(c) { return /^[A-Za-z_-][A-Za-z0-9_-]*$/.test(c); })
            .slice(0, 3);
          if (!classes.length) return;
          var selector = tag + classes.map(function(c) { return "." + c; }).join("");
          if (snapshot.tagStyles[selector]) return;
          var styleMap = pickComputedTextStyles(node);
          if (Object.keys(styleMap).length) snapshot.tagStyles[selector] = styleMap;
        });
      } catch (_) {}

      if (!Object.keys(snapshot.root || {}).length && !Object.keys(snapshot.tagStyles || {}).length) {
        return null;
      }
      return snapshot;
    }

    function resolvePreviewStyleSurface(form) {
      var boxes = visibleFroalaBoxes(form);
      for (var i = 0; i < boxes.length; i++) {
        var box = boxes[i];
        if (!box) continue;

        try {
          var frm = box.querySelector("iframe");
          if (frm && isVisibleElement(frm)) {
            var doc = frm.contentDocument || (frm.contentWindow && frm.contentWindow.document);
            if (doc && doc.body) {
              var txt = String(doc.body.textContent || "").trim();
              var html = String(doc.body.innerHTML || "").trim();
              if (txt || html) return doc.body;
            }
          }
        } catch (_) {}

        var visual = box.querySelector(".fr-element.fr-view[contenteditable='true'], .fr-element.fr-view");
        if (visual && isVisibleElement(visual)) return visual;
      }

      var visible = visibleFroalaEditors();
      if (visible && visible.length) return visible[0];

      // Last resort: scan likely editor iframes only.
      var frames = Array.from(document.querySelectorAll("iframe"));
      for (var j = 0; j < frames.length; j++) {
        var frame = frames[j];
        if (!isVisibleElement(frame)) continue;
        var hint = (
          String(frame.id || "") + " " +
          String(frame.className || "") + " " +
          String(frame.getAttribute("title") || "")
        ).toLowerCase();
        if (
          hint.indexOf("fr") === -1 &&
          hint.indexOf("editor") === -1 &&
          hint.indexOf("html") === -1 &&
          !frame.closest(".fr-box")
        ) {
          continue;
        }
        try {
          var d = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
          if (!d || !d.body) continue;
          var t = String(d.body.textContent || "").trim();
          var h = String(d.body.innerHTML || "").trim();
          if (!t && !h) continue;
          return d.body;
        } catch (_) {}
      }

      if (form) {
        var inForm = form.querySelector("[contenteditable='true'], .fr-element.fr-view");
        if (inForm) return inForm;
      }

      return document.querySelector("[contenteditable='true'], .fr-element.fr-view");
    }

    function pickComputedTextStyles(el) {
      if (!el) return {};
      var style = null;
      try {
        var win = (el.ownerDocument && el.ownerDocument.defaultView) || window;
        style = win.getComputedStyle(el);
      } catch (_) {
        return {};
      }
      if (!style) return {};

      var props = [
        "font-family",
        "font-size",
        "font-weight",
        "font-style",
        "line-height",
        "letter-spacing",
        "text-transform",
        "text-decoration-line",
        "text-align",
        "color"
      ];
      var out = {};
      props.forEach(function(prop) {
        var val = String(style.getPropertyValue(prop) || "").trim();
        if (!val) return;
        out[prop] = val;
      });
      return out;
    }

    function captureCodeViewEditors() {
      var nodes = Array.from(
        document.querySelectorAll(
          "textarea.fr-code,.fr-code textarea,textarea[id*='code'],textarea[id*='html'],textarea[name*='code'],textarea[name*='html']",
        ),
      );

      return nodes
        .filter(function(el) {
          if (!el) return false;
          if (el.closest("#" + IMP_MODAL_ID) || el.closest("#" + EXP_MODAL_ID)) return false;
          if (!isVisibleElement(el) && !String(el.value || "").trim()) return false;
          return true;
        })
        .map(function(el, idx) {
          return {
            index: idx,
            source: "code-view:" + (el.id || el.name || idx),
            html: String(el.value || "")
          };
        });
    }

    function captureIframeEditors() {
      var editors = [];
      var frames = Array.from(document.querySelectorAll("iframe"));

      frames.forEach(function(frame, idx) {
        if (!isVisibleElement(frame)) return;
        try {
          var doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
          if (!doc || !doc.body) return;
          var html = doc.body.innerHTML || "";
          var txt = (doc.body.textContent || "").trim();
          if (!html && !txt) return;
          editors.push({
            index: idx,
            source: "iframe:" + (frame.id || frame.name || idx),
            html: html
          });
        } catch (_) {}
      });

      return editors;
    }

    function captureContentEditableEditors(form) {
      var scope = form || document;
      var nodes = Array.from(scope.querySelectorAll("[contenteditable='true'], .fr-element.fr-view"));
      return nodes
        .filter(function(node) {
          if (!node || node.closest("#" + IMP_MODAL_ID) || node.closest("#" + EXP_MODAL_ID)) return false;
          return isVisibleElement(node);
        })
        .map(function(node, idx) {
          return {
            index: idx,
            source: "contenteditable",
            html: node.innerHTML || ""
          };
        });
    }

    function captureFroalaEditors(form) {
      var editors = [];
      var boxes = visibleFroalaBoxes(form);

      boxes.forEach(function(box, idx) {
        var html = "";
        var source = "dom";

        // If code view is open, this is closest to manual Ctrl+A/C behavior.
        var codeTextarea = box.querySelector("textarea.fr-code, .fr-code textarea, textarea[data-f-id][class*='fr-']");
        if (codeTextarea && isVisibleElement(codeTextarea)) {
          html = codeTextarea.value || "";
          source = "code-view";
        }

        if (!html) {
          var apiHtml = getFroalaHtmlFromBox(box);
          if (typeof apiHtml === "string" && apiHtml.length) {
            html = apiHtml;
            source = "api";
          }
        }

        if (!html) {
          var visual = box.querySelector(".fr-element.fr-view");
          if (visual) {
            html = visual.innerHTML || "";
            source = "dom";
          }
        }

        editors.push({ index: idx, source: source, html: html || "" });
      });

      if (!editors.length) {
        var fallback = visibleFroalaEditors();
        fallback.forEach(function(el, idx) {
          editors.push({ index: idx, source: "dom", html: el.innerHTML || "" });
        });
      }

      return editors;
    }

    function visibleFroalaBoxes(form) {
      var roots = [];
      if (form && form.querySelectorAll) {
        roots = Array.from(form.querySelectorAll(".fr-box"));
      }
      if (!roots.length) {
        roots = Array.from(document.querySelectorAll(".fr-box"));
      }
      return roots.filter(function(box) {
        if (!box) return false;
        if (box.closest("#" + IMP_MODAL_ID) || box.closest("#" + EXP_MODAL_ID)) return false;
        return isVisibleElement(box);
      });
    }

    function getFroalaHtmlFromBox(box) {
      if (!box) return "";
      var wrappers = [];
      if (window.$jq213) wrappers.push(window.$jq213);
      if (window.jQuery && wrappers.indexOf(window.jQuery) === -1) wrappers.push(window.jQuery);

      var targets = [];
      var textarea = box.querySelector("textarea");
      if (textarea) targets.push(textarea);
      var element = box.querySelector(".fr-element.fr-view");
      if (element) targets.push(element);

      for (var w = 0; w < wrappers.length; w++) {
        var $ = wrappers[w];
        if (!$ || !$.fn || typeof $.fn.froalaEditor !== "function") continue;
        for (var t = 0; t < targets.length; t++) {
          try {
            var $target = $(targets[t]);
            var hasInstance = !!($target.data("froala.editor") || $target.data("froalaEditor"));
            if (!hasInstance) continue;
            var result = $target.froalaEditor("html.get");
            if (typeof result === "string") return result;
          } catch (_) {}
        }
      }
      return "";
    }

    function syncOpenCodeViewEditors(html) {
      var editors = Array.from(document.querySelectorAll("textarea.fr-code, .fr-code textarea"))
        .filter(function(el) {
          return isVisibleElement(el);
        });

      editors.forEach(function(el) {
        el.value = html;
        dispatch(el);
      });
    }

    function setFroalaHtmlViaApi(form, html) {
      var wrappers = [];
      if (window.$jq213) wrappers.push(window.$jq213);
      if (window.jQuery && wrappers.indexOf(window.jQuery) === -1) wrappers.push(window.jQuery);

      var applied = false;
      var candidates = Array.from(
        document.querySelectorAll("textarea, .fr-element.fr-view[contenteditable='true'], .fr-element.fr-view"),
      );

      wrappers.forEach(function($) {
        if (!$ || !$.fn || typeof $.fn.froalaEditor !== "function") return;

        candidates.forEach(function(node) {
          try {
            var $node = $(node);
            var hasInstance = !!($node.data("froala.editor") || $node.data("froalaEditor"));

            if (!hasInstance && node.classList && node.classList.contains("fr-element")) {
              var box = node.closest(".fr-box");
              var textarea = box ? box.querySelector("textarea") : null;
              if (textarea) {
                var $textarea = $(textarea);
                hasInstance = !!($textarea.data("froala.editor") || $textarea.data("froalaEditor"));
                if (hasInstance) {
                  $textarea.froalaEditor("html.set", html);
                  try {
                    $textarea.froalaEditor("undo.saveStep");
                  } catch (_) {}
                  try {
                    $textarea.froalaEditor("events.trigger", "contentChanged");
                  } catch (_) {}
                  applied = true;
                  return;
                }
              }
            }

            if (!hasInstance) return;
            $node.froalaEditor("html.set", html);
            try {
              $node.froalaEditor("undo.saveStep");
            } catch (_) {}
            try {
              $node.froalaEditor("events.trigger", "contentChanged");
            } catch (_) {}
            applied = true;
          } catch (_) {}
        });

        ["#txtPageContent", "#txtBody", "#txtDescription", "#txtLongDescription", "#txtLinkDescription"].forEach(function(sel) {
          try {
            var $el = $(sel);
            if (!$el.length) return;
            var has = !!($el.data("froala.editor") || $el.data("froalaEditor"));
            if (!has) return;
            $el.froalaEditor("html.set", html);
            try {
              $el.froalaEditor("undo.saveStep");
            } catch (_) {}
            try {
              $el.froalaEditor("events.trigger", "contentChanged");
            } catch (_) {}
            applied = true;
          } catch (_) {}
        });
      });

      return applied;
    }

    function setVisibleContentEditableHtml(form, html) {
      var scope = form || document;
      var applied = false;
      Array.from(scope.querySelectorAll("[contenteditable='true'], .fr-element.fr-view")).forEach(function(el) {
        if (!el || !isVisibleElement(el)) return;
        if (el.closest("#" + IMP_MODAL_ID) || el.closest("#" + EXP_MODAL_ID)) return;
        try {
          el.innerHTML = html;
          dispatch(el);
          applied = true;
        } catch (_) {}
      });
      return applied;
    }

    function setVisibleIframeEditorHtml(html) {
      var applied = false;
      Array.from(document.querySelectorAll("iframe")).forEach(function(frame) {
        if (!isVisibleElement(frame)) return;
        try {
          var doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
          if (!doc || !doc.body) return;
          doc.body.innerHTML = html;
          try {
            doc.body.dispatchEvent(new Event("input", { bubbles: true }));
            doc.body.dispatchEvent(new Event("change", { bubbles: true }));
            doc.body.dispatchEvent(new Event("blur", { bubbles: true }));
          } catch (_) {}
          applied = true;
        } catch (_) {}
      });
      return applied;
    }

    function syncLikelyHtmlFields(form, html) {
      if (!form) return;
      Array.from(form.querySelectorAll("textarea,input[type='hidden'],input[type='text']")).forEach(function(el) {
        if (!el || el.disabled) return;
        var key = String(el.name || el.id || "").toLowerCase();
        if (!key) return;
        if (!/(body|content|description|editor|html)/i.test(key)) return;
        if (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && (el.type === "hidden" || el.type === "text"))) {
          el.value = html;
          dispatch(el);
        }
      });
    }

    function syncBodyFields(form, fields, html) {
      var nameSet = {
        txtBody: true,
        txtPageContent: true,
        txtContent: true,
        txtLongDescription: true
      };

      if (fields && typeof fields === "object") {
        Object.keys(fields).forEach(function(key) {
          if (/(body|content)/i.test(key)) nameSet[key] = true;
        });
      }

      Object.keys(nameSet).forEach(function(name) {
        var byName = document.querySelectorAll('[name="' + esc(name) + '"]');
        byName.forEach(function(el) {
          if (!el || el.disabled) return;
          if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
            el.value = html;
            dispatch(el);
          }
        });

        var byId = document.getElementById(name);
        if (byId && (byId.tagName === "TEXTAREA" || byId.tagName === "INPUT")) {
          byId.value = html;
          dispatch(byId);
        }
      });
    }

    function isEmptyRichHtml(html) {
      if (html == null) return true;
      var s = String(html).trim();
      if (!s) return true;
      var normalized = s
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\s+/g, "")
        .toLowerCase();
      if (!normalized) return true;
      if (
        normalized === "<p><br></p>" ||
        normalized === "<p></p>" ||
        normalized === "<br>" ||
        normalized === "<div><br></div>"
      ) {
        return true;
      }
      var stripped = normalized
        .replace(/&nbsp;/g, "")
        .replace(/<br\s*\/?>/g, "")
        .replace(/<\/?(p|div|span)>/g, "");
      return stripped === "";
    }

    function infoForm() {
      var namedCandidates = [document.forms["frmQLLinkEdit"], document.forms["frmQLLinkAdd"]];
      for (var i = 0; i < namedCandidates.length; i++) {
        if (namedCandidates[i] && isLikelyItemForm(namedCandidates[i])) return namedCandidates[i];
      }

      var candidates = Array.from(document.querySelectorAll("form")).filter(function(f) {
        return isLikelyItemForm(f);
      });
      if (!candidates.length) return null;

      candidates.sort(function(a, b) {
        return scoreItemForm(b) - scoreItemForm(a);
      });
      return candidates[0] || null;
    }

    function scoreItemForm(form) {
      if (!form) return 0;
      var s = 0;
      var formName = String(form.getAttribute("name") || form.name || "").toLowerCase();
      if (formName === "frmqllinkedit" || formName === "frmqllinkadd") s += 4;
      if (form.querySelector("[name='intQLLinkID']")) s += 3;
      if (form.querySelector("[name='txtLinkText'],#txtLinkText,[name='txtTitle'],#txtTitle,[name='txtName'],#txtName")) s += 5;
      if (form.querySelector("[name='txtLinkDescription'],#txtLinkDescription,[name='txtDescription'],#txtDescription,[name='txtPageContent'],#txtPageContent,[name='txtBody'],#txtBody")) s += 5;
      if (form.querySelector("[name='txtLink'],#txtLink,[name='txtLinkURL'],#txtLinkURL")) s += 2;
      if (form.querySelector(".fr-element.fr-view,.fr-box")) s += 3;
      if (form.querySelector("textarea[name*='Body'],textarea[id*='Body'],textarea[name*='Content'],textarea[id*='Content']")) s += 2;
      return s;
    }

    function isLikelyItemForm(form) {
      if (!form) return false;
      var hasTitle = !!form.querySelector("[name='txtLinkText'],#txtLinkText,[name='txtTitle'],#txtTitle,[name='txtName'],#txtName");
      var hasBody = !!form.querySelector("textarea[name*='Body'],textarea[id*='Body'],textarea[name*='Content'],textarea[id*='Content'],[name='txtPageContent'],#txtPageContent,[name='txtDescription'],#txtDescription,[name='txtLinkDescription'],#txtLinkDescription");
      var hasRich = !!form.querySelector(".fr-element.fr-view,.fr-box");
      var hasLink = !!form.querySelector("[name='txtLink'],#txtLink,[name='txtLinkURL'],#txtLinkURL");
      return hasTitle || hasBody || hasRich || hasLink;
    }

    function isRealItemEditorForm(form) {
      if (!form) return false;
      if (!isLikelyItemForm(form)) return false;
      var hasEditableSurface = !!form.querySelector(
        "[name='txtLinkText'],#txtLinkText,[name='txtTitle'],#txtTitle,[name='txtName'],#txtName,[name='txtPageContent'],#txtPageContent,[name='txtDescription'],#txtDescription,[name='txtLinkDescription'],#txtLinkDescription,textarea[name*='Body'],textarea[id*='Body'],.fr-element.fr-view,.fr-box",
      );
      return hasEditableSurface;
    }

    function isVisibleElement(el) {
      if (!el) return false;
      if (el.closest("#" + IMP_MODAL_ID) || el.closest("#" + EXP_MODAL_ID)) return false;
      var style = window.getComputedStyle(el);
      if (!style) return false;
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
      return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }

    function visibleFroalaEditors() {
      return Array.from(document.querySelectorAll(".fr-element.fr-view[contenteditable='true'], .fr-element.fr-view"))
        .filter(function(el) {
          if (!el) return false;
          if (el.closest("#" + IMP_MODAL_ID) || el.closest("#" + EXP_MODAL_ID)) return false;
          var style = window.getComputedStyle(el);
          if (!style) return false;
          if (style.display === "none" || style.visibility === "hidden") return false;
          return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        });
    }

    function showToast(message) {
      var id = "cp-info-import-toast";
      var old = document.getElementById(id);
      if (old) old.remove();
      var toast = document.createElement("div");
      toast.id = id;
      toast.style.cssText =
        "position:fixed;right:18px;bottom:18px;z-index:2147483647;" +
        "background:#26643b;color:#fff;padding:10px 12px;border-radius:6px;" +
        "font:13px Arial,Helvetica,sans-serif;box-shadow:0 8px 18px rgba(0,0,0,.25);";
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(function() {
        if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
      }, 3500);
    }

    function currentCategoryID() {
      if (window.__cpInfoDefaultCategoryID) {
        return String(window.__cpInfoDefaultCategoryID);
      }
      var sels = ['form[name="frmQLLinkList"] [name="intQLCategoryID"]', 'form[name="frmQLCategoryList"] [name="intQLCategoryID"]', '[name="intQLCategoryID"]'];
      for (var i = 0; i < sels.length; i++) {
        var els = document.querySelectorAll(sels[i]);
        for (var j = 0; j < els.length; j++) {
          var v = String(els[j].value || "").trim();
          if (v && v !== "0") return v;
        }
      }
      return "";
    }

    function parseCategoryFromAddItemButton(addBtn) {
      if (!addBtn) return "";
      var attr = String(addBtn.getAttribute("onclick") || "");
      if (!attr) return "";
      var match = attr.match(/addLink\((\d+)/i);
      if (!match) return "";
      return String(match[1] || "");
    }

    function findAddItemButton() {
      var all = Array.from(document.querySelectorAll("input[type='button'],input[type='submit'],a.button,a"));
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        var text = String(el.value || el.textContent || "").toLowerCase();
        var onclick = String(el.getAttribute("onclick") || "").toLowerCase();
        if (text.indexOf("add item") > -1) return el;
        if (onclick.indexOf("addlink(") > -1) return el;
      }
      return null;
    }

    function openAddForCategory(cat) {
      cat = String(cat || "").trim();
      if (!cat) return false;

      var addButtons = Array.from(document.querySelectorAll("input[value*='Add Item'],a[onclick*='addLink(']"));
      for (var i = 0; i < addButtons.length; i++) {
        var btn = addButtons[i];
        var onclick = String(btn.getAttribute("onclick") || "");
        if (onclick && onclick.indexOf("addLink(") > -1) {
          var m = onclick.match(/addLink\(\s*(\d+)/i);
          if (m && String(m[1]) !== cat) continue;
        }
        try {
          if (typeof btn.onclick === "function") btn.onclick();
          else btn.click();
          console.info("[CP Toolkit][Info Advanced] Triggered Add Item via button click for category:", cat);
          return true;
        } catch (_) {}
      }

      if (typeof window.addLink === "function") {
        try {
          window.addLink(cat, "qlLinkAdd");
          console.info("[CP Toolkit][Info Advanced] Triggered Add Item via window.addLink for category:", cat);
          return true;
        } catch (_) {}
      }

      var form = document.forms["frmQLLinkAdd"] || document.frmQLLinkAdd || document.querySelector("form[name='frmQLLinkAdd']");
      if (!form) return false;

      ensureField(form, "strAction");
      ensureField(form, "ysnSave");
      ensureField(form, "intQLCategoryID");
      ensureField(form, "lngContainerID");
      setField(form, "strAction", "qlLinkAdd");
      setField(form, "ysnSave", "0");
      setField(form, "intQLCategoryID", cat);
      setField(form, "lngContainerID", "");
      try {
        form.submit();
      } catch (_) {
        HTMLFormElement.prototype.submit.call(form);
      }
      console.info("[CP Toolkit][Info Advanced] Triggered Add Item via frmQLLinkAdd.submit for category:", cat);
      return true;
    }

    function ensureField(form, name) {
      if (!form || !name) return;
      var existing = form.querySelector('[name="' + esc(name) + '"]');
      if (existing) return;
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      form.appendChild(input);
    }

    function setField(form, name, value) {
      var el = form.querySelector('[name="' + esc(name) + '"]');
      if (el) el.value = value;
    }

    function dispatch(el) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    }

    function skipField(name, type) {
      var n = String(name || "").toLowerCase();
      var t = String(type || "").toLowerCase();
      if (!n) return true;
      if (n === "__requestverificationtoken" || n.indexOf("__viewstate") === 0 || n.indexOf("__event") === 0 || n.indexOf("__prevpage") === 0) return true;
      if (t === "submit" || t === "button" || t === "file") return true;
      return false;
    }

    function toBool(v, checkboxValue) {
      if (Array.isArray(v)) v = v[0];
      if (typeof v === "boolean") return v;
      if (typeof v === "number") return v > 0;
      if (v == null) return false;
      var s = String(v).toLowerCase().trim();
      return s === "true" || s === "1" || s === "on" || s === "yes" || s === String(checkboxValue || "").toLowerCase();
    }

    function esc(v) {
      return String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }
  }
})();
