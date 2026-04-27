(function loadTool() {
  var thisTool = "cp-MultipleQuickLinks";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool] !== false) {
        console.log("[CP Toolkit] Loading " + thisTool);
        try {
          var $ = window.jQuery;

          function ensureToolkitOverlay() {
            var overlay = document.getElementById("cp-toolkit-quicklinks-overlay");
            if (overlay) {
              return overlay;
            }

            overlay = document.createElement("div");
            overlay.id = "cp-toolkit-quicklinks-overlay";
            overlay.style.cssText =
              "position:fixed;inset:0;background:rgba(255,255,255,0.72);z-index:2147483647;display:none;align-items:center;justify-content:center;";

            var panel = document.createElement("div");
            panel.style.cssText =
              "background:#ffffff;border:1px solid #d3d3d3;border-radius:6px;box-shadow:0 6px 24px rgba(0,0,0,0.18);padding:18px 22px;font:600 14px/1.4 Arial,sans-serif;color:#333;";
            panel.textContent = "Please wait... This will only take a moment.";

            overlay.appendChild(panel);
            document.body.appendChild(overlay);
            return overlay;
          }

          function showToolkitOverlay() {
            ensureToolkitOverlay().style.display = "flex";
          }

          function hideToolkitOverlay() {
            var overlay = document.getElementById("cp-toolkit-quicklinks-overlay");
            if (overlay) {
              overlay.style.display = "none";
            }
          }

          function appendCode() {
            // Guard against duplicate insertion from retries/observer
            if ($('input[name="addNewSection"]').length) return;

            var addNew = `<br><input type="button" style="width: 30px; float: right; margin-top: 25px;" name="addNewSection" value="+">`,
              div = $(".formline.selfClear.multiple.link div:first-of-type")[0];
            if (!div) return;
            div.insertAdjacentHTML("beforebegin", addNew);

            // Add New Section
            function addNewSectionClickHandler() {
              var str = `
            <div class="formline selfClear multiple link cp-toolkit-added" style="padding-top: 10px;">
              <br>
              <input type="button" style="width: 30px; float: right; margin-top: 55px;" name="addNewSection" value="+">
              <label for="cp-txtLink">Link</label>
              <div> <label for="cp-txtLink">
                  Web Address<br> <input type="text" name="cp-txtLink" value=""> </label>
                <label for="cp-txtLinkText">
                  Display Text<br> <input type="text" maxlength="500" name="cp-txtLinkText" value="">
                </label>
                <label class="check" style="width:47%" for="cp-ysnNewWindow">
                  <input type="checkbox" name="cp-ysnNewWindow">Open in new window
                </label>
              </div>
            </div>`,
                div = $(".formline.selfClear.multiple.link div:last-of-type")[0];
              div.insertAdjacentHTML("beforeend", str);
              $('input[name="addNewSection"]').click(function() {
                $(this).remove();
                addNewSectionClickHandler();
              });
            }
            // Click handler to Add New Section
            $('input[name="addNewSection"]').click(function() {
              $(this).remove();
              addNewSectionClickHandler();
            });
          }

          function addQuickLinks(displayText, webAddress, newWindow, status) {
            // Get Current Category ID
            var intQLCategoryID = document.getElementsByName("intQLCategoryID")[1].value;
            var lngResourceID = document.getElementsByName("lngResourceID")[1].value;
            // Get Current Date
            var today = new Date();
            var dd = today.getDate();
            var mm = today.getMonth() + 1; //January is 0!
            var yyyy = today.getFullYear();

            if (dd < 10) {
              dd = "0" + dd;
            }

            if (mm < 10) {
              mm = "0" + mm;
            }

            today = mm + "/" + dd + "/" + yyyy;

            // Create Events
            var data = {
              lngResourceID: lngResourceID,
              strResourceType: "M",
              ysnSave: 1,
              strAction: "qlLinkSave",
              strActionSubmit: 0,
              intQLCategoryID: intQLCategoryID,
              save: status,
              txtLink: webAddress,
              txtLinkText: displayText.value,
              ysnNewWindow: newWindow ? 1 : 0,
              dtiStartDate: today,
              txtCategoryIDListSave: intQLCategoryID
            };
            return $.ajax({
              type: "POST",
              url: "https://" + document.location.hostname + "/admin/quicklinks.aspx",
              data: data
            }).done(function() {
              displayText.value = "Done";
            });
          }

          function batchPost(status) {
            var addedRows = $(".cp-toolkit-added");
            if (addedRows.length === 0) {
              return false; // No extra rows - let native button handle it
            }

            showToolkitOverlay();

            // Gather original CMS row fields
            var origLink = document.getElementsByName("txtLink")[0];
            var origText = document.getElementsByName("txtLinkText")[0];
            var origWindow = $("[name=ysnNewWindow]:not(#enableQuickLinkAutochange):not([name^=cp-])")[0];

            // Gather toolkit-added rows
            var addedLinks = document.getElementsByName("cp-txtLink");
            var addedTexts = document.getElementsByName("cp-txtLinkText");
            var addedWindows = document.querySelectorAll("[name=cp-ysnNewWindow]");

            // Build items array: original row + added rows
            var items = [];
            items.push({ text: origText, link: origLink.value, newWindow: origWindow ? origWindow.checked : false });
            for (var i = 0; i < addedLinks.length; i++) {
              items.push({ text: addedTexts[i], link: addedLinks[i].value, newWindow: addedWindows[i].checked });
            }

            // Post items sequentially to preserve order
            var queue = $.Deferred().resolve();
            for (var i = 0; i < items.length; i++) {
              (function(item) {
                queue = queue.then(function() {
                  return addQuickLinks(item.text, item.link, item.newWindow, status);
                });
              })(items[i]);
            }
            queue.then(function() {
              hideToolkitOverlay();
              $('input[value="Back"]').click();
            }, function() {
              hideToolkitOverlay();
            });
            return true; // Handled by toolkit
          }

          // Hijack native buttons — use retry + observer for late-loading forms

          var qlInitialized = false;
          var initObserver = null;

          function tryInit() {
            if (qlInitialized) return;
            if (
              $(".formline.selfClear.multiple.link").length &&
              window.location.pathname.toLowerCase() === "/admin/quicklinks.aspx" &&
              $("input[value*='Save and Publish']").length
            ) {
              appendCode();
              // Only mark initialized if the button was actually inserted
              if (!$('input[name="addNewSection"]').length) return;
              qlInitialized = true;
              if (initObserver) { initObserver.disconnect(); initObserver = null; }

              var publishBtn = $("input[value='Save and Publish']");
              var saveBtn = $("input[value='Save']");

              publishBtn.on("click.cpToolkit", function(e) {
                if (batchPost("Save and Publish")) {
                  e.preventDefault();
                  e.stopImmediatePropagation();
                }
              });

              saveBtn.on("click.cpToolkit", function(e) {
                if (batchPost("Save")) {
                  e.preventDefault();
                  e.stopImmediatePropagation();
                }
              });

              console.log("[CP Toolkit] Loaded " + thisTool);
            }
          }

          // Try immediately and with delays for late-loading forms
          tryInit();
          setTimeout(tryInit, 500);
          setTimeout(tryInit, 1000);
          setTimeout(tryInit, 2000);

          // MutationObserver fallback for very late loading
          if (!qlInitialized && document.body) {
            initObserver = new MutationObserver(function() {
              if (!qlInitialized) {
                tryInit();
              }
            });
            initObserver.observe(document.body, { childList: true, subtree: true });
          }
        } catch (err) {
          console.warn("[CP Toolkit](cp-MultipleQuickLinks) error:", err);
        }
      }
    });
  });
})();
