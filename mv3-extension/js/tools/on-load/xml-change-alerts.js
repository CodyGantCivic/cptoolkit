(function loadTool() {
  var thisTool = "xml-change-alerts";
  var initialized = false;

  chrome.storage.local.get(thisTool, function(settings) {
    if (chrome.runtime.lastError) {
      console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
      return;
    }
    detect_if_cp_site(function() {
      if (
        settings[thisTool] !== false &&
        window.location.pathname.toLowerCase().startsWith("/admin/designcenter/layouts/modify")
      ) {
        // Initialize the tool when the DOM is ready
        function initTool() {
          // Skip if already initialized
          if (initialized) {
            return;
          }

          // Check if required element exists
          if (!$("#structureFile").length) {
            return; // Will retry via MutationObserver or DOMContentLoaded
          }

          // Skip if already processed
          if ($("#toolkitAlert").length) {
            return;
          }

          initialized = true;
          console.log("[CP Toolkit] Loaded " + thisTool);

          try {
            function arrayDiff(oldArray, newArray) {
              return oldArray.filter(function(i) {
                return newArray.indexOf(i) < 0;
              });
            }

            // Add an area for alerts
            $("#structureFile")
              .parent()
              .append("<div id='toolkitAlert'></div>");

            var originalXml = $("code").text();

            // Check for malformed XML on the original XML
            $(originalXml)
              .find("*[cpRole='contentContainer']")
              .each(function() {
                if ($(this).children().length) {
                  var badIds = "";
                  $(this)
                    .children()
                    .each(function() {
                      badIds += this.id + "\n";
                    });
                  alert(
                    "The current XML is malformed:\n\n" +
                      this.id +
                      " is a content container that contains additional elements. Content containers should not contain any elements. Please change this to a structural container or remove the following elements from this container: \n\n" +
                      badIds +
                      "\nIf you continue to use this XML, you may run into unexpected issues, such as 404 errors when saving the theme."
                  );
                }
              });

            // Monitor for alerts on save and do an alert box instead
            $("#ErrorMessage").bind("DOMSubtreeModified", function(e) {
              if (e.target.innerHTML.length > 0) {
                alert(
                  $("#ErrorMessage")
                    .text()
                    .trim()
                );
              }
            });

            // Move breakpoint and error message up
            $("ol.cpForm > li.left:nth-child(4)").after($("#mainMenuBreakpoint").parents("li.left"));
            $("ol.cpForm > li.left:nth-child(5)").after($("#ErrorMessage").parents("li.left"));

            // Add button to view layout page
            var pagesUrl = "/Pages/LayoutPage/?name=" + $("#txtStructureName").val();
            var pagesLink = $(
              "<li><a class='button bigButton nextAction' href='" + pagesUrl + "'><span>View Layout Page</span></a></li>"
            );
            $(".buttons li a.save")
              .parent("li")
              .after(pagesLink);

            // Add title to auto-save button for help text
            $("#autoSaveThemeStyles").attr("title", "Rebuilds the CSS for all themes that use this layout.");

            $("#structureFile").change(function() {
              var file = $("#structureFile")[0].files[0];
              if (typeof file != "undefined") {
                var reader = new FileReader();
                reader.readAsText(file);
                reader.onloadend = function(e) {
                  var data = e.target.result;
                  var newXml = data.replace(/[\s\S]+<\?xml/, "<?xml");

                  // Get all of the ID's from each
                  var originalIds = [];
                  var newIds = [];

                  $(originalXml)
                    .find("*")
                    .each(function() {
                      if (this.id != "") {
                        originalIds.push(this.id);
                      }
                    });
                  $(newXml)
                    .find("*")
                    .each(function() {
                      if (this.id != "") {
                        newIds.push(this.id);
                      }
                    });

                  originalIds = originalIds.sort();
                  newIds = newIds.sort();

                  var differences = arrayDiff(originalIds, newIds);
                  var differenceString = "";

                  if (differences.length) {
                    $(differences).each(function(index, value) {
                      if (differenceString == "") {
                        differenceString += value;
                      } else {
                        differenceString += ", " + value;
                      }
                    });
                    $("#toolkitAlert")
                      .html(
                        "Warning: There are containers in the old XML that are not in the new XML. This will cause any widgets or styles applied to the following to be lost:<br><br>" +
                          differenceString
                      )
                      .css("color", "red");
                    $("a.button.save")
                      .css("background-color", "#B33A3A")
                      .css("border-bottom-color", "#792327")
                      .css("color", "#fff");
                    $("a.button.save span").text("Save ignoring XML warning");
                  } else {
                    $("#toolkitAlert")
                      .text("This XML has all the containers that the old XML had.")
                      .css("color", "green");
                    $("a.button.save")
                      .css("background-color", "")
                      .css("border-bottom-color", "")
                      .css("color", "");
                    $("a.button.save span").text("Save");
                  }

                  // Check for malformed XML
                  $(newXml)
                    .find("*[cpRole='contentContainer']")
                    .each(function() {
                      if ($(this).children().length) {
                        var badIds = "";
                        $(this)
                          .children()
                          .each(function() {
                            badIds += this.id + "\n";
                          });
                        alert(
                          "The chosen XML is malformed:\n\n" +
                            this.id +
                            " is a content container that contains additional elements. Content containers should not contain any elements. Please change this to a structural container or remove the following elements from this container: \n\n" +
                            badIds +
                            "\nIf you continue to use this XML, you may run into unexpected issues, such as 404 errors when saving the theme."
                        );
                      }
                    });
                };
              } else {
                $("#toolkitAlert").text("");
              }
            });
          } catch (err) {
            console.warn("[CP Toolkit](" + thisTool + ") Error:", err);
          }
        }

        // Try immediately in case DOM is ready
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", initTool);
        } else {
          initTool();
        }

        // Also watch for dynamic content loading (CivicPlus pages often load content dynamically)
        var observer = new MutationObserver(function(mutations) {
          if (!initialized) {
            initTool();
          } else {
            // Disconnect once initialized
            observer.disconnect();
          }
        });

        // Start observing when the body is available
        function startObserving() {
          if (document.body) {
            observer.observe(document.body, {
              childList: true,
              subtree: true
            });
          } else {
            setTimeout(startObserving, 50);
          }
        }
        startObserving();
      }
    });
  });
})();
