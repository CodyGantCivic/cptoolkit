// CSS Editor Enhancement - Theme Manager Helper (MAIN world)
// This file runs in the page's MAIN world to access CivicPlus globals
(function() {
    'use strict';
    
    if (typeof window.initializePopovers !== 'undefined') {
        var originalInitializePopovers = window.initializePopovers;
        window.initializePopovers = function() {
            originalInitializePopovers();
            var textAreas = $(".cpPopOver textarea");
            textAreas.each(function() {
                $(this).attr("maxlength", 1000);
            });
            // console.log("[CP Toolkit] Text limit enforced (Theme Manager: 1000 chars)"); // Phase 3: Reduced logging
        };
    }
})();
