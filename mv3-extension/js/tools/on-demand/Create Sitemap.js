// Average of 99.8% faster than before [Gunnar Richards]
(function() {
  var DEFAULT_HIGHEST_PAGE = 5000;
  var API_URL = "/SiteMap/Home/Content?showMineOnly=false";
  var OVERLAY_ID = "cp-toolkit-sitemap-overlay";

  // Remove any existing modal
  var existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();

  // --- Check Live Edit ---
  if (!$("body").hasClass("liveEditOn")) {
    showWarningModal();
    return;
  }

  // --- Try auto-detect, fall back to default on failure ---
  detectHighestPageId(function(detected, wasAutoDetected) {
    showConfigModal(detected, wasAutoDetected);
  });

  // ==================== AUTO-DETECTION ====================

  function detectHighestPageId(callback) {
    var http = new XMLHttpRequest();
    http.open("POST", API_URL, true);
    http.setRequestHeader("Content-type", "application/json");
    http.timeout = 10000; // 10 second timeout

    http.onreadystatechange = function() {
      if (http.readyState !== 4) return;

      if (http.status !== 200) {
        callback(DEFAULT_HIGHEST_PAGE, false);
        return;
      }

      try {
        var responseText = http.responseText;
        var ids = [];

        // Strategy 1: Look for data-pageid or data-id attributes
        var idMatches = responseText.match(/data-(?:page)?id\s*=\s*["'](\d+)["']/gi);
        if (idMatches) {
          for (var i = 0; i < idMatches.length; i++) {
            var numMatch = idMatches[i].match(/(\d+)/);
            if (numMatch) ids.push(parseInt(numMatch[1], 10));
          }
        }

        // Strategy 2: Look for expandPage/collapsePage calls or PageID= params
        var funcMatches = responseText.match(/(?:expandPage|collapsePage|PageID=|pageId=|pageid=)(\d+)/gi);
        if (funcMatches) {
          for (var j = 0; j < funcMatches.length; j++) {
            var fNumMatch = funcMatches[j].match(/(\d+)/);
            if (fNumMatch) ids.push(parseInt(fNumMatch[1], 10));
          }
        }

        // Strategy 3: Parse as DOM and look for links with numeric IDs
        try {
          var parser = new DOMParser();
          var doc = parser.parseFromString(responseText, "text/html");
          var allLinks = doc.querySelectorAll("a[href], [data-id], [data-pageid]");
          for (var k = 0; k < allLinks.length; k++) {
            var el = allLinks[k];
            var dataId = el.getAttribute("data-id") || el.getAttribute("data-pageid");
            if (dataId && !isNaN(parseInt(dataId, 10))) {
              ids.push(parseInt(dataId, 10));
            }
            var href = el.getAttribute("href") || "";
            var hrefNums = href.match(/(\d+)/g);
            if (hrefNums) {
              for (var m = 0; m < hrefNums.length; m++) {
                var n = parseInt(hrefNums[m], 10);
                if (n > 0 && n < 100000) ids.push(n);
              }
            }
          }
        } catch (parseErr) {
          // DOMParser failed, continue with what we have
        }

        // Filter and find max
        var validIds = [];
        for (var v = 0; v < ids.length; v++) {
          if (ids[v] > 0 && ids[v] < 100000) validIds.push(ids[v]);
        }

        if (validIds.length > 0) {
          var maxId = Math.max.apply(null, validIds);
          var detected = Math.ceil(maxId * 1.2); // 20% safety margin
          callback(Math.max(detected, 100), true);
        } else {
          callback(DEFAULT_HIGHEST_PAGE, false);
        }
      } catch (err) {
        console.warn("[CP Toolkit](Create Sitemap) Auto-detect error:", err);
        callback(DEFAULT_HIGHEST_PAGE, false);
      }
    };

    http.onerror = function() {
      callback(DEFAULT_HIGHEST_PAGE, false);
    };

    http.ontimeout = function() {
      callback(DEFAULT_HIGHEST_PAGE, false);
    };

    http.send(JSON.stringify({ expandedPages: [1] }));
  }

  // ==================== ERROR MODAL ====================

  function showErrorModal(message) {
    var existing = document.getElementById(OVERLAY_ID);
    if (existing) existing.remove();

    var overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;";

    overlay.innerHTML =
      '<div style="background:#fff;border-radius:8px;width:480px;max-width:90vw;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,0.3);">' +
        '<div style="padding:16px 20px;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;justify-content:space-between;">' +
          '<h3 style="margin:0;font-size:18px;font-weight:600;color:#d32f2f;">Sitemap Error</h3>' +
          '<button id="cp-toolkit-sitemap-err-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;padding:0;line-height:1;">&times;</button>' +
        '</div>' +
        '<div style="padding:20px;">' +
          '<p style="margin:0;color:#555;font-size:14px;">' + message + '</p>' +
        '</div>' +
        '<div style="padding:16px 20px;border-top:1px solid #e0e0e0;display:flex;justify-content:flex-end;">' +
          '<button id="cp-toolkit-sitemap-err-ok" style="padding:10px 20px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;background:#af282f;color:#fff;">OK</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var closeModal = function() { overlay.remove(); document.removeEventListener("keydown", onKey); };
    var onKey = function(e) { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", onKey);
    document.getElementById("cp-toolkit-sitemap-err-close").addEventListener("click", closeModal);
    document.getElementById("cp-toolkit-sitemap-err-ok").addEventListener("click", closeModal);
  }

  // ==================== WARNING MODAL (Live Edit off) ====================

  function showWarningModal() {
    var overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;";

    overlay.innerHTML =
      '<div style="background:#fff;border-radius:8px;width:420px;max-width:90vw;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,0.3);">' +
        '<div style="padding:16px 20px;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;justify-content:space-between;">' +
          '<h3 style="margin:0;font-size:18px;font-weight:600;color:#333;">Create Sitemap</h3>' +
          '<button id="cp-toolkit-sitemap-warn-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;padding:0;line-height:1;">&times;</button>' +
        '</div>' +
        '<div style="padding:20px;">' +
          '<p style="margin:0;color:#555;font-size:14px;">Live Edit must be turned on to use this tool.</p>' +
        '</div>' +
        '<div style="padding:16px 20px;border-top:1px solid #e0e0e0;display:flex;justify-content:flex-end;">' +
          '<button id="cp-toolkit-sitemap-warn-ok" style="padding:10px 20px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;background:#af282f;color:#fff;">OK</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var closeModal = function() { overlay.remove(); document.removeEventListener("keydown", onKey); };
    var onKey = function(e) { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", onKey);
    document.getElementById("cp-toolkit-sitemap-warn-close").addEventListener("click", closeModal);
    document.getElementById("cp-toolkit-sitemap-warn-ok").addEventListener("click", closeModal);
  }

  // ==================== CONFIG MODAL ====================

  function showConfigModal(detectedMax, wasAutoDetected) {
    var statusText = wasAutoDetected
      ? 'Detected highest page ID: <strong>' + detectedMax + '</strong>'
      : 'Could not auto-detect. Using default: <strong>' + detectedMax + '</strong>';

    var overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;";

    overlay.innerHTML =
      '<div style="background:#fff;border-radius:8px;width:500px;max-width:90vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,0.3);">' +
        '<div style="padding:16px 20px;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;justify-content:space-between;">' +
          '<h3 style="margin:0;font-size:18px;font-weight:600;color:#333;">Create Sitemap</h3>' +
          '<button id="cp-toolkit-sitemap-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666;padding:0;line-height:1;">&times;</button>' +
        '</div>' +
        '<div style="padding:20px;overflow-y:auto;flex:1;">' +
          '<p style="margin:0 0 16px;color:#555;font-size:13px;">' + statusText + '</p>' +
          '<label style="display:block;margin-bottom:8px;font-size:13px;font-weight:500;color:#333;">Highest Page Number</label>' +
          '<input type="number" id="cp-toolkit-sitemap-pagenum" value="' + detectedMax + '" min="1" style="width:100%;padding:10px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;box-sizing:border-box;">' +
          '<p style="margin:12px 0 0;font-size:12px;color:#666;">Pages from 1 to this number will be requested. Non-existent pages are ignored. Use a higher number for completeness.</p>' +
        '</div>' +
        '<div style="padding:16px 20px;border-top:1px solid #e0e0e0;display:flex;justify-content:flex-end;gap:8px;">' +
          '<button id="cp-toolkit-sitemap-cancel" style="padding:10px 20px;border:1px solid #ccc;border-radius:4px;font-size:14px;cursor:pointer;background:#e0e0e0;color:#333;">Cancel</button>' +
          '<button id="cp-toolkit-sitemap-generate" style="padding:10px 20px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;background:#af282f;color:#fff;">Generate Sitemap</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var input = document.getElementById("cp-toolkit-sitemap-pagenum");
    var generateBtn = document.getElementById("cp-toolkit-sitemap-generate");

    var closeModal = function() { overlay.remove(); document.removeEventListener("keydown", onKey); };
    var onKey = function(e) {
      if (e.key === "Escape") closeModal();
      if (e.key === "Enter" && document.activeElement === input) {
        e.preventDefault();
        doGenerate();
      }
    };
    document.addEventListener("keydown", onKey);

    document.getElementById("cp-toolkit-sitemap-close").addEventListener("click", closeModal);
    document.getElementById("cp-toolkit-sitemap-cancel").addEventListener("click", closeModal);

    // Focus the input
    input.focus();
    input.select();

    function doGenerate() {
      var val = parseInt(input.value, 10);
      if (!val || val < 1) {
        input.style.borderColor = "#d32f2f";
        input.focus();
        return;
      }
      closeModal();
      runSitemapGeneration(val);
    }

    generateBtn.addEventListener("click", doGenerate);

    // Focus border color
    input.addEventListener("focus", function() { input.style.borderColor = "#af282f"; });
    input.addEventListener("blur", function() { input.style.borderColor = "#ccc"; });
  }

  // ==================== SITEMAP GENERATION ====================

  function runSitemapGeneration(highestPageNum) {
    var t0 = performance.now();

    ajaxPostBackStart("Please wait... This will only take a moment.");
    $("#divAjaxProgress")
      .clone()
      .attr("id", "toolkit-block")
      .css("z-index", "90000001")
      .appendTo("body");
    ajaxPostBackEnd();

    var http = new XMLHttpRequest();
    var payload = JSON.stringify({
      expandedPages: Array.from(Array(highestPageNum), function(e, i) { return i + 1; })
    });
    http.open("POST", API_URL, true);
    http.setRequestHeader("Content-type", "application/json");

    http.onreadystatechange = function() {
      if (http.readyState !== 4) return;
      if (http.status == 200) {
        document.getElementsByTagName("body")[0].innerHTML = this.responseText;
        console.log("[CP Toolkit](Create Sitemap) Done expanding");
        createSiteMapText(t0);
      } else {
        // Remove loading overlay and show error
        var block = document.getElementById("toolkit-block");
        if (block) block.remove();
        console.error("[CP Toolkit](Create Sitemap) API returned " + http.status);
        showErrorModal("The sitemap API returned an error (HTTP " + http.status + "). This may happen if the page count is too high or the server timed out. Try a smaller number.");
      }
    };
    http.onerror = function() {
      var block = document.getElementById("toolkit-block");
      if (block) block.remove();
      console.error("[CP Toolkit](Create Sitemap) Network error");
      showErrorModal("A network error occurred while generating the sitemap. Please check your connection and try again.");
    };
    http.send(payload);
  }

  // ==================== CSV + TEXT OUTPUT ====================

  function createSiteMapText(t0) {
    // Convert the "Features Link" to a link so that it shows up
    var featureLinks = $(".siteMap.tree h3:not([id])");
    for (var i = 0; i < featureLinks.length; i++) {
      featureLinks[i].innerHTML = "<a><h3>" + featureLinks[i].innerText + "</h3></a>";
    }

    var siteLinks = $(".siteMap.tree a:not(.grippy):not(.treeExpandCollapse):not(.backToTop)");
    var formattedLink = "";
    var csvLink = "";
    siteLinks.each(function() {
      var numTabs = $(this).parents("ol.subMenu").length;
      var thisLink = $(this).text();
      formattedLink += "\t".repeat(numTabs) + thisLink + "\n";
      csvLink += ",".repeat(numTabs) + thisLink + "\n";
    });

    var data = encodeURI("data:text/csv;charset=utf-8," + csvLink);
    var filename = window.location.hostname + " - SiteMap.csv";
    var link = document.createElement("a");
    link.setAttribute("href", data);
    link.setAttribute("value", "Test");
    link.setAttribute("download", filename);
    link.click();
    $(
      '<div style="position: fixed; z-index: 90000002; top: 0; left: 0; right: 0; bottom: 0;"><textarea style="width: 100%; height: 100%;">' +
        formattedLink +
        "</textarea></div>"
    ).appendTo("body");

    var t1 = performance.now();
    console.log("[CP Toolkit](Create Sitemap) Took " + (t1 - t0) + " milliseconds to complete.");
  }

})();
