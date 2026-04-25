// CivicPlus Toolkit - Top-frame ops for cp-ImportFancyButton (MAIN world)
// Each function is serialized via Function.prototype.toString and re-parsed
// in the page's MAIN world by chrome.scripting.executeScript. They must be
// fully self-contained — no closures, no `this`, only their args.

var MAIN_OPS = Object.create(null);

MAIN_OPS.installSaveInterceptor = function installSaveInterceptor() {
  window.__cpToolkitCapturedSave = null;
  var origAjax = $.ajax;
  $.ajax = function (opts) {
    if (
      opts &&
      typeof opts.url === 'string' &&
      opts.url.indexOf('/GraphicLinks/GraphicLinkSave') !== -1
    ) {
      var d = opts.data;
      window.__cpToolkitCapturedSave =
        typeof d === 'string' ? d : JSON.stringify(d);
      $.ajax = origAjax;
      return $.Deferred().promise();
    }
    return origAjax.apply(this, arguments);
  };
  return { status: 'installed' };
};

MAIN_OPS.readCapturedSave = function readCapturedSave() {
  return window.__cpToolkitCapturedSave || null;
};

MAIN_OPS.clearCapturedSave = function clearCapturedSave() {
  delete window.__cpToolkitCapturedSave;
};
