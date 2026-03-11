alert(
  "This function is deprecated and will be removed in a future version. Let a web dev know if you are still using this."
);

var foundSecondaryMenuItems_ts = false;
$(DesignCenter.themeJSON.MenuStyles).each(function() {
  if (this.Name == "SecondaryMainItem") {
    var SecondaryMenuItem = this;
    console.log("Copying from:");
    console.log(this);
    console.log("Copying to:");

    $(DesignCenter.themeJSON.MenuStyles).each(function() {
      if (
        this.Name == "SecondaryMenuItem" ||
        this.Name == "SecondaryMenuItem1" ||
        this.Name == "SecondaryMenuItem2" ||
        this.Name == "SecondaryMenuItem3" ||
        this.Name == "SecondaryMenuItem4"
      ) {
        this.RecordStatus = 2;
        this.FontFamily = SecondaryMenuItem.FontFamily;
        this.FontSize = SecondaryMenuItem.FontSize;
        this.FontStyle = SecondaryMenuItem.FontStyle;
        this.FontColor = SecondaryMenuItem.FontColor;
        this.HoverFontColor = SecondaryMenuItem.HoverFontColor;
        this.PaddingBottom = SecondaryMenuItem.PaddingBottom;
        this.PaddingLeft = SecondaryMenuItem.PaddingLeft;
        this.PaddingRight = SecondaryMenuItem.PaddingRight;
        this.PaddingTop = SecondaryMenuItem.PaddingTop;
        this.NormalUnderline = SecondaryMenuItem.NormalUnderline;
        this.TextAlignment = SecondaryMenuItem.TextAlignment;
        this.HoverUnderline = SecondaryMenuItem.HoverUnderline;
        foundSecondaryMenuItems_ts = true;
        console.log(this);
      }
    });
  }
});

if (foundSecondaryMenuItems_ts) {
  saveTheme();
}
