(function loadTool() {
  var thisTool = "cp-MultipleQuickLinks";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool] !== false) {
        console.log("[CP Toolkit] Loading " + thisTool);
        try {
          var $ = window.jQuery;

          function appendCode() {
            var addNew = `<br><input type="button" style="width: 30px; float: right; margin-top: 25px;" name="addNewSection" value="+">`,
              div = $(".formline.selfClear.multiple.link div:first-of-type")[0];
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
              return false; // No extra rows — let native button handle it
            }

            // Show loading overlay via MAIN world (CSP-safe)
            chrome.runtime.sendMessage({
              action: "cp-execute-in-main",
              code: 'ajaxPostBackStart("Please wait... This will only take a moment.");$("#divAjaxProgress").clone().attr("id", "toolkit-block").css("display", "block").appendTo("body");ajaxPostBackEnd();'
            });

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
              chrome.runtime.sendMessage({
                action: "cp-execute-in-main",
                code: 'var el = document.getElementById("toolkit-block"); if (el) el.style.display = "none";'
              });
              $('input[value="Back"]').click();
            });
            return true; // Handled by toolkit
          }

          // Hijack native buttons

          if (
            $(".formline.selfClear.multiple.link").length &&
            window.location.pathname.toLowerCase() == "/admin/quicklinks.aspx" &&
            $("input[value*='Save and Publish']").length
          ) {
            appendCode();

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
          }
        } catch (err) {
          console.warn("[CP Toolkit](cp-MultipleQuickLinks) error:", err);
        }
      }
    });
  });
})();
