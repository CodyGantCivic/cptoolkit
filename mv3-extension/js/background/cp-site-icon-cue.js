// CivicPlus Toolkit - "CivicPlus site detected" toolbar icon cue
//
// Chrome evaluates these selectors itself (declarativeContent), so no extension
// code or content script is injected into any page and nothing can error on
// non-CivicPlus sites. When a page matches, the toolbar icon gains a green dot
// as a cue to open the popup, where the existing "Trust this domain" flow lives.
(function(root) {
  'use strict';

  // declarativeContent requires every selector in one matcher to match, so each
  // marker is its own matcher (OR across matchers). Only CivicPlus-specific
  // markers are used; generic ones (e.g. #aspnetForm) would light up on any
  // ASP.NET site. Selectors must be compound (no descendant combinators).
  var CP_MARKER_SELECTORS = Object.freeze([
    '#ctl00_ctl00_adminHeader_headerTitle',
    '#adminHeader',
    '.cp-AdminWrap',
    '.cp-AdminMenu',
    '.cp-Toolbar',
    '.cp-ModuleList',
    '.cp-UserMenu',
    'body.liveEditOn',
    '#LiveEditCSS',
    '#liveEditToolbar',
    '#LiveEditToolbar',
    '.cp-LiveEdit',
    '.cp-EditToolbar'
  ]);

  var ICON_SIZES = Object.freeze([
    { size: 16, path: 'images/icon_19.png' },
    { size: 32, path: 'images/icon_38.png' }
  ]);

  function drawCueIcon(path, size) {
    return fetch(chrome.runtime.getURL(path))
      .then(function(response) { return response.blob(); })
      .then(function(blob) { return createImageBitmap(blob); })
      .then(function(bitmap) {
        var canvas = new OffscreenCanvas(size, size);
        var ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, size, size);

        var radius = Math.max(3, Math.round(size * 0.22));
        var cx = size - radius;
        var cy = size - radius;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, radius - 1.5), 0, Math.PI * 2);
        ctx.fillStyle = '#1fa851';
        ctx.fill();

        return ctx.getImageData(0, 0, size, size);
      });
  }

  function buildCueImageData() {
    return Promise.all(ICON_SIZES.map(function(entry) {
      return drawCueIcon(entry.path, entry.size);
    })).then(function(images) {
      var imageData = {};
      ICON_SIZES.forEach(function(entry, index) {
        imageData[entry.size] = images[index];
      });
      return imageData;
    });
  }

  function registerCueRules() {
    var dc = chrome.declarativeContent;
    if (!dc || !dc.onPageChanged || typeof OffscreenCanvas === 'undefined') {
      return Promise.resolve(false);
    }

    return buildCueImageData().then(function(imageData) {
      var rules = CP_MARKER_SELECTORS.map(function(selector) {
        return {
          conditions: [
            new dc.PageStateMatcher({
              pageUrl: { schemes: ['https'] },
              css: [selector]
            })
          ],
          actions: [new dc.SetIcon({ imageData: imageData })]
        };
      });

      return new Promise(function(resolve) {
        dc.onPageChanged.removeRules(undefined, function() {
          dc.onPageChanged.addRules(rules, function() {
            resolve(true);
          });
        });
      });
    }).catch(function(error) {
      console.warn('[CP Toolkit] Could not register CivicPlus site icon cue:', error);
      return false;
    });
  }

  root.CPToolkitSiteIconCue = Object.freeze({
    selectors: CP_MARKER_SELECTORS,
    register: registerCueRules
  });

  // Rules persist across sessions, but re-registering is idempotent and keeps
  // them in sync with this list after an extension update.
  registerCueRules();
})(self);
