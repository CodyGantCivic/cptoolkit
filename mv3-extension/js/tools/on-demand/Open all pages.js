alert(
  "This function is deprecated and will be removed in a future version. Let a web dev know if you are still using this."
);

if ($("body").hasClass("liveEditOn")) {
  var expandInterval = setInterval(function() {
    expandEntireTree();
  }, 8000);

  ajaxPostBackStart("[CP Toolkit] Opening all links... Please Wait.");
  $("#divAjaxProgress")
    .clone()
    .attr("id", "toolkit-block")
    .css("z-index", "90000001")
    .appendTo("body");
  ajaxPostBackEnd();

  function expandEntireTree() {
    if ($("#divAjaxProgress").is(":visible") == false) {
      var expandable = $(".siteMap.tree .collapsed:not([data-expanding=true])");
      if (expandable.length) {
        expandable.each(function() {
          console.log(
            "Expanding: " +
              $(this)
                .parent("li")
                .find("a:not(.grippy):not(.collapsed):not(.backToTop)")
                .text()
          );
          $(this).attr("data-expanding", true);
          $(this).click();
        });
      } else {
        clearInterval(expandInterval);
        $("#toolkit-block").remove();
        console.log("Done expanding.");
        createOpenLinkButton();
      }
    }
  }
  expandEntireTree();

  function createOpenLinkButton() {
    // Convert the "Features Link" to a link so that it shows up
    var FeaturesLinkHeader = $(".siteMap.tree h3:not([id])");
    FeaturesLinkHeader.replaceWith("<a><h3>" + FeaturesLinkHeader.text() + "</h3></a>");

    var numOpened = 0;
    var siteLinks = $(".siteMap.tree a:not(.grippy):not(.treeExpandCollapse):not(.backToTop)");

    var siteMapElement = $(
      '<div style="position: fixed; z-index: 90000002; background-color: rgba(255, 255, 255, .8); top: 0; left: 0; right: 0; bottom: 0;"><a style="text-align: center; top: 40%; font-size: 3em; position: absolute; width: 100%;" class="openMore">Open next 10 links</a></div>'
    ).appendTo("body");

    alert("Ready to open links.");
    $(".openMore").click(function() {
      var currentNumOpened = numOpened;
      for (var i = currentNumOpened; i < currentNumOpened + 10; i++) {
        if (siteLinks.length > i) {
          window.open(siteLinks[i].href, "_blank");
          numOpened++;
        }
      }
    });
  }
} else {
  alert("Live Edit must be turned on.");
}
