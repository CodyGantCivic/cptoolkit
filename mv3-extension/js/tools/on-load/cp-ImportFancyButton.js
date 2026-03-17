(function loadTool() {
  var thisTool = "cp-ImportFancyButton";
  chrome.storage.local.get(thisTool, function (settings) {
    detect_if_cp_site(function () {
      if (
        settings[thisTool] !== false &&
        window.location.pathname.toLowerCase() === "/admin/graphiclinks.aspx"
      ) {
        var importButtonAdded = false;
        var buttonLibrary = null;
        var customButtonLibrary = {};
        var darkBgToggles = {};
        var socialIcons = null;

        // Resolve ext: prefixed URLs in savedImages to full chrome-extension:// URLs
        function resolveExtUrls(templates) {
          Object.keys(templates).forEach(function (key) {
            var tpl = templates[key];
            if (tpl.savedImages) {
              Object.keys(tpl.savedImages).forEach(function (imgKey) {
                var val = tpl.savedImages[imgKey];
                if (typeof val === "string" && val.indexOf("ext:") === 0) {
                  tpl.savedImages[imgKey] = chrome.runtime.getURL(
                    val.substring(4),
                  );
                }
              });
            }
          });
        }

        // Load the button library
        $.getJSON(
          chrome.runtime.getURL("data/fancy-button-library.json"),
          function (data) {
            buttonLibrary = data && data.FancyButtons ? data.FancyButtons : {};
            resolveExtUrls(buttonLibrary);
          },
        );

        // Load the social icons registry
        $.getJSON(
          chrome.runtime.getURL("data/social-icons.json"),
          function (data) {
            socialIcons = data && data.icons ? data.icons : [];
          },
        );

        // Load custom saved buttons and dark bg toggle state from chrome storage
        chrome.storage.local.get(
          ["cp-customButtonLibrary", "cp-darkBgToggles"],
          function (data) {
            customButtonLibrary = data["cp-customButtonLibrary"] || {};
            darkBgToggles = data["cp-darkBgToggles"] || {};
          },
        );

        // ── Fancy Button Preview Builder ──
        // Generates live HTML+CSS preview from template style data.
        var previewCounter = 0;

        function buildFancyButtonPreview(template, previewTextOverride) {
          var id = previewCounter++;
          var scope = "cpPrev" + id;

          // Build styles lookup
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
            // ext: prefix = extension-relative path (for built-in templates)
            if (saved.indexOf("ext:") === 0)
              return chrome.runtime.getURL(saved.substring(4));
            return saved;
          }
          // Replace url() references in raw CSS (MiscStyles) with savedImages data URLs
          function resolveCssUrls(cssText) {
            if (!cssText) return "";
            return cssText.replace(
              /url\(["']?([^)"']+)["']?\)/g,
              function (match, url) {
                var saved = savedImages[url];
                if (!saved) return match;
                if (saved.indexOf("ext:") === 0)
                  return (
                    "url(" + chrome.runtime.getURL(saved.substring(4)) + ")"
                  );
                return "url(" + saved + ")";
              },
            );
          }

          // Generic CSS builder for a background section (outer or inner)
          function buildBgSectionCSS(prefix) {
            var css = "";

            // Background color
            if (v(prefix + "Color"))
              css += "background-color:" + v(prefix + "Color") + ";";

            // Gradient
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
                gd +
                "," +
                gs +
                "," +
                ge +
                ");";
            }

            // Background image (overrides gradient) — resolve from savedImages if available
            if (v(prefix + "ImageSource"))
              css +=
                "background-image:url(" +
                resolveImg(v(prefix + "ImageSource")) +
                ");";
            if (v(prefix + "ImageRepeat"))
              css += "background-repeat:" + v(prefix + "ImageRepeat") + ";";

            // Background position
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
                (x || "center") +
                " " +
                (y || "center") +
                ";";

            // Border
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

            // Border radius
            var br = v(prefix + "BorderRadius");
            if (br) {
              var bu = v(prefix + "BorderRadiusUnits") || "px";
              var tl =
                v(prefix + "BorderRadiusApplyToTopLeft") !== "False"
                  ? br + bu
                  : "0";
              var tr =
                v(prefix + "BorderRadiusApplyToTopRight") !== "False"
                  ? br + bu
                  : "0";
              var brr =
                v(prefix + "BorderRadiusApplyToBottomRight") !== "False"
                  ? br + bu
                  : "0";
              var bll =
                v(prefix + "BorderRadiusApplyToBottomLeft") !== "False"
                  ? br + bu
                  : "0";
              css +=
                "border-radius:" + tl + " " + tr + " " + brr + " " + bll + ";";
            }

            // Padding
            ["Top", "Right", "Bottom", "Left"].forEach(function (side) {
              var pv = v(prefix + "Padding" + side);
              if (pv)
                css +=
                  "padding-" +
                  side.toLowerCase() +
                  ":" +
                  pv +
                  (v(prefix + "Padding" + side + "Units") || "px") +
                  ";";
            });

            // Width / Height
            if (v(prefix + "Width"))
              css +=
                "width:" +
                v(prefix + "Width") +
                (v(prefix + "WidthUnits") || "px") +
                ";";
            if (v(prefix + "Height"))
              css +=
                "height:" +
                v(prefix + "Height") +
                (v(prefix + "HeightUnits") || "px") +
                ";";

            // Misc styles (raw CSS) — resolve saved image URLs
            if (v(prefix + "MiscStyles"))
              css += resolveCssUrls(
                v(prefix + "MiscStyles").replace(/\n/g, ""),
              );

            return css;
          }

          // ── Build CSS per target element ──

          // Outer (<a>) — normal and hover
          var outerN = buildBgSectionCSS("fancyButtonNormalOuterBackground");
          var outerH = buildBgSectionCSS("fancyButtonHoverOuterBackground");

          // Inner (> span) — background color, gradient, border, radius, misc
          var innerN = buildBgSectionCSS("fancyButtonNormalInnerBackground");
          var innerH = buildBgSectionCSS("fancyButtonHoverInnerBackground");

          // Text container (.cpText) — alignment, decoration, text-style padding, text misc
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
                "padding-" +
                side.toLowerCase() +
                ":" +
                pv +
                (v("fancyButtonNormalTextStylePadding" + side + "Units") ||
                  "px") +
                ";";
          });
          if (v("fancyButtonNormalTextMiscStyles"))
            textN += resolveCssUrls(
              v("fancyButtonNormalTextMiscStyles").replace(/\n/g, ""),
            );
          if (v("fancyButtonHoverTextMiscStyles"))
            textH += resolveCssUrls(
              v("fancyButtonHoverTextMiscStyles").replace(/\n/g, ""),
            );

          // Helper: build text style CSS from a key prefix
          // CMS uses three sets of text keys:
          //   fancyButtonNormalText*   — general / .cpTS1 (single-text buttons)
          //   fancyButton1NormalText*  — .textStyle1 overrides
          //   fancyButton2NormalText*  — .textStyle2 overrides
          function buildTextCSS(normalPre, hoverPre) {
            var n = "";
            var h = "";
            if (v(normalPre + "Color"))
              n += "color:" + v(normalPre + "Color") + ";";
            if (v(normalPre + "FontSize"))
              n += "font-size:" + v(normalPre + "FontSize") + "em;";
            if (v(normalPre + "FontFamily"))
              n +=
                "font-family:'" + v(normalPre + "FontFamily") + "',sans-serif;";
            // CMS stores font-weight as FontVariant (or FontWeight)
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
                (v(normalPre + "ShadowOffsetX") || "0") +
                "px " +
                (v(normalPre + "ShadowOffsetY") || "0") +
                "px " +
                (v(normalPre + "ShadowBlurRadius") || "0") +
                "px " +
                tsc +
                ";";
            }
            // Misc styles — resolve saved image URLs
            if (v(normalPre + "MiscStyles"))
              n += resolveCssUrls(
                v(normalPre + "MiscStyles").replace(/\n/g, ""),
              );

            if (v(hoverPre + "Color"))
              h += "color:" + v(hoverPre + "Color") + ";";
            if (v(hoverPre + "FontSize"))
              h += "font-size:" + v(hoverPre + "FontSize") + "em;";
            if (v(hoverPre + "Underline") === "True")
              h += "text-decoration:underline;";
            else if (v(hoverPre + "Underline") === "False")
              h += "text-decoration:none;";
            if (v(hoverPre + "MiscStyles"))
              h += resolveCssUrls(
                v(hoverPre + "MiscStyles").replace(/\n/g, ""),
              );
            return { normal: n, hover: h };
          }

          // General text styles (fancyButtonNormalText*) — applied to .cpFB
          var ts1 = buildTextCSS(
            "fancyButtonNormalText",
            "fancyButtonHoverText",
          );

          // Dynamically detect all textStyle numbers from style keys
          // Keys like fancyButton{N}NormalText* indicate textStyle{N}
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
              "fancyButton" + num + "HoverText",
            );
          });

          // ── Assemble scoped CSS ──
          var css = "";
          // Outer: background + general text font/color
          css +=
            "." +
            scope +
            " .cpFB{display:block;text-decoration:none;color:#333;" +
            ts1.normal +
            outerN +
            "}";
          if (outerH || ts1.hover)
            css +=
              ".cp-template-card:hover ." +
              scope +
              " .cpFB{" +
              ts1.hover +
              outerH +
              "}";
          css +=
            "." +
            scope +
            " .cpFB>span{display:flex;height:100%;}";
          css +=
            "." +
            scope +
            " .cpFB>span>span{display:flex;flex-direction:column;width:100%;}";
          // Inner background goes on .cpText (matches CMS .text element)
          // textN must come before innerN because MiscStyles in innerN may
          // break out of the selector (e.g. closing } then opening ::after {)
          css +=
            "." +
            scope +
            " .cpText{display:flex;flex-direction:column;justify-content:center;" +
            textN +
            innerN +
            "}";
          if (innerH || textH)
            css +=
              ".cp-template-card:hover ." +
              scope +
              " .cpFB .cpText{" +
              innerH +
              textH +
              "}";
          // All textStyle overrides (dynamic: textStyle1 through textStyleN)
          Object.keys(allTextStyles).forEach(function (num) {
            var txs = allTextStyles[num];
            if (txs.normal)
              css += "." + scope + " .textStyle" + num + "{" + txs.normal + "}";
            if (txs.hover)
              css +=
                ".cp-template-card:hover ." +
                scope +
                " .cpFB .textStyle" +
                num +
                "{" +
                txs.hover +
                "}";
          });

          // ── Post-process: rewrite injected .fancyButtonN selectors ──
          // Some buttons inject ::after/::before pseudo-elements via MiscStyles
          // using .fancyButton1 as the selector. Rewrite to our scoped selector.
          // First rewrite hover/focus/active variants to use card-hover pattern
          var scopedFB = "." + scope + " .cpFB";
          css = css.replace(
            /\.fancyButton\d+:is\([^)]*:hover[^)]*\)/g,
            ".cp-template-card:hover " + scopedFB,
          );
          // Then rewrite remaining .fancyButtonN references
          css = css.replace(/\.fancyButton\d+/g, scopedFB);
          // Rewrite .text references to .cpText (CMS inner element)
          css = css.replace(/\.text(?=[^S\w-])/g, ".cpText");

          // ── Assemble HTML ──
          var buttonText = template.buttonText || "Button";
          // For preview, override visible text with the template name
          if (previewTextOverride) {
            if (buttonText.indexOf('class="textStyle1"') !== -1) {
              // Rebuild with clean structure: textStyle1 (name) + textStyle2 (secondary)
              buttonText = '<span class="textStyle1">' + previewTextOverride +
                '</span><span class="textStyle2">secondary text</span>';
            } else {
              buttonText = previewTextOverride;
            }
          }

          // Collect custom fonts and load via Google Fonts
          var SYSTEM_FONTS = [
            "arial",
            "helvetica",
            "verdana",
            "georgia",
            "times new roman",
            "courier new",
            "trebuchet ms",
            "tahoma",
            "sans-serif",
            "serif",
            "monospace",
          ];
          var fontsNeeded = {};
          function collectFont(prefix) {
            var ff = v(prefix + "FontFamily");
            if (ff && SYSTEM_FONTS.indexOf(ff.toLowerCase()) === -1) {
              var weight =
                v(prefix + "FontVariant") || v(prefix + "FontWeight") || "400";
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
            var params = fontFamilies
              .map(function (ff) {
                var weights = Object.keys(fontsNeeded[ff]).join(";");
                return "family=" + encodeURIComponent(ff) + ":wght@" + weights;
              })
              .join("&");
            fontImport =
              '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' +
              params +
              '&display=swap">';
          }

          var html =
            fontImport +
            '<div class="' +
            scope +
            '">' +
            '<a class="cpFB" style="pointer-events:none;">' +
            '<span><span><span class="cpText">' +
            buttonText +
            "</span></span></span></a></div>" +
            "<style>" +
            css +
            "</style>";

          return html;
        }

        function createImportModal() {
          // Remove existing modal if any
          var existing = document.getElementById("cp-toolkit-import-modal");
          if (existing) existing.remove();

          var modal = document.createElement("div");
          modal.id = "cp-toolkit-import-modal";
          modal.innerHTML = `
            <style>
              #cp-toolkit-import-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: Arial, Helvetica, sans-serif;
              }
              .cp-import-dialog {
                background: white;
                border-radius: 8px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                width: 1000px;
                max-width: 90vw;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
              }
              .cp-import-header {
                padding: 16px 20px;
                border-bottom: 1px solid #e0e0e0;
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              .cp-import-header h2 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #333;
              }
              .cp-import-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 0;
                line-height: 1;
              }
              .cp-import-close:hover {
                color: #333;
              }
              .cp-import-tabs {
                display: flex;
                border-bottom: 1px solid #e0e0e0;
              }
              .cp-import-tab {
                padding: 12px 20px;
                border: none;
                background: none;
                cursor: pointer;
                font-size: 14px;
                color: #666;
                border-bottom: 2px solid transparent;
                margin-bottom: -1px;
                width: 100% !important;
                line-height: normal !important;
              }
              .cp-import-tab:hover {
                color: #333;
                background: #f5f5f5;
              }
              .cp-import-tab.active {
                color: #af282f;
                border-bottom-color: #af282f;
              }
              .cp-import-content {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
              }
              .cp-import-panel {
                display: none;
              }
              .cp-import-panel.active {
                display: block;
              }
              .cp-template-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 16px;
              }
              .cp-template-card {
                position: relative;
                padding: 2em 0;
                display: flex;
                flex-direction: column;
                justify-content: center;
                border-radius: 8px;
                cursor: pointer;
                transition: border-color 0.2s, box-shadow 0.2s;
              }
              .cp-template-card:hover {
              }
              .cp-template-preview {
                border-radius: 4px;
                overflow: visible;
                pointer-events: none;
                padding: 5px;
                border: 2px solid transparent;
              }
              .cp-template-card.selected .cp-template-preview {
                border-color: #af282f;
              }
              .cp-paste-section textarea {
                width: 100%;
                height: 200px;
                border: 1px solid #ccc;
                border-radius: 4px;
                padding: 12px;
                font-family: monospace;
                font-size: 12px;
                resize: vertical;
                box-sizing: border-box;
              }
              .cp-paste-section textarea:focus {
                outline: none;
                border-color: #af282f;
              }
              .cp-paste-section label {
                display: block;
                margin-bottom: 8px;
                font-weight: bold;
                color: #333;
              }
              .cp-paste-section .cp-hint {
                font-size: 12px;
                color: #666;
                margin-top: 8px;
              }
              .cp-import-footer {
                padding: 16px 20px;
                border-top: 1px solid #e0e0e0;
                display: flex;
                justify-content: flex-end;
                gap: 8px;
              }
              .cp-import-btn {
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                border: none;
                line-height: normal !important;
              }
              .cp-import-btn-cancel {
                background: #e0e0e0;
                color: #333;
              }
              .cp-import-btn-cancel:hover {
                background: #d0d0d0;
              }
              .cp-import-btn-primary {
                background: #af282f;
                color: white;
              }
              .cp-import-btn-primary:hover {
                background: #c42f37;
              }
              .cp-import-btn-primary:disabled {
                background: #ccc;
                cursor: not-allowed;
              }
              .cp-no-templates {
                text-align: center;
                color: #666;
                padding: 40px;
              }
              .cp-library-toolbar {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-bottom: 12px;
              }
              .cp-library-toolbar button {
                background: none;
                border: 1px solid #ccc;
                border-radius: 4px;
                padding: 4px 12px;
                font-size: 12px;
                cursor: pointer;
                color: #555;
                line-height: normal !important;
              }
              .cp-library-toolbar button:hover {
                border-color: #af282f;
                color: #af282f;
              }
              button#cp-lib-view-full {
                margin: 0 auto;
                margin-left: 0;
              }
              .cp-template-section-header {
                grid-column: 1 / -1;
                font-size: 13px;
                font-weight: 600;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                padding: 8px 0 4px;
                border-bottom: 1px solid #e0e0e0;
                margin-bottom: 4px;
              }
              .cp-template-card {
                position: relative;
              }
              .cp-template-card-btns {
                position: absolute;
                top: 4px;
                right: 4px;
                display: flex;
                gap: 2px;
              }
              .cp-template-darkbg,
              .cp-template-delete,
              .cp-template-edit {
                background: none;
                border: none;
                color: #ccc;
                font-size: 14px;
                cursor: pointer;
                padding: 2px 4px;
                line-height: normal !important;
                width: auto !important;
                border-radius: 3px;
              }
              .cp-template-darkbg:hover {
                color: #333;
                background: rgba(0,0,0,0.08);
              }
              .cp-template-darkbg.active {
                color: #fff;
                background: rgba(0,0,0,0.5);
              }
              .cp-template-edit:hover {
                color: #333;
                background: rgba(0,0,0,0.08);
              }
              .cp-template-edit.active {
                color: #af282f;
                background: rgba(175,40,47,0.1);
              }
              .cp-template-delete:hover {
                color: #cc0000;
              }
              .cp-template-preview.cp-editing .cpText {
                pointer-events: auto;
                cursor: text;
                outline: 2px dashed #af282f;
                outline-offset: 2px;
                min-height: 1em;
              }
              .cp-template-preview.cp-editing {
                pointer-events: auto;
              }
              .cp-template-preview.cp-preview-dark {
                background: #2a2a2a;
              }
              /* Socials tab styles */
              .cp-socials-controls {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 16px;
                width: 100%;
              }
              .cp-socials-controls-row {
                display: flex;
                gap: 12px;
                align-items: flex-end;
                justify-content: center;
                flex-wrap: wrap;
              }
              .cp-socials-controls label {
                display: block;
                font-weight: bold;
                color: #333;
                margin-bottom: 4px;
                font-size: 13px;
              }
              .cp-socials-controls select,
              .cp-socials-controls input[type="number"] {
                padding: 6px 10px;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 13px;
              }
              .cp-socials-controls select { min-width: 100px; }
              .cp-socials-folder-btn {
                padding: 1px 12px;
                border: 1px solid #af282f;
                border-radius: 4px;
                background: #af282f;
                color: #fff;
                font-size: 13px;
                cursor: pointer;
                min-height: 44px;
                white-space: nowrap;
                line-height: normal !important;
              }
              .cp-socials-folder-btn:hover {
                background: #c42f37;
                border-color: #c42f37;
              }
              .cp-folder-lookup-container {
                width: 100%;
              }
              .cp-socials-select-actions {
                display: flex;
                gap: 8px;
                align-self: center;
                width: 100%;
                justify-content: center;
              }
              .cp-socials-select-actions button {
                border: 1px solid #ccc;
                border-radius: 4px;
                background: #f5f5f5;
                width: 100% !important;
                cursor: pointer;
                height: 44px;
                font-size: 12px;
                display: flex;
                flex-direction: column;
                justify-content: center;
              }
              .cp-socials-select-actions button:hover { background: #e0e0e0; }
              .cp-socials-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                gap: 10px;
              }
              .cp-social-card {
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                padding: 10px 6px;
                text-align: center;
                cursor: pointer;
                transition: border-color 0.2s;
              }
              .cp-social-card:hover { border-color: #af282f; }
              .cp-social-card.selected {
                border-color: #af282f;
                background: #fdf2f2;
              }

            .cp-social-card.selected-other {
              border-color: #888;
              position: relative;
            }
            .cp-social-card.selected-other::after {
              content: attr(data-selected-color);
              position: absolute;
              top: 2px;
              right: 2px;
              font-size: 9px;
              background: #888;
              color: #fff;
              padding: 1px 4px;
              border-radius: 3px;
              line-height: normal;
            }
              .cp-social-card img { width: 36px; height: 36px; }
              .cp-social-card .cp-social-name {
                font-size: 11px;
                color: #333;
                font-weight: bold;
                margin-top: 4px;
              }
              .cp-socials-progress { margin-top: 16px; }
              .cp-socials-progress-bar-wrap {
                width: 100%;
                height: 8px;
                background: #e0e0e0;
                border-radius: 4px;
                margin: 8px 0;
                overflow: hidden;
              }
              .cp-socials-progress-bar {
                height: 100%;
                background: #af282f;
                border-radius: 4px;
                transition: width 0.3s;
                width: 0%;
              }
              .cp-socials-progress-text {
                font-size: 13px;
                color: #333;
              }
              .cp-socials-progress-log {
                max-height: 150px;
                overflow-y: auto;
                font-size: 11px;
                font-family: monospace;
                color: #666;
                margin-top: 8px;
                border: 1px solid #e0e0e0;
                border-radius: 4px;
                padding: 8px;
              }
              .cp-socials-hint {
                font-size: 12px;
                color: #666;
                margin-top: 4px;
              }
              .cp-socials-folder-loading {
                font-size: 12px;
                color: #999;
                font-style: italic;
              }
            </style>
            <div class="cp-import-dialog">
              <div class="cp-import-header">
                <h2>CP Toolkit — Import</h2>
                <button class="cp-import-close" id="cp-import-close">&times;</button>
              </div>
              <div class="cp-import-tabs">
                <button class="cp-import-tab active" data-tab="templates">Template Library</button>
                <button class="cp-import-tab" data-tab="paste">Paste JSON</button>
                <button class="cp-import-tab" data-tab="socials">Socials</button>
              </div>
              <div class="cp-import-content">
                <div class="cp-import-panel active" id="cp-panel-templates">
                  <div class="cp-library-toolbar">
                    <button id="cp-lib-view-full" title="Open the full button library page">View Full Library</button>
                    <button id="cp-lib-import" title="Import saved buttons from a file">Import Library</button>
                    <button id="cp-lib-export" title="Export saved buttons to a file">Export Library</button>
                  </div>
                  <div class="cp-template-grid" id="cp-template-grid">
                    <!-- Templates will be inserted here -->
                  </div>
                </div>
                <div class="cp-import-panel" id="cp-panel-paste">
                  <div class="cp-paste-section">
                    <label for="cp-paste-json">Paste Button JSON:</label>
                    <textarea id="cp-paste-json" placeholder='{"styles":[...],"buttonText":"...","linkUrl":"/..."}'></textarea>
                    <div class="cp-hint">
                      Paste JSON exported from another fancy button or from the template library.
                    </div>
                  </div>
                </div>
                <div class="cp-import-panel" id="cp-panel-socials">
                  <div class="cp-socials-controls">
                    <div class="cp-socials-controls-row">
                      <div>
                        <label>Color variant:</label>
                        <select id="cp-socials-color">
                          <option value="Black">Black</option>
                          <option value="White">White</option>
                          <option value="Color">Color</option>
                        <option value="All">All</option>
                        </select>
                      </div>
                      <div>
                        <label>Upload to folder:</label>
                        <select id="cp-socials-folder" style="min-width:200px;">
                          <option value="">Loading folders...</option>
                        </select>
                      </div>
                    </div>
                    <div class="cp-folder-lookup-container" id="cp-folder-lookup-container"></div>
                    <div class="cp-socials-select-actions">
                      <button type="button" id="cp-socials-select-all">Select All</button>
                      <button type="button" id="cp-socials-select-none">Select None</button>
                    </div>
                  </div>
                  <div class="cp-socials-grid" id="cp-socials-grid"></div>
                  <div class="cp-socials-progress" id="cp-socials-progress" style="display:none;">
                    <div class="cp-socials-progress-text" id="cp-socials-progress-text"></div>
                    <div class="cp-socials-progress-bar-wrap">
                      <div class="cp-socials-progress-bar" id="cp-socials-progress-bar"></div>
                    </div>
                    <div class="cp-socials-progress-log" id="cp-socials-progress-log"></div>
                  </div>
                </div>
              </div>
              <div class="cp-import-footer">
                <button class="cp-import-btn cp-import-btn-cancel" id="cp-import-cancel">Cancel</button>
                <button class="cp-import-btn cp-import-btn-primary" id="cp-import-submit" disabled>Import</button>
              </div>
            </div>
          `;

          document.body.appendChild(modal);

          // Tab switching
          var tabs = modal.querySelectorAll(".cp-import-tab");
          var panels = modal.querySelectorAll(".cp-import-panel");
          var selectedTemplate = null;
          var submitBtn = modal.querySelector("#cp-import-submit");
          var selectedSocials = {};
          var selectedOrder = [];

          tabs.forEach(function (tab) {
            tab.addEventListener("click", function () {
              tabs.forEach(function (t) {
                t.classList.remove("active");
              });
              panels.forEach(function (p) {
                p.classList.remove("active");
              });
              tab.classList.add("active");
              var panelId = "cp-panel-" + tab.dataset.tab;
              document.getElementById(panelId).classList.add("active");
              updateSubmitButton();
            });
          });

          // Library import/export buttons
          modal
            .querySelector("#cp-lib-view-full")
            .addEventListener("click", function () {
              chrome.runtime.sendMessage({
                action: "cp-open-extension-page",
                page: "html/button-library.html",
              });
            });
          modal
            .querySelector("#cp-lib-export")
            .addEventListener("click", function () {
              exportCustomLibrary();
            });
          modal
            .querySelector("#cp-lib-import")
            .addEventListener("click", function () {
              importCustomLibrary(function () {
                renderTemplateGrid();
              });
            });

          // Populate templates
          var grid = modal.querySelector("#cp-template-grid");
          var allTemplates = {};
          var templateSource = {};

          function renderTemplateGrid() {
            grid.innerHTML = "";
            allTemplates = {};
            templateSource = {};

            var hasBuiltIn =
              buttonLibrary && Object.keys(buttonLibrary).length > 0;
            var hasCustom =
              customButtonLibrary &&
              Object.keys(customButtonLibrary).length > 0;

            if (!hasBuiltIn && !hasCustom) {
              grid.innerHTML =
                '<div class="cp-no-templates">No templates available. Use the "Paste JSON" tab or Export JSON to save buttons.</div>';
              return;
            }

            // Custom buttons section
            if (hasCustom) {
              var customHeader = document.createElement("div");
              customHeader.className = "cp-template-section-header";
              customHeader.textContent = "My Saved Buttons";
              grid.appendChild(customHeader);

              Object.keys(customButtonLibrary).forEach(function (key) {
                allTemplates["custom:" + key] = customButtonLibrary[key];
                templateSource["custom:" + key] = "custom";
                grid.appendChild(
                  createTemplateCard(
                    "custom:" + key,
                    customButtonLibrary[key],
                    true,
                  ),
                );
              });
            }

            // Built-in section
            if (hasBuiltIn) {
              if (hasCustom) {
                var builtInHeader = document.createElement("div");
                builtInHeader.className = "cp-template-section-header";
                builtInHeader.textContent = "Built-in Templates";
                grid.appendChild(builtInHeader);
              }

              Object.keys(buttonLibrary).forEach(function (key) {
                allTemplates["builtin:" + key] = buttonLibrary[key];
                templateSource["builtin:" + key] = "builtin";
                grid.appendChild(
                  createTemplateCard(
                    "builtin:" + key,
                    buttonLibrary[key],
                    false,
                  ),
                );
              });
            }
          }

          function createTemplateCard(key, template, isCustom) {
            var card = document.createElement("div");
            card.className = "cp-template-card";
            card.dataset.templateKey = key;

            var displayName = key
              .replace(/^(custom|builtin):/, "")
              .replace(/_/g, " ");

            var preview = buildFancyButtonPreview(template, isCustom ? null : displayName);

            // Check persisted dark bg state, default Standard_5 to dark
            var isDark = darkBgToggles[key];
            if (isDark === undefined && key === "builtin:Standard_5")
              isDark = true;

            card.innerHTML =
              '<div class="cp-template-preview' +
              (isDark ? " cp-preview-dark" : "") +
              '">' +
              preview +
              "</div>" +
              '<div class="cp-template-card-btns">' +
              (isCustom
                ? '<button class="cp-template-edit" title="Edit button text">&#9998;</button>'
                : "") +
              '<button class="cp-template-darkbg' +
              (isDark ? " active" : "") +
              '" title="Toggle dark preview background">&#9681;</button>' +
              (isCustom
                ? '<button class="cp-template-delete" title="Delete saved button">&times;</button>'
                : "") +
              "</div>";

            // Dark background toggle — persists to storage
            var darkBtn = card.querySelector(".cp-template-darkbg");
            darkBtn.addEventListener("click", function (e) {
              e.stopPropagation();
              var previewEl = card.querySelector(".cp-template-preview");
              previewEl.classList.toggle("cp-preview-dark");
              darkBtn.classList.toggle("active");
              darkBgToggles[key] =
                previewEl.classList.contains("cp-preview-dark");
              chrome.storage.local.set({ "cp-darkBgToggles": darkBgToggles });
            });

            // Edit text toggle (custom buttons only)
            var editBtn = card.querySelector(".cp-template-edit");
            if (editBtn) editBtn.addEventListener("click", function (e) {
              e.stopPropagation();
              var previewEl = card.querySelector(".cp-template-preview");
              var cpText = previewEl.querySelector(".cpText");
              if (!cpText) return;
              var isEditing = previewEl.classList.contains("cp-editing");
              if (isEditing) {
                // Save and exit edit mode
                previewEl.classList.remove("cp-editing");
                editBtn.classList.remove("active");
                cpText.contentEditable = "false";
                // Update the template's buttonText
                template.buttonText = cpText.innerHTML;
                // Persist if custom
                if (isCustom) {
                  var rawKey = key.replace(/^custom:/, "");
                  customButtonLibrary[rawKey].buttonText = cpText.innerHTML;
                  chrome.storage.local.set({ "cp-customButtonLibrary": customButtonLibrary });
                }
              } else {
                // Enter edit mode
                previewEl.classList.add("cp-editing");
                editBtn.classList.add("active");
                cpText.contentEditable = "true";
                cpText.focus();
              }
            });

            card.addEventListener("click", function (e) {
              if (
                e.target.classList.contains("cp-template-delete") ||
                e.target.classList.contains("cp-template-darkbg") ||
                e.target.classList.contains("cp-template-edit") ||
                e.target.closest(".cp-editing")
              )
                return;
              grid.querySelectorAll(".cp-template-card").forEach(function (c) {
                c.classList.remove("selected");
              });
              card.classList.add("selected");
              selectedTemplate = key;
              updateSubmitButton();
            });

            if (isCustom) {
              var deleteBtn = card.querySelector(".cp-template-delete");
              if (deleteBtn) {
                deleteBtn.addEventListener("click", function (e) {
                  e.stopPropagation();
                  var rawKey = key.replace(/^custom:/, "");
                  if (
                    !confirm(
                      'Delete saved button "' +
                        rawKey.replace(/_/g, " ") +
                        '"?',
                    )
                  )
                    return;
                  delete customButtonLibrary[rawKey];
                  chrome.storage.local.set({
                    "cp-customButtonLibrary": customButtonLibrary,
                  });
                  if (selectedTemplate === key) selectedTemplate = null;
                  renderTemplateGrid();
                  updateSubmitButton();
                });
              }
            }

            return card;
          }

          renderTemplateGrid();

          // JSON paste handling
          var textarea = modal.querySelector("#cp-paste-json");
          textarea.addEventListener("input", function () {
            updateSubmitButton();
          });

          // ── Socials tab logic ──

          var colorSelect = modal.querySelector("#cp-socials-color");
          var socialsGrid = modal.querySelector("#cp-socials-grid");

          // Helper to get current folder value (element may be select or input after fallback)
          function getFolderValue() {
            var el = modal.querySelector("#cp-socials-folder");
            return el ? el.value.trim() : "";
          }

          // Fetch folder list from Document Center
          initFolderInput(modal.querySelector("#cp-socials-folder"));

          function getSelKey(name, color) {
            return name + ":" + color;
          }

          function getSelectedColorFor(name) {
            var colors = ["Color", "Black", "White"];
            for (var i = 0; i < colors.length; i++) {
              if (selectedSocials[getSelKey(name, colors[i])]) return colors[i];
            }
            return false;
          }

          function renderSocialsGrid() {
            socialsGrid.innerHTML = "";
            if (!socialIcons || socialIcons.length === 0) {
              socialsGrid.innerHTML =
                '<div class="cp-no-templates">Social icons data not loaded.</div>';
              return;
            }
            var currentColor = colorSelect.value;
            var isAll = currentColor === "All";

            if (isAll) {
              var colorOrder = ["Color", "Black", "White"];
              colorOrder.forEach(function (color) {
                socialIcons.forEach(function (icon) {
                  if (!icon.files[color]) return;
                  var key = getSelKey(icon.name, color);
                  renderCard(icon, color, key, null, true);
                });
              });
            } else {
              socialIcons.forEach(function (icon) {
                if (!icon.files[currentColor]) return;
                var key = getSelKey(icon.name, currentColor);
                var otherColor = getSelectedColorFor(icon.name);
                var isSelectedHere = !!selectedSocials[key];
                var isSelectedOther = !isSelectedHere && !!otherColor;
                renderCard(
                  icon,
                  currentColor,
                  key,
                  isSelectedOther ? otherColor : null,
                  false,
                );
              });
            }
          }

          function renderCard(
            icon,
            displayColor,
            selKey,
            otherColor,
            showVariant,
          ) {
            var card = document.createElement("div");
            var isSelected = !!selectedSocials[selKey];
            card.className =
              "cp-social-card" +
              (isSelected ? " selected" : otherColor ? " selected-other" : "");
            if (otherColor) {
              card.dataset.selectedColor = otherColor;
            }
            card.dataset.iconName = icon.name;

            var fileName = icon.files[displayColor];
            if (!chrome.runtime?.id) return;
            var imgSrc = chrome.runtime.getURL(
              "socials/" + displayColor + "/" + fileName,
            );
            var previewStyle =
              displayColor === "White"
                ? "background:#333;border-radius:4px;padding:4px;display:inline-block;"
                : "display:inline-block;";

            var labelHtml = showVariant
              ? ' <span style="font-size:9px;color:#888;">(' +
                displayColor +
                ")</span>"
              : "";

            card.innerHTML =
              '<div style="' +
              previewStyle +
              '">' +
              '<img src="' +
              imgSrc +
              '" alt="' +
              icon.name +
              '">' +
              "</div>" +
              '<div class="cp-social-name">' +
              icon.name +
              labelHtml +
              "</div>";

            card.addEventListener("click", function () {
              if (selectedSocials[selKey]) {
                selectedSocials[selKey] = false;
                selectedOrder = selectedOrder.filter(function (k) {
                  return k !== selKey;
                });
              } else {
                selectedSocials[selKey] = true;
                selectedOrder.push(selKey);
              }
              renderSocialsGrid();
              updateSubmitButton();
            });
            socialsGrid.appendChild(card);
          }

          colorSelect.addEventListener("change", function () {
            renderSocialsGrid();
            updateSubmitButton();
          });

          renderSocialsGrid();

          modal
            .querySelector("#cp-socials-select-all")
            .addEventListener("click", function () {
              var currentColor = colorSelect.value;
              var isAll = currentColor === "All";
              var colors = isAll ? ["Color", "Black", "White"] : [currentColor];
              colors.forEach(function (color) {
                socialIcons.forEach(function (icon) {
                  if (!icon.files[color]) return;
                  var key = getSelKey(icon.name, color);
                  if (!selectedSocials[key]) {
                    selectedSocials[key] = true;
                    selectedOrder.push(key);
                  }
                });
              });
              renderSocialsGrid();
              updateSubmitButton();
            });

          modal
            .querySelector("#cp-socials-select-none")
            .addEventListener("click", function () {
              selectedOrder = [];
              selectedSocials = {};
              renderSocialsGrid();
              updateSubmitButton();
            });

          // Folder change — use event delegation since element may be replaced
          modal.addEventListener("input", function (e) {
            if (e.target && e.target.id === "cp-socials-folder")
              updateSubmitButton();
          });
          modal.addEventListener("change", function (e) {
            if (e.target && e.target.id === "cp-socials-folder")
              updateSubmitButton();
          });

          // ── Submit button state ──

          function updateSubmitButton() {
            var activeTab = modal.querySelector(".cp-import-tab.active").dataset
              .tab;
            if (activeTab === "templates") {
              submitBtn.disabled = !selectedTemplate;
              submitBtn.textContent = "Import Button";
            } else if (activeTab === "paste") {
              submitBtn.disabled = !textarea.value.trim();
              submitBtn.textContent = "Import Button";
            } else if (activeTab === "socials") {
              var hasSelected = Object.keys(selectedSocials).some(function (k) {
                return selectedSocials[k];
              });
              var hasFolder = !!getFolderValue();
              submitBtn.disabled = !hasSelected || !hasFolder;
              submitBtn.textContent = "Add Social Icons";
            }
          }

          // Close modal
          function closeModal() {
            modal.remove();
          }

          modal
            .querySelector("#cp-import-close")
            .addEventListener("click", closeModal);
          modal
            .querySelector("#cp-import-cancel")
            .addEventListener("click", closeModal);
          modal.addEventListener("click", function (e) {
            if (e.target === modal) closeModal();
          });

          // Escape key closes modal
          document.addEventListener("keydown", function (e) {
            if (
              e.key === "Escape" &&
              document.getElementById("cp-toolkit-import-modal")
            )
              closeModal();
          });

          // ── Submit handler ──

          modal
            .querySelector("#cp-import-submit")
            .addEventListener("click", function () {
              var activeTab = modal.querySelector(".cp-import-tab.active")
                .dataset.tab;

              // Socials flow
              if (activeTab === "socials") {
                var folderID = getFolderValue();
                if (!folderID) {
                  alert("Please enter a Document Center folder ID.");
                  return;
                }
                var iconsToUpload = [];
                var iconsByName = {};
                socialIcons.forEach(function (icon) {
                  iconsByName[icon.name] = icon;
                });
                selectedOrder.forEach(function (key) {
                  if (!selectedSocials[key]) return;
                  var parts = key.split(":");
                  var name = parts[0];
                  var color = parts[1];
                  var icon = iconsByName[name];
                  if (icon && icon.files[color]) {
                    iconsToUpload.push({ icon: icon, color: color });
                  }
                });
                if (iconsToUpload.length === 0) {
                  alert("Please select at least one social icon.");
                  return;
                }
                submitBtn.disabled = true;
                // Collapse modal to show only progress
                var header = modal.querySelector(".cp-import-header h2");
                if (header) header.textContent = "Uploading Social Icons...";
                var tabsBar = modal.querySelector(".cp-import-tabs");
                if (tabsBar) tabsBar.style.display = "none";
                var controls = modal.querySelector(".cp-socials-controls");
                if (controls) controls.style.display = "none";
                var grid = modal.querySelector("#cp-socials-grid");
                if (grid) grid.style.display = "none";
                var footer = modal.querySelector(".cp-import-footer");
                if (footer) footer.style.display = "none";
                uploadSocialIcons(iconsToUpload, folderID, modal);
                return;
              }

              // Template / Paste flow (existing)
              var jsonData;
              if (activeTab === "templates" && selectedTemplate) {
                var tpl = Object.assign({}, allTemplates[selectedTemplate]);
                delete tpl.previewImage;
                delete tpl.previewText;
                delete tpl.savedImages;
                // Ensure required API fields exist (built-in templates omit these)
                if (!tpl.graphicLinkID) tpl.graphicLinkID = "0";
                if (!tpl.categoryID) tpl.categoryID = "0";
                if (!tpl.documentID) tpl.documentID = "0";
                if (!tpl.mouseOverDocumentID) tpl.mouseOverDocumentID = "0";
                if (!tpl.shouldPublish) tpl.shouldPublish = true;
                jsonData = JSON.stringify(tpl);
              } else {
                jsonData = textarea.value.trim();
              }

              if (!jsonData) {
                alert("Please select a template or paste JSON data.");
                return;
              }

              try {
                JSON.parse(jsonData);
              } catch (e) {
                alert("Invalid JSON format. Please check your input.");
                return;
              }

              closeModal();
              importFancyButton(jsonData);
            });
        }

        // ── Fetch Document Center folder list ──

        function initFolderInput(selectEl) {
          var wrapper = selectEl.parentNode;
          var controlsRow = selectEl.closest(".cp-socials-controls-row");
          var lookupContainer = document.getElementById(
            "cp-folder-lookup-container",
          );

          var input = document.createElement("input");
          input.type = "number";
          input.id = "cp-socials-folder";
          input.placeholder = "Folder ID";
          input.min = "1";
          input.style.cssText =
            "padding:6px 10px;border:1px solid #ccc;border-radius:4px;font-size:13px;width:120px;";

          var lookupBtn = document.createElement("button");
          lookupBtn.type = "button";
          lookupBtn.textContent = "Find Folder ID";
          lookupBtn.className = "cp-socials-folder-btn";
          lookupBtn.addEventListener("click", function () {
            showFolderLookup(lookupContainer);
          });

          selectEl.replaceWith(input);

          var btnWrapper = document.createElement("div");
          btnWrapper.style.cssText = "display:flex;align-items:flex-end;";
          btnWrapper.appendChild(lookupBtn);
          controlsRow.appendChild(btnWrapper);

          var hint = wrapper.querySelector(".cp-socials-hint");
          if (hint) hint.remove();
        }

        function showFolderLookup(wrapper) {
          // Check if lookup is already open
          if (wrapper.querySelector(".cp-folder-lookup")) return;

          var lookupDiv = document.createElement("div");
          lookupDiv.className = "cp-folder-lookup";
          lookupDiv.style.cssText =
            "margin-top:8px;padding:10px;background:#f8f9fa;border:1px solid #ddd;border-radius:4px;max-height:200px;overflow-y:auto;";
          lookupDiv.innerHTML =
            '<div style="color:#666;font-size:12px;">Loading image folders...</div>';
          wrapper.appendChild(lookupDiv);

          // Load FolderForModal in a hidden iframe so React renders the Ant Design tree.
          // Content scripts can't access React fiber (page-world JS), so we use
          // executeInFrame to run extraction code in the MAIN world.
          var iframe = document.createElement("iframe");
          iframe.style.cssText =
            "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;";
          iframe.src =
            "/Admin/DocumentCenter/FolderForModal/Index/0?renderMode=1&loadSource=4&requestingModuleID=34";
          document.body.appendChild(iframe);

          var extractCode =
            "(" +
            function () {
              var treeNodes = document.querySelectorAll(".ant-tree-treenode");
              if (treeNodes.length === 0) return { ready: false };
              var folders = [];
              treeNodes.forEach(function (node) {
                var fiberKey = Object.keys(node).find(function (k) {
                  return (
                    k.indexOf("__reactFiber$") === 0 ||
                    k.indexOf("__reactInternalInstance$") === 0
                  );
                });
                if (!fiberKey) return;
                var current = node[fiberKey];
                for (var i = 0; i < 5 && current; i++) {
                  if (current.memoizedProps && current.memoizedProps.eventKey) {
                    var data = current.memoizedProps.data;
                    var title = data ? data.title : null;
                    var id = current.memoizedProps.eventKey;
                    if (title && title !== "Content") {
                      folders.push({ id: id, title: title });
                    }
                    break;
                  }
                  current = current.return;
                }
              });
              return { ready: true, folders: folders };
            }.toString() +
            ")()";

          var attempts = 0;
          var maxAttempts = 15;
          function pollForFolders() {
            attempts++;
            if (attempts > maxAttempts) {
              iframe.remove();
              lookupDiv.innerHTML =
                '<div style="font-size:12px;color:#888;">Timed out loading folders. Enter the folder ID manually.</div>';
              return;
            }
            executeInFrame("FolderForModal/Index", extractCode)
              .then(function (result) {
                if (!result || !result.ready) {
                  setTimeout(pollForFolders, 1000);
                  return;
                }
                iframe.remove();
                var folders = result.folders || [];
                if (folders.length > 0) {
                  var folderInput =
                    document.querySelector("#cp-socials-folder");
                  lookupDiv.innerHTML =
                    '<div style="font-size:12px;color:#666;margin-bottom:6px;">Click a folder to select it:</div>' +
                    '<div style="font-size:12px;columns:2;column-gap:12px;">' +
                    folders
                      .map(function (f) {
                        return (
                          '<div class="cp-folder-item" data-id="' +
                          f.id +
                          '" style="padding:2px 4px;cursor:pointer;border-radius:3px;" ' +
                          "onmouseover=\"this.style.background='#e8e8e8'\" onmouseout=\"this.style.background='none'\">" +
                          "<b>" +
                          f.id +
                          "</b> — " +
                          f.title +
                          "</div>"
                        );
                      })
                      .join("") +
                    "</div>";
                  lookupDiv.addEventListener("click", function (e) {
                    var item = e.target.closest(".cp-folder-item");
                    if (item && folderInput) {
                      folderInput.value = item.getAttribute("data-id");
                      folderInput.dispatchEvent(
                        new Event("change", { bubbles: true }),
                      );
                      lookupDiv
                        .querySelectorAll(".cp-folder-item")
                        .forEach(function (el) {
                          el.style.background = "none";
                        });
                      item.style.background = "#d4edda";
                    }
                  });
                } else {
                  lookupDiv.innerHTML =
                    '<div style="font-size:12px;color:#888;">No folders found. Enter the folder ID manually.</div>';
                }
              })
              .catch(function () {
                setTimeout(pollForFolders, 1000);
              });
          }
          setTimeout(pollForFolders, 2000);
        }

        // ── Find the highest existing document ID via binary search ──

        function findMaxDocumentID() {
          // Binary search for the highest valid document ID
          function probe(id) {
            return $.ajax({
              type: "POST",
              url: "/ImageRepository/Source",
              data: { imageID: id },
            }).then(
              function (resp) {
                return (
                  typeof resp === "string" &&
                  resp.indexOf("ErrorMessage") === -1
                );
              },
              function () {
                return false;
              },
            );
          }

          // Phase 1: Find upper bound by doubling
          function findUpperBound(low, high) {
            return probe(high).then(function (exists) {
              if (exists) {
                return findUpperBound(high, high * 2);
              }
              return { low: low, high: high };
            });
          }

          // Phase 2: Binary search between low and high
          function binarySearch(low, high) {
            if (high - low <= 1) {
              return probe(high).then(function (exists) {
                return exists ? high : low;
              });
            }
            var mid = Math.floor((low + high) / 2);
            return probe(mid).then(function (exists) {
              return exists ? binarySearch(mid, high) : binarySearch(low, mid);
            });
          }

          // Start with a reasonable estimate and search from there
          return findUpperBound(1, 40000).then(function (bounds) {
            return binarySearch(bounds.low, bounds.high);
          });
        }

        // ── Verify a new document was created after form POST ──

        function verifyNewDocument(maxIdBefore, iconName) {
          var candidateId = maxIdBefore + 1;
          var attempts = 0;
          var maxAttempts = 10;

          function checkId() {
            attempts++;
            return $.ajax({
              type: "POST",
              url: "/ImageRepository/Source",
              data: { imageID: candidateId },
            }).then(
              function (resp) {
                var isValid =
                  typeof resp === "string" &&
                  resp.indexOf("ErrorMessage") === -1;
                if (isValid) {
                  console.log(
                    "[CP Toolkit](socials) Found new document ID:",
                    candidateId,
                  );
                  return String(candidateId);
                }
                if (attempts < maxAttempts) {
                  // Wait a moment and retry (server may be slow to commit)
                  return $.Deferred(function (d) {
                    setTimeout(function () {
                      d.resolve();
                    }, 500);
                  }).then(checkId);
                }
                throw new Error(
                  "Document not found after creation for " +
                    iconName +
                    ". Expected ID " +
                    candidateId,
                );
              },
              function () {
                if (attempts < maxAttempts) {
                  return $.Deferred(function (d) {
                    setTimeout(function () {
                      d.resolve();
                    }, 500);
                  }).then(checkId);
                }
                throw new Error("Failed to verify document for " + iconName);
              },
            );
          }

          return checkId();
        }

        // ── Execute code in a specific iframe's MAIN world via service worker ──

        function executeInFrame(urlMatch, code) {
          return new Promise(function (resolve, reject) {
            chrome.runtime.sendMessage(
              {
                action: "cp-execute-in-frame",
                urlMatch: urlMatch,
                code: code,
              },
              function (response) {
                if (chrome.runtime.lastError)
                  return reject(new Error(chrome.runtime.lastError.message));
                if (response && response.error)
                  return reject(new Error(response.error));
                resolve(response ? response.result : null);
              },
            );
          });
        }

        // ── Upload a single image to Document Center via hidden iframe ──
        // Loads the real Add page in a hidden iframe so that:
        // - Dropzone uploads go to the correct page instance (same ViewState)
        // - reloadPage() and saveChanges() run in the real page context
        // This replicates exactly what a user does manually.

        function uploadDocumentViaIframe(
          svgBlob,
          fileName,
          iconName,
          folderID,
          log,
        ) {
          var deferred = $.Deferred();
          var ADD_URL =
            "/Admin/DocumentCenter/DocumentForModal/Add/0?folderID=" +
            folderID +
            "&renderMode=1&loadSource=4&requestingModuleID=34";

          // Step 1: Find max document ID BEFORE upload (for detection later)
          log("  Finding current max document ID...");
          findMaxDocumentID()
            .then(function (maxIdBefore) {
              log("  Current max ID: " + maxIdBefore);

              // Step 2: Create hidden iframe with the real Add page
              var iframe = document.createElement("iframe");
              iframe.style.cssText =
                "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;";
              iframe.src = ADD_URL;
              document.body.appendChild(iframe);

              var iframeLoadHandled = false;
              iframe.onload = function () {
                if (iframeLoadHandled) return;
                iframeLoadHandled = true;
                log("  Add page loaded in iframe");

                // Step 3: Wait for inner copyLinkDialog iframe (contains Dropzone) to load
                var pollCount = 0;
                var maxPolls = 60; // 30 seconds

                function waitForInnerIframe() {
                  pollCount++;
                  if (pollCount > maxPolls) {
                    cleanup();
                    deferred.reject(
                      new Error("Timeout waiting for upload iframe"),
                    );
                    return;
                  }
                  // Use executeInFrame to check if Dropzone is ready in the inner iframe
                  executeInFrame(
                    "MultipleFileUpload/SelectFiles",
                    "(" +
                      function () {
                        var dz = document.querySelector(".dropzone");
                        return {
                          ready: !!(
                            dz &&
                            (dz.dropzone ||
                              (typeof Dropzone !== "undefined" &&
                                Dropzone.instances &&
                                Dropzone.instances.length > 0))
                          ),
                        };
                      }.toString() +
                      ")()",
                  )
                    .then(function (result) {
                      if (result && result.ready) {
                        onInnerReady();
                      } else {
                        setTimeout(waitForInnerIframe, 500);
                      }
                    })
                    .catch(function () {
                      setTimeout(waitForInnerIframe, 500);
                    });
                }

                function onInnerReady() {
                  log("  Dropzone ready, uploading file...");

                  // Step 4: Convert blob to base64 and inject into Dropzone via MAIN world
                  var reader = new FileReader();
                  reader.onload = function () {
                    var base64Data = reader.result.split(",")[1];

                    // Execute in the inner iframe (SelectFiles page) to add file to Dropzone
                    var uploadCode =
                      "(" +
                      function (b64, fname) {
                        var byteChars = atob(b64);
                        var byteArray = new Uint8Array(byteChars.length);
                        for (var i = 0; i < byteChars.length; i++) {
                          byteArray[i] = byteChars.charCodeAt(i);
                        }
                        var file = new File([byteArray], fname, {
                          type: "image/svg+xml",
                        });

                        var dz =
                          document.querySelector(".dropzone").dropzone ||
                          (typeof Dropzone !== "undefined" &&
                            Dropzone.instances[0]);
                        if (!dz) return { error: "Dropzone not found" };

                        dz.addFile(file);
                        return { status: "added" };
                      }.toString() +
                      ')("' +
                      base64Data +
                      '","' +
                      fileName.replace(/"/g, '\\"') +
                      '")';

                    executeInFrame("MultipleFileUpload/SelectFiles", uploadCode)
                      .then(function (result) {
                        if (result && result.error)
                          throw new Error(result.error);
                        // Step 5: Poll for Dropzone upload completion
                        return pollDropzoneComplete();
                      })
                      .then(function () {
                        log("  File uploaded via Dropzone");
                        // Step 6: Trigger CONTINUE (reloadPage) from inner iframe
                        return triggerContinue();
                      })
                      .then(function () {
                        log("  Form updated, filling metadata...");
                        // Step 7: Fill metadata and submit the outer Add form
                        return fillMetadataAndSubmit();
                      })
                      .then(function () {
                        log("  Form submitted, verifying document...");
                        // Step 8: Verify document was created
                        return verifyNewDocument(maxIdBefore, iconName);
                      })
                      .then(function (docId) {
                        cleanup();
                        deferred.resolve(docId);
                      })
                      .catch(function (err) {
                        cleanup();
                        deferred.reject(err);
                      });
                  };
                  reader.readAsDataURL(svgBlob);
                }

                function pollDropzoneComplete() {
                  var pollCode =
                    "(" +
                    function () {
                      var dz =
                        document.querySelector(".dropzone").dropzone ||
                        (typeof Dropzone !== "undefined" &&
                          Dropzone.instances[0]);
                      if (!dz) return { done: false, error: "no dropzone" };
                      var uploading = dz.getUploadingFiles().length;
                      var accepted = dz.getAcceptedFiles().length;
                      var rejected = dz.getRejectedFiles().length;
                      return {
                        done: uploading === 0 && accepted > 0,
                        accepted: accepted,
                        rejected: rejected,
                      };
                    }.toString() +
                    ")()";

                  return new Promise(function (resolve, reject) {
                    var attempts = 0;
                    function check() {
                      attempts++;
                      if (attempts > 30)
                        return reject(new Error("Dropzone upload timed out"));
                      executeInFrame("MultipleFileUpload/SelectFiles", pollCode)
                        .then(function (result) {
                          if (result && result.done) return resolve();
                          if (result && result.rejected > 0)
                            return reject(new Error("Dropzone rejected file"));
                          setTimeout(check, 500);
                        })
                        .catch(function () {
                          setTimeout(check, 500);
                        });
                    }
                    check();
                  });
                }

                function triggerContinue() {
                  // In the inner iframe, simulate CONTINUE which calls window.parent.reloadPage()
                  var continueCode =
                    "(" +
                    function () {
                      var dz =
                        document.querySelector(".dropzone").dropzone ||
                        (typeof Dropzone !== "undefined" &&
                          Dropzone.instances[0]);
                      if (!dz)
                        return { error: "Dropzone not found for continue" };
                      var files = dz.getAcceptedFiles();
                      var fileList = files.map(function (f) {
                        return f.name;
                      });
                      var fileSizes = files.map(function (f) {
                        return f.size;
                      });
                      var categoryId = document.getElementById("categoryId")
                        ? document.getElementById("categoryId").value
                        : "0";

                      if (typeof window.parent.reloadPage === "function") {
                        window.parent.reloadPage(
                          files.length,
                          categoryId,
                          fileList,
                          fileSizes,
                          {},
                          [],
                        );
                        return { status: "ok" };
                      }
                      return { error: "reloadPage not found on parent" };
                    }.toString() +
                    ")()";

                  return executeInFrame(
                    "MultipleFileUpload/SelectFiles",
                    continueCode,
                  ).then(function (result) {
                    if (result && result.error) throw new Error(result.error);
                    // Poll outer iframe until the form is ready (reloadPage may trigger a postback)
                    return waitForFormReady();
                  });
                }

                function waitForFormReady() {
                  // Poll the outer Add iframe until saveChanges exists and olfileUploadControl has file children
                  var probeCode =
                    "(" +
                    function () {
                      var ol = document.getElementById("olfileUploadControl");
                      return {
                        hasSaveChanges: typeof saveChanges === "function",
                        fileSlotCount: ol ? ol.children.length : 0,
                      };
                    }.toString() +
                    ")()";

                  return new Promise(function (resolve, reject) {
                    var attempts = 0;
                    function check() {
                      attempts++;
                      if (attempts > 20)
                        return reject(
                          new Error(
                            "Timeout waiting for Add form after reloadPage",
                          ),
                        );
                      executeInFrame(
                        "DocumentCenter/DocumentForModal/Add",
                        probeCode,
                      )
                        .then(function (result) {
                          console.log(
                            "[CP Toolkit](socials) Form probe attempt " +
                              attempts +
                              ":",
                            result,
                          );
                          if (
                            result &&
                            result.hasSaveChanges &&
                            result.fileSlotCount > 1
                          ) {
                            return resolve(result);
                          }
                          setTimeout(check, 1000);
                        })
                        .catch(function (err) {
                          console.log(
                            "[CP Toolkit](socials) Form probe error (attempt " +
                              attempts +
                              "):",
                            err.message,
                          );
                          setTimeout(check, 1000);
                        });
                    }
                    check();
                  });
                }

                function fillMetadataAndSubmit() {
                  // In the outer iframe (DocumentForModal/Add), fill metadata and submit.
                  // After reloadPage(), the form is a multi-file bulk upload with slots for ALL
                  // files in the folder (not just our upload). saveChanges() validates every slot
                  // and alerts if any FileName is empty — which we can't fully control.
                  // Instead, we fill our file's FileName and submit the form directly,
                  // replicating what saveChanges does after validation passes.
                  var escapedName = iconName
                    .replace(/\\/g, "\\\\")
                    .replace(/"/g, '\\"')
                    .replace(/'/g, "\\'");
                  var submitCode =
                    "(" +
                    function (name) {
                      // Fill ALL empty FileName fields to prevent any validation issues
                      var allNameInputs = document.querySelectorAll(
                        "input[id*=__FileName]",
                      );
                      var filled = 0;
                      for (var i = 0; i < allNameInputs.length; i++) {
                        if (
                          !allNameInputs[i].value ||
                          allNameInputs[i].value.trim() === ""
                        ) {
                          allNameInputs[i].value = name;
                          filled++;
                        }
                      }

                      // Also fill description fields
                      var allDescInputs = document.querySelectorAll(
                        "input[id*=__FileDescription], textarea[id*=__FileDescription]",
                      );
                      for (var j = 0; j < allDescInputs.length; j++) {
                        if (
                          !allDescInputs[j].value ||
                          allDescInputs[j].value.trim() === ""
                        ) {
                          allDescInputs[j].value = name;
                        }
                      }

                      // Submit directly — replicate exactly what saveChanges does after validation:
                      // 1. Append saveAction to form action
                      // 2. Call ajaxPostBackStart() (required for server to accept the POST)
                      // 3. Call aspnetForm.submit()
                      if (!document.aspnetForm) {
                        return { error: "aspnetForm not found" };
                      }

                      var connector =
                        document.aspnetForm.action.indexOf("?") !== -1
                          ? "&"
                          : "?";
                      document.aspnetForm.action +=
                        connector + "saveAction=publish";
                      if (typeof ajaxPostBackStart === "function") {
                        ajaxPostBackStart();
                      }
                      document.aspnetForm.submit();
                      return { status: "submitted", filled: filled };
                    }.toString() +
                    ')("' +
                    escapedName +
                    '")';

                  return executeInFrame(
                    "DocumentCenter/DocumentForModal/Add",
                    submitCode,
                  ).then(function (result) {
                    console.log(
                      "[CP Toolkit](socials) fillMetadata result:",
                      result,
                    );
                    if (result && result.error) throw new Error(result.error);
                    // Wait for form submit and server processing
                    return new Promise(function (resolve) {
                      setTimeout(resolve, 3000);
                    });
                  });
                }

                waitForInnerIframe();
              };

              function cleanup() {
                if (iframe && iframe.parentNode) {
                  iframe.parentNode.removeChild(iframe);
                }
              }
            })
            .fail(function (err) {
              deferred.reject(err);
            });

          return deferred.promise();
        }

        // ── Upload social icons sequentially ──

        function uploadSocialIcons(icons, folderID, modal) {
          var progressDiv = modal.querySelector("#cp-socials-progress");
          var progressText = modal.querySelector("#cp-socials-progress-text");
          var progressBar = modal.querySelector("#cp-socials-progress-bar");
          var progressLog = modal.querySelector("#cp-socials-progress-log");

          progressDiv.style.display = "block";
          progressLog.innerHTML = "";

          var categoryElement =
            document.getElementsByName("intQLCategoryID")[0];
          var categoryID = categoryElement ? categoryElement.value : "0";

          var total = icons.length;
          var errors = [];

          function log(msg, isError) {
            var line = document.createElement("div");
            line.textContent = msg;
            if (isError) line.style.color = "#cc0000";
            progressLog.appendChild(line);
            progressLog.scrollTop = progressLog.scrollHeight;
          }

          function updateProgress(current) {
            var pct = Math.round((current / total) * 100);
            progressBar.style.width = pct + "%";
            progressText.textContent =
              "Processing " + current + " of " + total + "...";
          }

          function processNext(index) {
            if (index >= icons.length) {
              var successCount = total - errors.length;
              progressText.textContent =
                "Done! " + successCount + " of " + total + " icons created.";
              progressBar.style.width = "100%";
              progressBar.style.background =
                errors.length > 0 ? "#cc6600" : "#4CAF50";
              if (errors.length > 0) {
                log(
                  errors.length +
                    " error(s) occurred — check above for details.",
                  true,
                );
                log(
                  "Page will NOT auto-reload so you can inspect the console. Reload manually when ready.",
                );
              } else {
                log("Reloading page in 3 seconds...");
                setTimeout(function () {
                  location.reload();
                }, 3000);
              }
              return;
            }

            var entry = icons[index];
            var icon = entry.icon;
            var entryColor = entry.color;
            var fileName = icon.files[entryColor];
            var svgUrl = chrome.runtime.getURL(
              "socials/" + entryColor + "/" + fileName,
            );

            updateProgress(index + 1);
            log(
              "(" +
                (index + 1) +
                "/" +
                total +
                ") " +
                icon.name +
                ": Fetching SVG...",
            );

            // Step 1: Fetch SVG blob from extension resources
            fetch(svgUrl)
              .then(function (resp) {
                if (!resp.ok)
                  throw new Error("Failed to fetch SVG: " + resp.status);
                return resp.blob();
              })
              .then(function (svgBlob) {
                // Step 2: Upload via hidden iframe (replicates the real browser flow)
                log("  Uploading via Document Center...");
                return uploadDocumentViaIframe(
                  svgBlob,
                  fileName,
                  icon.name,
                  folderID,
                  log,
                );
              })
              .then(function (docID) {
                log("  Document created (ID: " + docID + ")");

                // Step 3: Create the graphic link
                var graphicLinkData = {
                  styles: [],
                  buttonText: null,
                  image: "/ImageRepository/Document?documentID=" + docID,
                  hoverImage: "",
                  startDate: "",
                  endDate: "",
                  linkUrl: icon.linkUrl,
                  openInNewWindow: false,
                  graphicLinkID: "0",
                  documentID: parseInt(docID, 10),
                  mouseOverDocumentID: null,
                  categoryID: categoryID,
                  shouldPublish: true,
                };

                log("  Creating graphic link -> " + icon.linkUrl);
                return $.ajax({
                  type: "POST",
                  url: "/GraphicLinks/GraphicLinkSave",
                  data: JSON.stringify(graphicLinkData),
                  contentType: "application/json",
                });
              })
              .then(function () {
                log("  Done!");
                processNext(index + 1);
              })
              .catch(function (err) {
                var errMsg = err.statusText || err.message || String(err);
                log("  ERROR: " + errMsg, true);
                errors.push(icon.name);
                processNext(index + 1);
              });
          }

          processNext(0);
        }

        // (Dead code removed — document ID detection now uses findMaxDocumentID + verifyNewDocument)

        function importFancyButton(data) {
          console.log("[CP Toolkit] Generating Fancy Button...");

          // Show loading overlay
          var loadingOverlay = document.createElement("div");
          loadingOverlay.id = "toolkit-block";
          loadingOverlay.style.cssText =
            "position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.8); z-index: 99999; display: flex; align-items: center; justify-content: center;";
          loadingOverlay.innerHTML =
            '<div style="text-align: center; font-family: Arial, sans-serif;"><div style="font-size: 18px; margin-bottom: 10px;">Generating Fancy Button...</div><div style="color: #666;">Please wait</div></div>';
          document.body.appendChild(loadingOverlay);

          // Get current category ID
          var categoryElement =
            document.getElementsByName("intQLCategoryID")[0];
          var categoryID = categoryElement ? categoryElement.value : "0";

          // Reset graphicLinkID to 0 so API creates a new item (not update)
          var updatedData = data.replace(
            /"graphicLinkID"\s*:\s*("\d+"|\d+)/,
            '"graphicLinkID": "0"',
          );
          // Update categoryID to current page category
          updatedData = updatedData.replace(
            /"categoryID"\s*:\s*("\d+"|\d+)/,
            '"categoryID": "' + categoryID + '"',
          );

          $.ajax({
            type: "POST",
            url: "/GraphicLinks/GraphicLinkSave",
            data: updatedData,
            contentType: "application/json",
          })
            .done(function () {
              var overlay = document.getElementById("toolkit-block");
              if (overlay) overlay.remove();
              location.reload();
            })
            .fail(function (xhr, status, error) {
              var overlay = document.getElementById("toolkit-block");
              if (overlay) overlay.remove();
              alert("Error importing: " + error);
            });
        }

        // ── Export JSON feature ──

        var exportOptionsInjected = false;

        function injectExportOptions() {
          var dropdowns = document.querySelectorAll(
            'select[onchange*="linkDetails"]',
          );
          dropdowns.forEach(function (sel) {
            if (sel.querySelector('option[value="ExportJSON"]')) return;
            var opt = document.createElement("option");
            opt.value = "ExportJSON";
            opt.textContent = "Export JSON";
            sel.appendChild(opt);
          });
          if (dropdowns.length > 0 && !exportOptionsInjected) {
            exportOptionsInjected = true;
            document.addEventListener(
              "change",
              function (e) {
                var sel = e.target;
                if (sel.tagName !== "SELECT" || sel.value !== "ExportJSON")
                  return;
                sel.value = "choose";
                // Extract graphic link ID from onchange attribute
                var onchangeAttr = sel.getAttribute("onchange") || "";
                var match = onchangeAttr.match(/linkDetails\((\d+)/);
                if (!match) {
                  console.warn(
                    "[CP Toolkit](ExportJSON) Could not extract graphic link ID",
                  );
                  return;
                }
                var glID = match[1];
                fetchGraphicLinkJSON(glID);
              },
              true,
            );
          }
        }

        var PENDING_EXPORT_KEY = "cp-pendingFancyExport";

        function handlePendingExport() {
          chrome.storage.local.get(PENDING_EXPORT_KEY, function (data) {
            var pending = data[PENDING_EXPORT_KEY];
            if (!pending) return;
            // Expire stale exports (older than 30 seconds)
            if (pending.ts && Date.now() - pending.ts > 30000) {
              chrome.storage.local.remove(PENDING_EXPORT_KEY);
              return;
            }
            chrome.storage.local.remove(PENDING_EXPORT_KEY);
            console.log(
              "[CP Toolkit](ExportJSON) Processing pending export for GL " +
                pending.id,
            );

            // Wait for DOM to be ready, then check for fancy button
            setTimeout(function () {
              var fancyContainer = document.querySelector(
                ".fancyButtonContainer",
              );
              if (
                !fancyContainer ||
                getComputedStyle(fancyContainer).display === "none"
              ) {
                alert("This graphic link does not have a fancy button.");
                return;
              }

              // Intercept the GraphicLinkSave POST via MAIN world $.ajax patch.
              // When "Save and Publish" is clicked, the CMS assembles the complete
              // button JSON and POSTs it to /GraphicLinks/GraphicLinkSave. We
              // monkey-patch $.ajax to capture that payload and cancel the request.
              chrome.runtime.sendMessage(
                {
                  action: "cp-execute-in-main",
                  code:
                    "(" +
                    function () {
                      window.__cpToolkitCapturedSave = null;
                      var origAjax = $.ajax;
                      $.ajax = function (opts) {
                        if (
                          opts &&
                          typeof opts.url === "string" &&
                          opts.url.indexOf("/GraphicLinks/GraphicLinkSave") !==
                            -1
                        ) {
                          // Capture the payload and block the actual save
                          var d = opts.data;
                          window.__cpToolkitCapturedSave =
                            typeof d === "string" ? d : JSON.stringify(d);
                          // Restore original $.ajax immediately
                          $.ajax = origAjax;
                          // Return a deferred that never resolves so the CMS
                          // success handler (which reloads the page) doesn't fire
                          return $.Deferred().promise();
                        }
                        return origAjax.apply(this, arguments);
                      };
                    }.toString() +
                    ")()",
                },
                function () {
                  // Now click "Save and Publish" to trigger the CMS to assemble and send the data
                  var saveBtn = document.querySelector(
                    'input[name="saveAndPublish"], button[name="saveAndPublish"]',
                  );
                  if (!saveBtn) {
                    // Try finding by text content
                    var allBtns = document.querySelectorAll(
                      "input[type='submit'], button",
                    );
                    for (var i = 0; i < allBtns.length; i++) {
                      if (
                        allBtns[i].value &&
                        allBtns[i].value
                          .toUpperCase()
                          .indexOf("SAVE AND PUBLISH") !== -1
                      ) {
                        saveBtn = allBtns[i];
                        break;
                      }
                      if (
                        allBtns[i].textContent &&
                        allBtns[i].textContent
                          .toUpperCase()
                          .indexOf("SAVE AND PUBLISH") !== -1
                      ) {
                        saveBtn = allBtns[i];
                        break;
                      }
                    }
                  }
                  if (!saveBtn) {
                    alert("Could not find Save and Publish button.");
                    return;
                  }
                  saveBtn.click();

                  // Poll for the intercepted data
                  var attempts = 0;
                  var maxAttempts = 40;
                  function pollForCapture() {
                    attempts++;
                    chrome.runtime.sendMessage(
                      {
                        action: "cp-execute-in-main",
                        code: "window.__cpToolkitCapturedSave",
                      },
                      function (resp) {
                        var captured = resp && resp.result;
                        if (captured) {
                          // Clean up
                          chrome.runtime.sendMessage({
                            action: "cp-execute-in-main",
                            code: "delete window.__cpToolkitCapturedSave; null;",
                          });
                          showExportModal(
                            captured,
                            pending.id,
                            pending.returnUrl,
                            pending.categoryID,
                          );
                        } else if (attempts < maxAttempts) {
                          setTimeout(pollForCapture, 300);
                        } else {
                          alert(
                            "Timed out waiting for button data. The save may not have triggered.",
                          );
                        }
                      },
                    );
                  }
                  setTimeout(pollForCapture, 500);
                },
              );
            }, 1000);
          });
        }

        function collectFancyButtonJSON(graphicLinkID) {
          var styles = [];
          // Collect inputs (handle checkboxes specially)
          var inputs = document.querySelectorAll('input[name^="fancyButton"]');
          inputs.forEach(function (inp) {
            var val =
              inp.type === "checkbox"
                ? inp.checked
                  ? "True"
                  : "False"
                : inp.value;
            styles.push({ Key: inp.name, Value: val || "" });
          });
          // Collect selects
          var selects = document.querySelectorAll(
            'select[name^="fancyButton"]',
          );
          selects.forEach(function (sel) {
            styles.push({ Key: sel.name, Value: sel.value || "" });
          });
          // Collect textareas (advanced styles)
          var textareas = document.querySelectorAll(
            'textarea[name^="fancyButton"]',
          );
          textareas.forEach(function (ta) {
            styles.push({ Key: ta.name, Value: ta.value || "" });
          });

          // Extract font-family and font-weight from the rendered preview.
          // The builder's font controls are React components that don't use
          // native form elements with name="fancyButton..." attributes,
          // so the form scraping above misses them. We read the computed
          // styles from the rendered .text element instead.
          var styleKeys = {};
          styles.forEach(function (s) {
            styleKeys[s.Key] = true;
          });

          var renderedText = document.querySelector(
            ".fancyButtonBuilder .fancyButton:not(.hover) .text",
          );
          if (!renderedText) {
            renderedText = document.querySelector(
              ".fancyButtonContainer .text",
            );
          }
          if (renderedText) {
            var cs = getComputedStyle(renderedText);
            if (
              cs.fontFamily &&
              !styleKeys["fancyButtonNormalTextFontFamily"]
            ) {
              // Strip generic fallbacks and outer quotes, keep just the font name
              var ff = cs.fontFamily
                .split(",")[0]
                .trim()
                .replace(/^["']|["']$/g, "");
              if (ff)
                styles.push({
                  Key: "fancyButtonNormalTextFontFamily",
                  Value: ff,
                });
            }
            // CMS stores font-weight as FontVariant
            if (
              cs.fontWeight &&
              !styleKeys["fancyButtonNormalTextFontVariant"] &&
              !styleKeys["fancyButtonNormalTextFontWeight"]
            ) {
              styles.push({
                Key: "fancyButtonNormalTextFontVariant",
                Value: cs.fontWeight,
              });
            }
            // CMS text-align (alignment control is a React component, not a native form element)
            if (cs.textAlign && !styleKeys["fancyButtonNormalTextAlignment"]) {
              styles.push({
                Key: "fancyButtonNormalTextAlignment",
                Value: cs.textAlign,
              });
            }
            // Also check individual textStyle elements for their font overrides
            var textStyles = renderedText.querySelectorAll(
              '[class^="textStyle"]',
            );
            textStyles.forEach(function (tsEl) {
              var m = tsEl.className.match(/textStyle(\d+)/);
              if (!m) return;
              var num = m[1];
              var tsCS = getComputedStyle(tsEl);
              var ffKey = "fancyButton" + num + "NormalTextFontFamily";
              var fvKey = "fancyButton" + num + "NormalTextFontVariant";
              if (tsCS.fontFamily && !styleKeys[ffKey]) {
                var tsFF = tsCS.fontFamily
                  .split(",")[0]
                  .trim()
                  .replace(/^["']|["']$/g, "");
                if (tsFF) styles.push({ Key: ffKey, Value: tsFF });
              }
              if (tsCS.fontWeight && !styleKeys[fvKey]) {
                styles.push({ Key: fvKey, Value: tsCS.fontWeight });
              }
              var taKey = "fancyButton" + num + "NormalTextAlignment";
              if (tsCS.textAlign && !styleKeys[taKey]) {
                styles.push({ Key: taKey, Value: tsCS.textAlign });
              }
            });
          }

          // Get buttonText from the builder preview
          var textEl = document.querySelector(
            ".fancyButtonBuilder .fancyButton:not(.hover) .text.autoUpdate",
          );
          if (!textEl) {
            textEl = document.querySelector(".fancyButtonContainer .text");
          }
          var buttonText = textEl ? textEl.innerHTML.trim() : "";

          // Get linkUrl
          var linkUrlEl =
            document.querySelector('input[name="txtLinkURL"]') ||
            document.querySelector('input[name="linkUrl"]');
          var linkUrl = linkUrlEl && linkUrlEl.value ? linkUrlEl.value : "/";

          // Get openInNewWindow
          var openNewEl = document.querySelector(
            'input[name="ysnLinkOpenInNewWindow"]',
          );
          var openInNewWindow = openNewEl ? openNewEl.checked : false;

          // Get categoryID
          var catEls = document.getElementsByName("intQLCategoryID");
          var categoryID = "0";
          for (var i = 0; i < catEls.length; i++) {
            if (catEls[i].value && catEls[i].value !== "0") {
              categoryID = catEls[i].value;
              break;
            }
          }

          var json = {
            styles: styles,
            buttonText: buttonText,
            image: "",
            hoverImage: "",
            startDate: "",
            endDate: "",
            linkUrl: linkUrl,
            openInNewWindow: openInNewWindow,
            graphicLinkID: graphicLinkID,
            documentID: null,
            mouseOverDocumentID: null,
            categoryID: categoryID,
            shouldPublish: true,
          };

          return JSON.stringify(json);
        }

        function fetchGraphicLinkJSON(graphicLinkID) {
          // Store pending export intent and navigate to the edit page.
          // The edit page loads via form POST (same as clicking Modify in the dropdown).
          // On the edit page, handlePendingExport() opens the Fancy Button Builder,
          // collects all style fields, and shows the export modal.
          chrome.storage.local.set(
            {
              [PENDING_EXPORT_KEY]: {
                id: graphicLinkID,
                ts: Date.now(),
                returnUrl: window.location.href,
                categoryID:
                  (document.getElementsByName("intQLCategoryID")[0] || {})
                    .value || null,
              },
            },
            function () {
              var form = document.forms["frmQLLinkList"];
              if (!form) {
                chrome.storage.local.remove(PENDING_EXPORT_KEY);
                alert("Cannot export from this page.");
                return;
              }
              var setField = function (name, value) {
                var el = form.querySelector('[name="' + name + '"]');
                if (el) el.value = value;
              };
              setField("strAction", "qlLinkModify");
              setField("ysnSave", "0");
              setField("ysnCopy", "0");
              setField("intQLLinkID", graphicLinkID);
              form.submit();
            },
          );
        }

        function showExportModal(
          jsonStr,
          graphicLinkID,
          returnUrl,
          returnCategoryID,
        ) {
          var existing = document.getElementById("cp-toolkit-export-modal");
          if (existing) existing.remove();

          var prettyJSON;
          try {
            prettyJSON = JSON.stringify(JSON.parse(jsonStr), null, 2);
          } catch (e) {
            prettyJSON = jsonStr;
          }

          var overlay = document.createElement("div");
          overlay.id = "cp-toolkit-export-modal";
          overlay.innerHTML =
            "<style>" +
            "#cp-toolkit-export-modal{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;}" +
            ".cp-export-dialog{background:#fff;border-radius:8px;width:600px;max-width:90vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,0.3);}" +
            ".cp-export-header{padding:16px 20px;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;justify-content:space-between;}" +
            ".cp-export-header h3{margin:0;font-size:18px;font-weight:600;color:#333;}" +
            ".cp-export-close{background:none;border:none;font-size:24px;cursor:pointer;color:#666;padding:0;line-height:1;}" +
            ".cp-export-close:hover{color:#333;}" +
            ".cp-export-body{padding:20px;overflow-y:auto;flex:1;}" +
            ".cp-export-body textarea{width:100%;height:300px;border:1px solid #ccc;border-radius:4px;padding:12px;font-family:monospace;font-size:12px;resize:vertical;box-sizing:border-box;}" +
            ".cp-export-body textarea:focus{outline:none;border-color:#af282f;}" +
            ".cp-export-footer{padding:16px 20px;border-top:1px solid #e0e0e0;display:flex;justify-content:flex-end;gap:8px;}" +
            ".cp-export-btn{padding:6px 12px;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;border:none;line-height:normal !important;}" +
            ".cp-export-btn-primary{background:#af282f;color:#fff;}" +
            ".cp-export-btn-primary:hover{background:#c42f37;}" +
            ".cp-export-btn-secondary{background:#e0e0e0;color:#333;}" +
            ".cp-export-btn-secondary:hover{background:#d0d0d0;}" +
            "</style>" +
            '<div class="cp-export-dialog">' +
            '<div class="cp-export-header">' +
            "<h3>Export Fancy Button JSON</h3>" +
            '<button class="cp-export-close" id="cp-export-close">&times;</button>' +
            "</div>" +
            '<div class="cp-export-body">' +
            '<textarea readonly id="cp-export-json"></textarea>' +
            "</div>" +
            '<div class="cp-export-footer">' +
            '<button class="cp-export-btn cp-export-btn-secondary" id="cp-export-close-btn">Close</button>' +
            '<button class="cp-export-btn cp-export-btn-secondary" id="cp-export-download">Download</button>' +
            '<button class="cp-export-btn cp-export-btn-secondary" id="cp-export-save-lib">Save to Library</button>' +
            '<button class="cp-export-btn cp-export-btn-primary" id="cp-export-copy">Copy to Clipboard</button>' +
            "</div>" +
            "</div>";

          document.body.appendChild(overlay);

          var textarea = overlay.querySelector("#cp-export-json");
          textarea.value = prettyJSON;

          function closeExport() {
            overlay.remove();
            if (returnUrl) {
              if (returnCategoryID) {
                chrome.storage.local.set(
                  {
                    "cp-pendingCategoryReturn": {
                      categoryID: returnCategoryID,
                      ts: Date.now(),
                    },
                  },
                  function () {
                    window.location.href = returnUrl;
                  },
                );
              } else {
                window.location.href = returnUrl;
              }
            }
          }

          overlay
            .querySelector("#cp-export-close")
            .addEventListener("click", closeExport);
          overlay
            .querySelector("#cp-export-close-btn")
            .addEventListener("click", closeExport);
          overlay.addEventListener("click", function (e) {
            if (e.target === overlay) closeExport();
          });
          document.addEventListener("keydown", function handler(e) {
            if (
              e.key === "Escape" &&
              document.getElementById("cp-toolkit-export-modal")
            ) {
              closeExport();
              document.removeEventListener("keydown", handler);
            }
          });

          overlay
            .querySelector("#cp-export-copy")
            .addEventListener("click", function () {
              textarea.select();
              navigator.clipboard.writeText(prettyJSON).then(function () {
                var btn = overlay.querySelector("#cp-export-copy");
                btn.textContent = "Copied!";
                setTimeout(closeExport, 1000);
              });
            });

          overlay
            .querySelector("#cp-export-download")
            .addEventListener("click", function () {
              var blob = new Blob([prettyJSON], { type: "application/json" });
              var url = URL.createObjectURL(blob);
              var a = document.createElement("a");
              a.href = url;
              a.download = "graphic-link-" + graphicLinkID + ".json";
              a.click();
              URL.revokeObjectURL(url);
              setTimeout(closeExport, 500);
            });
          overlay
            .querySelector("#cp-export-save-lib")
            .addEventListener("click", function () {
              showSaveToLibraryModal(jsonStr, overlay, closeExport);
            });
        }

        // Fetch an image URL and return a base64 data URL
        function fetchImageAsDataUrl(url) {
          return fetch(url)
            .then(function (resp) {
              if (!resp.ok) throw new Error("HTTP " + resp.status);
              return resp.blob();
            })
            .then(function (blob) {
              return new Promise(function (resolve) {
                var reader = new FileReader();
                reader.onload = function () {
                  resolve(reader.result);
                };
                reader.readAsDataURL(blob);
              });
            })
            .catch(function (e) {
              console.warn(
                "[CP Toolkit](cp-ImportFancyButton) Failed to fetch image:",
                url,
                e,
              );
              return null;
            });
        }

        // Scan template styles for image URLs and download them as base64
        var IMAGE_STYLE_KEYS = [
          "fancyButtonNormalOuterBackgroundImageSource",
          "fancyButtonHoverOuterBackgroundImageSource",
          "fancyButtonNormalInnerBackgroundImageSource",
          "fancyButtonHoverInnerBackgroundImageSource",
        ];

        function downloadTemplateImages(parsed) {
          var savedImages = {};
          var promises = [];

          if (parsed.styles) {
            parsed.styles.forEach(function (s) {
              // Direct image source keys
              if (
                IMAGE_STYLE_KEYS.indexOf(s.Key) > -1 &&
                s.Value &&
                !s.Value.startsWith("data:")
              ) {
                promises.push(
                  fetchImageAsDataUrl(s.Value).then(function (dataUrl) {
                    if (dataUrl) savedImages[s.Value] = dataUrl;
                  }),
                );
              }
              // MiscStyles may contain url() references (e.g. background-image in textStyle CSS)
              if (s.Key.indexOf("MiscStyles") > -1 && s.Value) {
                var urlMatches =
                  s.Value.match(/url\(["']?([^)"']+)["']?\)/g) || [];
                urlMatches.forEach(function (m) {
                  var url = m.replace(/url\(["']?/, "").replace(/["']?\)/, "");
                  if (url && !url.startsWith("data:") && !savedImages[url]) {
                    promises.push(
                      fetchImageAsDataUrl(url).then(function (dataUrl) {
                        if (dataUrl) savedImages[url] = dataUrl;
                      }),
                    );
                  }
                });
              }
            });
          }

          return Promise.all(promises).then(function () {
            return savedImages;
          });
        }

        function showSaveToLibraryModal(jsonStr, exportOverlay, closeExport) {
          var saveModal = document.createElement("div");
          saveModal.id = "cp-toolkit-save-lib-modal";
          saveModal.style.cssText =
            "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);" +
            "z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
            "font-family:Arial,Helvetica,sans-serif;";
          saveModal.innerHTML =
            '<div style="background:#fff;border-radius:8px;width:420px;max-width:90vw;box-shadow:0 10px 40px rgba(0,0,0,0.3);display:flex;flex-direction:column;">' +
            '<div style="padding:16px 20px;border-bottom:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center;">' +
            '<h3 style="margin:0;font-size:18px;font-weight:600;color:#333;">Save to Library</h3>' +
            '<button id="cp-save-lib-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;padding:0;line-height:1;">&times;</button>' +
            "</div>" +
            '<div style="padding:20px;">' +
            '<label style="display:block;font-size:13px;font-weight:500;color:#333;margin-bottom:6px;">Button Name</label>' +
            '<input id="cp-save-lib-name" type="text" placeholder="e.g. Standard Template" style="width:100%;padding:10px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;box-sizing:border-box;">' +
            "</div>" +
            '<div style="padding:16px 20px;border-top:1px solid #e0e0e0;display:flex;justify-content:flex-end;gap:8px;">' +
            '<button id="cp-save-lib-cancel" style="padding:10px 20px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;background:#e0e0e0;color:#333;line-height:normal !important;">Cancel</button>' +
            '<button id="cp-save-lib-save" style="padding:10px 20px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;background:#af282f;color:#fff;line-height:normal !important;">Save</button>' +
            "</div></div>";

          document.body.appendChild(saveModal);

          var nameInput = saveModal.querySelector("#cp-save-lib-name");
          nameInput.focus();

          function closeSaveModal() {
            saveModal.remove();
          }

          function doSave() {
            var name = nameInput.value.trim();
            if (!name) {
              nameInput.style.borderColor = "#cc0000";
              nameInput.focus();
              return;
            }
            var saveBtn = saveModal.querySelector("#cp-save-lib-save");
            saveBtn.textContent = "Downloading images...";
            saveBtn.disabled = true;

            var storageKey = name.replace(/\s+/g, "_");
            try {
              var parsed = JSON.parse(jsonStr);
              delete parsed.previewImage;

              downloadTemplateImages(parsed).then(function (savedImages) {
                if (Object.keys(savedImages).length > 0) {
                  parsed.savedImages = savedImages;
                  console.log(
                    "[CP Toolkit](cp-ImportFancyButton) Saved " +
                      Object.keys(savedImages).length +
                      " image(s) with button",
                  );
                }
                chrome.storage.local.get(
                  "cp-customButtonLibrary",
                  function (data) {
                    var lib = data["cp-customButtonLibrary"] || {};
                    lib[storageKey] = parsed;
                    chrome.storage.local.set(
                      { "cp-customButtonLibrary": lib },
                      function () {
                        customButtonLibrary = lib;
                        closeSaveModal();
                        var btn = exportOverlay.querySelector(
                          "#cp-export-save-lib",
                        );
                        if (btn) btn.textContent = "Saved!";
                        setTimeout(closeExport, 1000);
                      },
                    );
                  },
                );
              });
            } catch (e) {
              alert("Could not parse button JSON: " + e.message);
              saveBtn.textContent = "Save";
              saveBtn.disabled = false;
            }
          }

          saveModal
            .querySelector("#cp-save-lib-close")
            .addEventListener("click", closeSaveModal);
          saveModal
            .querySelector("#cp-save-lib-cancel")
            .addEventListener("click", closeSaveModal);
          saveModal
            .querySelector("#cp-save-lib-save")
            .addEventListener("click", doSave);
          nameInput.addEventListener("keydown", function (e) {
            if (e.key === "Enter") doSave();
          });
        }

        function exportCustomLibrary() {
          if (
            !customButtonLibrary ||
            Object.keys(customButtonLibrary).length === 0
          ) {
            alert("No saved buttons to export.");
            return;
          }

          var exportData = {
            type: "cp-toolkit-fancy-button-library",
            version: 1,
            buttons: customButtonLibrary,
          };
          var prettyJSON = JSON.stringify(exportData, null, 2);

          var exportOverlay = document.createElement("div");
          exportOverlay.id = "cp-toolkit-lib-export-modal";
          exportOverlay.style.cssText =
            "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);" +
            "z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
            "font-family:Arial,Helvetica,sans-serif;";
          exportOverlay.innerHTML =
            '<div style="background:#fff;border-radius:8px;width:550px;max-width:90vw;max-height:90vh;box-shadow:0 10px 40px rgba(0,0,0,0.3);display:flex;flex-direction:column;">' +
            '<div style="padding:16px 20px;border-bottom:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center;">' +
            '<h3 style="margin:0;font-size:18px;font-weight:600;color:#333;">Export Button Library</h3>' +
            '<button id="cp-lib-exp-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;padding:0;line-height:1;">&times;</button>' +
            "</div>" +
            '<div style="padding:20px;overflow-y:auto;flex:1;">' +
            '<div style="font-size:13px;color:#666;margin-bottom:12px;">' +
            Object.keys(customButtonLibrary).length +
            " saved button(s)" +
            "</div>" +
            '<textarea id="cp-lib-exp-json" readonly style="width:100%;height:200px;border:1px solid #ccc;border-radius:4px;padding:12px;font-family:monospace;font-size:12px;resize:vertical;box-sizing:border-box;"></textarea>' +
            "</div>" +
            '<div style="padding:16px 20px;border-top:1px solid #e0e0e0;display:flex;justify-content:flex-end;gap:8px;">' +
            '<button id="cp-lib-exp-cancel" style="padding:10px 20px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;background:#e0e0e0;color:#333;line-height:normal !important;">Close</button>' +
            '<button id="cp-lib-exp-download" style="padding:10px 20px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;background:#e0e0e0;color:#333;line-height:normal !important;">Download</button>' +
            '<button id="cp-lib-exp-copy" style="padding:10px 20px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;background:#af282f;color:#fff;line-height:normal !important;">Copy to Clipboard</button>' +
            "</div></div>";

          document.body.appendChild(exportOverlay);
          exportOverlay.querySelector("#cp-lib-exp-json").value = prettyJSON;

          function closeLibExport() {
            exportOverlay.remove();
          }

          exportOverlay
            .querySelector("#cp-lib-exp-close")
            .addEventListener("click", closeLibExport);
          exportOverlay
            .querySelector("#cp-lib-exp-cancel")
            .addEventListener("click", closeLibExport);

          exportOverlay
            .querySelector("#cp-lib-exp-copy")
            .addEventListener("click", function () {
              navigator.clipboard.writeText(prettyJSON).then(function () {
                var btn = exportOverlay.querySelector("#cp-lib-exp-copy");
                btn.textContent = "Copied!";
                setTimeout(closeLibExport, 1000);
              });
            });

          exportOverlay
            .querySelector("#cp-lib-exp-download")
            .addEventListener("click", function () {
              var blob = new Blob([prettyJSON], { type: "application/json" });
              var url = URL.createObjectURL(blob);
              var a = document.createElement("a");
              a.href = url;
              a.download = "fancy-button-library.json";
              a.click();
              URL.revokeObjectURL(url);
            });
        }

        function importCustomLibrary(onComplete) {
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

              // Support both wrapped format and raw button object
              var buttons;
              if (
                data.type === "cp-toolkit-fancy-button-library" &&
                data.buttons
              ) {
                buttons = data.buttons;
              } else if (
                typeof data === "object" &&
                !Array.isArray(data) &&
                !data.styles
              ) {
                // Assume raw { key: buttonObj, ... } format
                buttons = data;
              } else {
                alert(
                  "Unrecognized file format. Expected a button library export.",
                );
                return;
              }

              var keys = Object.keys(buttons);
              if (keys.length === 0) {
                alert("No buttons found in file.");
                return;
              }

              // Show confirmation modal
              var importModal = document.createElement("div");
              importModal.id = "cp-toolkit-lib-import-modal";
              importModal.style.cssText =
                "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);" +
                "z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
                "font-family:Arial,Helvetica,sans-serif;";

              var existingCount = Object.keys(customButtonLibrary).length;
              var newCount = 0;
              var overwriteCount = 0;
              keys.forEach(function (k) {
                if (customButtonLibrary[k]) overwriteCount++;
                else newCount++;
              });

              importModal.innerHTML =
                '<div style="background:#fff;border-radius:8px;width:420px;max-width:90vw;box-shadow:0 10px 40px rgba(0,0,0,0.3);display:flex;flex-direction:column;">' +
                '<div style="padding:16px 20px;border-bottom:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center;">' +
                '<h3 style="margin:0;font-size:18px;font-weight:600;color:#333;">Import Button Library</h3>' +
                '<button id="cp-lib-imp-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;padding:0;line-height:1;">&times;</button>' +
                "</div>" +
                '<div style="padding:20px;font-size:14px;color:#333;">' +
                '<p style="margin:0 0 12px;">Found <strong>' +
                keys.length +
                "</strong> button(s) in file:</p>" +
                '<ul style="margin:0 0 12px;padding-left:20px;color:#555;font-size:13px;">' +
                keys
                  .map(function (k) {
                    return (
                      "<li>" +
                      k.replace(/_/g, " ") +
                      (customButtonLibrary[k]
                        ? ' <span style="color:#af282f;">(will overwrite)</span>'
                        : "") +
                      "</li>"
                    );
                  })
                  .join("") +
                "</ul>" +
                (overwriteCount > 0
                  ? '<p style="margin:0;font-size:13px;color:#888;">' +
                    newCount +
                    " new, " +
                    overwriteCount +
                    " will overwrite existing.</p>"
                  : "") +
                "</div>" +
                '<div style="padding:16px 20px;border-top:1px solid #e0e0e0;display:flex;justify-content:flex-end;gap:8px;">' +
                '<button id="cp-lib-imp-cancel" style="padding:10px 20px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;background:#e0e0e0;color:#333;line-height:normal !important;">Cancel</button>' +
                '<button id="cp-lib-imp-confirm" style="padding:10px 20px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;background:#af282f;color:#fff;line-height:normal !important;">Import</button>' +
                "</div></div>";

              document.body.appendChild(importModal);

              function closeImportModal() {
                importModal.remove();
              }

              importModal
                .querySelector("#cp-lib-imp-close")
                .addEventListener("click", closeImportModal);
              importModal
                .querySelector("#cp-lib-imp-cancel")
                .addEventListener("click", closeImportModal);

              importModal
                .querySelector("#cp-lib-imp-confirm")
                .addEventListener("click", function () {
                  // Merge into existing library
                  keys.forEach(function (k) {
                    customButtonLibrary[k] = buttons[k];
                  });
                  chrome.storage.local.set(
                    { "cp-customButtonLibrary": customButtonLibrary },
                    function () {
                      closeImportModal();
                      if (onComplete) onComplete();
                      console.log(
                        "[CP Toolkit](cp-ImportFancyButton) Imported " +
                          keys.length +
                          " button(s)",
                      );
                    },
                  );
                });
            };
            reader.readAsText(file);
          });

          fileInput.click();
        }

        function tryAddImportButton() {
          if (importButtonAdded) return;

          var addItemButton = $("input[value*='Add Item']");
          if (!addItemButton.length) return;

          // Check if we already added the button
          if ($("input[value='Import Item']").length) {
            importButtonAdded = true;
            return;
          }

          importButtonAdded = true;
          console.log("[CP Toolkit] Loaded " + thisTool);

          try {
            var importItem = $(
              '<input type="button" style="background-color: #d3d657; border-bottom-color: #b3b64a; color: #333; margin-left: 5px;" class="cp-button" value="Import Item">',
            );
            addItemButton.after(importItem[0]);
            importItem.click(function () {
              createImportModal();
            });
          } catch (err) {
            console.warn("[CP Toolkit](" + thisTool + ") Error:", err);
          }
        }

        // Check for pending category return (after export modal navigated back)
        function handlePendingCategoryReturn() {
          chrome.storage.local.get("cp-pendingCategoryReturn", function (data) {
            var pending = data["cp-pendingCategoryReturn"];
            if (!pending) return;
            if (pending.ts && Date.now() - pending.ts > 15000) {
              chrome.storage.local.remove("cp-pendingCategoryReturn");
              return;
            }
            chrome.storage.local.remove("cp-pendingCategoryReturn");
            var catID = pending.categoryID;
            if (!catID) return;

            // Try to find and click the category link in the sidebar tree
            var catLinks = document.querySelectorAll(
              "a[id*='CategoryTree'], a[href*='CategoryID'], .TreeView a",
            );
            for (var i = 0; i < catLinks.length; i++) {
              var link = catLinks[i];
              // Check if the link's text/href/onclick contains our category ID
              var onclick = link.getAttribute("onclick") || "";
              var href = link.getAttribute("href") || "";
              if (
                onclick.indexOf(catID) !== -1 ||
                href.indexOf("CategoryID=" + catID) !== -1
              ) {
                link.click();
                return;
              }
            }

            // Fallback: try form submission approach
            var form = document.forms["frmQLLinkList"];
            if (form) {
              var setField = function (name, value) {
                var el = form.querySelector('[name="' + name + '"]');
                if (el) el.value = value;
              };
              var catEl = form.querySelector('[name="intQLCategoryID"]');
              if (catEl) {
                catEl.value = catID;
                setField("strAction", "");
                form.submit();
              }
            }
          });
        }

        // Check for pending export (runs on edit page after navigation)
        handlePendingCategoryReturn();
        handlePendingExport();

        // Try immediately
        tryAddImportButton();
        injectExportOptions();

        // Retry after delays for dynamically loaded content
        setTimeout(function () {
          tryAddImportButton();
          injectExportOptions();
        }, 500);
        setTimeout(function () {
          tryAddImportButton();
          injectExportOptions();
        }, 1000);
        setTimeout(function () {
          tryAddImportButton();
          injectExportOptions();
        }, 2000);

        // Also watch for DOM changes
        var observer = new MutationObserver(function () {
          tryAddImportButton();
          injectExportOptions();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  });
})();
