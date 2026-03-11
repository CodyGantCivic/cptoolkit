// CSS Editor Enhancement - Widget Manager Helper (MAIN world)
// This file runs in the page's MAIN world to access CivicPlus globals
(function() {
    'use strict';
    
    if (typeof window.InitializeWidgetOptionsModal !== 'undefined') {
        var oldInitOptionsModal = window.InitializeWidgetOptionsModal;
        window.InitializeWidgetOptionsModal = function() {
            oldInitOptionsModal();
            $("#MiscAdvStyles").attr("maxlength", 255);
            // console.log("[CP Toolkit] Text limit enforced (Widget Manager: 255 chars)"); // Phase 3: Reduced logging
        };
    }
})();
