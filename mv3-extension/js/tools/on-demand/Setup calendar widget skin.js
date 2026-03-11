var foundCalendarSkin = false;
$.each(DesignCenter.themeJSON.WidgetSkins, function() {
  if (this.Name.indexOf("Calendar") !== -1) {
    if (confirm("Detected '" + this.Name + "' as Calendar widget skin. Click OK to override its settings.")) {
      foundCalendarSkin = true;
      this.RecordStatus = DesignCenter.recordStatus.Modified;

      /* Wrapper */
      this.Components[0].FontSize = 1;
      this.Components[0].RecordStatus = DesignCenter.recordStatus.Modified;

      if (
        confirm(
          "Would you like to add a base style to the view all button? This will override styles on the current view all button."
        )
      ) {
        /* View All Link */
        this.Components[9].PaddingBottom = { Value: ".5", Unit: "0" };
        this.Components[9].PaddingLeft = { Value: "2", Unit: "0" };
        this.Components[9].PaddingRight = { Value: "2", Unit: "0" };
        this.Components[9].PaddingTop = { Value: ".5", Unit: "0" };
        this.Components[9].LinkHoverMiscellaneousStyles =
          "background-color: " + DesignCenter.themeJSON.ModuleStyle.Color5 + ";";
        this.Components[9].LinkNormalMiscellaneousStyles =
          "background-color: " + DesignCenter.themeJSON.ModuleStyle.Color10 + ";\ntransition: all ease-in-out .3s;";
        this.Components[9].RecordStatus = DesignCenter.recordStatus.Modified;
      }

      /* Calendar Wrapper */
      this.Components[23].RecordStatus = DesignCenter.recordStatus.Modified;
      this.Components[23].PaddingBottom = { Value: "1", Unit: "0" };
      this.Components[23].PaddingLeft = { Value: "1", Unit: "0" };
      this.Components[23].PaddingRight = { Value: "1", Unit: "0" };
      this.Components[23].PaddingTop = { Value: "1", Unit: "0" };
      this.Components[23].MarginBottom = { Value: "1", Unit: "0" };
      /* Stuff for circle behind dates with links */
      this.Components[23].MiscellaneousStyles =
        "}\n.widget.skin" +
        this.WidgetSkinID +
        " .miniCalendar td>a {\nposition: relative;\nz-index: 0;\n}\n.widget.skin" +
        this.WidgetSkinID +
        ' .miniCalendar td>a:after {\ncontent: "";\nposition: absolute;\ntop: 50%;\nleft: 50%;\nwidth: 2em;\nheight: 2em;\nbackground-color: #000;\ntransform: translateX(-50%) translateY(-50%);\nz-index: -1;\nborder-radius: 50%;';

      /* Calendar Header */
      this.Components[16].RecordStatus = DesignCenter.recordStatus.Modified;
      this.Components[16].MiscellaneousStyles =
        "}\n.widget.skin" + this.WidgetSkinID + " .miniCalendar th abbr {\ntext-decoration: none;";
      this.Components[16].TextAlignment = "3";
      this.Components[16].FontSize = "1.5";
      this.Components[16].PaddingTop = { Value: "1", Unit: "0" };
      this.Components[16].PaddingBottom = { Value: "1", Unit: "0" };

      /* Calendar Day Headers */
      this.Components[18].RecordStatus = DesignCenter.recordStatus.Modified;
      this.Components[18].MiscellaneousStyles =
        "}\n.widget.skin" + this.WidgetSkinID + " .miniCalendar th abbr {\ntext-decoration: none;";
      this.Components[18].PaddingTop = { Value: ".8", Unit: "0" };
      this.Components[18].PaddingBottom = { Value: ".8", Unit: "0" };

      /* Calendar Day */
      this.Components[19].RecordStatus = DesignCenter.recordStatus.Modified;
      this.Components[19].PaddingTop = { Value: ".8", Unit: "0" };
      this.Components[19].PaddingBottom = { Value: ".8", Unit: "0" };

      /* Calendar Event Link */
      this.Components[20].RecordStatus = DesignCenter.recordStatus.Modified;
      this.Components[20].FontColor = "#fff";
    }
  }
});
if (foundCalendarSkin) {
  saveTheme();
} else {
  alert("There is no skin with 'Calendar' in its name. No changes were made.");
}
