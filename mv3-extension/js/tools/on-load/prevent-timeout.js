(function loadTool() {
  var thisTool = "prevent-timeout";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool] !== false) {
        try {
          function checkForTimeoutAndPrevent() {
            // Check for the popover modal (Session Timeout dialog)
            var $modal = $("#popoverModal");
            if (
              $modal.is(":visible") &&
              $modal.find(".cp-PopOver-title").text().trim() ===
                "Session Timeout"
            ) {
              $modal.find("#cpPopOverFooter .cp-Btn--primary").click();
              console.log(
                "[CP Toolkit](" + thisTool + ") Login timeout prevented! (modal)",
              );
              return;
            }

            // Fallback: check for the older inline UI message
            if (
              $(".cp-UIMessage-text")
                .text()
                .startsWith("You will be signed out in")
            ) {
              $(".cp-UIMessage-text").find(".cp-Btn").click();
              console.log(
                "[CP Toolkit](" + thisTool + ") Login timeout prevented!",
              );
            }
          }

          // Listen for alarm-triggered messages from the service worker.
          // chrome.alarms is immune to background tab timer throttling,
          // so this fires reliably even when the tab has been hidden for 30+ minutes.
          if (chrome.runtime?.id) {
            chrome.runtime.onMessage.addListener(function(message) {
              if (message && message.action === "cp-check-timeout") {
                checkForTimeoutAndPrevent();
              }
            });
          }

          // Also keep the setInterval as a backup for foreground tabs.
          // Checks every 15 seconds to catch the 60-second countdown in time.
          setInterval(checkForTimeoutAndPrevent, 15 * 1000);

          console.log("[CP Toolkit] Loaded " + thisTool);
        } catch (err) {
          console.warn("[CP Toolkit](" + thisTool + ") error:", err);
        }
      }
    });
  });
})();
