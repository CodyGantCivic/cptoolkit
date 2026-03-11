(function loadTool() {
  var thisTool = "cp-MultipleQuickLinks";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool]) {
        console.log("[CP Toolkit] Loading " + thisTool);
        try {
          var $ = window.jQuery;
          // Code:
          var uploadMultiple = $(
            '<textarea id="completedResults" style="display: none;margin: 0px 921px 0px 0px; height: 356px; width: 362px;"></textarea>'
          );
          var thisButtonSection = $("input[value*='Save and Publish']");
          thisButtonSection.after(uploadMultiple[0]);

          function appendCode() {
            var addNew = `<br><input type="button" style="width: 30px; float: right; margin-top: 25px;" name="addNewSection" value="+">`,
              div = $(".formline.selfClear.multiple.link div:first-of-type")[0];
            div.insertAdjacentHTML("beforebegin", addNew);
            var setStatus = `<select name="txtStatus" style="float: left; margin-right: 20px;"><option value="Save and Publish">Published</option><option value="Save">Draft</option></select>`,
              div = $(".formline.selfClear.multiple.link div:first-of-type")[0];
            div.insertAdjacentHTML("beforeend", setStatus);

            // Add New Section
            function addNewSectionClickHandler() {
              var str = `
            <div class="formline selfClear multiple link" style="padding-top: 10px;">
              <br>
              <input type="button" style="width: 30px; float: right; margin-top: 55px;" name="addNewSection" value="+">
              <label for="txtLink">Link</label>
              <div> <label for="txtLink">
                  Web Address<br> <input type="text" name="txtLink" value=""> </label>
                <label for="txtLinkText">
                  Display Text<br> <input type="text" maxlength="500" name="txtLinkText" value="">
                </label>
                <label class="check" style="width:47%" for="ysnNewWindow">
                  <input type="checkbox" name="ysnNewWindow">Open in new window
                </label>
                <select name="txtStatus" style="float: left; margin-right: 20px;">
                  <option value="Save and Publish">Published</option>
                  <option value="Save">Draft</option>
                </select>
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
          // Post Items
          var categoryCount = 0;

          function addQuickLinks(displayText, webAddress, newWindow, status) {
            completedResults++;
            var newWindowChoice;

            if (newWindow) {
              newWindowChoice = 1;
            } else {
              newWindowChoice = 0;
            }

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
              ysnNewWindow: newWindow,
              dtiStartDate: today,
              txtCategoryIDListSave: intQLCategoryID
            };
            $.ajax({
              type: "POST",
              url: "https://" + document.location.hostname + "/admin/quicklinks.aspx",
              data: data
            }).done(function() {
              displayText.value = "Done";
              categoryCount++;
              document.getElementById("completedResults").value = categoryCount;
              var qlCount = document.getElementsByName("txtLinkText");
              if (categoryCount == qlCount.length) {
                document.getElementById("toolkit-block").style.display = "none";
                $('input[value="Back"]').click();
              }
            });
          }

          // Add Post Button

          if (
            $(".formline.selfClear.multiple.link").length &&
            window.location.pathname.toLowerCase() == "/admin/quicklinks.aspx" &&
            $("input[value*='Save and Publish']").length
          ) {
            appendCode();
            var uploadMultiple = $(
              '<input type="button" class="cp-button" value="Post Items" style="margin-left: 5px;">'
            );
            var thisButtonSection = $("input[value*='Save and Publish']");
            thisButtonSection.after(uploadMultiple[0]);
            uploadMultiple.click(function() {
              var ajaxLoad =
                'ajaxPostBackStart("Please wait... This will only take a moment.");$("#divAjaxProgress").clone().attr("id", "toolkit-block").css("display", "block").appendTo("body");ajaxPostBackEnd();';
              var script = document.createElement("script");
              script.innerHTML = ajaxLoad;
              document.body.appendChild(script);
              var webAddress = document.getElementsByName("txtLink");
              var displayText = document.getElementsByName("txtLinkText");
              var newWindow = $("[name=ysnNewWindow]:not(#enableQuickLinkAutochange)");
              var status = document.getElementsByName("txtStatus");
              var i;
              for (i = 0; i < webAddress.length; i++) {
                for (i = 0; i < displayText.length; i++) {
                  for (i = 0; i < newWindow.length; i++) {
                    for (i = 0; i < status.length; i++) {
                      addQuickLinks(displayText[i], webAddress[i].value, newWindow[i].checked, status[i].value);
                    }
                  }
                }
              }
            });
          }
        } catch (err) {
          console.warn(err);
        }
      }
    });
  });
})();
