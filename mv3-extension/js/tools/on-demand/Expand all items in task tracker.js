var expandingOverlay = $(
  '<div class="expanderOverlay" style="position: absolute;top: 0;left: 0;right: 0;bottom: 0;background: rgba(0,0,0,.8);display: flex;align-items: center;justify-content: center;color: #fff;"><h1>Expanding Items...</h1></div>'
);

function expandVisible() {
  if (jQuery(".toggler").not(".expanded").length) {
    jQuery(".toggler")
      .not(".expanded")
      .click();
    if (jQuery(".expanderOverlay").length == 0) {
      expandingOverlay.appendTo("body");
    }
  } else {
    clearInterval(expanderInterval);
    console.log("Done expanding items.");
    jQuery(".expanderOverlay").remove();
  }
}

var expanderInterval = setInterval(function() {
  expandVisible();
}, 1000);
expandVisible();
