(function loadTool() {
  var thisTool = "cp-MultipleInfoAdvancedItems";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool] !== false) {
        try {

/**
 * Multiple Info Advanced Items Upload
 *
 * Adds an "Add Multiple Items" button next to "Add Item" inside an
 * Info Advanced category on /Admin/InfoII.aspx.
 * Opens a modal where users paste a block of text — each non-empty line
 * becomes a separate Info Advanced item (name + body).
 */

(function() {
  'use strict';

  var TOOLKIT_NAME = '[CP Toolkit](cp-MultipleInfoAdvancedItems)';
  var MODAL_ID = 'cp-miai-modal';

  function getToday() {
    var today = new Date();
    var dd = String(today.getDate());
    var mm = String(today.getMonth() + 1);
    if (dd.length < 2) dd = '0' + dd;
    if (mm.length < 2) mm = '0' + mm;
    return mm + '/' + dd + '/' + today.getFullYear();
  }

  /**
   * Matches a phone number portion: (408) 779-7261, 408 779-7261, 408-779-7261, etc.
   */
  var PHONE_NUMBER = /[\(]?\d{3}[\)]?[\s.\-]?\d{3}[\s.\-]?\d{4}/;

  /**
   * Matches a full line that contains a phone number, with optional prefix.
   */
  var PHONE_LINE_REGEX = /^((?:(?:phone(?:\s*number)?|fax|tel)\s*:\s*)?)([\(]?\d{3}[\)]?[\s.\-]?\d{3}[\s.\-]?\d{4})\s*$/i;

  /**
   * Format a single line — HTML-escape it, and wrap phone numbers in a tel: link.
   * Only the number portion becomes a link; any prefix text stays as plain text.
   */
  function formatLine(line) {
    var match = PHONE_LINE_REGEX.exec(line);
    if (match) {
      var prefix = match[1]; // e.g. "Phone: " or ""
      var number = match[2]; // e.g. "(408) 779-7261"
      var digits = number.replace(/\D/g, '');
      var escapedPrefix = prefix.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var escapedNumber = number.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return escapedPrefix + '<a href="tel:' + digits + '">' + escapedNumber + '</a>';
    }
    return line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Parse pasted text into items.
   * - Each non-blank line becomes its own item.
   * - Blank lines are skipped but add a trailing <br> to the previous item's
   *   body (creates visual spacing on the front-end, like pressing Enter in Froala).
   * - Phone number lines get wrapped in a tel: link.
   */
  /**
   * Parse pasted text into item entries (name + trailing spacing flag).
   */
  function parseLines(text) {
    var rawLines = text.split('\n');
    var items = [];

    for (var i = 0; i < rawLines.length; i++) {
      var line = rawLines[i].trim();

      if (line.length === 0) {
        if (items.length > 0) {
          items[items.length - 1].trailingBr = true;
        }
        continue;
      }

      items.push({ name: line, trailingBr: false });
    }

    return items;
  }

  /**
   * Build final body HTML for an item given its format and bold setting.
   */
  function buildBodyHtml(item) {
    var isPhone = PHONE_LINE_REGEX.test(item.name);

    // Phone numbers always use their tel: link inside <p>, ignoring the format setting
    if (isPhone) {
      var formatted = formatLine(item.name);
      if (item.bold) formatted = '<strong>' + formatted + '</strong>';
      var html = '<p>' + formatted + '</p>';
      if (item.trailingBr) html += '<br>';
      return html;
    }

    var formatted = formatLine(item.name);
    if (item.bold) formatted = '<strong>' + formatted + '</strong>';
    var openTag, closeTag;
    switch (item.format) {
      case 'headline':    openTag = '<h1 class="headline">'; closeTag = '</h1>'; break;
      case 'subhead1':    openTag = '<h2 class="subhead1">'; closeTag = '</h2>'; break;
      case 'subhead2':    openTag = '<h3 class="subhead2">'; closeTag = '</h3>'; break;
      case 'hyperlink':   openTag = '<p><a href="/">'; closeTag = '</a></p>'; break;
      default:            openTag = '<p>'; closeTag = '</p>'; break;
    }
    var html = openTag + formatted + closeTag;
    if (item.trailingBr) html += '<br>';
    return html;
  }

  /**
   * Create a single Info Advanced item via POST.
   */
  function createItem(catId, itemName, bodyHtml, status, resourceId, csrfToken) {
    var data = new URLSearchParams();
    data.append('lngResourceID', resourceId);
    data.append('strResourceType', 'M');
    data.append('ysnSave', '1');
    data.append('strAction', 'qlLinkSave');
    data.append('strActionSubmit', '0');
    data.append('intQLCategoryID', catId);
    data.append('intQLLinkID', '0');
    data.append('txtCategoryIDListSave', catId);
    data.append('txtLink', itemName);
    data.append('txtLinkText', bodyHtml);
    data.append('dtiStartDate', getToday());
    data.append('save', status === 'Published' ? 'Save and Publish' : 'Save');
    if (csrfToken) {
      data.append('__RequestVerificationToken', csrfToken);
    }
    return fetch(window.location.origin + '/admin/infoii.aspx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: data.toString(),
      credentials: 'same-origin'
    });
  }

  function injectStyles() {
    if (document.getElementById(MODAL_ID + '-style')) return;
    var style = document.createElement('style');
    style.id = MODAL_ID + '-style';
    style.textContent =
      '#' + MODAL_ID + '{position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;}' +
      '#' + MODAL_ID + ' .cp-miai-dialog{background:#fff;border-radius:8px;width:550px;max-width:90vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,0.3);}' +
      '#' + MODAL_ID + ' .cp-miai-header{padding:16px 20px;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;justify-content:space-between;}' +
      '#' + MODAL_ID + ' .cp-miai-header h3{margin:0;font-size:18px;font-weight:600;color:#333;}' +
      '#' + MODAL_ID + ' .cp-miai-close{background:none;border:none;font-size:24px;cursor:pointer;color:#666;padding:0;line-height:1;}' +
      '#' + MODAL_ID + ' .cp-miai-close:hover{color:#333;}' +
      '#' + MODAL_ID + ' .cp-miai-body{padding:20px;overflow-y:auto;flex:1;}' +
      '#' + MODAL_ID + ' .cp-miai-label{display:block;font-size:13px;font-weight:500;color:#333;margin-bottom:4px;}' +
      '#' + MODAL_ID + ' .cp-miai-select,#' + MODAL_ID + ' .cp-miai-textarea{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;}' +
      '#' + MODAL_ID + ' .cp-miai-select:focus,#' + MODAL_ID + ' .cp-miai-textarea:focus{outline:none;border-color:#af282f;}' +
      '#' + MODAL_ID + ' .cp-miai-textarea{min-height:180px;resize:vertical;font-family:Arial,Helvetica,sans-serif;}' +
      '#' + MODAL_ID + ' .cp-miai-field{margin-bottom:14px;}' +
      '#' + MODAL_ID + ' .cp-miai-hint{font-size:12px;color:#666;margin-top:4px;}' +
      '#' + MODAL_ID + ' .cp-miai-footer{padding:16px 20px;border-top:1px solid #e0e0e0;display:flex;justify-content:flex-end;gap:8px;}' +
      '#' + MODAL_ID + ' .cp-miai-footer button{padding:6px 12px;border-radius:4px;font-size:14px;font-weight:500;cursor:pointer;border:none;line-height:normal!important;}' +
      '#' + MODAL_ID + ' .cp-miai-btn-cancel{background:#e0e0e0;color:#333;}' +
      '#' + MODAL_ID + ' .cp-miai-btn-cancel:hover{background:#d0d0d0;}' +
      '#' + MODAL_ID + ' .cp-miai-btn-submit{background:#af282f;color:#fff;}' +
      '#' + MODAL_ID + ' .cp-miai-btn-submit:hover{background:#c42f37;}' +
      '#' + MODAL_ID + ' .cp-miai-btn-submit:disabled{opacity:0.5;cursor:not-allowed;}' +
      '#' + MODAL_ID + ' .cp-miai-progress{margin-top:12px;font-size:13px;color:#333;}' +
      '#' + MODAL_ID + ' .cp-miai-progress-bar{height:6px;background:#e0e0e0;border-radius:3px;margin-top:6px;overflow:hidden;}' +
      '#' + MODAL_ID + ' .cp-miai-progress-fill{height:100%;background:#af282f;border-radius:3px;transition:width 0.3s;}' +
      '#' + MODAL_ID + ' .cp-miai-item-list{max-height:320px;overflow-y:auto;border:1px solid #e0e0e0;border-radius:4px;}' +
      '#' + MODAL_ID + ' .cp-miai-item-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;}' +
      '#' + MODAL_ID + ' .cp-miai-item-row:last-child{border-bottom:none;}' +
      '#' + MODAL_ID + ' .cp-miai-item-row:nth-child(even){background:#fafafa;}' +
      '#' + MODAL_ID + ' .cp-miai-item-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#333;}' +
      '#' + MODAL_ID + ' .cp-miai-item-format{width:100px;padding:4px 6px;border:1px solid #ccc;border-radius:3px;font-size:12px;}' +
      '#' + MODAL_ID + ' .cp-miai-item-bold{width:auto;margin:0;cursor:pointer;}';
    document.head.appendChild(style);
  }

  var FORMAT_OPTIONS = '<option value="normal">Normal</option><option value="headline">Headline</option><option value="subhead1">Subhead 1</option><option value="subhead2">Subhead 2</option><option value="hyperlink">Hyperlink</option>';

  function showModal(catId) {
    var old = document.getElementById(MODAL_ID);
    if (old) old.remove();

    injectStyles();

    var overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.innerHTML =
      '<div class="cp-miai-dialog">' +
        '<div class="cp-miai-header">' +
          '<h3>Add Multiple Items</h3>' +
          '<button type="button" class="cp-miai-close" id="cp-miai-close">&times;</button>' +
        '</div>' +
        '<div class="cp-miai-body">' +
          '<div class="cp-miai-field">' +
            '<label class="cp-miai-label" for="cp-miai-status">Status</label>' +
            '<select class="cp-miai-select" id="cp-miai-status">' +
              '<option value="Published">Published</option>' +
              '<option value="Draft">Draft</option>' +
            '</select>' +
          '</div>' +
          '<div id="cp-miai-step-paste">' +
            '<div class="cp-miai-field">' +
              '<label class="cp-miai-label" for="cp-miai-items">Items (one per line)</label>' +
              '<textarea class="cp-miai-textarea" id="cp-miai-items" placeholder="Paste items here (one per line)&#10;&#10;Example:&#10;City Name&#10;Address&#10;Phone Number&#10;Zip Code"></textarea>' +
              '<div class="cp-miai-hint">Each non-empty line becomes a separate Info Advanced item.</div>' +
            '</div>' +
          '</div>' +
          '<div id="cp-miai-step-review" style="display:none;">' +
            '<div class="cp-miai-field">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
                '<span class="cp-miai-label" style="margin:0;">Review Items</span>' +
                '<span class="cp-miai-hint" style="margin:0;">Format &amp; bold are per-item</span>' +
              '</div>' +
              '<div class="cp-miai-item-list" id="cp-miai-item-list"></div>' +
            '</div>' +
          '</div>' +
          '<div class="cp-miai-progress" id="cp-miai-progress" style="display:none;">' +
            '<span id="cp-miai-progress-text"></span>' +
            '<div class="cp-miai-progress-bar"><div class="cp-miai-progress-fill" id="cp-miai-progress-fill" style="width:0%;"></div></div>' +
          '</div>' +
        '</div>' +
        '<div class="cp-miai-footer">' +
          '<button type="button" class="cp-miai-btn-cancel" id="cp-miai-cancel">Cancel</button>' +
          '<button type="button" class="cp-miai-btn-submit" id="cp-miai-next">Continue</button>' +
          '<button type="button" class="cp-miai-btn-submit" id="cp-miai-submit" style="display:none;">Submit</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var closeBtn = overlay.querySelector('#cp-miai-close');
    var cancelBtn = overlay.querySelector('#cp-miai-cancel');
    var nextBtn = overlay.querySelector('#cp-miai-next');
    var submitBtn = overlay.querySelector('#cp-miai-submit');
    var textarea = overlay.querySelector('#cp-miai-items');
    var stepPaste = overlay.querySelector('#cp-miai-step-paste');
    var stepReview = overlay.querySelector('#cp-miai-step-review');
    var itemListEl = overlay.querySelector('#cp-miai-item-list');

    var parsedItems = [];

    function closeModal() {
      overlay.remove();
    }

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape' && document.getElementById(MODAL_ID)) {
        closeModal();
        document.removeEventListener('keydown', onEsc);
      }
    });

    // Step 1 → Step 2: Parse text and show review list
    nextBtn.addEventListener('click', function() {
      parsedItems = parseLines(textarea.value);
      if (parsedItems.length === 0) {
        textarea.style.borderColor = '#d32f2f';
        textarea.focus();
        return;
      }

      // Build item rows
      var rowsHtml = '';
      for (var i = 0; i < parsedItems.length; i++) {
        var item = parsedItems[i];
        var escaped = item.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        var isPhone = PHONE_LINE_REGEX.test(item.name);
        var formatOpts = FORMAT_OPTIONS;
        if (isPhone) {
          formatOpts = formatOpts.replace('value="hyperlink">', 'value="hyperlink" selected>');
        }
        rowsHtml +=
          '<div class="cp-miai-item-row" data-idx="' + i + '">' +
            '<span class="cp-miai-item-name" title="' + escaped + '">' + escaped + '</span>' +
            '<select class="cp-miai-item-format" data-idx="' + i + '">' + formatOpts + '</select>' +
            '<label style="display:flex;align-items:center;gap:3px;font-size:12px;cursor:pointer;white-space:nowrap;" title="Bold">' +
              '<input type="checkbox" class="cp-miai-item-bold" data-idx="' + i + '"> Bold' +
            '</label>' +
          '</div>';
      }
      itemListEl.innerHTML = rowsHtml;

      // Switch to review step
      stepPaste.style.display = 'none';
      stepReview.style.display = 'block';
      nextBtn.style.display = 'none';
      submitBtn.style.display = '';
    });

    // Step 2: Submit with per-item formatting
    submitBtn.addEventListener('click', function() {
      var status = overlay.querySelector('#cp-miai-status').value;

      // Read per-item format and bold from the review list
      for (var i = 0; i < parsedItems.length; i++) {
        var formatSel = itemListEl.querySelector('select[data-idx="' + i + '"]');
        var boldChk = itemListEl.querySelector('input[data-idx="' + i + '"]');
        parsedItems[i].format = formatSel ? formatSel.value : 'normal';
        parsedItems[i].bold = boldChk ? boldChk.checked : false;
      }

      // Build body HTML for each item
      var items = [];
      for (var j = 0; j < parsedItems.length; j++) {
        items.push({
          name: parsedItems[j].name,
          bodyHtml: buildBodyHtml(parsedItems[j])
        });
      }

      // Read page values
      var resourceIdInput = document.querySelector('input[name="lngResourceID"]');
      var resourceId = resourceIdInput ? resourceIdInput.value : '43';
      var csrfInput = document.querySelector('input[name="__RequestVerificationToken"]');
      var csrfToken = csrfInput ? csrfInput.value : '';

      // Disable controls
      submitBtn.disabled = true;
      cancelBtn.disabled = true;
      overlay.querySelector('#cp-miai-status').disabled = true;
      var allSelects = itemListEl.querySelectorAll('select');
      var allCheckboxes = itemListEl.querySelectorAll('input[type="checkbox"]');
      for (var s = 0; s < allSelects.length; s++) allSelects[s].disabled = true;
      for (var c = 0; c < allCheckboxes.length; c++) allCheckboxes[c].disabled = true;

      // Show progress
      var progressEl = overlay.querySelector('#cp-miai-progress');
      var progressText = overlay.querySelector('#cp-miai-progress-text');
      var progressFill = overlay.querySelector('#cp-miai-progress-fill');
      progressEl.style.display = 'block';

      var completed = 0;
      var errors = 0;
      var total = items.length;

      function updateProgress() {
        progressText.textContent = 'Creating item ' + (completed + errors) + ' of ' + total + (errors > 0 ? ' (' + errors + ' failed)' : '') + '...';
        var pct = Math.round(((completed + errors) / total) * 100);
        progressFill.style.width = pct + '%';
      }

      function processNext(idx) {
        if (idx >= items.length) {
          if (errors === 0) {
            progressFill.style.background = '#4CAF50';
            progressText.textContent = 'Created ' + completed + ' item' + (completed !== 1 ? 's' : '') + ' successfully!';
          } else {
            progressFill.style.background = '#cc6600';
            progressText.textContent = 'Done: ' + completed + ' created, ' + errors + ' failed.';
          }
          progressFill.style.width = '100%';
          console.log(TOOLKIT_NAME + ' Created ' + completed + ' items, ' + errors + ' errors');
          setTimeout(function() {
            window.location.reload();
          }, 1000);
          return;
        }

        updateProgress();

        var item = items[idx];

        createItem(catId, item.name, item.bodyHtml, status, resourceId, csrfToken)
          .then(function(resp) {
            if (resp.ok) {
              completed++;
              console.log(TOOLKIT_NAME + ' Created: ' + item.name);
            } else {
              errors++;
              console.warn(TOOLKIT_NAME + ' Failed (' + resp.status + '): ' + item.name);
            }
          })
          .catch(function(err) {
            errors++;
            console.warn(TOOLKIT_NAME + ' Error creating "' + item.name + '":', err);
          })
          .finally(function() {
            setTimeout(function() {
              processNext(idx + 1);
            }, 150);
          });
      }

      processNext(0);
    });

    // Focus the textarea
    setTimeout(function() { textarea.focus(); }, 50);
  }

  /**
   * Initialize: only on /admin/infoii.aspx, item list view (has "Add Item" button).
   * The "Add Item" button has onclick="addLink(catId, 'qlLinkAdd')".
   */
  function init() {
    var path = (window.location.pathname || '').toLowerCase();
    if (path !== '/admin/infoii.aspx') return;

    // Wait for the "Add Item" button to appear (indicates item list view inside a category)
    var attempts = 0;
    var maxAttempts = 50;
    (function waitForButton() {
      var addItemBtn = document.querySelector('input[value="Add Item"]');
      if (!addItemBtn) {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(waitForButton, 200);
        }
        return;
      }

      // Get category ID from the Add Item button's onclick handler
      var onclick = addItemBtn.getAttribute('onclick') || '';
      var match = onclick.match(/addLink\((\d+)/);
      var catId = match ? match[1] : null;

      // Fallback: read from hidden input
      if (!catId) {
        var catIdInput = document.querySelector('input[name="intQLCategoryID"]');
        catId = catIdInput ? catIdInput.value : null;
      }

      if (!catId) {
        console.log(TOOLKIT_NAME + ' Could not determine category ID');
        return;
      }

      // Create the trigger button
      var triggerButton = document.createElement('input');
      triggerButton.type = 'button';
      triggerButton.className = 'cp-button';
      triggerButton.value = 'Add Multiple Items';
      triggerButton.style.marginLeft = '5px';

      // Insert next to the "Add Item" button
      addItemBtn.insertAdjacentElement('afterend', triggerButton);

      triggerButton.addEventListener('click', function(e) {
        e.preventDefault();
        showModal(catId);
      });

      console.log(TOOLKIT_NAME + ' Button added (category ' + catId + ')');
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

        console.log("[CP Toolkit] Loaded " + thisTool);
        } catch (err) {
          console.warn("[CP Toolkit](" + thisTool + ") error:", err);
        }
      }
    });
  });
})();
