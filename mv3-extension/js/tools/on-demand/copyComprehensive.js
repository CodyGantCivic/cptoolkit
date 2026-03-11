// CSP FIX: Removed inline script injection - just use direct console.log
console.log("[CPToolbox] Comprehensive Script Copied to Clipboard");

var MobileGoogleTranslateScript = `
<!-- Fixed Nav Adjustment -->
<script>
  function getValueTS(elem, attr) {
    const val = elem.css(attr);
    if (val === undefined) return undefined;
    const num = parseInt(val, 10);
    if (num === NaN) return undefined;
    return num;
  }

  function clampTS(number, min, max) {
    return Math.min(Math.max(number, min), max);
  }

  function isPageEditingTS() {
    return (
      $("#doneEditing").length > 0 || // In live edit
      typeof DesignCenter !== "undefined" // In theme manager
    );
  }

  const bgColorRegexTS = /rgba\((\d+), (\d+), (\d+), (\d*\.?\d*)\)/;
  function isTransparentTS(elem) {
    const bg = elem.css('background-color');
    if (typeof bg !== "string" || !bg.startsWith('rgba(')) return false;
    const matchState = bg.match(bgColorRegexTS);
    if (!matchState || matchState.length !== 5) return false;
    const alpha = parseFloat(matchState[4], 10);
    if (!(alpha >= 0 && alpha < 1)) return false;
    return true;
  }

  function iterateLeftpads(cb) {
    const containersTS = $("[class^='siteWrap'],[class*=' siteWrap']");
    for (let i = 0; i < containersTS.length; i++) {
      const containerTS = containersTS[i];
      // Skip the body container and anything with data-skip-leftpad
      if (
        containerTS.id !== "bodyContainerTS" &&
        containerTS.getAttribute('data-skip-leftpad') === null
      ) {
        cb(containerTS);
      }
    }
  }

  const anchor = $("#divToolbars");
  const anchor2 = $("#headerContainerTS")

  // Outer banner padding (push banner down)
  const outerSizingTS = $("#bannerContainerTS");
  // Inner banner padding (push banner content down) - Transparent header OR on attaching headers
  const innerSizingTS = $("#bannerSizingTS");
  const bodyContainerTS = $("#bodyContainerTS");

  const forceUnfixClassTS = "forceUnfixTS";

  const fixedTopTS = $(".fixedTopTS");
  const fixedBottomTS = $(".fixedBottomTS");
  const fixedLeftTS = $(".fixedLeftTS");

  var initialTopTS;
  var topAttachTS;
  if (fixedTopTS && fixedTopTS.length === 1) {
    initialTopTS = getValueTS(fixedTopTS, 'top');
    const attachment = fixedTopTS.attr('data-attach');
    if (attachment) topAttachTS = $("#" + attachment);
    if (!topAttachTS || topAttachTS.length !== 1) topAttachTS = undefined;
  }

  function resizeAdjustmentTS() {
    const editing = isPageEditingTS();

    // Fixed top script
    (function () {
      if (!fixedTopTS || fixedTopTS.length !== 1 || initialTopTS === undefined) return;

      if (editing) {
        fixedTopTS[0].classList.add(forceUnfixClassTS);
      } else {
        fixedTopTS[0].classList.remove(forceUnfixClassTS);
      }

      const topPosition = fixedTopTS.css('position');
      if (topPosition === 'fixed') {
        if (topAttachTS) {
          scrollAdjustmentTS();
        } else {
          const anchorHeight = anchor.outerHeight() - 1;
          fixedTopTS.css('top', anchorHeight + initialTopTS);
        }
      } else {
        fixedTopTS.css('top', initialTopTS);
      }

      if (topPosition === 'fixed' || topPosition === 'absolute') {
        // Bump the banner content down
        if (isTransparentTS(fixedTopTS)) {
          innerSizingTS.css('padding-top', initialTopTS + fixedTopTS.outerHeight() - 1);
          outerSizingTS.css('padding-top', '');

          try {
            window.Pages.onResizeHandlersExecute();
          } catch (e) { }
        } else {
          outerSizingTS.css('padding-top', fixedTopTS.outerHeight() - 1);
          innerSizingTS.css('padding-top', '');
        }
      } else {
        innerSizingTS.css('padding-top', '');
        outerSizingTS.css('padding-top', '');
      }
    })();

    // Fixed bottom script
    (function () {
      if (!fixedBottomTS || fixedBottomTS.length === 0) return;

      // If the widget has gone narrow, force unfix
      if (editing || fixedBottomTS.outerHeight() > 200) {
        fixedBottomTS[0].classList.add(forceUnfixClassTS);
      } else {
        fixedBottomTS[0].classList.remove(forceUnfixClassTS);
      }

      if (fixedBottomTS.css('position') === 'fixed') {
        bodyContainerTS.css('padding-bottom', fixedBottomTS.outerHeight());
      } else {
        bodyContainerTS.css('padding-bottom', '');
      }
    })();

    // Fixed left script
    (function () {
      if (!fixedLeftTS || fixedLeftTS.length === 0) return;

      if (editing) {
        fixedLeftTS[0].classList.add(forceUnfixClassTS);
      } else {
        fixedLeftTS[0].classList.remove(forceUnfixClassTS);
      }

      if (fixedLeftTS.css('position') === 'fixed') {
        const anchorHeight = anchor.outerHeight() - 1;
        fixedLeftTS.css('top', anchorHeight);
        const leftBoundingTS = fixedLeftTS[0].getBoundingClientRect();
        iterateLeftpads(function (containerTS) {
          const containerBoundingTS = containerTS.getBoundingClientRect();
          if (containerBoundingTS.left <= leftBoundingTS.right) {
            $(containerTS).css('padding-left', leftBoundingTS.width + 16);
          }
        });
      } else {
        fixedLeftTS.css('top', '');
        iterateLeftpads(function (containerTS) {
          $(containerTS).css('padding-left', '');
        });
      }
    })();
  }

  function scrollAdjustmentTS() {
    if (!fixedTopTS || fixedTopTS.length !== 1 || !topAttachTS || topAttachTS.length !== 1) return;
    const topPosition = fixedTopTS.css('position');
    if (topPosition === 'fixed' || topPosition === 'absolute') {
      const anchorBounding = anchor[0].getBoundingClientRect();
      const attachBounding = topAttachTS[0].getBoundingClientRect();
      const scrollTop = $(window).scrollTop();

      fixedTopTS.css('top', Math.max(anchorBounding.bottom - 1, attachBounding.bottom));
    } else {
      fixedTopTS.css('top', initialTopTS);
    }
  }

  $(window).load(function () {
    setTimeout(function () {
      resizeAdjustmentTS();
    }, 350);

    $(window).scroll(function () {
      scrollAdjustmentTS();
    });

    var adjustTimeoutTS;
    $(window).resize(function () {
      clearTimeout(adjustTimeoutTS);
      adjustTimeoutTS = setTimeout(function () {
        resizeAdjustmentTS();
      }, 350);
    });

    $.when(window.Pages.angularToolbarComplete).done(function () {
      resizeAdjustmentTS();
    });
  });
</script>
<!-- End Fixed Nav Adjustment -->
`;

// Use modern clipboard API with fallback
if (navigator.clipboard && navigator.clipboard.writeText) {
  navigator.clipboard.writeText(MobileGoogleTranslateScript).then(function() {
    alert("[CPToolbox] Comprehensive Script Copied to Clipboard");
  }).catch(function() {
    fallbackCopy(MobileGoogleTranslateScript);
  });
} else {
  fallbackCopy(MobileGoogleTranslateScript);
}

function fallbackCopy(text) {
  var input = document.createElement("textarea");
  input.style.position = "fixed";
  input.style.opacity = 0;
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand("Copy");
  document.body.removeChild(input);
  alert("[CPToolbox] Comprehensive Script Copied to Clipboard");
}
