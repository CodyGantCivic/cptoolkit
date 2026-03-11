(function loadTool() {
  var thisTool = "title-changer";
  chrome.storage.local.get(thisTool, function(settings) {
    if (chrome.runtime.lastError) {
      console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
      return;
    }
    detect_if_cp_site(function() {
      if (settings[thisTool] !== false) {
        console.log("[CP Toolkit] Loaded " + thisTool);
        try {
          function setTitle(titleToSet) {
            var originalTitle = document.title;
            // If this page doesn't have a title, pull it from the CP menu
            if (originalTitle == "") {
              originalTitle = $(".cp-Toolbar-menu strong.ng-binding").text();
            }
            document.title = titleToSet + " | " + originalTitle;
          }

          $(document).ready(function() {
            if (window.location.pathname.toLowerCase().startsWith("/admin/")) {
              // Check if we are on an Admin page
              if (window.location.pathname.toLowerCase().startsWith("/admin/graphiclinks.aspx")) {
                $("#ctl00_ctl00_adminHeader_headerTitle").text("Graphic Links");
              }
              var breadcrumbText = jQuery(".wayfinder")
                .find("em")
                .text();
              if (breadcrumbText != "") {
                setTitle(breadcrumbText);
              } else {
                var breadcrumbLinkText = jQuery(".wayfinder")
                  .find("a")
                  .last()
                  .text()
                  .trim();
                if (breadcrumbLinkText != "") {
                  setTitle(breadcrumbLinkText);
                } else {
                  var headerText = jQuery(".header")
                    .find("h1")
                    .text();
                  if (headerText != "") {
                    setTitle(headerText);
                  } else {
                    // Give up
                    console.log("[CP Toolkit](" + thisTool + ") Couldn't find title to set.");
                  }
                }
              }
            } else if (window.location.pathname.toLowerCase().startsWith("/designcenter/")) {
              // Check if we are a Design Center page
              var currentlySelected = jQuery("#currentView option:selected").text();
              if (currentlySelected != "") {
                setTitle(currentlySelected);
              }
            } else {
              // Give up
              console.log("[CP Toolkit](" + thisTool + ") Not a recognized page.");
            }
          });
        } catch (err) {
          console.warn(err);
        }
      }
    });
  });
})();
