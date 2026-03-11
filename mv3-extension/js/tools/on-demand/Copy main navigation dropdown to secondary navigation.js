alert(
  "This function is deprecated and will be removed in a future version. Let a web dev know if you are still using this."
);

$(DesignCenter.themeJSON.MenuStyles).each(function() {
  if (this.Name == "MainMenuItem") {
    var MainMenuItem = this;

    $(DesignCenter.themeJSON.MenuStyles).each(function() {
      if (
        this.Name == "SecondaryMenuItem" ||
        this.Name == "SecondaryMenuItem1" ||
        this.Name == "SecondaryMenuItem2" ||
        this.Name == "SecondaryMenuItem3" ||
        this.Name == "SecondaryMenuItem4"
      ) {
        this.RecordStatus = 2;
        this.BackgroundColor = MainMenuItem.BackgroundColor;
        this.HoverBackgroundColor = MainMenuItem.HoverBackgroundColor;
        this.FontColor = MainMenuItem.FontColor;
        this.HoverFontColor = MainMenuItem.HoverFontColor;
        this.PaddingBottom = MainMenuItem.PaddingBottom;
        this.PaddingLeft = MainMenuItem.PaddingLeft;
        this.PaddingRight = MainMenuItem.PaddingRight;
        this.PaddingTop = MainMenuItem.PaddingTop;
        saveTheme();
      }
    });
  }
});
