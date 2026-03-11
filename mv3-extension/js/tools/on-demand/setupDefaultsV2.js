/**
 * Setup Defaults V2 - Theme Configuration Tool
 * CivicPlus Toolkit - Manifest V3 Migration
 * 
 * This script configures professional default settings across the entire CivicPlus theme system:
 * - Site Styles (typography, spacing, colors)
 * - Menu Styles (main nav, secondary nav, mega menu, dropdowns)
 * - Banner Styles (header areas, logo padding)
 * - Container Styles (padding, margins, backgrounds)
 * - Widget Skins (default styles for widgets)
 * 
 * SiteStyle Map:
 *    body                         0
 *    p                            1
 *    h1                           2
 *    h2                           3
 *    h3                           4
 *    ol                           5
 *    ol > li                      6
 *    ul                           7
 *    ul > li                      8
 *    table                        9
 *    td                           10
 *    thead th                     11
 *    tbody th                     12
 *    .alt > td, .alt > th         13
 *    .alt > th                    14
 *    table > caption              15
 *    .imageBorder > img           16
 *    .imageBorder > figcaption    17
 *    a:link                       18
 *    BreadCrumbWrapper            19
 *    breadLeader                  20
 *    breadCrumb:link              21
 *    breadCrumbs li:before        22
 *    hr                           23
 *
 *
 * MenuStyles Map:
 *    MainWrapper                           0
 *    MainMainItem                          1
 *    MainMenuWrapper                       2
 *    MainMenuItem                          3
 *    MainSubMenuIndicator                  4
 *    MegaMenuWrapper                       5
 *    MegaMenuColumnSeparator               6
 *    SecondaryWrapper                      7
 *    SecondaryMainItem                     8
 *    SecondayMenuWrapper                   9
 *    SecondaryMenuItem                     10
 *    SecondarySubMenuIndicator             11
 *    SecondaryMainItemSubMenuIndicator     12
 *    SecondaryMenuWrapper1                 13
 *    SecondaryMenuItem1                    14
 *    SecondaryMenuWrapper2                 15
 *    SecondaryMenuItem2                    16
 *    SecondaryMenuWrapper3                 17
 *    SecondaryMenuItem3                    18
 *    SecondaryMenuWrapper4                 19
 *    SecondaryMenuItem4                    20
 *
 *
 * Skin map:
 *    Wrapper                               0
 *    Header                                1
 *    Item List                             2
 *    Item                                  3 ??
 *    Item Title                            4
 *    Item secondary text                   5 ??
 *    Item Bullets                          6 ??
 *    Item Link                             7 ??
 *    Read On                               8 ??
 *    View All                              9
 *    RSS Link                              10 ??
 *    Footer                                11 ??
 *    Tab List                              12
 *    Tab                                   13
 *    Tab Panel                             14
 *    Columns                               15
 *    Calendar Header                       16
 *    Calendar Grid                         17
 *    Calendar Day Headers                  18
 *    Calendar Day                          19
 *    Calendar Event Link                   20
 *    Calendar Today                        21
 *    Calendar Day Not In Current Month     22
 *    Calendar Wrapper                      23
 */

(function() {
  'use strict';

  console.log('[CP Toolkit] Setup Defaults V2 starting...');

  // Safety check: Verify we're on the Theme Manager page with DesignCenter available
  if (typeof DesignCenter === 'undefined' || !DesignCenter.themeJSON) {
    alert('[CP Toolkit] Error: DesignCenter is not available.\n\nThis tool must be run on the Theme Manager page.');
    console.error('[CP Toolkit] Setup Defaults V2 - DesignCenter not found');
    return;
  }

  // Safety check: Verify jQuery is available (needed for container selectors)
  // Use window.$ to avoid temporal dead zone issues with the const declaration below
  if (typeof window.$ === 'undefined' && typeof window.jQuery === 'undefined') {
    alert('[CP Toolkit] Error: jQuery is not available.\n\nPlease ensure you are on a CivicPlus page.');
    console.error('[CP Toolkit] Setup Defaults V2 - jQuery not found');
    return;
  }

  // Use jQuery reference from window to avoid scope conflicts
  const jQ = window.$ || window.jQuery;

  // Safety check: Verify saveTheme function exists
  if (typeof saveTheme !== 'function') {
    console.warn('[CP Toolkit] Warning: saveTheme function not found - changes may not be saveable');
  }

  const shouldIgnore = [
    "SiteStyleID",
    "ThemeID",
    "SiteStyleID",
    "Selector",
    "RecordStatus",
    "NumberStyle",
    "ModifiedOn",
    "ModifiedBy",
    "LeaderText",
    "ContentContainerID",
    "ParentId",
    "AnimationId",
    "ContentContainerID"
  ];

  // Properties that may not exist on all style objects - suppress warnings for these
  const optionalProperties = [
    "LinkNormalUnderlined",
    "LinkHoverUnderlined",
    "LinkVisitedUnderlined",
    "DisplayBreadCrumbs",
    "DisplayBreadCrumbHome",
    "DisplayBreadCrumbLeader",
    "BreadCrumbDivider",
    "DisplayTextResizer",
    "SterchToFullWidth",  // Note: This appears to be a typo in CivicPlus ("Stretch")
    "StretchToFullWidth"
  ];

  let madeChanges = false;
  const stat = DesignCenter.recordStatus;
  const ws = DesignCenter.themeJSON.WidgetSkins;
  const ss = DesignCenter.themeJSON.SiteStyles;
  const cs = DesignCenter.themeJSON.ContainerStyles;
  const ms = DesignCenter.themeJSON.MenuStyles;
  const bs = DesignCenter.themeJSON.BannerStyles;

  function copyStyles(to, from, debug = false) {
    if (to === null || from === null || typeof to !== "object" || typeof from !== "object") {
      console.warn("[CP Toolkit]: copyStyle - Invalid parameters");
      return to;
    }

    for (const [k, v] of Object.entries(from)) {
      if (debug) console.log(`${k}: ${v}`);
      if (shouldIgnore.indexOf(k) !== -1) continue;
      if (k === "LineHeight") {
        if (v > 0) {
          if (typeof from.HeaderMiscellaneousStyles1 === "string") {
            from.HeaderMiscellaneousStyles1 += `\nline-height: ${v}px;`;
          } else {
            from.HeaderMiscellaneousStyles1 = `line-height: ${v}px;`;
          }
        }
      } else if (k in to) {
        if (typeof v === "object" && v !== null) {
          to[k] = copyStyles(from[k], v);
        } else {
          if (debug) console.log(`SET: ${k}: ${v}`);

          to[k] = v;
        }
      } else {
        // Only warn for truly unexpected missing keys, not optional properties
        if (optionalProperties.indexOf(k) === -1) {
          console.warn(`[CP Toolkit] Key missing: ${k}`);
        }
      }
    }

    if (to.RecordStatus !== undefined) to.RecordStatus = stat.Modified;

    return to;
  }

  function getSpacingValues(type, vals, unit = "em") {
    const out = {
      top: null,
      bottom: null,
      left: null,
      right: null
    };

    switch (vals.length) {
      case 1:
        out.top = vals[0];
        out.right = vals[0];
        out.bottom = vals[0];
        out.left = vals[0];
        break;
      case 2:
        out.top = vals[0];
        out.right = vals[1];
        out.bottom = vals[0];
        out.left = vals[1];
        break;
      case 4:
        out.top = vals[0];
        out.right = vals[1];
        out.bottom = vals[2];
        out.left = vals[3];
        break;
      default:
        console.warn("[CP Toolkit]: getSpacingValues - Invalid parameters. 1, 2, or 4 values required.");
        return {};
    }

    function getUnitInt() {
      switch (unit) {
        case "em":
          return 0;
        case "px":
          return 1;
        case "%":
          return 2;
        default:
          return 0;
      }
    }

    const unitInt = getUnitInt();
    return {
      [`${type}Top`]: {
        Value: out.top,
        Unit: unitInt
      },
      [`${type}Right`]: {
        Value: out.right,
        Unit: unitInt
      },
      [`${type}Bottom`]: {
        Value: out.bottom,
        Unit: unitInt
      },
      [`${type}Left`]: {
        Value: out.left,
        Unit: unitInt
      }
    };
  }

  function getColor(i) {
    return DesignCenter.themeJSON.ModuleStyle.AllColors[i - 1];
  }

  // Declare variables that will be set by user prompts
  let filter, shouldSetupTheme, setSecondaryColor;
  // Variables for skipping styles that would override Figma colors (from apply-module-colors.js)
  let skipFigmaFontSizes = false;
  let skipFigmaSecondaryNav = false;

  function setupSiteStyles() {
    if (!shouldSetupTheme) {
      return;
    }
    madeChanges = true;

    /* Body */
    ss[0] = copyStyles(ss[0], {
      // Skip FontSize if preserving Figma font sizes
      ...(skipFigmaFontSizes ? {} : { FontSize: "0" }),
      LineHeight: "1.5"
    });

    /* Paragraph */
    ss[1] = copyStyles(ss[1], {
      ...getSpacingValues("Margin", [0, null, 1.4, null]),
      FontColor: null // This is an override for the color tool's error.
    });

    /* Headline */
    ss[2] = copyStyles(ss[2], {
      // Skip FontSize if preserving Figma font sizes
      ...(skipFigmaFontSizes ? {} : { FontSize: 2.25 }),
      MiscellaneousStyles: "line-height: 1.2;\n" + ss[2].MiscellaneousStyles
    });

    /* h2 */
    ss[3] = copyStyles(ss[3], {
      // Skip FontSize if preserving Figma font sizes
      ...(skipFigmaFontSizes ? {} : { FontSize: 1.5 }),
      ...getSpacingValues("Margin", [0.167, null, 0, null])
    });

    /* h3 */
    ss[4] = copyStyles(ss[4], {
      // Skip FontSize if preserving Figma font sizes
      ...(skipFigmaFontSizes ? {} : { FontSize: 1.3 }),
      ...getSpacingValues("Margin", [0, null, 0, null])
    });

    /* ol */
    ss[5] = copyStyles(ss[5], {
      ...getSpacingValues("Padding", [null, null, null, 2])
    });

    /* a:link */
    ss[18] = copyStyles(ss[18], {
      LinkVisitedColor: ss[18].LinkNormalColor
    });
    /* Bread Crumbs Wrapper */
    ss[19] = copyStyles(ss[19], {
      DisplayBreadCrumbHome: true,
      DisplayBreadCrumbs: true
    });

    /* Bread Crumbs Wrapper */
    ss[23] = copyStyles(ss[23], {
      BorderStyle: "1",
      BorderWidth: "1"
    });
  }

  function setupBannerStyles() {
    if (!shouldSetupTheme) return;
    madeChanges = true;

    bs.forEach((banner, i) => {
      if (banner.SlotName === "bannerLogoTS") {
        bs[i] = copyStyles(banner, {
          ...getSpacingValues("Padding", [.5, null])
        });
      }
    });
  }

  function setupMenuStyles() {
    if (!shouldSetupTheme) {
      return;
    }
    madeChanges = true;

    /* MM Width */
    ms[0] = copyStyles(ms[0], {
      AdjustItemsToFillWidth: true,
      BackgroundColor: null,
      TextResizer: false,
      TextResizerRatio: 1
    });

    // Main Item
    ms[1] = copyStyles(ms[1], {
      ...getSpacingValues("Padding", [1.5, .2])
    });

    const dropdownStyles = {
      FontFamily: ss[0].FontFamily,
      FontVariant: ss[0].FontVariant,
      BackgroundColor: getColor(6),
      FontColor: getColor(8),
      HoverBackgroundColor: getColor(9),
      HoverFontColor: getColor(6),
      LinkNormalUnderlined: false,
      LinkHoverUnderlined: true,
      ...getSpacingValues("Padding", [0.5, 1])
    };

    /* Main Dropdown */
    ms[3] = copyStyles(ms[3], {
      ...dropdownStyles
    });

    // Main submenu indicators
    ms[4] = copyStyles(ms[4], {
      DisplaySubMenuIndicators: true,
      MiscellaneousStyles: `\
padding-right: 5px;
`});

    // Secondary submenu indicators
    ms[11] = copyStyles(ms[11], {
      DisplaySubMenuIndicators: true,
      MiscellaneousStyles: `\
padding-right: 5px;
`});
    // Secondary main item submenu indicators
    ms[12] = copyStyles(ms[12], {
      DisplaySubMenuIndicators: true,
      MiscellaneousStyles: `\
padding-right: 10px;
`});

    /* MMWrapper */
    ms[5].RecordStatus = stat.Modified;
    DesignCenter.themeJSON.MegaMenuWidthReference = 1;
    ms[5] = copyStyles(ms[5], {
      MiscellaneousStyles: "padding: 1.5em;"
    });

    /* Secondary Wrapper - Always set SubMenuType for accordions */
    ms[7] = copyStyles(ms[7], {
      SubMenuType: 1
    });

    /* Main Style - Skip if preserving Figma secondary nav styles */
    const secondaryStyles = {
      FontFamily: ss[0].FontFamily,
      FontVariant: ss[0].FontVariant,
      FontSize: 1.1,
      FontColor: "#fff",
      HoverFontColor: "#fff",
      NormalUnderline: false,
      BackgroundColor: null,
      HoverBackgroundColor: null,
      HoverUnderline: true,
      HoverFontVariant: "",
      ...getSpacingValues("Padding", [0.85, 2])
    };

    /* Secondary Main Item - Skip if preserving Figma secondary nav styles */
    if (!skipFigmaSecondaryNav) {
      ms[8] = copyStyles(ms[8], {
        ...secondaryStyles
      });
    }

    /* Main Menu Item - DROPDOWN - Skip if preserving Figma secondary nav styles */
    if (!skipFigmaSecondaryNav) {
      ms[10] = copyStyles(ms[10], {
        ...dropdownStyles
      });
    }

    /* Secondary Menu Items - Skip if preserving Figma secondary nav styles */
    if (!skipFigmaSecondaryNav) {
      [14, 16, 18, 20].forEach((msID, i) => {
        ms[msID] = copyStyles(ms[msID], {
          ...secondaryStyles,
          MiscellaneousStyles: setSecondaryColor ? `background-color: rgba(0, 0, 0, ${(0.2 * (i + 1)).toFixed(2)});` : ""
        });
      });
    }
  }

  function setupContainerStyles() {
    function itemIsContainer(item, id) {
      return item.ContentContainerID === jQ(`${id} > .contentContainerID`).text();
    }

    if (!shouldSetupTheme) {
      return;
    }
    madeChanges = true;
    let contentOverlap = prompt("Negative margin on main content (px)?");
    if (!contentOverlap) contentOverlap = null;
    if (contentOverlap < 0) contentOverlap = -contentOverlap;

    cs.forEach((item, i) => {
      if (itemIsContainer(item, "#mainWrapTS")) {
        cs[i] = copyStyles(item, {
          BackgroundColor: "#fff",
          MiscellaneousStyles: contentOverlap === null ? cs[i].MiscellaneousStyles : `margin-top: -${contentOverlap}px;`
        });
      } else if (itemIsContainer(item, "#bannerContainerTS")) {
        cs[i] = copyStyles(item, {
          MiscellaneousStyles: "overflow: hidden;"
        });
      } else if (itemIsContainer(item, "#bannerSizingTS")) {
        cs[i] = copyStyles(item, {
          ...getSpacingValues("Padding", [null, null, contentOverlap, null], "px")
        });
      } else if (itemIsContainer(item, "#bannerContentTS")) {
        cs[i] = copyStyles(item, {
          MiscellaneousStyles: "min-height: 220px;",
          ...getSpacingValues("Padding", [1, null])
        });
      } else if (itemIsContainer(item, "#searchTS")) {
        cs[i] = copyStyles(item, {
          MiscellaneousStyles: "max-width: 415px;"
        });
      } else if (itemIsContainer(item, "#megaMenu")) {
        cs[i] = copyStyles(item, {
          DefaultWidgetSkinID: skinMap["Mega Menu"].skinIDs[0]
        });
      } else if (itemIsContainer(item, "#featureColumn")) {
        cs[i] = copyStyles(item, {
          BackgroundColor: null,
          DefaultWidgetSkinID: skinMap.Features.skinIDs[0] || 0,
          ...getSpacingValues("Padding", [0.75, 1.5]),
          ...getSpacingValues("Margin", [0.75, null])
        });
      } else if (itemIsContainer(item, ".contentWrap")) {
        cs[i] = copyStyles(item, {
          ...getSpacingValues("Padding", [1.5])
        });
      } else if (itemIsContainer(item, ".siteSidebar")) {
        // Skip sidebar background if preserving Figma secondary nav styles
        if (!skipFigmaSecondaryNav) {
          cs[i] = copyStyles(item, {
            BackgroundColor: setSecondaryColor ? getColor(3) : null
          });
        }
      } else if (itemIsContainer(item, "#moduleContent")) {
        cs[i] = copyStyles(item, {
          DefaultWidgetSkinID: skinMap.Default.skinIDs[0] || 0
        });
      } else if (itemIsContainer(item, "#gbsTS")) {
        cs[i] = copyStyles(item, {
          DefaultWidgetSkinID: skinMap["Graphic Buttons"].skinIDs[0] || 0
        });
      } else if (itemIsContainer(item, "#socialsTS")) {
        cs[i] = copyStyles(item, {
          MiscellaneousStyles: "max-width: 415px;",
          DefaultWidgetSkinID: skinMap["Social Media"].skinIDs[0] || skinMap["Graphic Buttons"].skinIDs[0] || 0
        });
      } else if (itemIsContainer(item, "#footerTS")) {
        cs[i] = copyStyles(item, {
          DefaultWidgetSkinID: skinMap.Footer.skinIDs[0] || 0
        });
      } else if (itemIsContainer(item, "#poweredByContainerTS")) {
        cs[i] = copyStyles(item, {
          DefaultWidgetSkinID: skinMap.Footer.skinIDs[0] || 0,
          MiscellaneousStyles: `\
}

@media (max-width: 40em) {
#poweredByContainerTS {
padding-bottom: 3.25em;
}`
        });
      }
    });
  }

  const viewAllStyles = {
    ...getSpacingValues("Padding", [0.75, 2]),
    LinkNormalMiscellaneousStyles: `\
background-color: ${getColor(3)};
transition: all .3s ease-in-out;
display: table;
margin: 1.25em auto;`,
    FontFamily: "Arial",
    FontVariant: "700",
    LinkNormalColor: "#fff",
    LinkVisitedColor: "#fff",
    LinkNormalUnderlined: false,
    LinkHoverUnderlined: true
  };

  function setupDefaultSkin(skin) {
    /* Wrapper */
    skin.Components[0] = copyStyles(skin.Components[0], {
      FontSize: null
    });

    /* Header/Item Title (matching) */
    skin.Components[1] = copyStyles(skin.Components[1], ss[3]);
    skin.Components[4] = copyStyles(skin.Components[4], ss[3]);

    /* View All */
    skin.Components[9] = copyStyles(skin.Components[9], viewAllStyles);

    /* Tab */
    skin.Components[13] = copyStyles(skin.Components[13], {
      FontFamily: ss[0].FontFamily,
      FontVariant: "700",
      FontSize: 1.2,
      HeaderMiscellaneousStyles1: `\
line-height: 1.2;
text-align: left;
text-transform: uppercase;
position: relative;
}

.widget.skin${skin.WidgetSkinID} .cpTabs > li:not(.active) > a:link:after {
border-top: 6px solid transparent;
border-bottom: 6px solid transparent;
border-left: 6px solid ${getColor(3)};
}

.widget.skin${skin.WidgetSkinID} .cpTabs > li.active > a:link:after {
border-left: 6px solid transparent;
border-right: 6px solid transparent;
border-top: 6px solid ${getColor(7)};
}

.widget.skin${skin.WidgetSkinID} .cpTabs > li > a:link::after {
content: "";
position: absolute;
left: 20px;
top: 50%;
transform: translate(0, -50%);
width: 0;
height: 0;`,
      LinkHoverUnderlined: true,
      SpaceBetweenTabs: 10,
      SpaceBetweenTabsUnits: "px",
      BackgroundColor: getColor(4),
      FontColor: getColor(3),
      SelectedBackgroundColor: getColor(3),
      SelectedFontColor: getColor(7),
      ...getSpacingValues("Padding", [0.65, 2.5])
    });

    /* Tab Panel */
    skin.Components[14] = copyStyles(skin.Components[14], {
      ...getSpacingValues("Padding", [1.5])
    });

    return skin;
  }

  function setupFeatureSkin(skin) {
    /* Wrapper */
    skin.Components[0] = copyStyles(skin.Components[0], {
      FontSize: null,
      ...getSpacingValues("Padding", [null, null, 2, null])
    });

    /* Header */
    skin.Components[1] = copyStyles(skin.Components[1], {
      ...getSpacingValues("Margin", [null, null, .5, null])
    });

    /* Item */
    skin.Components[3] = copyStyles(skin.Components[3], {
      ...getSpacingValues("Padding", [.25, null, .75, null])
    });

    /* View All */
    skin.Components[9] = copyStyles(skin.Components[9], viewAllStyles);

    /* Calendar Header */
    skin.Components[16] = copyStyles(skin.Components[16], {
      FontFamily: ss[2].FontFamily,
      FontVariant: ss[2].FontVariant,
      FontSize: 1.5,
      BackgroundColor: getColor(13),
      FontColor: getColor(7),
      TextAlignment: 3,
      Capitalization: 2,
      ...getSpacingValues("Padding", [0.75, 1])
    });

    /* Calendar Grid */
    skin.Components[17] = copyStyles(skin.Components[17], {
      BackgroundColor: getColor(1)
    });

    /* Calendar Day Headers*/
    skin.Components[18] = copyStyles(skin.Components[18], {
      FontFamily: ss[2].FontFamily,
      FontVariant: ss[2].FontVariant,
      BackgroundColor: getColor(6),
      FontColor: getColor(7),
      Capitalization: 2,
      HeaderMiscellaneousStyles1: `\
}
.widget.skin${skin.WidgetSkinID} .miniCalendar th abbr {
text-decoration: none;`,
      ...getSpacingValues("Padding", [0.75, null])
    });

    /* Calendar Day */
    skin.Components[19] = copyStyles(skin.Components[19], {
      FontFamily: ss[0].FontFamily,
      FontVariant: "700",
      FontColor: "#000",
      ...getSpacingValues("Padding", [0.75, null])
    });

    /* Calendar Event Link */
    skin.Components[20] = copyStyles(skin.Components[20], {
      FontFamily: ss[0].FontFamily,
      FontVariant: "700",
      FontColor: "#fff",
      LinkNormalMiscellaneousStyles: `\
background-size: contain;
position: relative;
z-index: 0;
}

.widget.skin${skin.WidgetSkinID} .miniCalendar td > a::after {
content: "";
position: absolute;
left: 50%;
top: 50%;
transform: translate(-50%, -50%);
width: 2em;
height: 2em;
border-radius: 50%;
z-index: -1;
background-color: ${getColor(6) || "#333"};
`,
      BackgroundImagePositionXUseKeyword: true,
      BackgroundImagePositionYUseKeyword: true,
      HoverBackgroundImagePositionXUseKeyword: true,
      HoverBackgroundImagePositionYUseKeyword: true,
      BackgroundImagePositionXKeyword: "1",
      BackgroundImagePositionYKeyword: "1",
      HoverBackgroundImagePositionXKeyword: "1",
      HoverBackgroundImagePositionYKeyword: "1",
      LinkHoverUnderlined: true
    });

    return skin;
  }

  function setupSocialsSkin(skin) {
    /* Wrapper */
    skin.Components[0] = copyStyles(skin.Components[0], {
      FontSize: null,
      MiscellaneousStyles: `\
}
.widget.skin${skin.WidgetSkinID} .widgetItem a {
  text-align: center !important;
  width:24px;
  margin:0 auto;
  position:relative;
  transition:all .3s ease-in-out;
  transform:scale(1);
}
  .widget.skin${skin.WidgetSkinID} .widgetItem a:is(:hover, :focus, :active){
    transform:scale(1.1);
  }
  `,
    });

    // Columns
    skin.Components[15] = copyStyles(skin.Components[15], {
      ...getSpacingValues("Padding", [0, .15])
    });

    return skin;
  }

  function setupMMSkin(skin) {
    /* Wrapper */
    skin.Components[0] = copyStyles(skin.Components[0], {
      FontSize: null
    });

    /* Item */
    skin.Components[3] = copyStyles(skin.Components[3], {
      MiscellaneousStyles: `\
}
.widget.skin${skin.WidgetSkinID} .megaMenuItem {
  padding: 6px 0;
  line-height: 1.3;`,
      ...getSpacingValues("Padding", [0.5, null])
    });

    /* Item Title */
    skin.Components[4] = copyStyles(skin.Components[4], {
      LinkNormalUnderlined: false,
      LinkHoverUnderlined: true,
      FontSize: 1.1
    });

    /* Item Link */
    skin.Components[7] = copyStyles(skin.Components[7], {
      LinkNormalUnderlined: false,
      LinkHoverUnderlined: true
    });

    return skin;
  }

  function setupGBSkin(skin) {
    /* Wrapper */
    skin.Components[0] = copyStyles(skin.Components[0], {
      FontSize: null
    });

    /* Header */
    skin.Components[1] = copyStyles(skin.Components[1], {
      ...getSpacingValues("Margin", [null])
    });

    /* Item */
    skin.Components[3] = copyStyles(skin.Components[3], {
      ...getSpacingValues("Padding", [0.35, null])
    });

    /* Columns */
    skin.Components[15] = copyStyles(skin.Components[15], {
      ...getSpacingValues("Padding", [null, 0])
    });

    return skin;
  }

  function setupFooterSkin(skin) {
    /* Wrapper */
    skin.Components[0] = copyStyles(skin.Components[0], {
      MiscellaneousStyles: `\
}
.row.outer:not(.wide) .widget.skin${skin.WidgetSkinID} {
  text-align: center !important;`,
      TextAlignment: 0,
      FontSize: null
    });

    /* Header */
    skin.Components[1] = copyStyles(skin.Components[1], {
      ...getSpacingValues("Margin", [1.5, null, 0.75, null])
    });

    /* Item */
    skin.Components[3] = copyStyles(skin.Components[3], {});

    /* Item Link */
    skin.Components[7] = copyStyles(skin.Components[7], {
      LinkNormalUnderlined: false,
      LinkHoverUnderlined: true
    });

    return skin;
  }

  const skinMap = {
    Default: {
      matching: ["default"],
      fn: setupDefaultSkin,
      skinIDs: []
    },
    Features: {
      matching: ["feat"],
      fn: setupFeatureSkin,
      skinIDs: []
    },
    "Social Media": {
      matching: ["social"],
      fn: setupSocialsSkin,
      skinIDs: []
    },
    "Mega Menu": {
      matching: ["mega", "menu", "mm"],
      fn: setupMMSkin,
      skinIDs: []
    },
    "Graphic Buttons": {
      matching: ["graphic", "gb"],
      fn: setupGBSkin,
      skinIDs: []
    },
    Footer: {
      matching: ["footer"],
      fn: setupFooterSkin,
      skinIDs: []
    }
  };

  // ============================================
  // Main Execution Flow
  // ============================================

  // User prompts
  filter = prompt("String to filter skins by? ");
  filter = !filter ? "" : filter.toLowerCase();

  shouldSetupTheme = confirm("Setup theme?");

  // Ask if user wants to skip styles that would override Figma colors (from apply-figma-styles.js)
  if (shouldSetupTheme && confirm("Skip styles that would override Figma colors?\n\nClick OK if you used 'Apply Figma Styles' tool.\nClick Cancel to apply all default styles.")) {
    skipFigmaFontSizes = confirm("Skip font sizes?\n\n• Normal Text (body)\n• Headline (h1)\n• Subhead 1 (h2)\n• Subhead 2 (h3)\n\nClick OK to preserve Figma font sizes.\nClick Cancel to apply default sizes.");
    skipFigmaSecondaryNav = confirm("Skip secondary nav styles?\n\n• Secondary nav menu items (colors, fonts, padding)\n• Sidebar container background (#siteSidebarTS)\n• Menu item background colors (MiscellaneousStyles)\n\nClick OK to preserve Figma styles.\nClick Cancel to apply default styles.");
  }

  // Only ask about secondary colors if not skipping Figma secondary nav
  setSecondaryColor = !skipFigmaSecondaryNav && confirm("Set secondary navigation colors? ");

  // Setup theme styles
  setupSiteStyles();
  setupMenuStyles();
  setupBannerStyles();

  // Process widget skins
  for (const skinName of Object.keys(skinMap)) {
    const skinType = skinMap[skinName];
    for (let i = 0; i < ws.length; i++) {
      const skin = ws[i];
      for (const matchElem of skinType.matching) {
        if (skin.Name.toLowerCase().indexOf(filter) !== -1 && skin.Name.toLowerCase().indexOf(matchElem) !== -1) {
          if (confirm(`Detected '${skin.Name}' as ${skinName} widget skin. Click OK to override its settings.`)) {
            skinType.skinIDs.push(skin.WidgetSkinID);
            ws[i] = skinType.fn(skin);
            ws[i].RecordStatus = stat.Modified;
            madeChanges = true;
          }

          break;
        }
      }
    }
  }

  // Setup container styles (after skins, so skinIDs are populated)
  setupContainerStyles();

  // Save or cancel
  if (madeChanges && confirm("Save changes? ")) {
    if (typeof saveTheme === 'function') {
      saveTheme();
      console.log('[CP Toolkit] Setup Defaults V2 - Theme saved successfully');
    } else {
      alert('[CP Toolkit] Warning: Could not save theme - saveTheme function not available.\n\nChanges have been applied but not saved. Please save manually.');
      console.warn('[CP Toolkit] Setup Defaults V2 - saveTheme function not available');
    }
  } else {
    alert("No changes were made.");
    console.log('[CP Toolkit] Setup Defaults V2 - No changes made or save cancelled');
  }

  console.log('[CP Toolkit] Setup Defaults V2 completed');

})();
