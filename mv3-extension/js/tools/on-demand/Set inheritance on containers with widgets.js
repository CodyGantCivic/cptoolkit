var contentContainers = jQuery("[data-cprole='contentContainer']:not(.megaMenu):not(#featureColumn)");
var inheritableContentContainers = [];
var currentInheritanceIterator;

/* Find only the content containers that contain widgets */
contentContainers.each(function() {
  if ($(this).find(".widget").length) {
    inheritableContentContainers.push(this);
  }
});

if (inheritableContentContainers.length && window.location.pathname.indexOf("Layout-Page") > 0) {
  var originalCloseInheritancePopup = closeInheritancePopup;
  setInheritance_ts(0);
} else {
  alert("You must be on a layout page and containers must have widgets placed in them to use the inheritance tool.");
}

function setInheritance_ts(i) {
  currentInheritanceIterator = i;

  /* Open the content container's inheritance options */
  $(inheritableContentContainers[i])
    .find(".inheritance")
    .click();

  checkIfOpen(inheritableContentContainers[i], function() {
    /* override close handler, which is also run during a copy */
    closeInheritancePopup = function($handler) {
      originalCloseInheritancePopup($handler);
      if (currentInheritanceIterator < inheritableContentContainers.length - 1) {
        setTimeout(function() {
          setInheritance_ts(currentInheritanceIterator + 1);
        }, 500);
      } else {
        setTimeout(function() {
          $(".cpClosePopOver.inheritance").click();
          alert("Done setting inheritance!");
        }, 500);
      }
      closeInheritancePopup = originalCloseInheritancePopup;
    };
    if ($(".containerInheritRadio").length) {
      $(".containerInheritRadio[value='containerInheritToSubpages']").click();
    } else {
      $(".cpClosePopOver.inheritance").click();
    }
  });
}

function checkIfOpen(element, callback) {
  var parentElementGuid = $(element).find("div")[0].id;
  if ($(".containerInheritRadio").length || $(".stopInheritanceToSubpages").length) {
    callback();
  } else {
    setTimeout(function() {
      checkIfOpen(parentElementGuid, callback);
    }, 500);
  }
}
