/**
 * Apply Module Colors from Figma JSON
 *
 * This tool allows you to upload a Figma JSON export and automatically:
 * - Populate Module_Color1..13 from Rectangle 7..19
 * - Apply Table BACKGROUND styles from specific rectangles (via DesignCenter.themeJSON.SiteStyles):
 *   - Rectangle 28 → Table Header Cells (column, row, alternate rows) BackgroundColor
 *   - Rectangle 33 → Table Wrapper BackgroundColor
 *   - Rectangle 37 → Table Cells (alternate rows) BackgroundColor
 * - Apply Table BORDER styles from specific rectangles:
 *   - Rectangle 28 → Table Header Cells (column, row, alternate rows) BorderColor, BorderWidth, BorderStyle
 * - Apply TEXT/FONT styles from Figma text style nodes (FRAME nodes with TEXT children):
 *   - "headline" → Headline (h1) FontColor, FontFamily, FontSize
 *   - "subhead-1" → Subhead 1 (h2) FontColor, FontFamily, FontSize
 *   - "subhead-2" → Subhead 2 (h3) FontColor, FontFamily, FontSize
 *   - "normal-text" → Normal Text (body) FontColor, FontFamily, FontSize
 *   - "link" → Link (a:link) and Breadcrumb Links FontColor, FontFamily, FontSize
 *   - "one" → Table Header Cells (column, row, alternate rows) FontColor only
 * - Apply SIDEBAR CONTAINER styles from rectangles (via DesignCenter.themeJSON.ContainerStyles):
 *   - Rectangle 53 → .siteSidebar ContainerStyle BackgroundColor
 * - Apply MAIN NAV styles from Figma text nodes (via DesignCenter.themeJSON.MenuStyles):
 *   - "nav-item" → MainMainItem FontColor, FontFamily, FontSize
 * - Apply SECONDARY NAV styles from rectangles (via DesignCenter.themeJSON.MenuStyles):
 *   - Rectangle 54 → SecondaryMainItem HoverBg + SecondaryMenuItem1 Bg
 *   - Rectangle 57 → SecondaryMenuItem1 HoverBg + SecondaryMenuItem2 Bg
 *   - Rectangle 61 → SecondaryMenuItem2 HoverBg + SecondaryMenuItem3 Bg
 *   - Rectangle 67 → SecondaryMenuItem3 HoverBg
 *   - "sub-navigation-links" → Secondary nav font color + family
 *
 * SiteStyles Index Reference:
 *   1  = .pageStyles p (Normal Text)
 *   2  = .headline, .pageStyles h1 (Headline)
 *   3  = .subhead1, .pageStyles h2 (Subhead 1)
 *   4  = .subhead2, .pageStyles h3 (Subhead 2)
 *   18 = a:link (Link)
 *   9  = table (Table Wrapper)
 *   10 = td (Table Cells)
 *   11 = thead th (Table Header Cells - column)
 *   12 = tbody th (Table Header Cells - row)
 *   13 = .alt > td, .alt > th (Table Cells alternate)
 *   14 = .alt > th (Table Header Cells alternate rows)
 *   15 = table > caption (Table Caption)
 *
 * MenuStyles Index Reference:
 *   Main Navigation:
 *   0  = MainWrapper (main nav wrapper)
 *   1  = MainMainItem (Main Item default) - gets font styles from Figma
 *   2  = MainMenuWrapper (menu wrapper)
 *   3  = MainMenuItem (dropdown menu item)
 *   4  = MainSubMenuIndicator (sub-menu indicators)
 *   5  = MegaMenuWrapper (mega menu wrapper)
 *   6  = MegaMenuColumnSeparator (mega menu column separator)
 *
 *   Secondary Navigation:
 *   7  = SecondaryWrapper (siteSidebar background)
 *   8  = SecondaryMainItem (Main Style) - gets font colors from Figma
 *   10 = SecondaryMenuItem (Main Menu Item) - colors CLEARED (no bg/font)
 *   14 = SecondaryMenuItem1 (Level 1)
 *   16 = SecondaryMenuItem2 (Level 2)
 *   18 = SecondaryMenuItem3 (Level 3)
 *
 * @requires Theme Manager page (/DesignCenter/Themes/)
 */
(function() {
  'use strict';

  const TOOL_NAME = '[CP Toolkit] Apply Figma Styles';
  const OVERLAY_ID = 'cp-toolkit-apply-figma-styles-overlay';
  const STORAGE_KEY = 'cp-toolkit-figma-styles-warnings';

  // ==================== TOAST NOTIFICATION ====================
  function showToast(message, type = 'warning') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      background: ${type === 'error' ? '#d32f2f' : type === 'success' ? '#388e3c' : '#f57c00'};
      color: #fff;
      padding: 16px 24px;
      border-radius: 6px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      font-family: Arial, Helvetica, sans-serif;
      font-size: 14px;
      max-width: 400px;
      line-height: 1.5;
      cursor: pointer;
    `;
    toast.innerHTML = message;
    toast.title = 'Click to dismiss';
    toast.addEventListener('click', () => toast.remove());
    document.body.appendChild(toast);

    // Auto-dismiss after 10 seconds
    setTimeout(() => toast.remove(), 10000);
  }

  // Check for stored warnings from previous session (shown after refresh)
  const storedWarnings = sessionStorage.getItem(STORAGE_KEY);
  if (storedWarnings) {
    sessionStorage.removeItem(STORAGE_KEY);
    try {
      const warnings = JSON.parse(storedWarnings);
      if (warnings.length > 0) {
        const warningList = warnings.map(w => `• ${w}`).join('<br>');
        showToast(`<strong>Apply Figma Styles</strong><br>The following items were not found in the Figma file:<br>${warningList}`, 'warning');
      }
    } catch (e) {
      console.error(TOOL_NAME, 'Failed to parse stored warnings:', e);
    }
  }

  // Prevent duplicate overlays
  if (document.getElementById(OVERLAY_ID)) {
    const existing = document.getElementById(OVERLAY_ID);
    existing.style.display = existing.style.display === 'none' ? 'flex' : 'none';
    return;
  }

  // ==================== TABLE STYLE MAPPINGS ====================
  // Maps rectangle numbers to SiteStyles array indices for BACKGROUND COLOR
  // SiteStyles Map:
  //   9  = table (Table Wrapper)
  //   10 = td (Table Cells)
  //   11 = thead th (Table Header Cells - column)
  //   12 = tbody th (Table Header Cells - row)
  //   13 = .alt > td, .alt > th (Table Cells alternate)
  //   14 = .alt > th (Table Header Cells alternate rows)
  //   15 = table > caption (Table Caption)
  const TABLE_STYLE_MAPPINGS = [
    {
      rectangle: 28,
      targets: [
        { siteStyleIndex: 11, name: 'Table Header Cells (column)' },
        { siteStyleIndex: 12, name: 'Table Header Cells (row)' },
        { siteStyleIndex: 14, name: 'Table Header Cells (alternate rows)' }
      ]
    },
    {
      rectangle: 33,
      targets: [
        { siteStyleIndex: 9, name: 'Table Wrapper' }
      ]
    },
    {
      rectangle: 37,
      targets: [
        { siteStyleIndex: 13, name: 'Table Cells (alternate rows)' }
      ]
    }
  ];

  // ==================== BORDER STYLE MAPPINGS ====================
  // Maps rectangle numbers to SiteStyles array indices for BORDER styles
  // Border properties: BorderStyle (0=None,1=Solid,2=Dashed,3=Dotted), BorderWidth (px), BorderColor (hex)
  const BORDER_STYLE_MAPPINGS = [
    {
      rectangle: 28,
      targets: [
        { siteStyleIndex: 11, name: 'Table Header Cells (column)' },
        { siteStyleIndex: 12, name: 'Table Header Cells (row)' },
        { siteStyleIndex: 14, name: 'Table Header Cells (alternate rows)' }
      ]
    },
    {
      rectangle: 33,
      targets: [
        { siteStyleIndex: 10, name: 'Table Cells' }
      ]
    }
  ];

  // ==================== ADVANCED BORDER STYLE MAPPINGS ====================
  // Maps rectangle numbers to SiteStyles that need border in MiscellaneousStyles (advanced styles)
  // Used when the SiteStyle doesn't have standard border properties
  const ADVANCED_BORDER_STYLE_MAPPINGS = [
    {
      rectangle: 37,
      targets: [
        { siteStyleIndex: 13, name: 'Table Cells (alternate rows)' }
      ]
    }
  ];

  // ==================== TEXT STYLE MAPPINGS ====================
  // Maps Figma text style node names to SiteStyles array indices for font properties
  // Font properties: FontColor (hex), FontFamily (string), FontSize (number)
  // SiteStyles Map (from DesignCenter.themeJSON.SiteStyles):
  //   0  = body (Normal Text - Text tab)
  //   1  = .pageStyles p (Normal Text - Paragraph Spacing tab)
  //   2  = .headline, .pageStyles h1 (Headline)
  //   3  = .subhead1, .pageStyles h2 (Subhead 1)
  //   4  = .subhead2, .pageStyles h3 (Subhead 2)
  //   18 = a:link (Link)
  //   19 = .breadcrumbWrapper (Breadcrumb Wrapper)
  //   21 = .breadCrumb:link,.breadCrumb:visited, etc. (Breadcrumb Links)
  //   11 = thead th (Table Header Cells - column) font color
  //   12 = tbody th (Table Header Cells - row) font color
  //   14 = .alt > th (Table Header Cells - alternate rows) font color
  const TEXT_STYLE_MAPPINGS = [
    {
      figmaNodeName: 'headline',
      siteStyleIndex: 2,
      name: 'Headline (h1)'
    },
    {
      figmaNodeName: 'subhead-1',
      siteStyleIndex: 3,
      name: 'Subhead 1 (h2)'
    },
    {
      figmaNodeName: 'subhead-2',
      siteStyleIndex: 4,
      name: 'Subhead 2 (h3)'
    },
    {
      figmaNodeName: 'normal-text',
      siteStyleIndex: 0,
      name: 'Normal Text (body)'
    },
    // SiteStyles[1] (.pageStyles p) intentionally skipped — that record controls
    // paragraph spacing (margins) only. Its FontFamily must stay empty so <p>
    // elements inherit font from the body rule. Writing font here causes a
    // specificity override that breaks the CMS Theme Manager's Normal Text modal.
    {
      figmaNodeName: 'normal-text',
      siteStyleIndex: 19,
      name: 'Breadcrumb Wrapper (.breadcrumbWrapper)'
    },
    {
      figmaNodeName: 'link',
      siteStyleIndex: 18,
      name: 'Link (a:link)',
      fontColorOnly: true,
      useLinkColorProperties: true
    },
    {
      figmaNodeName: 'link',
      siteStyleIndex: 21,
      name: 'Breadcrumb Links',
      fontColorOnly: true,
      enableUnderline: true
    },
    {
      figmaNodeName: 'one',
      siteStyleIndex: 11,
      name: 'Table Header (column) font',
      fontColorOnly: true
    },
    {
      figmaNodeName: 'one',
      siteStyleIndex: 12,
      name: 'Table Header (row) font',
      fontColorOnly: true
    },
    {
      figmaNodeName: 'one',
      siteStyleIndex: 14,
      name: 'Table Header (alt rows) font',
      fontColorOnly: true
    }
  ];

  // ==================== SIDEBAR CONTAINER STYLE MAPPINGS ====================
  // Maps Figma rectangle to ContainerStyles for sidebar background
  // Rectangle 53 → .siteSidebar container BackgroundColor
  const SIDEBAR_CONTAINER_STYLE_MAPPINGS = [
    {
      rectangle: 53,
      containerSelector: '.siteSidebar',
      property: 'BackgroundColor',
      name: 'Sidebar Container (.siteSidebar)'
    }
  ];

  // ==================== SECONDARY NAV STYLE MAPPINGS ====================
  // Maps Figma rectangle names to MenuStyles array indices for secondary navigation
  // MenuStyles Map (from DesignCenter.themeJSON.MenuStyles):
  //   7  = SecondaryWrapper (nav wrapper - no background)
  //   8  = SecondaryMainItem (Main Style)
  //   10 = SecondaryMenuItem (Main Menu Item) - NO background or font colors applied here
  //   14 = SecondaryMenuItem1 (Level 1)
  //   16 = SecondaryMenuItem2 (Level 2)
  //   18 = SecondaryMenuItem3 (Level 3)
  //   20 = SecondaryMenuItem4 (Level 4)
  // NOTE: Secondary Menu Item (10) gets NO background colors - only Main Style and Level 1+ get colors
  const SECONDARY_NAV_STYLE_MAPPINGS = [
    {
      rectangle: 54,
      targets: [
        { menuStyleIndex: 8, property: 'HoverBackgroundColor', name: 'Secondary Main Item (hover)' },
        { menuStyleIndex: 14, property: 'BackgroundColor', name: 'Secondary Level 1' }
      ]
    },
    {
      rectangle: 57,
      targets: [
        { menuStyleIndex: 14, property: 'HoverBackgroundColor', name: 'Secondary Level 1 (hover)' },
        { menuStyleIndex: 16, property: 'BackgroundColor', name: 'Secondary Level 2' }
      ]
    },
    {
      rectangle: 61,
      targets: [
        { menuStyleIndex: 16, property: 'HoverBackgroundColor', name: 'Secondary Level 2 (hover)' },
        { menuStyleIndex: 18, property: 'BackgroundColor', name: 'Secondary Level 3' }
      ]
    },
    {
      rectangle: 67,
      targets: [
        { menuStyleIndex: 18, property: 'HoverBackgroundColor', name: 'Secondary Level 3 (hover)' }
      ]
    }
  ];

  // ==================== SECONDARY NAV FONT STYLE MAPPINGS ====================
  // Maps Figma text node to MenuStyles for font color and family
  // "sub-navigation-links" text node contains the font styles for secondary nav items
  // NOTE: SecondaryMenuItem (10 / Main Menu Item) intentionally excluded - colors cleared separately
  const SECONDARY_NAV_FONT_STYLE_MAPPINGS = [
    {
      figmaNodeName: 'sub-navigation-links',
      targets: [
        { menuStyleIndex: 8, name: 'Secondary Main Item (Main Style)' },
        { menuStyleIndex: 14, name: 'Secondary Level 1' },
        { menuStyleIndex: 16, name: 'Secondary Level 2' },
        { menuStyleIndex: 18, name: 'Secondary Level 3' }
      ]
    }
  ];

  // ==================== SECONDARY NAV PADDING SETTINGS ====================
  // Padding values to apply to secondary nav menu items (from setupDefaultsV2.js)
  // Values are in em: 0.85em top/bottom, 2em left/right
  const SECONDARY_NAV_PADDING = {
    targets: [
      { menuStyleIndex: 8, name: 'Secondary Main Item' },
      { menuStyleIndex: 14, name: 'Secondary Level 1' },
      { menuStyleIndex: 16, name: 'Secondary Level 2' },
      { menuStyleIndex: 18, name: 'Secondary Level 3' }
    ],
    values: {
      PaddingTop: { Value: 0.85, Unit: 0 },
      PaddingBottom: { Value: 0.85, Unit: 0 },
      PaddingLeft: { Value: 2, Unit: 0 },
      PaddingRight: { Value: 2, Unit: 0 }
    }
  };

  // ==================== MAIN NAV FONT STYLE MAPPINGS ====================
  // Maps Figma text node to MenuStyles for main navigation font styles
  // "nav-item" text node contains the font styles for the main nav items
  const MAIN_NAV_FONT_STYLE_MAPPINGS = [
    {
      figmaNodeName: 'nav-item',
      targets: [
        { menuStyleIndex: 1, name: 'Main Item (default)' }
      ]
    }
  ];

  // ==================== UTILITY FUNCTIONS ====================

  /**
   * Normalize a node name for matching
   */
  function normalizeNameForMatch(n) {
    return (n || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  }

  /**
   * Check if a node name matches the target name
   */
  function nameMatchesTarget(nodeName, targetName) {
    if (!nodeName || !targetName) return false;
    const nn = normalizeNameForMatch(nodeName);
    const tn = normalizeNameForMatch(targetName);
    const targetTokens = tn.split(' ').filter(Boolean);
    const nodeTokens = new Set(nn.split(' ').filter(Boolean));
    
    if (targetTokens.every(t => nodeTokens.has(t))) return true;
    
    const numMatch = tn.match(/\d+/);
    if (numMatch) {
      const n = numMatch[0];
      const regex = new RegExp(`\\b(rect|rectangle|r)\\W*${n}\\b`, 'i');
      if (regex.test(nodeName)) return true;
    }
    
    if (nn.includes(tn)) return true;
    return false;
  }

  /**
   * Find a node by name with tolerant matching
   */
  function findNodeByNameTolerant(root, targetName) {
    if (!root) return null;
    try {
      if (typeof root.name === 'string' && nameMatchesTarget(root.name, targetName)) return root;
      for (const k of Object.keys(root)) {
        const v = root[k];
        if (Array.isArray(v)) {
          for (const c of v) {
            const f = findNodeByNameTolerant(c, targetName);
            if (f) return f;
          }
        } else if (v && typeof v === 'object') {
          const f = findNodeByNameTolerant(v, targetName);
          if (f) return f;
        }
      }
    } catch (e) { /* ignore malformed nodes */ }
    return null;
  }

  /**
   * Find a node by EXACT name match (used for text styles to avoid "headline" matching "headline-2")
   * Also checks structure.name for exported JSON formats
   * IMPORTANT: Prefers FRAME nodes with children over TEXT label nodes
   */
  function findNodeByNameExact(root, targetName) {
    if (!root) return null;
    const normalizedTarget = normalizeNameForMatch(targetName);
    const matches = [];

    // Collect all matching nodes
    function collectMatches(obj) {
      if (!obj || typeof obj !== 'object') return;
      try {
        let matched = false;
        // Check direct name property
        if (typeof obj.name === 'string') {
          const normalizedNode = normalizeNameForMatch(obj.name);
          if (normalizedNode === normalizedTarget) {
            matches.push(obj);
            matched = true;
          }
        }
        // Also check structure.name (common in exported Figma JSON)
        if (!matched && obj.structure && typeof obj.structure.name === 'string') {
          const normalizedNode = normalizeNameForMatch(obj.structure.name);
          if (normalizedNode === normalizedTarget) {
            matches.push(obj);
          }
        }
        // Recurse into children and properties
        for (const k of Object.keys(obj)) {
          const v = obj[k];
          if (Array.isArray(v)) {
            for (const c of v) collectMatches(c);
          } else if (v && typeof v === 'object') {
            collectMatches(v);
          }
        }
      } catch (e) { /* ignore malformed nodes */ }
    }

    collectMatches(root);

    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];

    // Prefer FRAME nodes with children (actual style containers) over TEXT nodes (labels)
    // A FRAME with children contains the actual text styles we want
    const frameWithChildren = matches.find(m =>
      m.type === 'FRAME' && Array.isArray(m.children) && m.children.length > 0
    );
    if (frameWithChildren) return frameWithChildren;

    // Fallback: prefer any FRAME over TEXT
    const frameNode = matches.find(m => m.type === 'FRAME');
    if (frameNode) return frameNode;

    // Last resort: return first match
    return matches[0];
  }

  /**
   * Find a style object by ID in the Figma JSON
   */
  function findStyleObjectById(root, styleId) {
    if (!root) return null;
    const normalizedTarget = String(styleId || '');
    const targetCore = normalizedTarget.replace(/^[A-Za-z]:/, '');
    let found = null;

    function walk(o) {
      if (!o || typeof o !== 'object' || found) return;
      if (o.id && (String(o.id) === normalizedTarget || String(o.id).replace(/^[A-Za-z]:/, '') === targetCore)) {
        if (o.paints || o.fills || o.color) {
          found = o;
          return;
        }
      }
      for (const k of Object.keys(o)) {
        if (k === normalizedTarget || k.replace(/^[A-Za-z]:/, '') === targetCore) {
          const candidate = o[k];
          if (candidate && (candidate.paints || candidate.fills || candidate.color)) {
            found = candidate;
            return;
          }
        }
      }
      for (const k of Object.keys(o)) {
        const v = o[k];
        if (Array.isArray(v)) {
          for (const it of v) walk(it);
        } else if (v && typeof v === 'object') {
          walk(v);
        }
        if (found) return;
      }
    }
    walk(root);
    return found;
  }

  /**
   * Parse a color value from various formats
   */
  function parseColorValue(val) {
    if (val === null || typeof val === 'undefined') return null;

    // String formats
    if (typeof val === 'string') {
      const s = val.trim();

      // rgb(...) or rgba(...)
      const rgbMatch = s.match(/rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,\s]\s*([\d.]+))?\s*\)/i);
      if (rgbMatch) {
        const rRaw = Number(rgbMatch[1]), gRaw = Number(rgbMatch[2]), bRaw = Number(rgbMatch[3]);
        const anyGreaterThanOne = (rRaw > 1) || (gRaw > 1) || (bRaw > 1);
        const r = anyGreaterThanOne ? Math.round(rRaw) : Math.round(rRaw * 255);
        const g = anyGreaterThanOne ? Math.round(gRaw) : Math.round(gRaw * 255);
        const b = anyGreaterThanOne ? Math.round(bRaw) : Math.round(bRaw * 255);
        return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
      }

      // Hex like #fff or #ffffff
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) {
        return s.length === 4 ? '#' + s.slice(1).split('').map(c => c + c).join('') : s.toLowerCase();
      }

      // Try to parse numbers in string "1 29 77" etc.
      const nums = s.match(/[-+]?\d+(\.\d+)?/g);
      if (nums && nums.length >= 3) {
        const rRaw = Number(nums[0]), gRaw = Number(nums[1]), bRaw = Number(nums[2]);
        const anyGreaterThanOne = (rRaw > 1) || (gRaw > 1) || (bRaw > 1);
        const r = anyGreaterThanOne ? Math.round(rRaw) : Math.round(rRaw * 255);
        const g = anyGreaterThanOne ? Math.round(gRaw) : Math.round(gRaw * 255);
        const b = anyGreaterThanOne ? Math.round(bRaw) : Math.round(bRaw * 255);
        return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
      }

      return null;
    }

    // Object with r,g,b fields
    if (typeof val === 'object') {
      const c = val;
      if ('r' in c && 'g' in c && 'b' in c) {
        const rRaw = Number(c.r), gRaw = Number(c.g), bRaw = Number(c.b);
        const anyGreaterThanOne = (rRaw > 1) || (gRaw > 1) || (bRaw > 1);
        const r = anyGreaterThanOne ? Math.round(rRaw) : Math.round(rRaw * 255);
        const g = anyGreaterThanOne ? Math.round(gRaw) : Math.round(gRaw * 255);
        const b = anyGreaterThanOne ? Math.round(bRaw) : Math.round(bRaw * 255);
        return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
      }
      if ('red' in c && 'green' in c && 'blue' in c) {
        const r = Math.round(Number(c.red)), g = Math.round(Number(c.green)), b = Math.round(Number(c.blue));
        return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
      }
    }

    return null;
  }

  /**
   * Extract color from a paint array
   */
  function extractColorFromPaintArray(paints) {
    if (!Array.isArray(paints) || paints.length === 0) return null;
    for (const p of paints) {
      if (!p) continue;
      if ((p.type === 'SOLID' || p.paintType === 'SOLID') && p.color) {
        const parsed = parseColorValue(p.color);
        if (parsed) return parsed;
      }
      if (p.color) {
        const parsed = parseColorValue(p.color);
        if (parsed) return parsed;
      }
      if (p.value) {
        const parsed = parseColorValue(p.value);
        if (parsed) return parsed;
      }
      if (p.colorHex || p.hex) {
        const parsed = parseColorValue(p.colorHex || p.hex);
        if (parsed) return parsed;
      }
    }
    return null;
  }

  /**
   * Extract color from a Figma node (handles various JSON structures)
   */
  function extractColorFromNode(node, figmaJson) {
    if (!node) return null;
    
    let colorHex = null;

    // Try node.fills first
    if (Array.isArray(node.fills) && node.fills.length > 0) {
      colorHex = extractColorFromPaintArray(node.fills);
      if (colorHex) return colorHex;
    }

    // Try node.styles.bg or node.style.bg (common in exported JSON)
    const styleObjCandidates = [];
    if (node.styles) styleObjCandidates.push(node.styles);
    if (node.style) styleObjCandidates.push(node.style);
    
    const directProps = ['bg', 'background', 'fill', 'bgColor', 'backgroundColor', 'background_color'];
    let foundDirect = null;
    
    for (const s of styleObjCandidates) {
      for (const k of Object.keys(s || {})) {
        if (directProps.includes(k) || /bg|background|fill|color/i.test(k)) {
          foundDirect = s[k];
          if (foundDirect) break;
        }
      }
      if (foundDirect) break;
    }
    
    // Also check direct properties on node
    if (!foundDirect && typeof node.bg !== 'undefined') foundDirect = node.bg;
    if (!foundDirect && typeof node.background !== 'undefined') foundDirect = node.background;
    
    if (foundDirect) {
      colorHex = parseColorValue(foundDirect);
      if (colorHex) return colorHex;
    }

    // Try style references
    const styleCandidates = [];
    if (node.fillStyleId) styleCandidates.push({ key: 'fillStyleId', id: node.fillStyleId });
    if (node.fillStyleIds && Array.isArray(node.fillStyleIds) && node.fillStyleIds.length) {
      styleCandidates.push({ key: 'fillStyleIds', id: node.fillStyleIds[0] });
    }
    if (node.styleId) styleCandidates.push({ key: 'styleId', id: node.styleId });
    if (node.styles && node.styles.fill) styleCandidates.push({ key: 'styles.fill', id: node.styles.fill });
    if (node.styles && node.styles.bg) styleCandidates.push({ key: 'styles.bg', id: node.styles.bg });
    if (node.fill) styleCandidates.push({ key: 'fill', id: node.fill });

    for (const cand of styleCandidates) {
      if (!cand.id) continue;
      const styleObj = findStyleObjectById(figmaJson, cand.id);
      if (styleObj) {
        const paints = styleObj.paints || styleObj.fills || styleObj.value || styleObj.paint || styleObj.styles || null;
        const hex = extractColorFromPaintArray(Array.isArray(paints) ? paints : (paints && paints.paints ? paints.paints : []));
        if (hex) return hex;
        
        const fallbackColor = parseColorValue(styleObj.color || styleObj.value || styleObj.bg || styleObj.background || styleObj.fills || null);
        if (fallbackColor) return fallbackColor;
      }
    }

    // Try descendant fills
    let descendantColor = null;
    function searchDescendants(o) {
      if (!o || descendantColor) return;
      if (Array.isArray(o.fills) && o.fills.length > 0) {
        const h = extractColorFromPaintArray(o.fills);
        if (h) {
          descendantColor = h;
          return;
        }
      }
      for (const k of Object.keys(o)) {
        const v = o[k];
        if (Array.isArray(v)) {
          for (const it of v) {
            if (descendantColor) return;
            searchDescendants(it);
          }
        } else if (v && typeof v === 'object') {
          if (descendantColor) return;
          searchDescendants(v);
        }
      }
    }
    searchDescendants(node);
    if (descendantColor) return descendantColor;

    return null;
  }

  /**
   * Set a color to a Module_Color input
   */
  function setColorToModuleInput(i, color) {
    const inputId = `Module_Color${i}`;
    const input = document.querySelector(`#${inputId}`);
    if (!input) {
      return { success: false, reason: 'Input not found' };
    }
    try {
      input.value = color || '';
      input.style.display = '';
      const parent = input.parentElement;
      if (parent) {
        const replacer = parent.querySelector('.sp-replacer');
        if (replacer) {
          const previewInner = replacer.querySelector('.sp-preview-inner');
          if (previewInner) previewInner.style.backgroundColor = color || 'transparent';
          replacer.classList.remove('default');
        }
        const clearA = parent.querySelector('.clearValue');
        if (clearA) clearA.style.display = '';
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  /**
   * Set a color to a SiteStyle entry (table background color)
   * @param {number} siteStyleIndex - Index in DesignCenter.themeJSON.SiteStyles array
   * @param {string} color - Hex color value
   */
  function setColorToSiteStyle(siteStyleIndex, color) {
    if (typeof DesignCenter === 'undefined' || !DesignCenter.themeJSON || !DesignCenter.themeJSON.SiteStyles) {
      return { success: false, reason: 'DesignCenter.themeJSON.SiteStyles not available' };
    }
    
    const siteStyles = DesignCenter.themeJSON.SiteStyles;
    if (siteStyleIndex < 0 || siteStyleIndex >= siteStyles.length) {
      return { success: false, reason: `SiteStyle index ${siteStyleIndex} out of range (0-${siteStyles.length - 1})` };
    }
    
    try {
      const style = siteStyles[siteStyleIndex];
      style.BackgroundColor = color || null;
      
      // Mark as modified so saveTheme() will include it
      if (typeof DesignCenter.recordStatus !== 'undefined') {
        style.RecordStatus = DesignCenter.recordStatus.Modified;
      } else {
        style.RecordStatus = 2; // 2 = Modified
      }
      
      return { success: true };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  /**
   * Extract border info from a Figma node
   * Returns { color: '#hex', width: number, style: number } or null
   * Style: 0=None, 1=Solid, 2=Dashed, 3=Dotted
   */
  function extractBorderFromNode(node, figmaJson) {
    if (!node) return null;
    
    let borderInfo = {
      color: null,
      width: null,
      style: 1 // Default to Solid if we find a border
    };
    
    // Try to find stroke/border info in various Figma JSON formats
    
    // Check node.strokes (common Figma format)
    if (Array.isArray(node.strokes) && node.strokes.length > 0) {
      for (const stroke of node.strokes) {
        if (stroke && stroke.type === 'SOLID' && stroke.color) {
          borderInfo.color = parseColorValue(stroke.color);
          break;
        }
        if (stroke && stroke.color) {
          borderInfo.color = parseColorValue(stroke.color);
          break;
        }
      }
    }
    
    // Check node.strokeWeight for width
    if (typeof node.strokeWeight === 'number') {
      borderInfo.width = Math.round(node.strokeWeight);
    }
    
    // Check node.styles.stroke or node.style.stroke for style reference
    if (node.styles && node.styles.stroke) {
      const styleObj = findStyleObjectById(figmaJson, node.styles.stroke);
      if (styleObj) {
        const paints = styleObj.paints || styleObj.strokes || [];
        if (Array.isArray(paints)) {
          for (const p of paints) {
            if (p && p.color) {
              borderInfo.color = parseColorValue(p.color);
              break;
            }
          }
        }
      }
    }
    
    // Check for border in styles object (exported JSON format)
    if (node.styles) {
      // Handle border as an object: { width: 1, color: "rgb(...)" }
      if (node.styles.border && typeof node.styles.border === 'object') {
        if (node.styles.border.color) {
          borderInfo.color = parseColorValue(node.styles.border.color);
        }
        if (node.styles.border.width !== undefined) {
          borderInfo.width = parseInt(node.styles.border.width, 10);
        }
        if (node.styles.border.style) {
          const styleMap = { 'solid': 1, 'dashed': 2, 'dotted': 3, 'none': 0 };
          borderInfo.style = styleMap[node.styles.border.style.toLowerCase()] || 1;
        }
      }
      // Handle border as a string (color only)
      else if (node.styles.border && typeof node.styles.border === 'string') {
        borderInfo.color = parseColorValue(node.styles.border);
      }
      if (node.styles.borderColor) {
        borderInfo.color = parseColorValue(node.styles.borderColor);
      }
      if (node.styles.borderWidth !== undefined) {
        borderInfo.width = parseInt(node.styles.borderWidth, 10);
      }
      if (node.styles.strokeWidth !== undefined) {
        borderInfo.width = parseInt(node.styles.strokeWidth, 10);
      }
    }
    
    // Check direct properties
    if (node.border) {
      borderInfo.color = parseColorValue(node.border);
    }
    if (node.borderColor) {
      borderInfo.color = parseColorValue(node.borderColor);
    }
    if (node.borderWidth !== undefined) {
      borderInfo.width = parseInt(node.borderWidth, 10);
    }
    if (node.stroke) {
      borderInfo.color = parseColorValue(node.stroke);
    }
    
    // Check for strokeDashes to determine style
    if (Array.isArray(node.strokeDashes) && node.strokeDashes.length > 0) {
      // Has dashes - determine if dashed or dotted
      const dashLength = node.strokeDashes[0];
      if (dashLength <= 2) {
        borderInfo.style = 3; // Dotted
      } else {
        borderInfo.style = 2; // Dashed
      }
    }
    
    // Only return if we found at least a color or width
    if (borderInfo.color || borderInfo.width) {
      return borderInfo;
    }
    
    return null;
  }

  /**
   * Set border styles to a SiteStyle entry
   * @param {number} siteStyleIndex - Index in DesignCenter.themeJSON.SiteStyles array
   * @param {object} borderInfo - { color: '#hex', width: number, style: number }
   */
  function setBorderToSiteStyle(siteStyleIndex, borderInfo) {
    if (typeof DesignCenter === 'undefined' || !DesignCenter.themeJSON || !DesignCenter.themeJSON.SiteStyles) {
      return { success: false, reason: 'DesignCenter.themeJSON.SiteStyles not available' };
    }
    
    const siteStyles = DesignCenter.themeJSON.SiteStyles;
    if (siteStyleIndex < 0 || siteStyleIndex >= siteStyles.length) {
      return { success: false, reason: `SiteStyle index ${siteStyleIndex} out of range (0-${siteStyles.length - 1})` };
    }
    
    try {
      const style = siteStyles[siteStyleIndex];
      
      // Set border properties
      if (borderInfo.color) {
        style.BorderColor = borderInfo.color;
      }
      if (borderInfo.width !== null && borderInfo.width !== undefined) {
        style.BorderWidth = borderInfo.width;
      }
      if (borderInfo.style !== null && borderInfo.style !== undefined) {
        style.BorderStyle = borderInfo.style; // 0=None, 1=Solid, 2=Dashed, 3=Dotted
      }
      
      // Mark as modified so saveTheme() will include it
      if (typeof DesignCenter.recordStatus !== 'undefined') {
        style.RecordStatus = DesignCenter.recordStatus.Modified;
      } else {
        style.RecordStatus = 2; // 2 = Modified
      }
      
      return { success: true };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  /**
   * Set border styles to a SiteStyle entry via MiscellaneousStyles (advanced styles)
   * Used when the SiteStyle doesn't have standard border properties
   * @param {number} siteStyleIndex - Index in DesignCenter.themeJSON.SiteStyles array
   * @param {object} borderInfo - { color: '#hex', width: number, style: number }
   */
  function setBorderToSiteStyleAdvanced(siteStyleIndex, borderInfo) {
    if (typeof DesignCenter === 'undefined' || !DesignCenter.themeJSON || !DesignCenter.themeJSON.SiteStyles) {
      return { success: false, reason: 'DesignCenter.themeJSON.SiteStyles not available' };
    }

    const siteStyles = DesignCenter.themeJSON.SiteStyles;
    if (siteStyleIndex < 0 || siteStyleIndex >= siteStyles.length) {
      return { success: false, reason: `SiteStyle index ${siteStyleIndex} out of range (0-${siteStyles.length - 1})` };
    }

    try {
      const style = siteStyles[siteStyleIndex];

      // Build border CSS
      const styleNames = ['none', 'solid', 'dashed', 'dotted'];
      const borderStyle = styleNames[borderInfo.style] || 'solid';
      const borderWidth = (borderInfo.width !== null && borderInfo.width !== undefined) ? borderInfo.width : 1;
      const borderColor = borderInfo.color || '#000000';

      const borderCss = `border: ${borderWidth}px ${borderStyle} ${borderColor};`;

      // Get existing MiscellaneousStyles or start fresh
      let miscStyles = style.MiscellaneousStyles || '';

      // Remove any existing border declaration to avoid duplicates
      miscStyles = miscStyles.replace(/border\s*:\s*[^;]+;?\s*/gi, '');

      // Add our border CSS
      miscStyles = miscStyles.trim();
      if (miscStyles && !miscStyles.endsWith(';')) {
        miscStyles += ';';
      }
      miscStyles += ' ' + borderCss;

      style.MiscellaneousStyles = miscStyles.trim();

      // Mark as modified so saveTheme() will include it
      if (typeof DesignCenter.recordStatus !== 'undefined') {
        style.RecordStatus = DesignCenter.recordStatus.Modified;
      } else {
        style.RecordStatus = 2; // 2 = Modified
      }

      return { success: true, css: borderCss };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  /**
   * Set a color to a MenuStyle entry (for secondary nav)
   * @param {number} menuStyleIndex - Index in DesignCenter.themeJSON.MenuStyles array
   * @param {string} property - Property to set (e.g., 'BackgroundColor', 'HoverBackgroundColor')
   * @param {string} color - Hex color value
   */
  function setColorToMenuStyle(menuStyleIndex, property, color) {
    if (typeof DesignCenter === 'undefined' || !DesignCenter.themeJSON || !DesignCenter.themeJSON.MenuStyles) {
      return { success: false, reason: 'DesignCenter.themeJSON.MenuStyles not available' };
    }

    const menuStyles = DesignCenter.themeJSON.MenuStyles;
    if (menuStyleIndex < 0 || menuStyleIndex >= menuStyles.length) {
      return { success: false, reason: `MenuStyle index ${menuStyleIndex} out of range (0-${menuStyles.length - 1})` };
    }

    try {
      const style = menuStyles[menuStyleIndex];
      style[property] = color || null;

      // Mark as modified so saveTheme() will include it
      if (typeof DesignCenter.recordStatus !== 'undefined') {
        style.RecordStatus = DesignCenter.recordStatus.Modified;
      } else {
        style.RecordStatus = 2; // 2 = Modified
      }

      return { success: true };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  /**
   * Set a color to a ContainerStyle entry by selector
   * @param {string} containerSelector - CSS selector to match (e.g., '.siteSidebar')
   * @param {string} property - Property to set (e.g., 'BackgroundColor')
   * @param {string} color - Hex color value
   */
  function setColorToContainerStyle(containerSelector, property, color) {
    if (typeof DesignCenter === 'undefined' || !DesignCenter.themeJSON || !DesignCenter.themeJSON.ContainerStyles) {
      return { success: false, reason: 'DesignCenter.themeJSON.ContainerStyles not available' };
    }

    const containerStyles = DesignCenter.themeJSON.ContainerStyles;

    // Find container by checking if its element matches the selector
    // ContainerStyles have ContentContainerID which maps to DOM elements
    let foundContainer = null;
    let foundIndex = -1;
    let containerIdFromDom = null;

    // For .siteSidebar, we need the STRUCTURAL container (#siteSidebarTS),
    // not a content container inside it (#sidebarContainer1TS)
    // The structural container's .contentContainerID is a DIRECT child
    if (containerSelector === '.siteSidebar') {
      // Look for the structural container's own .contentContainerID (direct child)
      const structuralEl = document.querySelector('#siteSidebarTS > .contentContainerID');
      if (structuralEl) {
        containerIdFromDom = (structuralEl.textContent || structuralEl.innerText).trim();
      }
    } else {
      // For other selectors, try direct child first, then any descendant
      const directChildEl = document.querySelector(`${containerSelector} > .contentContainerID`);
      if (directChildEl) {
        containerIdFromDom = (directChildEl.textContent || directChildEl.innerText).trim();
      } else {
        const descendantEl = document.querySelector(`${containerSelector} .contentContainerID`);
        if (descendantEl) {
          containerIdFromDom = (descendantEl.textContent || descendantEl.innerText).trim();
        }
      }
    }

    // Find the matching ContainerStyle by ContentContainerID
    if (containerIdFromDom) {
      for (let i = 0; i < containerStyles.length; i++) {
        if (containerStyles[i].ContentContainerID === containerIdFromDom) {
          foundContainer = containerStyles[i];
          foundIndex = i;
          break;
        }
      }
    }

    if (!foundContainer) {
      return { success: false, reason: `Container matching "${containerSelector}" not found (looked for ID: ${containerIdFromDom || 'none'})` };
    }

    try {
      foundContainer[property] = color || null;

      // Mark as modified so saveTheme() will include it
      if (typeof DesignCenter.recordStatus !== 'undefined') {
        foundContainer.RecordStatus = DesignCenter.recordStatus.Modified;
      } else {
        foundContainer.RecordStatus = 2; // 2 = Modified
      }

      return { success: true, containerIndex: foundIndex, containerId: containerIdFromDom };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  /**
   * Set font styles to a MenuStyle entry
   * @param {number} menuStyleIndex - Index in DesignCenter.themeJSON.MenuStyles array
   * @param {object} fontInfo - { color: '#hex', family: 'string', size: number, weight: 'string' }
   */
  function setFontStyleToMenuStyle(menuStyleIndex, fontInfo) {
    if (typeof DesignCenter === 'undefined' || !DesignCenter.themeJSON || !DesignCenter.themeJSON.MenuStyles) {
      return { success: false, reason: 'DesignCenter.themeJSON.MenuStyles not available' };
    }

    const menuStyles = DesignCenter.themeJSON.MenuStyles;
    if (menuStyleIndex < 0 || menuStyleIndex >= menuStyles.length) {
      return { success: false, reason: `MenuStyle index ${menuStyleIndex} out of range (0-${menuStyles.length - 1})` };
    }

    try {
      const style = menuStyles[menuStyleIndex];
      const applied = [];

      // Set font color
      if (fontInfo.color) {
        style.FontColor = fontInfo.color;
        applied.push(`FontColor: ${fontInfo.color}`);
      }

      // Set font family
      if (fontInfo.family) {
        style.FontFamily = fontInfo.family;
        applied.push(`FontFamily: ${fontInfo.family}`);
      }

      // Set font weight (as FontVariant - "700" for bold, "regular" for normal, etc.)
      if (fontInfo.weight) {
        style.FontVariant = fontInfo.weight;
        applied.push(`FontVariant: ${fontInfo.weight}`);
      }

      // Set font size (convert px to em: 1em = 16px)
      if (fontInfo.size !== null && fontInfo.size !== undefined) {
        const sizeInEm = parseFloat((fontInfo.size / 16).toFixed(3));
        style.FontSize = sizeInEm;
        applied.push(`FontSize: ${fontInfo.size}px → ${sizeInEm}em`);
      }

      // Mark as modified so saveTheme() will include it
      if (typeof DesignCenter.recordStatus !== 'undefined') {
        style.RecordStatus = DesignCenter.recordStatus.Modified;
      } else {
        style.RecordStatus = 2; // 2 = Modified
      }

      return { success: true, applied: applied };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  /**
   * Clear Secondary Menu Item colors (background and font)
   * The Main Menu Item (index 10 / SecondaryMenuItem) should have no background or font colors - they should inherit/be blank
   * This is different from Main Style (index 8 / SecondaryMainItem) which DOES get colors applied
   */
  function clearSecondaryMenuItemColors() {
    if (typeof DesignCenter === 'undefined' || !DesignCenter.themeJSON || !DesignCenter.themeJSON.MenuStyles) {
      return { success: false, reason: 'DesignCenter.themeJSON.MenuStyles not available' };
    }

    const menuStyles = DesignCenter.themeJSON.MenuStyles;
    const menuItemIndex = 10; // SecondaryMenuItem (Main Menu Item)

    if (menuItemIndex >= menuStyles.length) {
      return { success: false, reason: `MenuStyle index ${menuItemIndex} (SecondaryMenuItem / Main Menu Item) out of range` };
    }

    try {
      const menuItem = menuStyles[menuItemIndex];
      const cleared = [];

      // Clear background colors
      menuItem.BackgroundColor = null;
      cleared.push('BackgroundColor: null');
      menuItem.HoverBackgroundColor = null;
      cleared.push('HoverBackgroundColor: null');

      // Clear font colors (leave blank to inherit)
      menuItem.FontColor = null;
      cleared.push('FontColor: null');
      menuItem.HoverFontColor = null;
      cleared.push('HoverFontColor: null');

      // Mark as modified so saveTheme() will include it
      if (typeof DesignCenter.recordStatus !== 'undefined') {
        menuItem.RecordStatus = DesignCenter.recordStatus.Modified;
      } else {
        menuItem.RecordStatus = 2; // 2 = Modified
      }

      return { success: true, cleared: cleared };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  /**
   * Set SecondaryWrapper to Accordions mode (SubMenuType = "1")
   * This must be done before applying other secondary nav styles,
   * otherwise Level 1, 2, 3 menu items won't be on the page
   */
  function setSecondaryWrapperToAccordions() {
    if (typeof DesignCenter === 'undefined' || !DesignCenter.themeJSON || !DesignCenter.themeJSON.MenuStyles) {
      return { success: false, reason: 'DesignCenter.themeJSON.MenuStyles not available' };
    }

    const menuStyles = DesignCenter.themeJSON.MenuStyles;
    const wrapperIndex = 7; // SecondaryWrapper

    if (wrapperIndex >= menuStyles.length) {
      return { success: false, reason: `MenuStyle index ${wrapperIndex} (SecondaryWrapper) out of range` };
    }

    try {
      const wrapper = menuStyles[wrapperIndex];
      wrapper.SubMenuType = "1"; // "0" = Flyouts, "1" = Accordions

      // Mark as modified so saveTheme() will include it
      if (typeof DesignCenter.recordStatus !== 'undefined') {
        wrapper.RecordStatus = DesignCenter.recordStatus.Modified;
      } else {
        wrapper.RecordStatus = 2; // 2 = Modified
      }

      return { success: true };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  /**
   * Set padding values to a MenuStyle entry
   * @param {number} menuStyleIndex - Index in DesignCenter.themeJSON.MenuStyles array
   * @param {object} paddingValues - { PaddingTop, PaddingBottom, PaddingLeft, PaddingRight }
   *                                 Each value is { Value: number, Unit: 0 }
   */
  function setPaddingToMenuStyle(menuStyleIndex, paddingValues) {
    if (typeof DesignCenter === 'undefined' || !DesignCenter.themeJSON || !DesignCenter.themeJSON.MenuStyles) {
      return { success: false, reason: 'DesignCenter.themeJSON.MenuStyles not available' };
    }

    const menuStyles = DesignCenter.themeJSON.MenuStyles;
    if (menuStyleIndex < 0 || menuStyleIndex >= menuStyles.length) {
      return { success: false, reason: `MenuStyle index ${menuStyleIndex} out of range (0-${menuStyles.length - 1})` };
    }

    try {
      const style = menuStyles[menuStyleIndex];
      const applied = [];

      // Set padding properties
      if (paddingValues.PaddingTop) {
        style.PaddingTop = paddingValues.PaddingTop;
        applied.push(`PaddingTop: ${paddingValues.PaddingTop.Value}em`);
      }
      if (paddingValues.PaddingBottom) {
        style.PaddingBottom = paddingValues.PaddingBottom;
        applied.push(`PaddingBottom: ${paddingValues.PaddingBottom.Value}em`);
      }
      if (paddingValues.PaddingLeft) {
        style.PaddingLeft = paddingValues.PaddingLeft;
        applied.push(`PaddingLeft: ${paddingValues.PaddingLeft.Value}em`);
      }
      if (paddingValues.PaddingRight) {
        style.PaddingRight = paddingValues.PaddingRight;
        applied.push(`PaddingRight: ${paddingValues.PaddingRight.Value}em`);
      }

      // Mark as modified so saveTheme() will include it
      if (typeof DesignCenter.recordStatus !== 'undefined') {
        style.RecordStatus = DesignCenter.recordStatus.Modified;
      } else {
        style.RecordStatus = 2; // 2 = Modified
      }

      return { success: true, applied: applied };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  /**
   * Extract font style info from a Figma text style node
   * The node is expected to be a FRAME with a TEXT child containing styles
   * Also handles GROUP nodes with VECTOR children (for table header font colors)
   * Returns { color: '#hex', family: 'string', size: number, weight: 'string' } or null
   */
  function extractFontStyleFromNode(node, figmaJson) {
    if (!node) return null;

    let fontInfo = {
      color: null,
      family: null,
      size: null,
      weight: null
    };

    // The text style nodes are FRAMEs with TEXT children
    // Structure: node.children[0].styles.bg (color) and node.children[0].styles.text (family, size)
    // Also handle structure.children for exported JSON formats
    // Also handle GROUP nodes with VECTOR children (for table header font colors)
    let textChild = null;

    // Get children array - check both direct children and structure.children
    const childrenArray = Array.isArray(node.children) ? node.children :
      (node.structure && Array.isArray(node.structure.children)) ? node.structure.children : [];

    // Look for the first child with text styles or bg color
    if (childrenArray.length > 0) {
      for (const child of childrenArray) {
        if (child && child.styles && (child.styles.text || child.styles.bg)) {
          textChild = child;
          break;
        }
        // Also check if child is a TEXT node type
        if (child && child.type === 'TEXT') {
          textChild = child;
          break;
        }
        // Check structure.type for exported formats
        if (child && child.structure && child.structure.type === 'TEXT') {
          textChild = child;
          break;
        }
        // Handle VECTOR nodes with styles.bg (used for table header font colors)
        if (child && child.type === 'VECTOR' && child.styles && child.styles.bg) {
          textChild = child;
          break;
        }
      }
    }

    // If no child found, try the node itself
    if (!textChild && node.styles && (node.styles.text || node.styles.bg)) {
      textChild = node;
    }

    // Also check node.structure for exported JSON formats where styles are nested under structure
    if (!textChild && node.structure && node.structure.styles && (node.structure.styles.text || node.structure.styles.bg)) {
      textChild = node.structure;
    }

    if (!textChild) {
      // Try to find any descendant with text styles or bg color
      function findTextNode(obj) {
        if (!obj || typeof obj !== 'object') return null;
        if (obj.styles && (obj.styles.text || obj.styles.bg)) return obj;
        if (obj.type === 'TEXT' && obj.styles) return obj;
        // Check structure.type for exported formats
        if (obj.structure && obj.structure.type === 'TEXT' && obj.structure.styles) return obj.structure;
        // Handle VECTOR nodes with styles.bg
        if (obj.type === 'VECTOR' && obj.styles && obj.styles.bg) return obj;
        // Check both direct children and structure.children
        const children = Array.isArray(obj.children) ? obj.children :
          (obj.structure && Array.isArray(obj.structure.children)) ? obj.structure.children : [];
        for (const c of children) {
          const found = findTextNode(c);
          if (found) return found;
        }
        return null;
      }
      textChild = findTextNode(node);
    }

    if (!textChild) return null;

    // Extract color from styles.bg
    if (textChild.styles && textChild.styles.bg) {
      fontInfo.color = parseColorValue(textChild.styles.bg);
    }

    // Also try styles.fill or styles.color as fallbacks for color
    if (!fontInfo.color && textChild.styles) {
      if (textChild.styles.fill) {
        fontInfo.color = parseColorValue(textChild.styles.fill);
      } else if (textChild.styles.color) {
        fontInfo.color = parseColorValue(textChild.styles.color);
      }
    }

    // Extract font-family, font-size, and font-weight from styles.text
    if (textChild.styles && textChild.styles.text) {
      const textStyles = textChild.styles.text;

      if (textStyles.family) {
        fontInfo.family = textStyles.family;
      }

      if (textStyles.size !== undefined && textStyles.size !== null) {
        fontInfo.size = parseInt(textStyles.size, 10);
      }

      if (textStyles.weight) {
        fontInfo.weight = String(textStyles.weight);
      }
    }

    // Try alternative locations for font properties
    if (!fontInfo.family && textChild.fontFamily) {
      fontInfo.family = textChild.fontFamily;
    }
    if (!fontInfo.size && textChild.fontSize !== undefined) {
      fontInfo.size = parseInt(textChild.fontSize, 10);
    }
    if (!fontInfo.weight && textChild.fontWeight) {
      fontInfo.weight = String(textChild.fontWeight);
    }

    // Normalize font weight to CMS FontVariant dropdown values
    // Handles both Figma style names ("Bold", "ExtraBold") and numeric strings ("700", "800")
    if (fontInfo.weight) {
      const w = fontInfo.weight.toLowerCase().replace(/[\s\-_]/g, '');
      const weightMap = {
        'thin': '100', 'hairline': '100',
        'extralight': '200', 'ultralight': '200',
        'light': '300',
        'regular': 'regular', 'normal': 'regular', 'book': 'regular',
        'medium': '500',
        'semibold': '600', 'demibold': '600',
        'bold': '700',
        'extrabold': '800', 'ultrabold': '800',
        'black': '900', 'heavy': '900',
        '400': 'regular' // CMS uses "regular" instead of "400"
      };
      const cleaned = w.replace(/italic|oblique/g, '').trim();
      if (weightMap[cleaned]) {
        fontInfo.weight = weightMap[cleaned];
      }
    }

    // Only return if we found at least one property
    if (fontInfo.color || fontInfo.family || fontInfo.size || fontInfo.weight) {
      return fontInfo;
    }

    return null;
  }

  /**
   * Set font styles to a SiteStyle entry
   * @param {number} siteStyleIndex - Index in DesignCenter.themeJSON.SiteStyles array
   * @param {object} fontInfo - { color: '#hex', family: 'string', size: number }
   * @param {object} options - { useLinkColorProperties: boolean, enableUnderline: boolean }
   *                           useLinkColorProperties: sets LinkNormalColor/LinkVisitedColor/LinkHoverColor instead of FontColor
   *                           enableUnderline: sets LinkNormalUnderlined to true
   */
  function setFontStyleToSiteStyle(siteStyleIndex, fontInfo, options = {}) {
    if (typeof DesignCenter === 'undefined' || !DesignCenter.themeJSON || !DesignCenter.themeJSON.SiteStyles) {
      return { success: false, reason: 'DesignCenter.themeJSON.SiteStyles not available' };
    }

    const siteStyles = DesignCenter.themeJSON.SiteStyles;
    if (siteStyleIndex < 0 || siteStyleIndex >= siteStyles.length) {
      return { success: false, reason: `SiteStyle index ${siteStyleIndex} out of range (0-${siteStyles.length - 1})` };
    }

    try {
      const style = siteStyles[siteStyleIndex];
      const applied = [];

      // Set font color
      if (fontInfo.color) {
        if (options.useLinkColorProperties) {
          // For links, set the Link*Color properties that the Links modal reads
          style.LinkNormalColor = fontInfo.color;
          style.LinkVisitedColor = fontInfo.color;
          style.LinkHoverColor = fontInfo.color;
          applied.push(`LinkNormalColor: ${fontInfo.color}`);
          applied.push(`LinkVisitedColor: ${fontInfo.color}`);
          applied.push(`LinkHoverColor: ${fontInfo.color}`);
        } else {
          style.FontColor = fontInfo.color;
          applied.push(`color: ${fontInfo.color}`);
        }
      }

      // Set font family
      if (fontInfo.family) {
        style.FontFamily = fontInfo.family;
        applied.push(`family: ${fontInfo.family}`);
      }

      // Set font weight (as FontVariant - "700" for bold, "regular" for normal, etc.)
      if (fontInfo.weight) {
        style.FontVariant = fontInfo.weight;
        applied.push(`FontVariant: ${fontInfo.weight}`);
      }

      // Set font size (convert px to em: 1em = 16px)
      if (fontInfo.size !== null && fontInfo.size !== undefined) {
        const sizeInEm = parseFloat((fontInfo.size / 16).toFixed(3));
        style.FontSize = sizeInEm;
        applied.push(`size: ${fontInfo.size}px → ${sizeInEm}em`);
      }

      // Set underline if enabled
      if (options.enableUnderline) {
        style.LinkNormalUnderlined = true;
        applied.push('LinkNormalUnderlined: true');
      }

      // Mark as modified so saveTheme() will include it
      if (typeof DesignCenter.recordStatus !== 'undefined') {
        style.RecordStatus = DesignCenter.recordStatus.Modified;
      } else {
        style.RecordStatus = 2; // 2 = Modified
      }

      return { success: true, applied: applied };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  /**
   * Read a file as text
   */
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file, 'utf-8');
    });
  }

  // ==================== BASE SKINS CREATION ====================

  /**
   * Base skin names to create
   */
  const BASE_SKIN_NAMES = [
    'Default',
    'Features',
    'Mega Menu',
    'Graphic Buttons',
    'Footer'
  ];

  /**
   * Create base widget skins via the CMS API
   * Uses parallel AJAX calls for speed, then waits for all to complete
   * @param {string} yearPrefix - Optional year prefix (e.g., "2026")
   * @param {function} logFn - Logging function
   * @returns {Promise<{created: number, failed: number, skipped: number, skins: Array}>}
   */
  async function createBaseSkins(yearPrefix, logFn) {
    const log = logFn || console.log;
    const results = { created: 0, failed: 0, skipped: 0, skins: [] };

    // Check if DesignCenter and API are available
    if (typeof DesignCenter === 'undefined' || !DesignCenter.themeJSON) {
      log('DesignCenter not available - cannot create skins', 'error');
      return results;
    }

    log('--- Creating Base Widget Skins ---');

    // Build list of skins to create (skip existing ones)
    const skinsToCreate = [];
    for (const baseName of BASE_SKIN_NAMES) {
      const skinName = yearPrefix ? `${yearPrefix} - ${baseName}` : baseName;

      const existingSkin = DesignCenter.themeJSON.WidgetSkins.find(
        s => s.Name && s.Name.toLowerCase() === skinName.toLowerCase()
      );

      if (existingSkin) {
        log(`"${skinName}" already exists (ID: ${existingSkin.WidgetSkinID})`, 'warning');
        results.skipped++;
      } else {
        skinsToCreate.push(skinName);
      }
    }

    if (skinsToCreate.length === 0) {
      log('All skins already exist - nothing to create');
      return results;
    }

    // Disable widget-skin-default-override prompts during bulk creation
    // This prevents the confirm dialog from appearing for each skin
    window.cpToolkitSkipSkinDefaultOverride = true;

    // Track created skins via intercepting processNewSkin
    const originalProcessNewSkin = DesignCenter.widgetSkinManager.processNewSkin;

    DesignCenter.widgetSkinManager.processNewSkin = function(response) {
      log(`Created "${response.Name}" (ID: ${response.WidgetSkinID})`, 'success');
      results.skins.push(response);
      // Call original method
      originalProcessNewSkin.call(this, response);
    };

    // Fire all AJAX requests with small stagger to avoid overwhelming server
    log(`Creating ${skinsToCreate.length} skins...`);
    const themeID = DesignCenter.themeJSON.ThemeID;
    const newSkinID = DesignCenter.widgetSkinManager.newSkinID;

    const promises = skinsToCreate.map((skinName, index) => {
      return new Promise((resolve) => {
        // Stagger requests by 100ms each
        setTimeout(() => {
          $.ajax({
            url: '/DesignCenter/WidgetSkinAdd/Index',
            type: 'POST',
            data: JSON.stringify({
              themeID: themeID,
              widgetSkinID: newSkinID,
              name: skinName
            }),
            contentType: 'application/json',
            cache: false,
            success: function(response) {
              // Call processNewSkin to add skin to array and update UI
              // (our intercepted version will log and track it)
              DesignCenter.widgetSkinManager.processNewSkin(response);
              resolve({ success: true, name: skinName, response: response });
            },
            error: function(xhr, textStatus, exception) {
              log(`Failed to create "${skinName}": ${xhr.statusText}`, 'error');
              resolve({ success: false, name: skinName, error: xhr.statusText });
            }
          });
        }, index * 100); // 100ms stagger between requests
      });
    });

    // Wait for all requests to complete
    const requestResults = await Promise.all(promises);

    // Restore original processNewSkin
    DesignCenter.widgetSkinManager.processNewSkin = originalProcessNewSkin;

    // Tally results
    for (const result of requestResults) {
      if (result.success) {
        results.created++;
      } else {
        results.failed++;
      }
    }

    // Close any loading overlay that might be open
    if (typeof ajaxPostBackEnd === 'function') {
      try { ajaxPostBackEnd(); } catch (e) { /* ignore */ }
    }

    // Re-enable widget-skin-default-override prompts
    window.cpToolkitSkipSkinDefaultOverride = false;

    log(`--- Skins: ${results.created} created, ${results.skipped} skipped, ${results.failed} failed ---`);
    return results;
  }

  // ==================== UI CREATION ====================

  /**
   * Create and show the overlay UI
   */
  function createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
      width: 600px;
      max-width: 90vw;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px 20px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    `;
    header.innerHTML = `
      <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #333;">Apply Colors from Figma</h2>
      <button id="cp-toolkit-amc-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 0; line-height: 1;">&times;</button>
    `;

    // Content
    const content = document.createElement('div');
    content.style.cssText = `
      padding: 20px;
      flex: 1;
      overflow-y: auto;
    `;

    content.innerHTML = `
      <!-- Create Base Skins Section -->
      <div style="margin-bottom: 16px; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden;">
        <div id="cp-toolkit-amc-skins-toggle" style="
          padding: 12px 16px;
          background: #f8f8f8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          user-select: none;
        ">
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="cp-toolkit-amc-create-skins" style="margin: 0; cursor: pointer;">
            <label for="cp-toolkit-amc-create-skins" style="font-weight: 500; color: #333; cursor: pointer;">Create Base Skins</label>
          </div>
          <span id="cp-toolkit-amc-skins-arrow" style="color: #666; transition: transform 0.2s;">▼</span>
        </div>
        <div id="cp-toolkit-amc-skins-content" style="display: none; padding: 16px; border-top: 1px solid #e0e0e0; background: #fff;">
          <p style="margin: 0 0 12px; color: #666; font-size: 13px;">
            Creates 5 widget skins: <strong>Default</strong>, <strong>Features</strong>, <strong>Mega Menu</strong>, <strong>Graphic Buttons</strong>, <strong>Footer</strong>
          </p>
          <div style="display: flex; align-items: center; gap: 12px;">
            <label style="font-size: 13px; color: #555; white-space: nowrap;">Name prefix (optional):</label>
            <input type="text" id="cp-toolkit-amc-year" placeholder="e.g., 2026 or 2026 - DHP" maxlength="20"
              style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; width: 185px;">
          </div>
          <p style="margin: 12px 0 0; color: #888; font-size: 12px; font-style: italic;">
            Skins will be named like "2026 - Default" or "2026 - DHP - Default". Leave blank for just "Default".
          </p>
        </div>
      </div>

      <p style="margin: 0 0 12px; color: #555; font-size: 14px;">
        Upload a Figma JSON export to automatically apply colors and font styles:
      </p>
      <ul style="margin: 0 0 16px; padding-left: 20px; color: #666; font-size: 13px; line-height: 1.6;">
        <li><strong>Module Colors:</strong> Rectangle 7–19 → Module_Color 1–13</li>
        <li><strong>Tables:</strong> Rectangle 28 (header bg/border), 33 (wrapper bg/border), 37 (alt rows bg/border), "one" (header font)</li>
        <li><strong>Typography:</strong> "headline" → h1, "subhead-1" → h2, "subhead-2" → h3, "normal-text" → body, "link" → links</li>
        <li><strong>Main Nav:</strong> "nav-item" → Main Item font color, family, size</li>
        <li><strong>Secondary Nav:</strong> Rectangle 53 (sidebar bg), 54/57/61/67 (level backgrounds), "sub-navigation-links" (fonts)</li>
      </ul>
      <p style="margin: 0 0 16px; color: #888; font-size: 12px; font-style: italic;">
        All styles are applied directly to theme SiteStyles/MenuStyles and saved automatically.
      </p>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">Select Figma JSON File</label>
        <input type="file" id="cp-toolkit-amc-file" accept=".json,application/json"
          style="width: 100%; padding: 10px; border: 2px dashed #ccc; border-radius: 6px; cursor: pointer; box-sizing: border-box;">
      </div>

      <div id="cp-toolkit-amc-log" style="
        background: #f5f5f5;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        padding: 12px;
        max-height: 250px;
        overflow-y: auto;
        font-family: 'Monaco', 'Consolas', monospace;
        font-size: 12px;
        color: #333;
        display: none;
      "></div>

      <div id="cp-toolkit-amc-progress" style="display: none;">
        <div id="cp-toolkit-amc-progress-text" style="
          font-size: 14px;
          color: #333;
          font-weight: 500;
          margin-bottom: 4px;
        "></div>
        <div style="
          width: 100%;
          height: 8px;
          background: #e0e0e0;
          border-radius: 4px;
          margin: 8px 0 16px;
          overflow: hidden;
        ">
          <div id="cp-toolkit-amc-progress-bar" style="
            height: 100%;
            background: #af282f;
            border-radius: 4px;
            transition: width 0.3s;
            width: 0%;
          "></div>
        </div>
        <div id="cp-toolkit-amc-progress-log" style="
          background: #f5f5f5;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 12px;
          max-height: 300px;
          overflow-y: auto;
          font-family: 'Monaco', 'Consolas', monospace;
          font-size: 12px;
          color: #333;
        "></div>
      </div>
    `;

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 16px 20px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    `;

    footer.innerHTML = `
      <button id="cp-toolkit-amc-cancel" style="
        padding: 10px 20px;
        border: 1px solid #ccc;
        border-radius: 6px;
        background: #fff;
        color: #333;
        font-size: 14px;
        cursor: pointer;
      ">Cancel</button>
      <button id="cp-toolkit-amc-start" style="
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        background: #af282f;
        color: #fff;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
      ">Apply Colors</button>
    `;

    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Event listeners
    const closeBtn = document.getElementById('cp-toolkit-amc-close');
    const cancelBtn = document.getElementById('cp-toolkit-amc-cancel');
    const startBtn = document.getElementById('cp-toolkit-amc-start');
    const fileInput = document.getElementById('cp-toolkit-amc-file');
    const logEl = document.getElementById('cp-toolkit-amc-log');

    // Skin creation UI elements
    const skinsToggle = document.getElementById('cp-toolkit-amc-skins-toggle');
    const skinsCheckbox = document.getElementById('cp-toolkit-amc-create-skins');
    const skinsContent = document.getElementById('cp-toolkit-amc-skins-content');
    const skinsArrow = document.getElementById('cp-toolkit-amc-skins-arrow');
    const yearInput = document.getElementById('cp-toolkit-amc-year');

    // Progress view elements
    const progressSection = document.getElementById('cp-toolkit-amc-progress');
    const progressText = document.getElementById('cp-toolkit-amc-progress-text');
    const progressBar = document.getElementById('cp-toolkit-amc-progress-bar');
    const progressLog = document.getElementById('cp-toolkit-amc-progress-log');

    function closeOverlay() {
      overlay.remove();
    }

    closeBtn.addEventListener('click', closeOverlay);
    cancelBtn.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay();
    });

    // Toggle skins section visibility when checkbox changes
    skinsCheckbox.addEventListener('change', () => {
      const isChecked = skinsCheckbox.checked;
      skinsContent.style.display = isChecked ? 'block' : 'none';
      skinsArrow.style.transform = isChecked ? 'rotate(180deg)' : 'rotate(0deg)';
      if (isChecked) {
        yearInput.focus();
      }
    });

    // Also toggle when clicking the header area (but not the checkbox itself)
    skinsToggle.addEventListener('click', (e) => {
      if (e.target !== skinsCheckbox && e.target.tagName !== 'LABEL') {
        skinsCheckbox.checked = !skinsCheckbox.checked;
        skinsCheckbox.dispatchEvent(new Event('change'));
      }
    });

    // Logging function
    function log(message, type = 'info') {
      const targetLog = progressSection.style.display !== 'none' ? progressLog : logEl;
      if (targetLog === logEl) targetLog.style.display = 'block';
      const line = document.createElement('div');
      line.style.cssText = `
        padding: 4px 0;
        border-bottom: 1px solid #eee;
        ${type === 'error' ? 'color: #d32f2f;' : ''}
        ${type === 'success' ? 'color: #388e3c;' : ''}
        ${type === 'warning' ? 'color: #f57c00;' : ''}
      `;
      line.textContent = message;
      targetLog.appendChild(line);
      targetLog.scrollTop = targetLog.scrollHeight;
      console.log(`${TOOL_NAME} ${message}`);
    }

    // Progress helpers
    function tick() {
      return new Promise(function(resolve) { setTimeout(resolve, 0); });
    }

    function updateProgress(current, total, label) {
      const pct = Math.round((current / total) * 100);
      progressBar.style.width = pct + '%';
      progressText.textContent = label || ('Processing step ' + current + ' of ' + total + '...');
    }

    function enterProgressMode() {
      // Update header title
      const headerTitle = header.querySelector('h2');
      if (headerTitle) headerTitle.textContent = 'Applying Styles...';

      // Hide all body children except the progress section
      const bodyChildren = content.children;
      for (let i = 0; i < bodyChildren.length; i++) {
        if (bodyChildren[i].id !== 'cp-toolkit-amc-progress') {
          bodyChildren[i].style.display = 'none';
        }
      }

      // Show progress section
      progressSection.style.display = 'block';
      progressLog.innerHTML = '';
      progressBar.style.width = '0%';
      progressBar.style.background = '#af282f';
      progressText.textContent = 'Starting...';

      // Hide footer
      footer.style.display = 'none';
    }

    // Start button handler
    startBtn.addEventListener('click', async () => {
      const file = fileInput.files && fileInput.files[0];
      const shouldCreateSkins = skinsCheckbox.checked;
      const yearPrefix = yearInput.value.trim();

      // Require either a file or skin creation to be selected
      if (!file && !shouldCreateSkins) {
        alert('Please select a Figma JSON file or enable "Create Base Skins".');
        return;
      }

      startBtn.disabled = true;

      // Calculate total steps and enter progress mode
      let totalSteps = 0;
      if (shouldCreateSkins) totalSteps++;
      if (file) totalSteps += 11; // parse, colors, tables, borders, adv-borders, text, secnav, sidebar, mainnav, secnavfont, save
      let currentStep = 0;

      enterProgressMode();
      logEl.innerHTML = '';

      try {
        // ==================== CREATE BASE SKINS (if enabled) ====================
        if (shouldCreateSkins) {
          currentStep++;
          updateProgress(currentStep, totalSteps, 'Creating base skins...');
          await tick();
          const skinResults = await createBaseSkins(yearPrefix, log);
          if (skinResults.created > 0) {
            log(`Base skins created successfully!`, 'success');
          }
        }

        // If no file selected but skins were created, refresh immediately
        if (!file) {
          log('--- No Figma file selected - skin creation only ---');
          progressBar.style.width = '100%';
          progressBar.style.background = '#4CAF50';
          progressText.textContent = 'Base skins created! Refreshing...';
          const headerTitle = header.querySelector('h2');
          if (headerTitle) headerTitle.textContent = 'Skins Created!';
          log('Refreshing page to load new skins...', 'success');
          window.location.reload();
          return;
        }

        currentStep++;
        updateProgress(currentStep, totalSteps, 'Parsing Figma JSON...');
        await tick();
        log(`Reading file: ${file.name} (${file.size} bytes)`);
        const text = await readFileAsText(file);
        const figmaJson = JSON.parse(text);
        log('Parsed JSON successfully');

        // Create backup
        if (typeof DesignCenter !== 'undefined' && DesignCenter.themeJSON) {
          window.__applyModuleColors_backup = JSON.parse(JSON.stringify(DesignCenter.themeJSON));
          log('Created backup (window.__applyModuleColors_backup)');
        }

        let totalApplied = 0;
        let totalFailed = 0;
        const notFoundWarnings = []; // Track items not found in Figma file

        // ==================== APPLY MODULE COLORS ====================
        currentStep++;
        updateProgress(currentStep, totalSteps, 'Applying module colors...');
        await tick();
        log('--- Module Colors (Rectangle 7-19) ---');
        
        for (let rect = 7; rect <= 19; rect++) {
          const nodeName = `Rectangle ${rect}`;
          const slot = rect - 6; // Rectangle 7 = Color 1, etc.
          const node = findNodeByNameTolerant(figmaJson, nodeName);

          if (!node) {
            log(`${nodeName}: NOT FOUND`, 'warning');
            notFoundWarnings.push(`${nodeName} (Module Color ${slot})`);
            continue;
          }

          const colorHex = extractColorFromNode(node, figmaJson);

          if (colorHex) {
            const setResult = setColorToModuleInput(slot, colorHex);
            if (setResult.success) {
              log(`${nodeName} → Color ${slot}: ${colorHex}`, 'success');
              totalApplied++;
            } else {
              log(`${nodeName}: Failed to set - ${setResult.reason}`, 'error');
              totalFailed++;
            }
          } else {
            log(`${nodeName}: No color found`, 'warning');
          }
        }

        // ==================== APPLY TABLE STYLES ====================
        currentStep++;
        updateProgress(currentStep, totalSteps, 'Applying table styles...');
        await tick();
        log('--- Table Styles (via SiteStyles) ---');
        
        for (const mapping of TABLE_STYLE_MAPPINGS) {
          const nodeName = `Rectangle ${mapping.rectangle}`;
          const node = findNodeByNameTolerant(figmaJson, nodeName);

          if (!node) {
            log(`${nodeName}: NOT FOUND`, 'warning');
            notFoundWarnings.push(`${nodeName} (Table Styles)`);
            continue;
          }

          const colorHex = extractColorFromNode(node, figmaJson);
          
          if (colorHex) {
            for (const target of mapping.targets) {
              const setResult = setColorToSiteStyle(target.siteStyleIndex, colorHex);
              if (setResult.success) {
                log(`${nodeName} → ${target.name} (SiteStyles[${target.siteStyleIndex}]): ${colorHex}`, 'success');
                totalApplied++;
              } else {
                log(`${nodeName} → ${target.name}: Failed - ${setResult.reason}`, 'error');
                totalFailed++;
              }
            }
          } else {
            log(`${nodeName}: No color found`, 'warning');
          }
        }

        // ==================== APPLY BORDER STYLES ====================
        currentStep++;
        updateProgress(currentStep, totalSteps, 'Applying border styles...');
        await tick();
        log('--- Border Styles (via SiteStyles) ---');
        
        for (const mapping of BORDER_STYLE_MAPPINGS) {
          const nodeName = `Rectangle ${mapping.rectangle}`;
          const node = findNodeByNameTolerant(figmaJson, nodeName);

          if (!node) {
            log(`${nodeName}: NOT FOUND (border)`, 'warning');
            notFoundWarnings.push(`${nodeName} (Border Styles)`);
            continue;
          }

          const borderInfo = extractBorderFromNode(node, figmaJson);
          
          if (borderInfo) {
            const borderDesc = [];
            if (borderInfo.color) borderDesc.push(`color: ${borderInfo.color}`);
            if (borderInfo.width !== null) borderDesc.push(`width: ${borderInfo.width}px`);
            if (borderInfo.style !== null) {
              const styleNames = ['None', 'Solid', 'Dashed', 'Dotted'];
              borderDesc.push(`style: ${styleNames[borderInfo.style] || borderInfo.style}`);
            }
            
            for (const target of mapping.targets) {
              const setResult = setBorderToSiteStyle(target.siteStyleIndex, borderInfo);
              if (setResult.success) {
                log(`${nodeName} → ${target.name} Border (SiteStyles[${target.siteStyleIndex}]): ${borderDesc.join(', ')}`, 'success');
                totalApplied++;
              } else {
                log(`${nodeName} → ${target.name} Border: Failed - ${setResult.reason}`, 'error');
                totalFailed++;
              }
            }
          } else {
            log(`${nodeName}: No border found`, 'warning');
          }
        }

        // ==================== APPLY ADVANCED BORDER STYLES ====================
        currentStep++;
        updateProgress(currentStep, totalSteps, 'Applying advanced border styles...');
        await tick();
        log('--- Advanced Border Styles (via MiscellaneousStyles) ---');

        for (const mapping of ADVANCED_BORDER_STYLE_MAPPINGS) {
          const nodeName = `Rectangle ${mapping.rectangle}`;
          const node = findNodeByNameTolerant(figmaJson, nodeName);

          if (!node) {
            log(`${nodeName}: NOT FOUND (advanced border)`, 'warning');
            notFoundWarnings.push(`${nodeName} (Advanced Border)`);
            continue;
          }

          const borderInfo = extractBorderFromNode(node, figmaJson);

          if (borderInfo) {
            const borderDesc = [];
            if (borderInfo.color) borderDesc.push(`color: ${borderInfo.color}`);
            if (borderInfo.width !== null) borderDesc.push(`width: ${borderInfo.width}px`);
            if (borderInfo.style !== null) {
              const styleNames = ['None', 'Solid', 'Dashed', 'Dotted'];
              borderDesc.push(`style: ${styleNames[borderInfo.style] || borderInfo.style}`);
            }

            for (const target of mapping.targets) {
              const setResult = setBorderToSiteStyleAdvanced(target.siteStyleIndex, borderInfo);
              if (setResult.success) {
                log(`${nodeName} → ${target.name} Border (Advanced): ${setResult.css}`, 'success');
                totalApplied++;
              } else {
                log(`${nodeName} → ${target.name} Border (Advanced): Failed - ${setResult.reason}`, 'error');
                totalFailed++;
              }
            }
          } else {
            log(`${nodeName}: No border found`, 'warning');
          }
        }

        // ==================== APPLY TEXT/FONT STYLES ====================
        currentStep++;
        updateProgress(currentStep, totalSteps, 'Applying text/font styles...');
        await tick();
        log('--- Text/Font Styles (via SiteStyles) ---');

        for (const mapping of TEXT_STYLE_MAPPINGS) {
          const nodeName = mapping.figmaNodeName;
          // Use exact matching for text styles to avoid "headline" matching "headline-2"
          const node = findNodeByNameExact(figmaJson, nodeName);

          if (!node) {
            log(`"${nodeName}": NOT FOUND`, 'warning');
            notFoundWarnings.push(`"${nodeName}" (Font Style)`);
            continue;
          }

          const fontInfo = extractFontStyleFromNode(node, figmaJson);

          if (fontInfo) {
            // If fontColorOnly flag is set, only keep the color
            const fontInfoToApply = mapping.fontColorOnly
              ? { color: fontInfo.color, family: null, size: null }
              : fontInfo;

            const setResult = setFontStyleToSiteStyle(mapping.siteStyleIndex, fontInfoToApply, {
              useLinkColorProperties: mapping.useLinkColorProperties || false,
              enableUnderline: mapping.enableUnderline || false
            });

            if (setResult.success && setResult.applied && setResult.applied.length > 0) {
              log(`"${nodeName}" → ${mapping.name} (SiteStyles[${mapping.siteStyleIndex}]): ${setResult.applied.join(', ')}`, 'success');
              totalApplied++;
            } else if (setResult.success) {
              // Success but nothing was applied (all values were null/undefined)
              log(`"${nodeName}" → ${mapping.name}: Found but no values to apply`, 'warning');
            } else {
              log(`"${nodeName}" → ${mapping.name}: Failed - ${setResult.reason}`, 'error');
              totalFailed++;
            }
          } else {
            log(`"${nodeName}": No font styles found`, 'warning');
          }
        }

        // ==================== APPLY SECONDARY NAV STYLES ====================
        currentStep++;
        updateProgress(currentStep, totalSteps, 'Applying secondary nav styles...');
        await tick();
        log('--- Secondary Nav Styles (via MenuStyles) ---');

        // First, set SecondaryWrapper to Accordions mode (required for Level 1, 2, 3 items to appear)
        const accordionResult = setSecondaryWrapperToAccordions();
        if (accordionResult.success) {
          log('SecondaryWrapper (MenuStyles[7]) SubMenuType → "1" (Accordions)', 'success');
          totalApplied++;
        } else {
          log(`SecondaryWrapper SubMenuType: Failed - ${accordionResult.reason}`, 'error');
          totalFailed++;
        }

        // Clear Secondary Menu Item colors (no background or font colors - should inherit)
        const clearResult = clearSecondaryMenuItemColors();
        if (clearResult.success) {
          log(`Secondary Menu Item (MenuStyles[10]) Colors cleared: ${clearResult.cleared.join(', ')}`, 'success');
          totalApplied++;
        } else {
          log(`Secondary Main Item Colors: Failed - ${clearResult.reason}`, 'error');
          totalFailed++;
        }

        // Apply padding to secondary nav menu items
        for (const target of SECONDARY_NAV_PADDING.targets) {
          const paddingResult = setPaddingToMenuStyle(target.menuStyleIndex, SECONDARY_NAV_PADDING.values);
          if (paddingResult.success && paddingResult.applied && paddingResult.applied.length > 0) {
            log(`${target.name} (MenuStyles[${target.menuStyleIndex}]) Padding: ${paddingResult.applied.join(', ')}`, 'success');
            totalApplied++;
          } else if (paddingResult.success) {
            log(`${target.name}: Padding - no values to apply`, 'warning');
          } else {
            log(`${target.name} Padding: Failed - ${paddingResult.reason}`, 'error');
            totalFailed++;
          }
        }

        // Apply background colors from Figma rectangles
        for (const mapping of SECONDARY_NAV_STYLE_MAPPINGS) {
          const nodeName = `Rectangle ${mapping.rectangle}`;
          const node = findNodeByNameTolerant(figmaJson, nodeName);

          if (!node) {
            log(`${nodeName}: NOT FOUND`, 'warning');
            notFoundWarnings.push(`${nodeName} (Secondary Nav)`);
            continue;
          }

          const colorHex = extractColorFromNode(node, figmaJson);

          if (colorHex) {
            for (const target of mapping.targets) {
              const setResult = setColorToMenuStyle(target.menuStyleIndex, target.property, colorHex);
              if (setResult.success) {
                log(`${nodeName} → ${target.name} (MenuStyles[${target.menuStyleIndex}].${target.property}): ${colorHex}`, 'success');
                totalApplied++;
              } else {
                log(`${nodeName} → ${target.name}: Failed - ${setResult.reason}`, 'error');
                totalFailed++;
              }
            }
          } else {
            log(`${nodeName}: No color found`, 'warning');
          }
        }

        // ==================== APPLY SIDEBAR CONTAINER STYLES ====================
        currentStep++;
        updateProgress(currentStep, totalSteps, 'Applying sidebar container styles...');
        await tick();
        log('--- Sidebar Container Styles (via ContainerStyles) ---');

        for (const mapping of SIDEBAR_CONTAINER_STYLE_MAPPINGS) {
          const nodeName = `Rectangle ${mapping.rectangle}`;
          const node = findNodeByNameTolerant(figmaJson, nodeName);

          if (!node) {
            log(`${nodeName}: NOT FOUND`, 'warning');
            notFoundWarnings.push(`${nodeName} (Sidebar Container)`);
            continue;
          }

          const colorHex = extractColorFromNode(node, figmaJson);

          if (colorHex) {
            const setResult = setColorToContainerStyle(mapping.containerSelector, mapping.property, colorHex);
            if (setResult.success) {
              log(`${nodeName} → ${mapping.name} (ContainerStyles.${mapping.property}): ${colorHex}`, 'success');
              totalApplied++;
            } else {
              log(`${nodeName} → ${mapping.name}: Failed - ${setResult.reason}`, 'error');
              totalFailed++;
            }
          } else {
            log(`${nodeName}: No color found`, 'warning');
          }
        }

        // ==================== APPLY MAIN NAV FONT STYLES ====================
        currentStep++;
        updateProgress(currentStep, totalSteps, 'Applying main nav font styles...');
        await tick();
        log('--- Main Nav Font Styles (via MenuStyles) ---');

        for (const mapping of MAIN_NAV_FONT_STYLE_MAPPINGS) {
          const nodeName = mapping.figmaNodeName;
          // Use tolerant matching for text nodes
          const node = findNodeByNameTolerant(figmaJson, nodeName);

          if (!node) {
            log(`"${nodeName}": NOT FOUND`, 'warning');
            notFoundWarnings.push(`"${nodeName}" (Main Nav Font)`);
            continue;
          }

          const fontInfo = extractFontStyleFromNode(node, figmaJson);

          if (fontInfo && (fontInfo.color || fontInfo.family || fontInfo.size || fontInfo.weight)) {
            for (const target of mapping.targets) {
              const setResult = setFontStyleToMenuStyle(target.menuStyleIndex, {
                color: fontInfo.color,
                family: fontInfo.family,
                size: fontInfo.size,
                weight: fontInfo.weight
              });
              if (setResult.success && setResult.applied && setResult.applied.length > 0) {
                log(`"${nodeName}" → ${target.name} (MenuStyles[${target.menuStyleIndex}]): ${setResult.applied.join(', ')}`, 'success');
                totalApplied++;
              } else if (setResult.success) {
                log(`"${nodeName}" → ${target.name}: Found but no values to apply`, 'warning');
              } else {
                log(`"${nodeName}" → ${target.name}: Failed - ${setResult.reason}`, 'error');
                totalFailed++;
              }
            }
          } else {
            log(`"${nodeName}": No font styles found`, 'warning');
          }
        }

        // ==================== APPLY SECONDARY NAV FONT STYLES ====================
        currentStep++;
        updateProgress(currentStep, totalSteps, 'Applying secondary nav font styles...');
        await tick();
        log('--- Secondary Nav Font Styles (via MenuStyles) ---');

        for (const mapping of SECONDARY_NAV_FONT_STYLE_MAPPINGS) {
          const nodeName = mapping.figmaNodeName;
          // Use tolerant matching for text nodes
          const node = findNodeByNameTolerant(figmaJson, nodeName);

          if (!node) {
            log(`"${nodeName}": NOT FOUND`, 'warning');
            notFoundWarnings.push(`"${nodeName}" (Secondary Nav Font)`);
            continue;
          }

          const fontInfo = extractFontStyleFromNode(node, figmaJson);

          if (fontInfo && (fontInfo.color || fontInfo.family)) {
            for (const target of mapping.targets) {
              const setResult = setFontStyleToMenuStyle(target.menuStyleIndex, {
                color: fontInfo.color,
                family: fontInfo.family
              });
              if (setResult.success && setResult.applied && setResult.applied.length > 0) {
                log(`"${nodeName}" → ${target.name} (MenuStyles[${target.menuStyleIndex}]): ${setResult.applied.join(', ')}`, 'success');
                totalApplied++;
              } else if (setResult.success) {
                log(`"${nodeName}" → ${target.name}: Found but no values to apply`, 'warning');
              } else {
                log(`"${nodeName}" → ${target.name}: Failed - ${setResult.reason}`, 'error');
                totalFailed++;
              }
            }
          } else {
            log(`"${nodeName}": No font styles found`, 'warning');
          }
        }

        // ==================== SUMMARY & SAVE ====================
        log(`--- Summary: ${totalApplied} applied, ${totalFailed} failed ---`);

        // Deduplicate warnings (same rectangle might be checked multiple times)
        const uniqueWarnings = [...new Set(notFoundWarnings)];

        // Update progress bar to completion state
        progressBar.style.width = '100%';
        if (totalFailed > 0) {
          progressBar.style.background = '#cc6600';
          progressText.textContent = 'Completed with ' + totalFailed + ' error(s). ' + totalApplied + ' applied.';
        } else {
          progressBar.style.background = '#4CAF50';
          progressText.textContent = 'All styles applied successfully! (' + totalApplied + ' total)';
        }

        const completionTitle = header.querySelector('h2');
        if (completionTitle) completionTitle.textContent = totalFailed > 0 ? 'Completed with Errors' : 'Styles Applied!';

        // Auto-save and refresh after save completes
        if (totalApplied > 0 && typeof saveTheme === 'function') {
          currentStep++;
          updateProgress(currentStep, totalSteps, 'Saving theme...');
          await tick();
          log('Saving theme...');

          // Use setTimeout to let the UI update before calling save
          setTimeout(() => {
            try {
              // Listen for AJAX complete to know when save is done
              const onSaveComplete = () => {
                $(document).off('ajaxComplete', onSaveComplete);
                log('Theme saved!', 'success');

                // Show warning alert BEFORE refresh if there are missing items
                if (uniqueWarnings.length > 0) {
                  const warningList = uniqueWarnings.map(w => `• ${w}`).join('\n');
                  alert(`Apply Figma Styles\n\nThe following items were not found in the Figma file:\n\n${warningList}\n\nPage will refresh after you click OK.`);
                }

                log('Waiting for changes to propagate...', 'info');
                progressBar.style.width = '100%';
                progressBar.style.background = '#4CAF50';
                progressText.textContent = 'Refreshing page...';
                // Wait 2 seconds for server to propagate changes, then hard refresh
                setTimeout(() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('_t', Date.now());
                  window.location.href = url.toString();
                }, 2000);
              };
              $(document).on('ajaxComplete', onSaveComplete);

              // Call saveTheme - this triggers an async AJAX request
              saveTheme();

              // Fallback timeout in case ajaxComplete doesn't fire (15 seconds)
              setTimeout(() => {
                $(document).off('ajaxComplete', onSaveComplete);
                log('Save timeout - refreshing anyway...', 'warning');
                progressText.textContent = 'Refreshing page...';
                const url = new URL(window.location.href);
                url.searchParams.set('_t', Date.now());
                window.location.href = url.toString();
              }, 15000);
            } catch (saveErr) {
              log(`Save failed: ${saveErr.message}`, 'error');
              progressBar.style.background = '#d32f2f';
              progressText.textContent = 'Save failed: ' + saveErr.message;
            }
          }, 50);
          return;
        } else if (totalApplied > 0) {
          log('saveTheme() not available - please save manually', 'warning');
        }

      } catch (err) {
        log(`Error: ${err.message}`, 'error');
        console.error(TOOL_NAME, err);
        progressBar.style.width = '100%';
        progressBar.style.background = '#d32f2f';
        progressText.textContent = 'Error: ' + err.message;
        const errorTitle = header.querySelector('h2');
        if (errorTitle) errorTitle.textContent = 'Error';
      }
    });

    return overlay;
  }

  // ==================== MAIN ====================

  // Check if we're on the Theme Manager page
  if (!/designcenter\/themes/i.test(window.location.pathname)) {
    alert(`${TOOL_NAME}\n\nThis tool only works on the Theme Manager page.\n\nPlease navigate to /DesignCenter/Themes/ and try again.`);
    return;
  }

  // Create and show the overlay
  createOverlay();
  console.log(`${TOOL_NAME} Overlay opened`);

})();
