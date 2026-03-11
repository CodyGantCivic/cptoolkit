alert(
  "This function is deprecated and will be removed in a future version. Let a web dev know if you are still using this."
);

var foundGraphicLinksSkin = false;
$.each(DesignCenter.themeJSON.WidgetSkins, function() {
  if (this.Name.indexOf("Graphic Links") !== -1) {
    if (confirm("Detected '" + this.Name + "' as Graphic Links widget skin. Click OK to override its settings.")) {
      foundGraphicLinksSkin = true;
      this.RecordStatus = DesignCenter.recordStatus.Modified;

      /* Wrapper */
      this.Components[0].RecordStatus = DesignCenter.recordStatus.Modified;
      this.Components[0].FontSize = 1;

      /* Item */
      this.Components[3].RecordStatus = DesignCenter.recordStatus.Modified;
      this.Components[3].PaddingBottom = { Value: null, Unit: "0" };
      this.Components[3].PaddingLeft = { Value: null, Unit: "0" };
      this.Components[3].PaddingRight = { Value: null, Unit: "0" };
      this.Components[3].PaddingTop = { Value: null, Unit: "0" };

      /* Column Separator */
      this.Components[15].RecordStatus = DesignCenter.recordStatus.Modified;
      this.Components[15].ColumnSeparatorWidth = "0";
      this.Components[15].DisplayColumnSeparator = false;
      this.Components[15].PaddingLeft = { Value: "0", Unit: "0" };
      this.Components[15].PaddingRight = { Value: "0", Unit: "0" };
    }
  }
});
if (foundGraphicLinksSkin) {
  saveTheme();
} else {
  alert("There is no skin with 'Graphic Links' in its name. No changes were made.");
}
