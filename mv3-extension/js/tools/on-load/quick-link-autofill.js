(function loadTool() {
  var thisTool = "quick-link-autofill";
  chrome.storage.local.get(thisTool, function(settings) {
    if (chrome.runtime.lastError) {
      console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
      return;
    }
    detect_if_cp_site(function() {
      if (settings[thisTool] !== false && window.location.pathname.toLowerCase().startsWith("/admin/quicklinks.aspx")) {
        try {
          $.getJSON(chrome.runtime.getURL("data/link-replacement-text.json"), function(linkReplacementText) {
            if (!linkReplacementText) return;

            // Track current form elements to detect changes
            var currentTxtLinkText = null;
            var currentTxtLink = null;
            var initialized = false;

            function findValToReplace(quickLinkText, quickLinkJson) {
              var link;
              $.each(quickLinkJson, function(key, value) {
                $(value).each(function() {
                  if (quickLinkText.toLowerCase() == this.toString().toLowerCase()) {
                    link = key;
                  }
                });
              });
              if (link) {
                return link;
              } else {
                return false;
              }
            }

            function replaceQuickLink() {
              if ($("#enableQuickLinkAutochange").is(":checked")) {
                var linkTextVal = $("#txtLinkText").val();
                var replacement = findValToReplace(linkTextVal, linkReplacementText);
                if (replacement) {
                  if ($("#txtLink").val() !== replacement) {
                    $("#txtLink").val(replacement);
                    $("#quickLinkChangeWarn").text(
                      "Notice: The link was autochanged by the CivicPlus Toolkit. You must save to actually update the URL."
                    );
                    console.log("[CP Toolkit](" + thisTool + ") Auto-filled URL:", replacement);
                  }
                }
              }
            }

            function initQuickLinkAutofill() {
              var txtLinkTextEl = document.getElementById('txtLinkText');
              var txtLinkEl = document.getElementById('txtLink');

              // Check if form elements exist
              if (!txtLinkTextEl || !txtLinkEl) {
                return false;
              }

              // Check if elements have changed (form was recreated)
              var formChanged = txtLinkTextEl !== currentTxtLinkText || txtLinkEl !== currentTxtLink;

              // Skip if already initialized and nothing changed
              if (!formChanged && initialized) {
                return true;
              }

              currentTxtLinkText = txtLinkTextEl;
              currentTxtLink = txtLinkEl;

              var isReinit = initialized;
              initialized = true;

              console.log("[CP Toolkit] Loaded " + thisTool + (isReinit ? " (re-initialized)" : ""));

              // Only add checkbox if it doesn't already exist
              if (!$("#enableQuickLinkAutochange").length) {
                var enableQuickLinkCheckbox = $(
                  '<label class="check" for="enableQuickLinkAutochange"><input type="checkbox" id="enableQuickLinkAutochange">[CP Toolkit] Enable quick link autochanger</label><div style="color: red;" id="quickLinkChangeWarn"></div><br>'
                );

                // Find the form container and prepend
                var formContainer = $(".formline.selfClear.multiple.link").first();
                if (formContainer.length) {
                  formContainer.closest("form").prepend(enableQuickLinkCheckbox);
                } else {
                  // Fallback: prepend to the container div
                  var contentContainer = $("#txtLinkText").closest(".contentContainerOld, .form, form");
                  if (contentContainer.length) {
                    contentContainer.prepend(enableQuickLinkCheckbox);
                  }
                }

                // Enable by default only if no link exists already
                if ($("#txtLinkText").val() == "" && $("#txtLink").val() == "") {
                  $("#enableQuickLinkAutochange").prop("checked", true);
                }

                // Handle checkbox changes
                $("#enableQuickLinkAutochange").on("change", function() {
                  replaceQuickLink();
                });
              }

              // Remove old event handlers and add new ones
              $(document).off("change keyup paste", "#txtLinkText").on("change keyup paste", "#txtLinkText", function() {
                replaceQuickLink();
              });

              // Run initial check
              replaceQuickLink();

              return true;
            }

            // Try to initialize now
            function tryInit() {
              if (document.getElementById('txtLinkText')) {
                initQuickLinkAutofill();
              }
            }

            // Try immediately
            tryInit();

            // Also try after delays for late-loading forms
            setTimeout(tryInit, 500);
            setTimeout(tryInit, 1000);
            setTimeout(tryInit, 2000);

            // Watch for DOM changes to detect when form appears or is recreated
            var bodyObserver = new MutationObserver(function() {
              var txtLinkText = document.getElementById('txtLinkText');
              var txtLink = document.getElementById('txtLink');

              var formChanged = (txtLinkText && txtLinkText !== currentTxtLinkText) ||
                                (txtLink && txtLink !== currentTxtLink);

              if (formChanged) {
                // Small delay to let the form fully render
                setTimeout(tryInit, 100);
              }
            });

            bodyObserver.observe(document.body, {
              childList: true,
              subtree: true
            });
          });
        } catch (err) {
          console.warn("[CP Toolkit](" + thisTool + ") Error:", err);
        }
      }
    });
  });
})();
