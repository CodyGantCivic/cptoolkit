alert(
  "This function is deprecated and will be removed in a future version. Let a web dev know if you are still using this."
);

var foundDefaultSkin = false;
$.each(DesignCenter.themeJSON.WidgetSkins, function() {
  if (this.Name.indexOf("Default") !== -1) {
    if (confirm("Detected '" + this.Name + "' as default widget skin. Click OK to override its settings.")) {
      foundDefaultSkin = true;
      this.RecordStatus = DesignCenter.recordStatus.Modified;

      /* Wrapper */
      this.Components[0].FontSize = 1;
      this.Components[0].RecordStatus = DesignCenter.recordStatus.Modified;

      /* Header */
      this.Components[1].FontColor = DesignCenter.themeJSON.SiteStyles[3].FontColor;
      this.Components[1].FontFamily = DesignCenter.themeJSON.SiteStyles[3].FontFamily;
      this.Components[1].FontVariant = DesignCenter.themeJSON.SiteStyles[3].FontVariant;
      this.Components[1].RecordStatus = DesignCenter.recordStatus.Modified;

      /* Item Title */
      this.Components[4].FontColor = DesignCenter.themeJSON.SiteStyles[3].FontColor;
      this.Components[4].FontFamily = DesignCenter.themeJSON.SiteStyles[3].FontFamily;
      this.Components[4].FontVariant = DesignCenter.themeJSON.SiteStyles[3].FontVariant;
      this.Components[4].RecordStatus = DesignCenter.recordStatus.Modified;

      /* View All Link */
      this.Components[9].PaddingBottom = { Value: ".5", Unit: "0" };
      this.Components[9].PaddingLeft = { Value: "2", Unit: "0" };
      this.Components[9].PaddingRight = { Value: "2", Unit: "0" };
      this.Components[9].PaddingTop = { Value: ".5", Unit: "0" };
      this.Components[9].LinkNormalColor = DesignCenter.themeJSON.ModuleStyle.Color5;
      this.Components[9].LinkVisitedColor = DesignCenter.themeJSON.ModuleStyle.Color5;
      this.Components[9].LinkNormalMiscellaneousStyles =
        "background-color: " + DesignCenter.themeJSON.ModuleStyle.Color10 + ";\ntransition: all ease-in-out .3s;";
      this.Components[9].LinkVisitedMiscellaneousStyles =
        "background-color: " + DesignCenter.themeJSON.ModuleStyle.Color10 + ";";
      this.Components[9].LinkHoverMiscellaneousStyles =
        "background-color: " + DesignCenter.themeJSON.ModuleStyle.Color11 + ";";
      this.Components[9].RecordStatus = DesignCenter.recordStatus.Modified;

      /* Tab */
      this.Components[13].RecordStatus = DesignCenter.recordStatus.Modified;
      /* (Normal) */
      this.Components[13].FontColor = DesignCenter.themeJSON.SiteStyles[0].FontColor;
      this.Components[13].FontFamily = DesignCenter.themeJSON.SiteStyles[3].FontFamily;
      this.Components[13].FontVariant = DesignCenter.themeJSON.SiteStyles[3].FontVariant;
      this.Components[13].FontSize = "1.3";
      this.Components[13].BackgroundColor = DesignCenter.themeJSON.ModuleStyle.Color5;
      this.Components[13].PaddingBottom = { Value: "1", Unit: "0" };
      this.Components[13].PaddingLeft = { Value: "2", Unit: "0" };
      this.Components[13].PaddingRight = { Value: "2", Unit: "0" };
      this.Components[13].PaddingTop = { Value: "1", Unit: "0" };
      /* (Selected) */
      this.Components[13].SelectedFontColor = DesignCenter.themeJSON.ModuleStyle.Color8;
      this.Components[13].SelectedBackgroundColor = DesignCenter.themeJSON.ModuleStyle.Color6;

      /* Tab Panel */
      this.Components[14].RecordStatus = DesignCenter.recordStatus.Modified;
      this.Components[14].PaddingBottom = { Value: "1", Unit: "0" };
      this.Components[14].PaddingTop = { Value: "1", Unit: "0" };
    }
  }
});
if (foundDefaultSkin) {
  saveTheme();
} else {
  alert("There is no skin named 'Default'. No changes were made.");
}
