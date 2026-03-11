(function loadTool() {
  var thisTool = "adfs";
  chrome.storage.local.get(thisTool, function(settings) {
    if (settings[thisTool] === false) return;

    var path = window.location.pathname.toLowerCase();
    var host = window.location.hostname;

    try {
      // SAML login page — bypass to standard CP login
      if (path.startsWith("/admin/saml/logonrequest")) {
        console.log("[CP Toolkit](" + thisTool + ") SAML login detected, redirecting to standard login.");
        $("form").remove();
        $(document).ready(function() {
          $("form").remove();
        });
        window.location = "//" + host + "/Admin/?saml=off";
      }
      // CivicPlus identity server — auto-follow ADFS redirect
      else if (
        (host === "account.civicplus.com" || host === "identityserver.cpqa.ninja") &&
        path.startsWith("/identity/")
      ) {
        $(document).ready(function() {
          if ($("#civicPlusAdfsUrl").length) {
            console.log("[CP Toolkit](" + thisTool + ") Identity server ADFS redirect found, following.");
            window.location = $("#civicPlusAdfsUrl").val();
          }
        });
      }
    } catch (err) {
      console.warn("[CP Toolkit](" + thisTool + ") Error:", err);
    }
  });
})();
