/**
 * Skin Operation Overlay - Helper (runs in MAIN world)
 *
 * A full-page cover with a status card, shared by the skin copy tools. It hides
 * the CMS re-rendering containers while a copy is cleaned up or saved, and ends
 * with a single completion summary. Exposed as window.CPToolkitSkinOverlay.
 *
 * It is a convenience, never a trap: it always has a Dismiss button, and a
 * failsafe timer removes it if the work that opened it never reports back.
 */
(function() {
  'use strict';

  if (window.CPToolkitSkinOverlay) return;

  var ROOT_ID = 'cp-toolkit-skin-overlay';
  var STYLE_ID = 'cp-toolkit-skin-overlay-style';
  var FAILSAFE_MS = 45000;
  var DISMISS_REVEAL_MS = 6000;

  var activeKeys = {};
  var pendingDone = null;
  var root = null;
  var failsafeTimer = null;
  var doneTimer = null;
  var dismissTimer = null;

  function activeCount() {
    return Object.keys(activeKeys).length;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '#' + ROOT_ID + '{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483000;' +
      'background:rgba(17,24,39,0.9);display:none;align-items:center;justify-content:center;' +
      'font-family:Arial,Helvetica,sans-serif;}' +
      '#' + ROOT_ID + '.cp-open{display:flex;}' +
      '#' + ROOT_ID + ' .cp-card{background:#fff;color:#1f2937;border-radius:10px;padding:26px 30px;' +
      'width:min(440px,calc(100vw - 40px));box-shadow:0 10px 40px rgba(0,0,0,0.45);text-align:center;}' +
      '#' + ROOT_ID + ' .cp-title{font-size:18px;font-weight:700;margin:0 0 8px;}' +
      '#' + ROOT_ID + ' .cp-detail{font-size:14px;line-height:1.45;color:#4b5563;margin:0;}' +
      '#' + ROOT_ID + ' .cp-spinner{width:34px;height:34px;margin:0 auto 14px;border-radius:50%;' +
      'border:4px solid #e5e7eb;border-top-color:#af282f;animation:cpSkinOverlaySpin 0.9s linear infinite;}' +
      '#' + ROOT_ID + ' .cp-check{width:38px;height:38px;margin:0 auto 12px;border-radius:50%;' +
      'background:#2e9e55;color:#fff;font-size:22px;line-height:38px;font-weight:700;}' +
      '#' + ROOT_ID + ' ul{list-style:none;padding:0;margin:12px 0 0;text-align:left;max-height:180px;overflow:auto;' +
      'font-size:13px;color:#374151;}' +
      '#' + ROOT_ID + ' li{padding:4px 0;border-top:1px solid #f0f1f3;}' +
      '#' + ROOT_ID + ' .cp-dismiss{display:none;margin:16px auto 0;background:none;border:none;color:#6b7280;' +
      'font-size:12px;text-decoration:underline;cursor:pointer;padding:0;}' +
      '#' + ROOT_ID + ' .cp-dismiss.cp-visible{display:block;}' +
      '@keyframes cpSkinOverlaySpin{to{transform:rotate(360deg);}}';
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureRoot() {
    if (root && document.body && document.body.contains(root)) return root;
    ensureStyles();
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'alertdialog');
    root.setAttribute('aria-live', 'polite');
    root.innerHTML = '<div class="cp-card"></div>';
    document.body.appendChild(root);
    return root;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function paint(html) {
    var overlay = ensureRoot();
    overlay.querySelector('.cp-card').innerHTML =
      html + '<button type="button" class="cp-dismiss">Dismiss</button>';
    overlay.querySelector('.cp-dismiss').addEventListener('click', hideAll);
    overlay.classList.add('cp-open');

    clearTimeout(dismissTimer);
    dismissTimer = setTimeout(function() {
      var button = overlay.querySelector('.cp-dismiss');
      if (button) button.classList.add('cp-visible');
    }, DISMISS_REVEAL_MS);
  }

  function renderWorking(title, detail) {
    paint(
      '<div class="cp-spinner"></div>' +
      '<p class="cp-title">' + escapeHtml(title) + '</p>' +
      (detail ? '<p class="cp-detail">' + escapeHtml(detail) + '</p>' : '')
    );
  }

  function renderDone(done) {
    var items = (done.lines || []).map(function(line) {
      return '<li>' + escapeHtml(line) + '</li>';
    }).join('');
    paint(
      '<div class="cp-check">&#10003;</div>' +
      '<p class="cp-title">' + escapeHtml(done.title) + '</p>' +
      (done.detail ? '<p class="cp-detail">' + escapeHtml(done.detail) + '</p>' : '') +
      (items ? '<ul>' + items + '</ul>' : '')
    );
    clearTimeout(doneTimer);
    doneTimer = setTimeout(hideAll, done.autoHideMs || 5000);
  }

  function armFailsafe() {
    clearTimeout(failsafeTimer);
    failsafeTimer = setTimeout(function() {
      console.warn('[CP Toolkit] Skin overlay failsafe: removing overlay that never finished');
      hideAll();
    }, FAILSAFE_MS);
  }

  function hideAll() {
    activeKeys = {};
    pendingDone = null;
    clearTimeout(failsafeTimer);
    clearTimeout(doneTimer);
    clearTimeout(dismissTimer);
    if (root) root.classList.remove('cp-open');
  }

  window.CPToolkitSkinOverlay = {
    /** Cover the page while the named operation is working. */
    show: function(key, title, detail) {
      activeKeys[key] = { title: title, detail: detail };
      clearTimeout(doneTimer);
      renderWorking(title, detail);
      armFailsafe();
    },

    /** Change the message of an operation that is already showing. */
    update: function(key, title, detail) {
      if (!activeKeys[key]) return;
      activeKeys[key] = { title: title, detail: detail };
      renderWorking(title, detail);
      armFailsafe();
    },

    /** The operation finished with nothing to announce. */
    hide: function(key) {
      // Ignore a hide for an operation that already finished or was never
      // shown, so it cannot cut a completion message short.
      if (!activeKeys[key]) return;
      delete activeKeys[key];
      if (activeCount() > 0) return;
      if (pendingDone) {
        var done = pendingDone;
        pendingDone = null;
        renderDone(done);
        return;
      }
      hideAll();
    },

    /** The operation finished; show a summary, then clear on its own. */
    complete: function(key, done) {
      delete activeKeys[key];
      if (activeCount() > 0) {
        pendingDone = done;
        return;
      }
      pendingDone = null;
      clearTimeout(failsafeTimer);
      renderDone(done);
    },

    isActive: function() {
      return activeCount() > 0;
    }
  };
})();
