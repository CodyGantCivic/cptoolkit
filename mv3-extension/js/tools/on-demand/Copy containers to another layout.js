var contentContainers = jQuery("[data-cprole='contentContainer']:not(.megaMenu):not(#featureColumn)");
var copyableContentContainers = [];
var currentCopyIterator;

// Find only the content containers that contain widgets
contentContainers.each(function() {
  if ($(this).find(".widget").length) {
    copyableContentContainers.push(this);
  }
});

if (copyableContentContainers.length && window.location.pathname.indexOf("Layout-Page") > 0) {
  var originalCloseContentContainerOptionsPopup = closeContentContainerOptionsPopup;
  var originalAlertFunction = alert;
  prepareContainerCopy(0);
} else {
  alert("You must be on a layout page and containers must have widgets placed in them to use the copy tool.");
}

function prepareContainerCopy(i) {
  currentCopyIterator = i;

  // Open the content container's options
  $(copyableContentContainers[i])
    .find(".containerOptions")
    .click();

  focusElement(copyableContentContainers[i]);

  checkIfOpen(copyableContentContainers[i], function() {
    // override close handler, which is also run during a copy
    closeContentContainerOptionsPopup = function($handler) {
      originalCloseContentContainerOptionsPopup($handler);
      if (currentCopyIterator < copyableContentContainers.length - 1) {
        setTimeout(function() {
          if (currentCopyIterator >= 0) {
            defocusElement(copyableContentContainers[currentCopyIterator]);
          }
          prepareContainerCopy(currentCopyIterator + 1);
        }, 500);
      } else {
        defocusElement(copyableContentContainers[currentCopyIterator]);
      }
      closeContentContainerOptionsPopup = originalCloseContentContainerOptionsPopup;
    };
    // Prevent alert from showing when copy was successful
    alert = function(message) {
      if (message != "Container copy successful.") {
        originalAlertFunction(message);
      } else {
        console.log(message);
      }
      alert = originalAlertFunction;
    };

    // Add to button handler
    $("#copyContainerToSelected").click(function() {
      var copyTo = [];
      $("#contentContainerCheckboxDiv input").each(function() {
        if ($(this).is(":checked")) {
          copyTo.push($(this).attr("data-copycontainerpageid"));
        }
      });

      copyContainerOptions(
        $($("#anchorOptions").val())
          .parent("*[data-cprole]")
          .attr("id"),
        $("select[name=columnAlignment]").val(),
        $("input[name='contentContainerbreakpoint']").val(),
        $("input[name='IsSmoothScrolling']").is(":checked"),
        $($("#anchorOptions").val())
          .find(".inheritance")
          .hasClass("locked"),
        copyTo
      );
    });
  });
}

function defocusElement(element) {
  jQuery(element).css("border", "none");
}

function focusElement(element) {
  $("html, body").animate(
    {
      scrollTop: $(element).offset().top - 400
    },
    100
  );
  // Add a red border
  jQuery(element).css("border", "5px solid red");
  // Flash the element
  jQuery(element)
    .fadeIn(200)
    .fadeOut(200)
    .fadeIn(200)
    .fadeOut(200)
    .fadeIn(200);
}

function checkIfOpen(element, callback) {
  var parentElementGuid = $(element).find("div")[0].id;
  if (
    $("#anchorOptions")
      .val()
      .replace("#", "") == parentElementGuid
  ) {
    // Remove other options from dialog
    $("li.left:not(:contains('Copy To'))").css("display", "none");
    $("#advancedWidgetOptions").css("display", "none");

    // Adjust message
    var originalMessageText = $("li.left:contains('Copy To') .tip:not(.hidden)").html();
    var additionalMessageText =
      "<br><br><span style='color: red;'>[CP Toolkit]<br>The container options and inheritance settings will also be copied.</span>";
    $("li.left:contains('Copy To') .tip:not(.hidden)").html(originalMessageText + additionalMessageText);

    // Remove done button
    $(".cpPopOverFooter .button span:contains('Done')")
      .parent(".button")
      .remove();

    // Change cancel button to skip
    $(".cpPopOverFooter .button.cancel").text("Skip");

    callback();
  } else {
    setTimeout(function() {
      checkIfOpen(parentElementGuid, callback);
    }, 500);
  }
}

function copyContainerOptions(containerId, alignment, breakpoint, smoothScrolling, inheritance, destinationLayouts) {
  console.log(arguments);

  destinationLayouts.forEach(function(id, i) {
    console.log("Setting container options for " + containerId + " on layout with ID " + id);
    jQuery.get("/" + id, function(response) {
      var copiedContainerId = $(response)
        .find("#" + containerId + " div.pageContent")
        .attr("data-containerid");

      jQuery.post(
        "/Layout/ContentContainerOptions/Save",
        "contentContainerID=" +
          copiedContainerId +
          "&ColumnAlignment=" +
          alignment +
          "&Breakpoint=" +
          breakpoint +
          "&IsSmoothScrolling=" +
          smoothScrolling,
        function() {
          console.log("Successfully set container options for " + containerId + " on layout with ID " + id);
        }
      );

      var contentCollectionId = response
        .split('<input type="hidden" id="hdnContentCollectionID" value="')[1]
        .split('" />')[0];

      jQuery.post(
        "/Layout/ContentInheritance/StartInheritanceToSubpages",
        "pageID=" + id + "&contentCollectionID=" + contentCollectionId + "&contentContainerID=" + copiedContainerId,
        function() {
          console.log("Successfully set inheritance options for " + containerId + " on layout with ID " + id);
        }
      );
    });
  });
}
