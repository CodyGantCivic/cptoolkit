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

            function replaceQuickLinkForField($textField) {
              if (!$("#enableQuickLinkAutochange").is(":checked")) return;

              var displayText = $textField.val();
              if (!displayText) return;

              var replacement = findValToReplace(displayText, linkReplacementText);
              if (!replacement) return;

              // Find the sibling link field using DOM traversal
              var $linkField;
              if ($textField.attr('id') === 'txtLinkText') {
                $linkField = $("#txtLink");
              } else {
                $linkField = $textField.closest('.formline').find('[name="cp-txtLink"]');
              }

              if ($linkField.length && $linkField.val() !== replacement) {
                $linkField.val(replacement);
                $("#quickLinkChangeWarn").text(
                  "Notice: The link was autochanged by the CivicPlus Toolkit. You must save to actually update the URL."
                );
                console.log("[CP Toolkit](" + thisTool + ") Auto-filled URL:", replacement);
              }
            }

            function replaceQuickLink() {
              replaceQuickLinkForField($("#txtLinkText"));
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

                // Handle checkbox changes — apply autofill to ALL current text fields
                $("#enableQuickLinkAutochange").on("change", function() {
                  if ($(this).is(":checked")) {
                    replaceQuickLinkForField($("#txtLinkText"));
                    $("[name='cp-txtLinkText']").each(function() {
                      replaceQuickLinkForField($(this));
                    });
                  }
                });
              }

              // Delegated events — covers both original #txtLinkText and toolkit-added cp-txtLinkText fields
              var delegateRoot = $(".formline.selfClear.multiple.link").first().parent();
              if (!delegateRoot.length) delegateRoot = $(document.body);

              delegateRoot.off("change.cpAutofill keyup.cpAutofill paste.cpAutofill")
                .on("change.cpAutofill keyup.cpAutofill paste.cpAutofill",
                  "#txtLinkText, [name='cp-txtLinkText']",
                  function() {
                    replaceQuickLinkForField($(this));
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
