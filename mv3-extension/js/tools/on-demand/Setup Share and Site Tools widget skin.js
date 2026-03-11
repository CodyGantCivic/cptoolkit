alert(
  "This function is deprecated and will be removed in a future version. Let a web dev know if you are still using this."
);

var mainMenuItemColor_ts;
$.each(DesignCenter.themeJSON.MenuStyles, function() {
  if (this.Name == "MainMenuItem") {
    mainMenuItemColor_ts = this.BackgroundColor;
    mainMenuTextColor_ts = this.FontColor;
  }
});

var foundShareSiteToolsSkin = false;
$.each(DesignCenter.themeJSON.WidgetSkins, function() {
  if (this.Name.indexOf("Share") !== -1) {
    if (confirm("Detected '" + this.Name + "' as Share/Site Tools widget skin. Click OK to override its settings.")) {
      foundShareSiteToolsSkin = true;
      this.RecordStatus = DesignCenter.recordStatus.Modified;

      /* Wrapper */
      this.Components[0].RecordStatus = DesignCenter.recordStatus.Modified;
      this.Components[0].FontSize = 1;
      this.Components[0].FontColor = mainMenuTextColor_ts;

      /* Header */
      this.Components[1].RecordStatus = DesignCenter.recordStatus.Modified;
      this.Components[1].TextAlignment = 3; /* 3 is centered */

      /* Item List */
      this.Components[2].RecordStatus = DesignCenter.recordStatus.Modified;
      this.Components[2].BackgroundColor = mainMenuItemColor_ts;
      this.Components[2].PaddingBottom = { Value: "1", Unit: "0" };
      this.Components[2].PaddingLeft = { Value: "1", Unit: "0" };
      this.Components[2].PaddingRight = { Value: "1", Unit: "0" };
      this.Components[2].PaddingTop = { Value: "1", Unit: "0" };

      /* Item Link */
      this.Components[7].RecordStatus = DesignCenter.recordStatus.Modified;
      this.Components[7].LinkNormalColor = mainMenuTextColor_ts;
      this.Components[7].LinkVisitedColor = mainMenuTextColor_ts;
      this.Components[7].LinkHoverColor = "";
      this.Components[7].LinkNormalUnderlined = false;
      this.Components[7].LinkHoverUnderlined = true;
    }
  }
});
if (foundShareSiteToolsSkin) {
  saveTheme();
} else {
  alert("There is no skin with 'Share' in its name. No changes were made.");
}
