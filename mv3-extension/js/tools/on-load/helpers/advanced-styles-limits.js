// Single source of truth for per-context CSS-textarea server limits.
// Consumed by:
//   - enforce-advanced-styles-text-limits.js (writes maxlength attribute)
//   - mini-ide.js (in-editor counter + truncation guard, runs independently
//     so users with the enforce tool disabled still get save-loss protection)
//
// Limits empirically verified on https://13.civic.place/ — type N chars, save,
// re-open, observe what the server stored.
(function () {
  window.CPToolkit = window.CPToolkit || {};
  if (window.CPToolkit.advancedStylesLimits) return;

  window.CPToolkit.advancedStylesLimits = {
    // Returns the server-side cap for a CSS textarea, or null if the context
    // is unrecognized. null = no client-side cap; caller decides whether to
    // skip enforcement or fall back to its own default.
    get: function (textarea) {
      if (!textarea) return null;

      var id = textarea.id || '';
      // Graphic Button builder — Fancy Button MiscStyles. The field has no
      // native maxlength attribute, but the server caps stored CSS at 1200.
      if (/^fancyButton.*MiscStyles$/.test(id)) return 1200;

      // Skin / container / menu editors — discriminate by class, then (for
      // skins) by id. Skin and container popovers both use id
      // "MiscellaneousStyles", so class is the primary discriminator.
      if (textarea.classList) {
        if (textarea.classList.contains('widgetSkin')) {
          // Only the main .widgetItem block (bare id "MiscellaneousStyles")
          // allows 4000. Every other skin sub-section caps at 1000 server-side:
          // the header rows (HeaderMiscellaneousStyles1/2/3) and the link-state
          // groups — link, readOn, RSSLink, viewAll — which all reuse the
          // Link{Normal,Visited,Hover}MiscellaneousStyles ids. Default unknown
          // skin shapes to 1000 so we under-allow rather than risk a silent
          // server-side truncation. Verified toolkit-off on 13.civic.place.
          return id === 'MiscellaneousStyles' ? 4000 : 1000;
        }
        if (textarea.classList.contains('containerStyle')) return 1000;
        if (textarea.classList.contains('menu')) return 1000;
      }

      return null;
    }
  };
})();
