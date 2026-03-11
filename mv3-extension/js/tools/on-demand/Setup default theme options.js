alert(
  "This function is deprecated and will be removed in a future version. Let a web dev know if you are still using this."
);

function setDefaultSettings() {
  /* Menu Styles */
  $(DesignCenter.themeJSON.MenuStyles).each(function() {
    if (this.Name == "MainWrapper") {
      this.RecordStatus = 2;
      this.AdjustItemsToFillWidth = true;
      this.BackgroundColor = "";
      this.TextResizerRatio = "1";
      this.TextResizer = true;
    } else if (this.Name == "MainMainItem") {
      this.RecordStatus = 2;
      this.PaddingLeft = {
        Value: 0.5,
        Unit: 0
      };
      this.PaddingRight = {
        Value: 0.5,
        Unit: 0
      };
    } else if (this.Name == "SecondaryWrapper") {
      this.RecordStatus = 2;
      this.PaddingBottom = {
        Value: 1,
        Unit: 0
      };
      this.PaddingLeft = {
        Value: 0,
        Unit: 0
      };
      this.PaddingRight = {
        Value: 0,
        Unit: 0
      };
      this.PaddingTop = {
        Value: 1,
        Unit: 0
      };
      this.DisplaySubMenuIndicators = true;
      /* 0: Flyouts, 1: Accordian */
      this.SubMenuType = "1";
    } else if (this.Name == "SecondaryMenuItem1") {
      this.RecordStatus = 2;
      this.MiscellaneousStyles = "background-color: rgba(0,0,0,.2);";
    } else if (this.Name == "SecondaryMenuItem2") {
      this.RecordStatus = 2;
      this.MiscellaneousStyles = "background-color: rgba(0,0,0,.4);";
    } else if (this.Name == "SecondaryMenuItem3") {
      this.RecordStatus = 2;
      this.MiscellaneousStyles = "background-color: rgba(0,0,0,.6);";
    } else if (this.Name == "SecondaryMenuItem4") {
      this.RecordStatus = 2;
      this.MiscellaneousStyles = "background-color: rgba(0,0,0,.8);";
    }
  });
  /* Site Styles */
  $(DesignCenter.themeJSON.SiteStyles).each(function() {
    if (this.Selector == "body") {
      this.RecordStatus = 2;
      this.FontSize = "0.9";
      this.LineHeight = "1.5";
      this.MarginTop = {
        Value: null,
        Unit: 0
      };
    } else if (this.Selector == ".pageStyles p") {
      this.RecordStatus = 2;
      this.MarginTop = {
        Value: 0,
        Unit: 0
      };
    } else if (this.Selector == ".subhead1, .pageStyles h2, .moduleContentNew .subhead1") {
      this.RecordStatus = 2;
      this.MarginBottom = {
        Value: 0,
        Unit: 0
      };
    } else if (this.Selector == ".subhead2, .pageStyles h3, .moduleContentNew .subhead2") {
      this.RecordStatus = 2;
      this.MarginBottom = {
        Value: 0,
        Unit: 0
      };
    } else if (this.Selector == "a:link") {
      this.RecordStatus = 2;
      this.LinkHoverColor = null;
      this.LinkVisitedColor = this.LinkNormalColor;
    } else if (this.Selector == ".breadCrumbContainer") {
      this.RecordStatus = 2;
      this.DisplayBreadCrumbHome = true;
      this.DisplayBreadCrumbs = true;
    } else if (this.Selector == ".pageStyles hr") {
      this.RecordStatus = 2;
      this.BorderStyle = 1; /* 0: None, 1: Solid, 2: Dashed, 3: Dotted */
      this.BorderWidth = 1;
    }
  });

  /* Padding on containers */
  $(DesignCenter.themeJSON.ContainerStyles).each(function() {
    if (this.ContentContainerID == $("#featureColumn .contentContainerID").text()) {
      /* Feature Column */
      this.RecordStatus = 2;
      this.PaddingBottom = {
        Value: 1.5,
        Unit: 0
      };
      this.PaddingLeft = {
        Value: 1.5,
        Unit: 0
      };
      this.PaddingRight = {
        Value: 1.5,
        Unit: 0
      };
      this.PaddingTop = {
        Value: 1.5,
        Unit: 0
      };
    } else if (
      this.ContentContainerID ==
      $(".sidebar aside[data-cprole='contentContainer']")
        .first()
        .find(".contentContainerID")
        .text()
    ) {
      /* Container Above Secondary Nav */
      this.RecordStatus = 2;
      this.PaddingBottom = {
        Value: 1,
        Unit: 0
      };
      this.PaddingLeft = {
        Value: 2,
        Unit: 0
      };
      this.PaddingRight = {
        Value: 2,
        Unit: 0
      };
      this.PaddingTop = {
        Value: 1,
        Unit: 0
      };
    } else if (
      this.ContentContainerID ==
      $(".sidebar aside[data-cprole='contentContainer']")
        .last()
        .find(".contentContainerID")
        .text()
    ) {
      /* Container below secondary nav */
      this.RecordStatus = 2;
      this.PaddingBottom = {
        Value: 1,
        Unit: 0
      };
      this.PaddingLeft = {
        Value: 2,
        Unit: 0
      };
      this.PaddingRight = {
        Value: 2,
        Unit: 0
      };
      this.PaddingTop = {
        Value: 1,
        Unit: 0
      };
    } else if (
      this.ContentContainerID ==
      $(".contentWrap .contentContainerID")
        .last()
        .text()
    ) {
      /* Content Wrap (breadcrumbs/module content) */
      this.RecordStatus = 2;
      this.PaddingBottom = {
        Value: 1.5,
        Unit: 0
      };
      this.PaddingLeft = {
        Value: 1.5,
        Unit: 0
      };
      this.PaddingRight = {
        Value: 1.5,
        Unit: 0
      };
      this.PaddingTop = {
        Value: 1.5,
        Unit: 0
      };
    }
  });
  /* Reset heights on banners */
  $(DesignCenter.themeJSON.BannerStyles).each(function() {
    this.RecordStatus = 2;
    this.ImageHeight = {
      Unit: 1,
      Value: 0
    };
  });

  saveTheme();
}
setDefaultSettings();
