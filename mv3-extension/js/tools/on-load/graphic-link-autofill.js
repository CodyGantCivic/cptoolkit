(function loadTool() {
  var thisTool = "graphic-link-autofill";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool] !== false && window.location.pathname.toLowerCase().startsWith("/admin/graphiclinks.aspx")) {
        try {
          $.getJSON(chrome.runtime.getURL("data/link-replacement-text.json"), function(linkReplacementText) {
            if (!linkReplacementText) return;

            // Track if we've already initialized for the current form instance
            var currentLinkUrlElement = null;
            var currentImagePreview = null;
            var currentFancyContainer = null;
            var imageChangeObserver = null;
            var fancyButtonObserver = null;

            function initGraphicLinkAutofill() {
              var linkUrlEl = document.getElementById('linkUrl');
              var imagePreviewEl = document.querySelector('.imagePreview');
              var fancyContainerEl = document.querySelector('.fancyButtonContainer');

              // Check if the form elements have changed (new form instance)
              var formChanged = linkUrlEl !== currentLinkUrlElement ||
                                imagePreviewEl !== currentImagePreview ||
                                fancyContainerEl !== currentFancyContainer;

              // Skip if nothing changed
              if (!formChanged && currentLinkUrlElement !== null) {
                return;
              }

              // Clean up old observers
              if (imageChangeObserver) {
                imageChangeObserver.disconnect();
                imageChangeObserver = null;
              }
              if (fancyButtonObserver) {
                fancyButtonObserver.disconnect();
                fancyButtonObserver = null;
              }

              var isReinit = currentLinkUrlElement !== null;
              currentLinkUrlElement = linkUrlEl;
              currentImagePreview = imagePreviewEl;
              currentFancyContainer = fancyContainerEl;
              console.log("[CP Toolkit] Loaded " + thisTool + (isReinit ? " (re-initialized)" : ""));

              // Only add checkbox if it doesn't already exist
              if (!$("#enableGraphicButtonAutochange").length) {
                var enableGraphicButtonCheckbox = $(
                  "<br><label class='check' style='width:47%' for='enableGraphicButtonAutochange'><input type='checkbox' name='ysnNewWindow' id='enableGraphicButtonAutochange'>[CP Toolkit] Enable graphic link autochanger</label><br><br><div style='color: red;' id='graphicButtonChangeWarn'></div>"
                );

                var container = $("#GraphicLink_OpenInNewWindow").parent().parent();
                if (container.length) {
                  container.append(enableGraphicButtonCheckbox);
                } else {
                  $("#linkUrl").after(enableGraphicButtonCheckbox);
                }
              }

              // Auto-check if link is empty
              if ($("#linkUrl").val() === "") {
                $("#enableGraphicButtonAutochange").prop("checked", true);
              }

              function wordsFromHtml(html) {
                if (!html || typeof html !== "string") return [];
                var normalized = html.replace(/([\s\n]*<[^>]*>[\s\n]*)+/g, " ").trim();
                if (normalized === "") return [];
                return normalized.split(/\s+/);
              }

              function checkFancyButton() {
                try {
                  if (!$("#enableGraphicButtonAutochange").is(":checked")) return;
                  var html = $(".fancyButtonContainer .text").html();
                  var words = wordsFromHtml(html);
                  if (words.length === 0) return;
                  $.each(words, function(_, w) {
                    checkForLink(String(w));
                  });
                } catch (e) {
                  console.warn("[CP Toolkit](" + thisTool + ") checkFancyButton error:", e);
                }
              }

              function checkRegularButton() {
                try {
                  if (!$("#enableGraphicButtonAutochange").is(":checked")) return;
                  var $imgPreview = $(".imagePreview").first();
                  if (!$imgPreview.length) return;
                  var src = $imgPreview.attr("src");
                  if (!src) return;
                  var parts = src.split("=");
                  if (parts.length < 2) return;
                  var imageID = parts[1];
                  if (typeof imageID === "undefined" || imageID === "") return;

                  var imageInfoURL = "/Admin/DocumentCenter/DocumentForModal/Edit/" + encodeURIComponent(imageID) + "?folderID=1";
                  $.get(imageInfoURL, function(response) {
                    try {
                      var responseObject = $(response);
                      var altText = responseObject.find("#txtAltText").val() || "";
                      var displayName = responseObject.find("#txtDocumentName").val() || "";
                      checkForLink(displayName);
                      checkForLink(altText);
                    } catch (e) {
                      console.warn("[CP Toolkit](" + thisTool + ") parsing image info error:", e);
                    }
                  }).fail(function() {
                    // ignore network/404
                  });
                } catch (e) {
                  console.warn("[CP Toolkit](" + thisTool + ") checkRegularButton error:", e);
                }
              }

              function setLinkInputValue(urlFromText) {
                try {
                  var $linkInput = $("#linkUrl");
                  if (!$linkInput.length) return;
                  var prior = $linkInput.val();
                  console.log("[CP Toolkit](" + thisTool + ") Matched URL:", urlFromText, "prior:", prior);

                  // Always set value (defensive). Trigger events for frameworks.
                  $linkInput.val(urlFromText);
                  $linkInput.trigger("input");
                  $linkInput.trigger("change");

                  try {
                    var inputEl = $linkInput.get(0);
                    if (inputEl) {
                      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
                      inputEl.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                  } catch (e) {
                    // ignore native dispatch errors
                  }

                  // Fallback delayed write in case page re-renders the input shortly after.
                  setTimeout(function() {
                    try {
                      var $requery = $("#linkUrl");
                      if ($requery.length && $requery.val() !== urlFromText) {
                        $requery.val(urlFromText);
                        $requery.trigger("input");
                        $requery.trigger("change");
                        try {
                          var el2 = $requery.get(0);
                          if (el2) {
                            el2.dispatchEvent(new Event("input", { bubbles: true }));
                            el2.dispatchEvent(new Event("change", { bubbles: true }));
                          }
                        } catch (e2) {}
                      }
                    } catch (e3) {}
                  }, 50);

                  $("#graphicButtonChangeWarn").text(
                    "Notice: The link was autochanged by the CivicPlus Toolkit. You must save the button to actually update the URL."
                  );

                  console.log("[CP Toolkit](" + thisTool + ") linkUrl set to:", $("#linkUrl").val());
                } catch (e) {
                  console.warn("[CP Toolkit](" + thisTool + ") set link error:", e);
                }
              }

              function checkForLink(theText) {
                try {
                  if (!$("#enableGraphicButtonAutochange").is(":checked")) return;
                  if (!theText || typeof theText !== "string") return;

                  console.log("[CP Toolkit](" + thisTool + ") Detected graphic link text: " + theText);

                  var urlFromText = false;
                  $.each(linkReplacementText, function(linkUrl, matchingText) {
                    if (!matchingText) return;
                    var items = Array.isArray(matchingText) ? matchingText : [matchingText];
                    $.each(items, function(_, m) {
                      if (typeof m === "undefined" || m === null) return;
                      if (theText.toString().toLowerCase() === m.toString().toLowerCase()) {
                        urlFromText = linkUrl;
                        return false;
                      }
                    });
                    if (urlFromText) return false;
                  });

                  if (urlFromText) {
                    setLinkInputValue(urlFromText);
                  }
                } catch (e) {
                  console.warn("[CP Toolkit](" + thisTool + ") checkForLink error:", e);
                }
              }

              if ($(".imagePreview").length) {
                try {
                  imageChangeObserver = new MutationObserver(function() {
                    checkRegularButton();
                  });
                  imageChangeObserver.observe($(".imagePreview")[0], { attributes: true });
                } catch (e) {
                  console.warn("[CP Toolkit](" + thisTool + ") imageChangeObserver error:", e);
                }
              }

              // Use MutationObserver for fancyButtonContainer (more reliable than deprecated DOMSubtreeModified)
              function setupFancyButtonObserver() {
                var fancyContainer = document.querySelector('.fancyButtonContainer');
                if (fancyContainer && !fancyButtonObserver) {
                  fancyButtonObserver = new MutationObserver(function() {
                    checkFancyButton();
                  });
                  fancyButtonObserver.observe(fancyContainer, {
                    childList: true,
                    subtree: true,
                    characterData: true
                  });
                }
              }

              // Try to set up observer now and after delays
              setupFancyButtonObserver();
              setTimeout(setupFancyButtonObserver, 500);
              setTimeout(setupFancyButtonObserver, 1000);

              // Fallback: also use deprecated event for older pages
              $(document).on("DOMSubtreeModified", ".fancyButtonContainer", function() {
                checkFancyButton();
              });

              $(document).on("change", "#enableGraphicButtonAutochange", function() {
                checkFancyButton();
                checkRegularButton();
              });

              // Initial checks - run immediately and with delays to catch late-loading content
              function runInitialChecks() {
                checkFancyButton();
                checkRegularButton();
              }

              // Run now
              runInitialChecks();

              // Run again after short delays to catch content that loads after the page
              setTimeout(runInitialChecks, 500);
              setTimeout(runInitialChecks, 1000);
              setTimeout(runInitialChecks, 2000);

              // Also run when document is fully loaded (images, iframes, etc.)
              if (document.readyState === 'complete') {
                runInitialChecks();
              } else {
                $(window).on('load', runInitialChecks);
              }
            }

            // Initialize when #linkUrl exists
            function tryInit() {
              if (document.getElementById('linkUrl')) {
                initGraphicLinkAutofill();
              }
            }

            // Try to initialize now
            tryInit();

            // Also try after delays for late-loading forms
            setTimeout(tryInit, 500);
            setTimeout(tryInit, 1000);
            setTimeout(tryInit, 2000);

            // Watch for DOM changes to detect when form is recreated (after save/publish)
            var bodyObserver = new MutationObserver(function(mutations) {
              // Check if any form elements appeared or were replaced
              var linkUrl = document.getElementById('linkUrl');
              var imagePreview = document.querySelector('.imagePreview');
              var fancyContainer = document.querySelector('.fancyButtonContainer');

              var formChanged = (linkUrl && linkUrl !== currentLinkUrlElement) ||
                                (imagePreview && imagePreview !== currentImagePreview) ||
                                (fancyContainer && fancyContainer !== currentFancyContainer);

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
          console.warn(err);
        }
      }
    });
  });
})();

