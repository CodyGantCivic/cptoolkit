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
      // Graphic Button builder — Fancy Button MiscStyles (uncapped by CMS).
      if (/^fancyButton.*MiscStyles$/.test(id)) return 1200;

      // Theme Manager popovers — discriminate by class, not id. Skin and
      // container both share id="MiscellaneousStyles" on the prefixed forms,
      // so id is not a reliable discriminator.
      if (textarea.classList) {
        if (textarea.classList.contains('widgetSkin')) return 4000;
        if (textarea.classList.contains('containerStyle')) return 1000;
        if (textarea.classList.contains('menu')) return 1000;
      }

      return null;
    }
  };
})();
