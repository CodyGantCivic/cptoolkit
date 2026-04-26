// CivicPlus Toolkit - Top-frame ops for cp-MultipleQuickLinks (MAIN world)
// Each function is serialized via Function.prototype.toString and re-parsed
// in the page's MAIN world by chrome.scripting.executeScript. They must be
// fully self-contained — no closures, no `this`, only their args.

var QL_MAIN_OPS = Object.create(null);

QL_MAIN_OPS.showOverlay = function showOverlay(args) {
  var message = (args && args.message) || 'Please wait... This will only take a moment.';
  ajaxPostBackStart(message);
  $('#divAjaxProgress')
    .clone()
    .attr('id', 'toolkit-block')
    .css('display', 'block')
    .appendTo('body');
  ajaxPostBackEnd();
};

QL_MAIN_OPS.hideOverlay = function hideOverlay() {
  var el = document.getElementById('toolkit-block');
  if (el) el.style.display = 'none';
};
