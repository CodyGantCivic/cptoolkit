var copyOfOriginalDesignCenterThemeJSON = JSON.parse(JSON.stringify(DesignCenter.themeJSON));

function ToolkitParseUploadedTheme(themeJSON) {
  // Create a copy of the themeJSON passed in
  var themeJSONupload = JSON.parse(JSON.stringify(themeJSON));

  themeJSONupload.ThemeID = copyOfOriginalDesignCenterThemeJSON.ThemeID;
  themeJSONupload.StructureID = copyOfOriginalDesignCenterThemeJSON.StructureID;
  themeJSONupload.ModifiedBy = copyOfOriginalDesignCenterThemeJSON.ModifiedBy;
  themeJSONupload.WidgetSkins = copyOfOriginalDesignCenterThemeJSON.WidgetSkins;

  themeJSONupload.ModuleStyle.ModuleStyleID = copyOfOriginalDesignCenterThemeJSON.ModuleStyle.ModuleStyleID;
  themeJSONupload.ModuleStyle.ThemeID = copyOfOriginalDesignCenterThemeJSON.ModuleStyle.ThemeID;

  themeJSONupload.FileName = copyOfOriginalDesignCenterThemeJSON.FileName;
  themeJSONupload.ContentHash = copyOfOriginalDesignCenterThemeJSON.ContentHash;

  themeJSONupload.CreatedBy = copyOfOriginalDesignCenterThemeJSON.CreatedBy;
  themeJSONupload.CreatedOn = copyOfOriginalDesignCenterThemeJSON.CreatedOn;

  var newContainerStyles = [];

  // Need to keep in same order
  $.each(DesignCenter.themeJSON.ContainerStyles, function() {
    var nonUploadedContainerStyle = this;

    var thisExternalId = null;
    $.each(DesignCenter.structureJSON.ContentContainers, function() {
      if (nonUploadedContainerStyle.ContentContainerID == this.ContentContainerID) {
        thisExternalId = this.ExternalID;
      }
    });

    $.each(themeJSONupload.ContainerStyles, function() {
      if (this.ContentContainerID == thisExternalId) {
        this.ContentContainerID = nonUploadedContainerStyle.ContentContainerID;
        this.DefaultWidgetSkinID = 0;
        this.ThemeID = copyOfOriginalDesignCenterThemeJSON.ModuleStyle.ThemeID;
        console.log(
          "Resetting widget skin ID on '" + this.ContentContainerID + "'. It was " + this.DefaultWidgetSkinID
        );

        newContainerStyles.push(this);
      }
    });
  });

  themeJSONupload.ContainerStyles = newContainerStyles;

  $.each(themeJSONupload.SiteStyles, function() {
    var uploadedSiteStyle = this;
    $.each(copyOfOriginalDesignCenterThemeJSON.SiteStyles, function() {
      if (this.Selector == uploadedSiteStyle.Selector) {
        uploadedSiteStyle.SiteStyleID = this.SiteStyleID;
        uploadedSiteStyle.ThemeID = this.ThemeID;
      }
    });
  });
  $.each(themeJSONupload.MenuStyles, function() {
    var uploadedSiteStyle = this;
    $.each(copyOfOriginalDesignCenterThemeJSON.MenuStyles, function() {
      if (this.Name == uploadedSiteStyle.Name) {
        uploadedSiteStyle.MenuStyleID = this.MenuStyleID;
        uploadedSiteStyle.ThemeID = this.ThemeID;
      }
    });
  });
  $.each(themeJSONupload.BannerOptions, function() {
    var uploadedSiteStyle = this;
    $.each(copyOfOriginalDesignCenterThemeJSON.BannerOptions, function() {
      if (this.SlotName == uploadedSiteStyle.SlotName) {
        uploadedSiteStyle.BannerOptionID = this.BannerOptionID;
        uploadedSiteStyle.BannerThemeID = this.BannerThemeID;
        uploadedSiteStyle.BannerImages = this.BannerImages;
        uploadedSiteStyle.BannerVideos = this.BannerVideos;
      }
    });
  });
  $.each(themeJSONupload.BannerStyles, function() {
    var uploadedSiteStyle = this;
    $.each(copyOfOriginalDesignCenterThemeJSON.BannerStyles, function() {
      if (this.SlotName == uploadedSiteStyle.SlotName) {
        uploadedSiteStyle.BannerStyleID = this.BannerStyleID;
        uploadedSiteStyle.ThemeID = this.ThemeID;
      }
    });
  });
  return themeJSONupload;
}

var shouldImportTheme_ts = confirm(
  "Importing a theme will override all styles associated with the current theme. You must manually upload the correct XML/CSS for this theme before importing."
);

if (shouldImportTheme_ts) {
  // Remove existing modal if any
  $("#toolkitThemeImportOverlay").remove();

  var overlay = $(
    "<div id='toolkitThemeImportOverlay' style='position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;'>" +
      "<div style='background:#fff;border-radius:8px;width:500px;max-width:90vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,0.3);'>" +
        // Header
        "<div style='padding:16px 20px;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;justify-content:space-between;'>" +
          "<h2 style='margin:0;font-size:18px;font-weight:600;color:#333;'>Import Theme JSON</h2>" +
          "<button id='toolkitThemeImportClose' type='button' style='background:none;border:none;font-size:24px;cursor:pointer;color:#666;padding:0;line-height:1;'>&times;</button>" +
        "</div>" +
        // Body
        "<div style='padding:20px;overflow-y:auto;flex:1;'>" +
          "<p style='margin:0 0 16px;font-size:14px;color:#555;line-height:1.5;'>Select a previously exported theme JSON file to import. This will override all styles on the current theme.</p>" +
          "<label style='display:block;margin-bottom:8px;font-size:13px;font-weight:500;color:#333;'>Theme JSON File</label>" +
          "<input type='file' id='toolkitThemeJSONUpload' accept='.json,application/json' style='width:100%;padding:10px 12px;border:2px dashed #ccc;border-radius:4px;font-size:14px;box-sizing:border-box;cursor:pointer;' />" +
          "<p style='margin:12px 0 0;font-size:12px;color:#888;font-style:italic;'>Make sure you have uploaded the correct XML/CSS for this theme before importing.</p>" +
        "</div>" +
        // Footer
        "<div style='padding:16px 20px;border-top:1px solid #e0e0e0;display:flex;justify-content:flex-end;gap:8px;'>" +
          "<button id='toolkitThemeImportCancel' type='button' style='padding:10px 20px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;background:#e0e0e0;color:#333;'>Cancel</button>" +
          "<button id='toolkitThemeImportBtn' type='button' style='padding:10px 20px;border:none;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;background:#af282f;color:#fff;'>Import Theme</button>" +
        "</div>" +
      "</div>" +
    "</div>"
  ).appendTo("body");

  function closeThemeImportModal() {
    $("#toolkitThemeImportOverlay").remove();
  }

  // Close on ×, Cancel, backdrop click, Escape
  $("#toolkitThemeImportClose").on("click", closeThemeImportModal);
  $("#toolkitThemeImportCancel").on("click", closeThemeImportModal);
  overlay.on("click", function(e) {
    if (e.target === overlay[0]) closeThemeImportModal();
  });
  $(document).on("keydown.toolkitThemeImport", function(e) {
    if (e.key === "Escape") {
      closeThemeImportModal();
      $(document).off("keydown.toolkitThemeImport");
    }
  });

  $("#toolkitThemeImportBtn").on("click", function() {
    var input = document.getElementById("toolkitThemeJSONUpload");
    var file = input && input.files ? input.files[0] : null;

    if (!file) {
      alert("Choose a .json file first.");
      return;
    }

    var reader = new FileReader();
    reader.readAsText(file);

    reader.onloadend = function(e) {
      try {
        console.log("Loaded new theme JSON. Parsing...");
        var data = JSON.parse(e.target.result);
        var parsedThemeData = ToolkitParseUploadedTheme(data);
        console.log(parsedThemeData);

        DesignCenter.themeJSON = parsedThemeData;

        if (
          confirm(
            "Are you SURE that you want to override the current theme with the uploaded theme? Click OK to continue or Cancel to cancel."
          )
        ) {
          saveTheme(true);
          setTimeout(function() {
            saveThemeStyleSheet(true);
          }, 2000);
        }
      } catch (err) {
        alert("Failed to parse theme JSON: " + err.message);
      } finally {
        closeThemeImportModal();
        $(document).off("keydown.toolkitThemeImport");
      }
    };
  });
}
