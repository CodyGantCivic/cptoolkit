(function loadTool() {
  var thisTool = "adfs";

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function removeForms() {
    document.querySelectorAll("form").forEach(function(form) {
      form.remove();
    });
  }

  chrome.storage.local.get(thisTool, function(settings) {
    if (settings[thisTool] === false) return;

    var path = window.location.pathname.toLowerCase();
    var host = window.location.hostname.toLowerCase();

    try {
      // SAML login page - bypass to standard CP login.
      if (path.startsWith("/admin/saml/logonrequest")) {
        console.log("[CP Toolkit](" + thisTool + ") SAML login detected, redirecting to standard login.");
        removeForms();
        onReady(removeForms);
        window.location = "//" + host + "/Admin/?saml=off";
      }
      // CivicPlus identity server - auto-follow ADFS redirect.
      else if (
        (host === "account.civicplus.com" || host === "identityserver.cpqa.ninja") &&
        path.startsWith("/identity/")
      ) {
        onReady(function() {
          var adfsUrlInput = document.getElementById("civicPlusAdfsUrl");
          if (adfsUrlInput && adfsUrlInput.value) {
            console.log("[CP Toolkit](" + thisTool + ") Identity server ADFS redirect found, following.");
            window.location = adfsUrlInput.value;
          }
        });
      }
    } catch (err) {
      console.warn("[CP Toolkit](" + thisTool + ") Error:", err);
    }
  });
})();
