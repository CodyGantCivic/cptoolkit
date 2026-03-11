// Widget Skin Advanced Style Helper - Page Context Helper (MAIN world)
// Defines window.__CPToolkit_fireAllJqChangeHandlers function
(function() {
  if (window.__CPToolkit_fireAllJqChangeHandlersInjected) return;
  window.__CPToolkit_fireAllJqChangeHandlersInjected = true;
  
  window.__CPToolkit_fireAllJqChangeHandlers = function(elem) {
    try {
      var jq = window.jQuery;
      if (jq && jq._data) {
        try {
          var evs = jq._data(elem, 'events');
          if (evs && evs.change) {
            for (var i = 0; i < evs.change.length; i++) {
              try {
                // call handler with a jQuery.Event to match expectations
                evs.change[i].handler.call(elem, jq.Event('change'));
              } catch (errH) {
                console.warn('[CP Toolkit] page handler threw', errH);
              }
            }
            return;
          }
        } catch (errGet) {
          // fall through to trigger
        }
        try {
          // trigger as fallback (delegated handlers will catch)
          jq(elem).trigger('change');
          return;
        } catch (errTrig) {
          // fallthrough to native
        }
      }
    } catch (err) {
      // ignore
    }
    // final fallback: native change event (bubbles)
    try {
      var e = new Event('change', { bubbles: true, cancelable: true });
      elem.dispatchEvent(e);
    } catch (err2) {
      console.warn('[CP Toolkit] failed to dispatch change', err2);
    }
  };
})();
