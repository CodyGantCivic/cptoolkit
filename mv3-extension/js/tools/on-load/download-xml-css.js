(function loadTool() {
  var thisTool = "download-xml-css";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool] !== false && window.location.pathname.toLowerCase() == "/admin/designcenter/layouts") {
        // console.log("[CP Toolkit] Loading " + thisTool);
        try {
          // If fontawesome isn't loaded, load it
          (function() {
            if ($("#fontawesome_css").length == 0) {
              var css = document.createElement("link");
              css.id = "fontawesome_css";
              css.href = chrome.runtime.getURL("css/external/fontawesome-all.min.css");
              css.rel = "stylesheet";
              css.type = "text/css";
              document.getElementsByTagName("head")[0].appendChild(css);
            }
          })();

          // Function to add styles
          function addStyles() {
            if ($("#download-xml-css-styles").length === 0) {
              $("body").append(`<style id="download-xml-css-styles">
                        .downloadXML, .downloadCSS {
                            line-height: 33px;
                            font-size: .75rem;
                            font-weight: 400 !important;
                            position: absolute;
                            top: 4px;
                        }
                        .downloadXML {
                            right: 221px;
                        }
                        .downloadCSS {
                            right: 120px;
                        }
                        .downloadXML .fa, .downloadCSS .fa {
                            color: #4f8ec0;
                        }
                        .listing .item {
                            padding-right: 330px;
                        }
                        .listing .item>.status {
                            right: 330px;
                        }
                        .listing .item h3 {
                            width: calc(100% - 54px);
                        }
                    </style>`);
            }
          }

          var currentSite = document.location.host;

          function downloadItem(title, url) {
            var link = document.createElement("a");
            link.download = title;
            link.href = url;
            link.click();
          }

          function processLayout($layoutItem) {
            // Skip if already processed
            if ($layoutItem.attr("data-download-buttons-added") === "true") {
              return;
            }
            $layoutItem.attr("data-download-buttons-added", "true");

            var $this = $layoutItem;
            var thisLayout = $this.find("h3 a").text();
            console.log("[CP Toolkit](" + thisTool + ") Running for layout: " + thisLayout);

            var downloadXML = $("<a href='#' class='button downloadXML'><i class='fa fa-download'></i> XML</a>");
            downloadXML.click(function() {
              var downloadUrl = "/App_Themes/" + thisLayout + "/" + thisLayout + ".xml";
              downloadItem(currentSite + "-" + thisLayout + ".xml", downloadUrl);
            });

            var thisLayoutPage = $this.find("a:contains('Layout Page')").attr("href");

            var downloadCSS = $("<a href='#' class='button downloadCSS'><i class='fa fa-download'></i> CSS</a>");
            downloadCSS.click(function() {
              // Because the layout page will redirect, get the redirected URL:
              var xhr = new XMLHttpRequest();
              xhr.onreadystatechange = function(e) {
                if (xhr.status == 200 && xhr.readyState == 4) {
                  var redirectedURL = xhr.responseURL;
                  console.log("[CP Toolkit](" + thisTool + ") Downloading... Got redirected URL: " + redirectedURL);
                  // Go to layout page with bundle off
                  $.get(
                    redirectedURL + "?bundle=off",
                    function(data) {
                      console.log("[CP Toolkit](" + thisTool + ") Downloading... Loaded layout page with bundle off.");
                      var cssLink = data.match(/\/App_Themes\/[^"]*Layout[^"]*/)[0];
                      downloadItem(currentSite + "-" + thisLayout + ".css", cssLink);
                    },
                    "text"
                  );
                }
              };
              xhr.open("GET", thisLayoutPage, true);
              xhr.send();
            });

            $this.append(downloadXML);
            $this.append(downloadCSS);
          }

          function addDownloadAllButton() {
            // Skip if already added
            if ($(".contentContainer .sidebar .buttons .download-all-btn").length > 0) {
              return;
            }

            var downloadAll = $(
              "<li class='download-all-btn'><a class='button bigButton nextAction' href='#'><span>Download All CSS and XML</span></a></li>"
            );
            downloadAll.click(function() {
              $(".downloadXML, .downloadCSS").each(function() {
                $(this).click();
              });
            });

            $(".contentContainer .sidebar .buttons").append(downloadAll);
          }

          function processAllLayouts() {
            var layouts = $(".item");
            if (layouts.length > 0) {
              console.log("[CP Toolkit](" + thisTool + ") Found " + layouts.length + " layouts");
              addStyles();
              layouts.each(function() {
                processLayout($(this));
              });
              addDownloadAllButton();
            }
          }

          // Try immediately in case DOM is ready
          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", processAllLayouts);
          } else {
            processAllLayouts();
          }

          // Also watch for dynamic content loading
          var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
              if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(function(node) {
                  if (node.nodeType === 1) { // Element node
                    // Check if the added node is a layout item
                    if ($(node).hasClass("item")) {
                      addStyles();
                      processLayout($(node));
                      addDownloadAllButton();
                    }
                    // Or check if layout items were added inside it
                    $(node).find(".item").each(function() {
                      addStyles();
                      processLayout($(this));
                      addDownloadAllButton();
                    });
                  }
                });
              }
            });
          });

          // Start observing when the body is available
          function startObserving() {
            if (document.body) {
              observer.observe(document.body, {
                childList: true,
                subtree: true
              });
            } else {
              setTimeout(startObserving, 100);
            }
          }
          startObserving();
        } catch (err) {
          console.warn(err);
        }
      }
    });
  });
})();
