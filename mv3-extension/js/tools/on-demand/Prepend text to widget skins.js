if ($(".manageWidgetSkins").length) {
  var textToPrepend = prompt("What would you like to prepend?");

  if (textToPrepend) {
    $(".manageWidgetSkins .currentWidgetSkins .rename input").each(function() {
      $this = $(this);
      $this.val(textToPrepend + $this.val());
      $this.change();
    });
  }
} else {
  alert("You must first open the Manage Widget Skins dialog.");
}
