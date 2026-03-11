(function loadTool() {
  var thisTool = "input-focus";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool] !== false && window.location.pathname.toLowerCase().startsWith("/admin/")) {
        // console.log("[CP Toolkit] Loading " + thisTool);
        try {
          $(document).ready(function() {
            // Get form inputs
            var inputs = $(".formline input");
            // Exclude date inputs from selecting
            var inputsToSelect = inputs.not(".formline .date input");
            // Check if anything is focused
            var nothingAlreadyFocused = $(":focus").length == 0;
            // If there is a selectable form element
            if (inputsToSelect.length) {
              if (nothingAlreadyFocused) {
                // If there is a link field
                if ($("#txtLinkText").length) {
                  $("#txtLinkText").focus();
                } else {
                  // Select the first form element
                  inputsToSelect.first().focus();
                }
              } else {
                // console.log("[CP Toolkit](" + thisTool + ") Another input has already been focused.");
              }
            } else {
              // console.log("[CP Toolkit](" + thisTool + ") No form detected on this page.");
            }
            // Prevent input field selection from selecting all text
            if (inputs.length) {
              inputs.each(function() {
                $this = $(this);
                if ($this.attr("onfocus") == "this.select()") {
                  $this.removeAttr("onfocus");
                }
              });
            }
            // Prevent tab from going to text editor buttons
            $(".reToolbar a").attr("tabindex", "-1");
          });
        } catch (err) {
          console.warn(err);
        }
      }
    });
  });
})();
