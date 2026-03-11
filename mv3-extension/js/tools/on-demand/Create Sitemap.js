// Average of 99.8% faster than before [Gunnar Richards]
if ($("body").hasClass("liveEditOn")) {
  var t0 = performance.now();

  var http = new XMLHttpRequest();
  var url = "/SiteMap/Home/Content?showMineOnly=false";
  var pageNum = prompt("Please enter the highest page number for the site: ", "5000");
  var highestPageNum = parseInt(pageNum, 10);

  ajaxPostBackStart("Please wait... This will only take a moment.");
  $("#divAjaxProgress")
    .clone()
    .attr("id", "toolkit-block")
    .css("z-index", "90000001")
    .appendTo("body");
  ajaxPostBackEnd();

  const payload = JSON.stringify({
    expandedPages: Array.from(Array(highestPageNum), (e, i) => i + 1)
  });
  http.open("POST", url, true);

  http.setRequestHeader("Content-type", "application/json");

  http.onreadystatechange = function() {
    if (http.readyState == 4 && http.status == 200) {
      document.getElementsByTagName("body")[0].innerHTML = this.responseText;
      console.log("Done expanding");
      createSiteMapText();
    }
  };
  http.send(payload);

  function createSiteMapText() {
    // Convert the "Features Link" to a link so that it shows up
    var featureLinks = $(".siteMap.tree h3:not([id])");
    for (i = 0; i < featureLinks.length; i++) {
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
    console.log("The SiteMap creation tool took " + (t1 - t0) + " milliseconds to complete.");
  }
} else {
  alert("Live Edit must be turned on.");
}
