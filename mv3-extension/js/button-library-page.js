// Fancy Button Library Page — view, manage, import/export saved buttons
(function () {
  "use strict";

  var CUSTOM_KEY = "cp-customButtonLibrary";
  var BUILTIN_URL = "data/fancy-button-library.json";

  // State
  var builtinLibrary = {};
  var customLibrary = {};
  var darkBgToggles = {};
  var currentView = "grid";
  var searchQuery = "";
  var previewCounter = 0;

  // ==================== PREVIEW BUILDER ====================
  // Ported from cp-ImportFancyButton.js — generates live HTML+CSS previews

  function resolveExtUrls(templates) {
    Object.keys(templates).forEach(function (key) {
      var tpl = templates[key];
      if (tpl.savedImages) {
        Object.keys(tpl.savedImages).forEach(function (imgKey) {
          var val = tpl.savedImages[imgKey];
          if (typeof val === "string" && val.indexOf("ext:") === 0) {
            tpl.savedImages[imgKey] = chrome.runtime.getURL(val.substring(4));
          }
        });
      }
    });
  }

  function buildFancyButtonPreview(template) {
    var id = previewCounter++;
    var scope = "cpPrev" + id;

    var s = {};
    if (template.styles) {
      template.styles.forEach(function (item) {
        s[item.Key] = item.Value;
      });
    }
    var savedImages = template.savedImages || {};
    function v(key) {
      return s[key] || "";
    }
    function resolveImg(url) {
      var saved = savedImages[url];
      if (!saved) return url;
      if (saved.indexOf("ext:") === 0)
        return chrome.runtime.getURL(saved.substring(4));
      return saved;
    }
    function resolveCssUrls(cssText) {
      if (!cssText) return "";
      return cssText.replace(/url\(["']?([^)"']+)["']?\)/g, function (match, url) {
        var saved = savedImages[url];
        if (!saved) return match;
        if (saved.indexOf("ext:") === 0)
          return "url(" + chrome.runtime.getURL(saved.substring(4)) + ")";
        return "url(" + saved + ")";
      });
    }

    function buildBgSectionCSS(prefix) {
      var css = "";
      if (v(prefix + "Color"))
        css += "background-color:" + v(prefix + "Color") + ";";
      var gs = v(prefix + "GradientStartColor");
      var ge = v(prefix + "GradientEndColor");
      if (gs && ge) {
        var dir = v(prefix + "GradientDirection");
        var deg = v(prefix + "GradientDegrees") || "45";
        var gd =
          dir === "horizontal"
            ? "to right"
            : dir === "vertical"
              ? "to bottom"
              : deg + "deg";
        css +=
          "background-image:linear-gradient(" +
          gd + "," + gs + "," + ge + ");";
      }
      if (v(prefix + "ImageSource"))
        css +=
          "background-image:url(" +
          resolveImg(v(prefix + "ImageSource")) +
          ");";
      if (v(prefix + "ImageRepeat"))
        css += "background-repeat:" + v(prefix + "ImageRepeat") + ";";
      var xP = v(prefix + "ImagePositionXPrecise") === "True";
      var yP = v(prefix + "ImagePositionYPrecise") === "True";
      var x = xP
        ? v(prefix + "ImagePositionX") +
          (v(prefix + "ImagePositionXUnit") || "px")
        : v(prefix + "ImagePositionXKeyword");
      var y = yP
        ? v(prefix + "ImagePositionY") +
          (v(prefix + "ImagePositionYUnit") || "px")
        : v(prefix + "ImagePositionYKeyword");
      if (x || y)
        css +=
          "background-position:" +
          (x || "center") + " " + (y || "center") + ";";
      var bw = v(prefix + "BorderWidth");
      var bc = v(prefix + "BorderColor");
      var bst = v(prefix + "BorderStyle");
      if (bw && bc && bst && bst !== "None") {
        var bl = bst.toLowerCase();
        if (v(prefix + "BorderApplyToTop") !== "False")
          css += "border-top:" + bw + "px " + bl + " " + bc + ";";
        if (v(prefix + "BorderApplyToRight") !== "False")
          css += "border-right:" + bw + "px " + bl + " " + bc + ";";
        if (v(prefix + "BorderApplyToBottom") !== "False")
          css += "border-bottom:" + bw + "px " + bl + " " + bc + ";";
        if (v(prefix + "BorderApplyToLeft") !== "False")
          css += "border-left:" + bw + "px " + bl + " " + bc + ";";
      }
      var br = v(prefix + "BorderRadius");
      if (br) {
        var bu = v(prefix + "BorderRadiusUnits") || "px";
        var tl =
          v(prefix + "BorderRadiusApplyToTopLeft") !== "False"
            ? br + bu : "0";
        var tr =
          v(prefix + "BorderRadiusApplyToTopRight") !== "False"
            ? br + bu : "0";
        var brr =
          v(prefix + "BorderRadiusApplyToBottomRight") !== "False"
            ? br + bu : "0";
        var bll =
          v(prefix + "BorderRadiusApplyToBottomLeft") !== "False"
            ? br + bu : "0";
        css += "border-radius:" + tl + " " + tr + " " + brr + " " + bll + ";";
      }
      ["Top", "Right", "Bottom", "Left"].forEach(function (side) {
        var pv = v(prefix + "Padding" + side);
        if (pv)
          css +=
            "padding-" + side.toLowerCase() + ":" + pv +
            (v(prefix + "Padding" + side + "Units") || "px") + ";";
      });
      if (v(prefix + "Width"))
        css +=
          "width:" + v(prefix + "Width") +
          (v(prefix + "WidthUnits") || "px") + ";";
      if (v(prefix + "Height"))
        css +=
          "height:" + v(prefix + "Height") +
          (v(prefix + "HeightUnits") || "px") + ";";
      if (v(prefix + "MiscStyles"))
        css += resolveCssUrls(v(prefix + "MiscStyles").replace(/\n/g, ""));
      return css;
    }

    var outerN = buildBgSectionCSS("fancyButtonNormalOuterBackground");
    var outerH = buildBgSectionCSS("fancyButtonHoverOuterBackground");
    var innerN = buildBgSectionCSS("fancyButtonNormalInnerBackground");
    var innerH = buildBgSectionCSS("fancyButtonHoverInnerBackground");

    var textN = "";
    var textH = "";
    var align = v("fancyButtonNormalTextAlignment") || "center";
    textN += "text-align:" + align + ";";
    // Flexbox needs align-items for horizontal alignment in column layout
    if (align === "center") textN += "align-items:center;";
    else if (align === "right") textN += "align-items:flex-end;";
    if (v("fancyButtonNormalTextUnderline") === "True")
      textN += "text-decoration:underline;";
    else textN += "text-decoration:none;";
    if (v("fancyButtonHoverTextUnderline") === "True")
      textH += "text-decoration:underline;";
    else if (v("fancyButtonHoverTextUnderline") === "False")
      textH += "text-decoration:none;";
    if (v("fancyButtonHoverTextAlignment"))
      textH += "text-align:" + v("fancyButtonHoverTextAlignment") + ";";
    ["Top", "Right", "Bottom", "Left"].forEach(function (side) {
      var pv = v("fancyButtonNormalTextStylePadding" + side);
      if (pv)
        textN +=
          "padding-" + side.toLowerCase() + ":" + pv +
          (v("fancyButtonNormalTextStylePadding" + side + "Units") || "px") + ";";
    });
    if (v("fancyButtonNormalTextMiscStyles"))
      textN += resolveCssUrls(v("fancyButtonNormalTextMiscStyles").replace(/\n/g, ""));
    if (v("fancyButtonHoverTextMiscStyles"))
      textH += resolveCssUrls(v("fancyButtonHoverTextMiscStyles").replace(/\n/g, ""));

    function buildTextCSS(normalPre, hoverPre) {
      var n = "";
      var h = "";
      if (v(normalPre + "Color")) n += "color:" + v(normalPre + "Color") + ";";
      if (v(normalPre + "FontSize"))
        n += "font-size:" + v(normalPre + "FontSize") + "em;";
      if (v(normalPre + "FontFamily"))
        n += "font-family:'" + v(normalPre + "FontFamily") + "',sans-serif;";
      if (v(normalPre + "FontVariant"))
        n += "font-weight:" + v(normalPre + "FontVariant") + ";";
      else if (v(normalPre + "FontWeight"))
        n += "font-weight:" + v(normalPre + "FontWeight") + ";";
      if (v(normalPre + "FontStyle"))
        n += "font-style:" + v(normalPre + "FontStyle") + ";";
      if (v(normalPre + "Underline") === "True")
        n += "text-decoration:underline;";
      var tsc = v(normalPre + "ShadowColor");
      if (tsc) {
        n +=
          "text-shadow:" +
          (v(normalPre + "ShadowOffsetX") || "0") + "px " +
          (v(normalPre + "ShadowOffsetY") || "0") + "px " +
          (v(normalPre + "ShadowBlurRadius") || "0") + "px " +
          tsc + ";";
      }
      if (v(normalPre + "MiscStyles"))
        n += resolveCssUrls(v(normalPre + "MiscStyles").replace(/\n/g, ""));
      if (v(hoverPre + "Color")) h += "color:" + v(hoverPre + "Color") + ";";
      if (v(hoverPre + "FontSize"))
        h += "font-size:" + v(hoverPre + "FontSize") + "em;";
      if (v(hoverPre + "Underline") === "True")
        h += "text-decoration:underline;";
      else if (v(hoverPre + "Underline") === "False")
        h += "text-decoration:none;";
      if (v(hoverPre + "MiscStyles"))
        h += resolveCssUrls(v(hoverPre + "MiscStyles").replace(/\n/g, ""));
      return { normal: n, hover: h };
    }

    // General text styles — applied to .cpFB (matches CMS :link/:visited)
    var ts1 = buildTextCSS("fancyButtonNormalText", "fancyButtonHoverText");

    // Dynamically detect all textStyle numbers from style keys
    var textStyleNums = {};
    if (template.styles) {
      template.styles.forEach(function (item) {
        var m = item.Key.match(/^fancyButton(\d+)NormalText/);
        if (m) textStyleNums[m[1]] = true;
      });
    }
    var allTextStyles = {};
    Object.keys(textStyleNums).forEach(function (num) {
      allTextStyles[num] = buildTextCSS(
        "fancyButton" + num + "NormalText",
        "fancyButton" + num + "HoverText"
      );
    });

    var css = "";
    // Outer: background + general text font/color
    css +=
      "." + scope +
      " .cpFB{display:block;text-decoration:none;color:#333;" +
      ts1.normal + outerN + "}";
    if (outerH || ts1.hover)
      css += ".cp-template-card:hover ." + scope + " .cpFB{" + ts1.hover + outerH + "}";
    css += "." + scope + " .cpFB>span{display:flex;height:100%;}";
    css += "." + scope + " .cpFB>span>span{display:flex;flex-direction:column;width:100%;}";
    // Inner background goes on .cpText (matches CMS .text element)
    // textN must come before innerN because MiscStyles in innerN may
    // break out of the selector (e.g. closing } then opening ::after {)
    css +=
      "." + scope +
      " .cpText{display:flex;flex-direction:column;justify-content:center;" + textN + innerN + "}";
    if (innerH || textH)
      css +=
        ".cp-template-card:hover ." + scope + " .cpFB .cpText{" + innerH + textH + "}";
    // All textStyle overrides (dynamic: textStyle1 through textStyleN)
    Object.keys(allTextStyles).forEach(function (num) {
      var txs = allTextStyles[num];
      if (txs.normal)
        css += "." + scope + " .textStyle" + num + "{" + txs.normal + "}";
      if (txs.hover)
        css +=
          ".cp-template-card:hover ." + scope +
          " .cpFB .textStyle" + num + "{" + txs.hover + "}";
    });

    // Post-process: rewrite injected .fancyButtonN selectors
    var scopedFB = "." + scope + " .cpFB";
    css = css.replace(
      /\.fancyButton\d+:is\([^)]*:hover[^)]*\)/g,
      ".cp-template-card:hover " + scopedFB
    );
    css = css.replace(/\.fancyButton\d+/g, scopedFB);
    // Rewrite .text references to .cpText (CMS inner element)
    css = css.replace(/\.text(?=[^S\w-])/g, ".cpText");

    var buttonText = template.previewText || template.buttonText || "Button";

    // Collect custom fonts and load via Google Fonts
    var SYSTEM_FONTS = ["arial", "helvetica", "verdana", "georgia", "times new roman", "courier new", "trebuchet ms", "tahoma", "sans-serif", "serif", "monospace"];
    var fontsNeeded = {};
    function collectFont(prefix) {
      var ff = v(prefix + "FontFamily");
      if (ff && SYSTEM_FONTS.indexOf(ff.toLowerCase()) === -1) {
        var weight = v(prefix + "FontVariant") || v(prefix + "FontWeight") || "400";
        if (weight === "normal") weight = "400";
        else if (weight === "bold") weight = "700";
        fontsNeeded[ff] = fontsNeeded[ff] || {};
        fontsNeeded[ff][weight] = true;
      }
    }
    collectFont("fancyButtonNormalText");
    Object.keys(allTextStyles).forEach(function (num) {
      collectFont("fancyButton" + num + "NormalText");
    });
    var fontImport = "";
    var fontFamilies = Object.keys(fontsNeeded);
    if (fontFamilies.length > 0) {
      var params = fontFamilies.map(function (ff) {
        var weights = Object.keys(fontsNeeded[ff]).join(";");
        return "family=" + encodeURIComponent(ff) + ":wght@" + weights;
      }).join("&");
      fontImport = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' + params + '&display=swap">';
    }

    var html =
      fontImport +
      '<div class="' + scope + '">' +
      '<a class="cpFB" style="pointer-events:none;">' +
      '<span><span><span class="cpText">' +
      buttonText +
      "</span></span></span></a></div>" +
      "<style>" + css + "</style>";

    return html;
  }

  // ==================== HELPERS ====================

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function formatName(key) {
    return key.replace(/_/g, " ");
  }

  function matchesSearch(key, template) {
    if (!searchQuery) return true;
    var q = searchQuery.toLowerCase();
    var name = formatName(key).toLowerCase();
    var btnText = (template.buttonText || "").toLowerCase();
    return name.indexOf(q) !== -1 || btnText.indexOf(q) !== -1;
  }

  // ==================== CARD BUILDER ====================

  function buildCard(key, template, isCustom) {
    var card = document.createElement("div");
    card.className = "cp-template-card";
    card.setAttribute("data-key", key);

    // Preview area
    var previewResult = buildFancyButtonPreview(template);
    var fullKey = (isCustom ? "custom:" : "builtin:") + key;
    var isDark = darkBgToggles[fullKey];
    if (isDark === undefined && key === "Standard_5") isDark = true;

    var preview = document.createElement("div");
    preview.className = "cp-template-card-preview" + (isDark ? " cp-preview-dark" : "");
    preview.innerHTML = previewResult;

    var darkToggle = document.createElement("button");
    darkToggle.className = "cp-template-card-darkbg" + (isDark ? " active" : "");
    darkToggle.title = "Toggle dark preview background";
    darkToggle.innerHTML = "&#9681;";
    darkToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      preview.classList.toggle("cp-preview-dark");
      darkToggle.classList.toggle("active");
      darkBgToggles[fullKey] = preview.classList.contains("cp-preview-dark");
      chrome.storage.local.set({ "cp-darkBgToggles": darkBgToggles });
    });
    preview.appendChild(darkToggle);

    // Edit text toggle
    var editToggle = document.createElement("button");
    editToggle.className = "cp-template-card-edit";
    editToggle.title = "Edit button text";
    editToggle.innerHTML = "&#9998;";
    editToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var cpText = preview.querySelector(".cpText");
      if (!cpText) return;
      var isEditing = preview.classList.contains("cp-editing");
      if (isEditing) {
        // Save and exit edit mode
        preview.classList.remove("cp-editing");
        editToggle.classList.remove("active");
        cpText.contentEditable = "false";
        // Update the template's buttonText
        template.buttonText = cpText.innerHTML;
        // Persist if custom
        if (isCustom) {
          customLibrary[key].buttonText = cpText.innerHTML;
          chrome.storage.local.set({ "cp-customButtonLibrary": customLibrary });
        }
      } else {
        // Enter edit mode
        preview.classList.add("cp-editing");
        editToggle.classList.add("active");
        cpText.contentEditable = "true";
        cpText.focus();
      }
    });
    preview.appendChild(editToggle);

    card.appendChild(preview);

    // Info bar
    var info = document.createElement("div");
    info.className = "cp-template-card-info";

    var name = document.createElement("span");
    name.className = "cp-template-card-name";
    name.textContent = formatName(key);
    name.title = formatName(key);
    info.appendChild(name);

    var badge = document.createElement("span");
    badge.className = "cp-template-card-type " + (isCustom ? "custom" : "builtin");
    badge.textContent = isCustom ? "Saved" : "Built-in";
    info.appendChild(badge);

    // Actions
    var actions = document.createElement("div");
    actions.className = "cp-template-card-actions";

    var viewBtn = document.createElement("button");
    viewBtn.className = "btn-view";
    viewBtn.textContent = "JSON";
    viewBtn.title = "View button JSON";
    viewBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      openJsonModal(key, template, isCustom);
    });
    actions.appendChild(viewBtn);

    var copyBtn = document.createElement("button");
    copyBtn.className = "btn-copy";
    copyBtn.textContent = "Copy";
    copyBtn.title = "Copy button JSON to clipboard";
    copyBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var json = JSON.stringify(template, null, 2);
      navigator.clipboard.writeText(json).then(function () {
        copyBtn.textContent = "Copied!";
        setTimeout(function () {
          copyBtn.textContent = "Copy";
        }, 1500);
      });
    });
    actions.appendChild(copyBtn);

    if (isCustom) {
      var deleteBtn = document.createElement("button");
      deleteBtn.className = "btn-delete";
      deleteBtn.textContent = "Delete";
      deleteBtn.title = "Delete this button";
      deleteBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (confirm('Delete "' + formatName(key) + '"?')) {
          delete customLibrary[key];
          chrome.storage.local.set(
            { "cp-customButtonLibrary": customLibrary },
            function () {
              renderButtons();
            }
          );
        }
      });
      actions.appendChild(deleteBtn);
    }

    info.appendChild(actions);
    card.appendChild(info);

    return card;
  }

  // ==================== RENDER ====================

  function renderButtons() {
    var grid = document.getElementById("buttons-grid");
    var emptyState = document.getElementById("buttons-empty");
    grid.innerHTML = "";

    var customKeys = Object.keys(customLibrary).filter(function (k) {
      return matchesSearch(k, customLibrary[k]);
    });
    var builtinKeys = Object.keys(builtinLibrary).filter(function (k) {
      return matchesSearch(k, builtinLibrary[k]);
    });

    if (customKeys.length === 0 && builtinKeys.length === 0) {
      emptyState.style.display = "block";
      grid.className = "";
      return;
    }
    emptyState.style.display = "none";
    grid.className = currentView === "grid" ? "view-grid" : "view-list";

    // Custom / Saved buttons section
    if (customKeys.length > 0) {
      var customSection = document.createElement("div");
      customSection.className = "section-group";

      var customHeader = document.createElement("div");
      customHeader.className = "section-header";
      customHeader.innerHTML =
        "<h2>My Saved Buttons</h2>" +
        '<span class="section-count">' + customKeys.length + "</span>";
      customSection.appendChild(customHeader);

      var customCards = document.createElement("div");
      customCards.className = "section-cards";
      customKeys.forEach(function (key) {
        customCards.appendChild(buildCard(key, customLibrary[key], true));
      });
      customSection.appendChild(customCards);
      grid.appendChild(customSection);
    }

    // Built-in templates section
    if (builtinKeys.length > 0) {
      var builtinSection = document.createElement("div");
      builtinSection.className = "section-group";

      var builtinHeader = document.createElement("div");
      builtinHeader.className = "section-header";
      builtinHeader.innerHTML =
        "<h2>Built-in Templates</h2>" +
        '<span class="section-count">' + builtinKeys.length + "</span>";
      builtinSection.appendChild(builtinHeader);

      var builtinCards = document.createElement("div");
      builtinCards.className = "section-cards";
      builtinKeys.forEach(function (key) {
        builtinCards.appendChild(buildCard(key, builtinLibrary[key], false));
      });
      builtinSection.appendChild(builtinCards);
      grid.appendChild(builtinSection);
    }

    scalePreviewsToFit();
  }

  function scalePreviewsToFit() {
    // After rendering, scale down any previews whose content overflows
    var previews = document.querySelectorAll(".cp-template-card-preview");
    previews.forEach(function (preview) {
      var inner = preview.querySelector('[class^="cpPrev"]');
      if (!inner) return;
      // Reset any previous scale
      inner.style.transform = "";
      inner.style.transformOrigin = "";
      // Wait a frame for styles to apply
      requestAnimationFrame(function () {
        var containerH = preview.clientHeight;
        var contentH = inner.scrollHeight;
        if (contentH > containerH && containerH > 0) {
          var scale = containerH / contentH;
          inner.style.transform = "scale(" + scale + ")";
          inner.style.transformOrigin = "center center";
        }
      });
    });
  }

  // ==================== JSON MODAL ====================

  function openJsonModal(key, template, isCustom) {
    var overlay = document.getElementById("json-modal-overlay");
    var title = document.getElementById("json-modal-title");
    var codeArea = document.getElementById("json-modal-code");
    var deleteBtn = document.getElementById("json-modal-delete");
    var copyBtn = document.getElementById("json-modal-copy");
    var downloadBtn = document.getElementById("json-modal-download");
    var cancelBtn = document.getElementById("json-modal-cancel");
    var closeBtn = document.getElementById("json-modal-close");

    title.textContent = formatName(key);
    deleteBtn.style.display = isCustom ? "" : "none";

    var json = JSON.stringify(template, null, 2);
    codeArea.value = json;

    overlay.style.display = "flex";

    // Clone buttons to remove old handlers
    var newCopy = copyBtn.cloneNode(true);
    copyBtn.parentNode.replaceChild(newCopy, copyBtn);
    var newDownload = downloadBtn.cloneNode(true);
    downloadBtn.parentNode.replaceChild(newDownload, downloadBtn);
    var newDelete = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDelete, deleteBtn);

    newCopy.addEventListener("click", function () {
      navigator.clipboard.writeText(json).then(function () {
        newCopy.textContent = "Copied!";
        setTimeout(function () {
          newCopy.textContent = "Copy to Clipboard";
        }, 1500);
      });
    });

    newDownload.addEventListener("click", function () {
      var blob = new Blob([json], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = key.replace(/\s+/g, "_") + ".json";
      a.click();
      URL.revokeObjectURL(url);
    });

    if (isCustom) {
      newDelete.addEventListener("click", function () {
        if (confirm('Delete "' + formatName(key) + '"?')) {
          delete customLibrary[key];
          chrome.storage.local.set(
            { "cp-customButtonLibrary": customLibrary },
            function () {
              closeJsonModal();
              renderButtons();
            }
          );
        }
      });
    }
  }

  function closeJsonModal() {
    document.getElementById("json-modal-overlay").style.display = "none";
  }

  // ==================== IMPORT / EXPORT ====================

  function importLibrary() {
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json,application/json";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    fileInput.addEventListener("change", function () {
      var file = fileInput.files[0];
      fileInput.remove();
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var data = JSON.parse(e.target.result);
        } catch (err) {
          alert("Invalid JSON file.");
          return;
        }

        var buttons;
        if (data.type === "cp-toolkit-fancy-button-library" && data.buttons) {
          buttons = data.buttons;
        } else if (
          typeof data === "object" &&
          !Array.isArray(data) &&
          !data.styles
        ) {
          buttons = data;
        } else {
          alert(
            "Unrecognized file format. Expected a button library export."
          );
          return;
        }

        var keys = Object.keys(buttons);
        if (keys.length === 0) {
          alert("No buttons found in file.");
          return;
        }

        var overwriteCount = 0;
        keys.forEach(function (k) {
          if (customLibrary[k]) overwriteCount++;
        });

        var msg =
          "Import " + keys.length + " button(s)?";
        if (overwriteCount > 0) {
          msg +=
            "\n" + overwriteCount + " existing button(s) will be overwritten.";
        }

        if (confirm(msg)) {
          keys.forEach(function (k) {
            customLibrary[k] = buttons[k];
          });
          chrome.storage.local.set(
            { "cp-customButtonLibrary": customLibrary },
            function () {
              renderButtons();
            }
          );
        }
      };
      reader.readAsText(file);
    });

    fileInput.click();
  }

  function exportLibrary() {
    if (
      !customLibrary ||
      Object.keys(customLibrary).length === 0
    ) {
      alert("No saved buttons to export.");
      return;
    }

    var exportData = {
      type: "cp-toolkit-fancy-button-library",
      version: 1,
      buttons: customLibrary,
    };
    var json = JSON.stringify(exportData, null, 2);

    var overlay = document.getElementById("json-modal-overlay");
    var title = document.getElementById("json-modal-title");
    var codeArea = document.getElementById("json-modal-code");
    var deleteBtn = document.getElementById("json-modal-delete");
    var copyBtn = document.getElementById("json-modal-copy");
    var downloadBtn = document.getElementById("json-modal-download");

    title.textContent =
      "Export Library (" + Object.keys(customLibrary).length + " buttons)";
    deleteBtn.style.display = "none";
    codeArea.value = json;

    overlay.style.display = "flex";

    var newCopy = copyBtn.cloneNode(true);
    copyBtn.parentNode.replaceChild(newCopy, copyBtn);
    var newDownload = downloadBtn.cloneNode(true);
    downloadBtn.parentNode.replaceChild(newDownload, downloadBtn);

    newCopy.addEventListener("click", function () {
      navigator.clipboard.writeText(json).then(function () {
        newCopy.textContent = "Copied!";
        setTimeout(function () {
          newCopy.textContent = "Copy to Clipboard";
        }, 1500);
      });
    });

    newDownload.addEventListener("click", function () {
      var blob = new Blob([json], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "fancy-button-library.json";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // ==================== TOOLBAR ====================

  function initToolbar() {
    // View toggle
    document.querySelectorAll(".view-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document
          .querySelectorAll(".view-btn")
          .forEach(function (b) {
            b.classList.remove("active");
          });
        btn.classList.add("active");
        currentView = btn.getAttribute("data-view");
        renderButtons();
      });
    });

    // Import
    document
      .getElementById("btn-import")
      .addEventListener("click", importLibrary);

    // Export
    document
      .getElementById("btn-export")
      .addEventListener("click", exportLibrary);

    // Search
    var searchInput = document.getElementById("search-input");
    var searchTimer;
    searchInput.addEventListener("input", function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        searchQuery = searchInput.value.trim();
        renderButtons();
      }, 200);
    });
  }

  // ==================== INIT ====================

  function init() {
    initToolbar();

    // Modal close handlers
    document
      .getElementById("json-modal-close")
      .addEventListener("click", closeJsonModal);
    document
      .getElementById("json-modal-cancel")
      .addEventListener("click", closeJsonModal);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeJsonModal();
    });

    // Load built-in templates
    fetch(chrome.runtime.getURL(BUILTIN_URL))
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        builtinLibrary =
          data && data.FancyButtons ? data.FancyButtons : {};
        resolveExtUrls(builtinLibrary);

        // Load custom library
        chrome.storage.local.get([CUSTOM_KEY, "cp-darkBgToggles"], function (result) {
          customLibrary = result[CUSTOM_KEY] || {};
          darkBgToggles = result["cp-darkBgToggles"] || {};
          renderButtons();
        });
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
