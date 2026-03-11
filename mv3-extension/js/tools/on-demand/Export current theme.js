function ToolkitExportTheme() {
  var themeJSON = JSON.parse(JSON.stringify(DesignCenter.themeJSON));

  /* Reset these variables and set them again on theme upload */
  themeJSON.ThemeID = null;
  themeJSON.StructureID = null;
  themeJSON.ModifiedBy = null;
  themeJSON.WidgetSkins = null;
  if (themeJSON.AnimationContentHash !== "") {
    alert("It looks like this theme may have animations active. These will not be exported.");
    /* TODO: log that animations are not copied over */
  }
  themeJSON.AnimationContentHash = "";
  themeJSON.AnimationFileName = "Animations-.css";
  themeJSON.AnimationsStyleFileID = null;
  themeJSON.ContentHash = null;
  themeJSON.FileName = null;
  $.each(themeJSON.MenuStyles, function() {
    this.MenuStyleID = null;
    this.ThemeID = null;
    this.RecordStatus = DesignCenter.recordStatus.Modified;
  });
  $.each(themeJSON.SiteStyles, function() {
    this.SiteStyleID = null;
    this.ThemeID = null;
    this.RecordStatus = DesignCenter.recordStatus.Modified;
  });
  themeJSON.ModuleStyle.ModuleStyleID = null;
  themeJSON.ModuleStyle.ThemeID = null;
  themeJSON.ModuleStyle.RecordStatus = DesignCenter.recordStatus.Modified;

  themeJSON.CreatedBy = null;
  themeJSON.CreatedOn = null;
  themeJSON.Name = themeJSON.Name + " imported";

  $.each(themeJSON.BannerOptions, function() {
    this.BannerImages = [
      {
        BannerImageID: 1,
        BannerOptionID: null,
        FileName: "EmptyBannerBkg201301091010127149.png",
        Height: 50,
        Width: 50,
        StartingOn: null,
        StoppingOn: null,
        IsLink: false,
        LinkAddress: null,
        Sequence: 1,
        RecordStatus: 0,
        ModifiedBy: 0,
        ModifiedOn: "0001-01-01 12:00:00",
        AltText: null
      }
    ];
    this.BannerVideos = [
      {
        BannerVideoID: 2,
        BannerOptionID: null,
        VideoFileName: "",
        ImageFileName: "EmptyBannerBkg201806291215069694.png",
        IsLink: false,
        LinkAddress: null,
        ModifiedBy: 0,
        ModifiedOn: "0001-01-01 12:00:00",
        VideoFileID: "00000000-0000-0000-0000-000000000000",
        ImageFileID: "00000000-0000-0000-0000-000000000000",
        VideoWidth: 0,
        VideoHeight: 0,
        ImageWidth: 0,
        ImageHeight: 0,
        LinkedVideoUrl: "",
        RecordStatus: 0,
        AltText: null
      }
    ];
    this.BannerOptionID = null;
    this.BannerThemeID = null;
    this.RecordStatus = DesignCenter.recordStatus.Modified;
  });
  $.each(themeJSON.BannerStyles, function() {
    this.BannerStyleID = null;
    this.ThemeID = null;
    this.RecordStatus = DesignCenter.recordStatus.Modified;
  });

  $.each(themeJSON.Fonts, function() {
    this.RecordStatus = DesignCenter.recordStatus.Modified;
  });

  /* Set the ContainerStyles to names that match XML */
  $.each(themeJSON.ContainerStyles, function() {
    this.AnimationId = "00000000-0000-0000-0000-000000000000";
    /* this.BackgroundImageFileName = ""; */
    if (this.BackgroundImageFileName !== "") {
      /* TODO: Create list of all background file names to fix and where at */
    }
    if (this.HoverBackgroundImageFileName !== "") {
    }
    this.RecordStatus = DesignCenter.recordStatus.Modified;
    var currentThemeJSONcontainerStyle = this;
    var didSwitchContainer = false;
    $.each(DesignCenter.structureJSON.ContentContainers, function() {
      if (this.ContentContainerID == currentThemeJSONcontainerStyle.ContentContainerID) {
        currentThemeJSONcontainerStyle.ContentContainerID = this.ExternalID;
        didSwitchContainer = true;
      }
    });
    if (!didSwitchContainer) {
      console.warn("Could not match ID: " + this.ContentContainerID);
    }
  });

  return themeJSON;
}
function downloadObjectAsJson_ts(exportObj, exportName) {
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
  var downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", exportName + ".json");
  document.body.appendChild(downloadAnchorNode); /* required for firefox */
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}
downloadObjectAsJson_ts(
  ToolkitExportTheme(),
  window.location.hostname.replace(".civicplus.com", "") + " " + DesignCenter.themeJSON.Name
);
