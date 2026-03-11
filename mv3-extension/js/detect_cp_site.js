// Phase 3: Reduced logging - only log module load once, cache detection result
// console.log("[CP Toolkit] Site detection module loaded"); // Commented out - too verbose

// Cache the detection result so we only make one HTTP request
let _cpSiteDetectionPromise = null;
let _cpSiteDetected = null;

function createCPSitePromise() {
  return new Promise(function(resolve, reject) {
    var fileTestRequest = new XMLHttpRequest();
    fileTestRequest.open("HEAD", "/Assets/Mystique/Shared/Components/ModuleTiles/Templates/cp-Module-Tile.html");
    fileTestRequest.timeout = 5000; // Add timeout
    
    fileTestRequest.onload = function() {
      var hasTestFile = fileTestRequest.status === 200;
      // Only log once when site is detected
      if (hasTestFile && _cpSiteDetected === null) {
        console.log("[CP Toolkit] ✓ CivicPlus site detected");
      } else if (!hasTestFile) {
        console.log("[CP Toolkit] ✗ Not a CivicPlus site (test file returned " + fileTestRequest.status + ")");
      }
      _cpSiteDetected = hasTestFile;
      resolve(hasTestFile);
    };
    
    fileTestRequest.onerror = function() {
      console.log("[CP Toolkit] ✗ Not a CivicPlus site (network error)");
      _cpSiteDetected = false;
      resolve(false); // RESOLVE FALSE instead of reject - prevents unhandled rejection
    };
    
    fileTestRequest.ontimeout = function() {
      console.log("[CP Toolkit] ✗ Not a CivicPlus site (timeout)");
      _cpSiteDetected = false;
      resolve(false);
    };
    
    fileTestRequest.send();
  });
}

async function detect_if_cp_site(callback) {
  try {
    // Guard against invalidated extension context (e.g., extension reloaded while page still open)
    if (!chrome.runtime?.id) return;

    // Use cached promise if available, otherwise create new one
    if (_cpSiteDetectionPromise === null) {
      _cpSiteDetectionPromise = createCPSitePromise();
    }
    var isCPsite = await _cpSiteDetectionPromise;

    // Re-check context validity after async wait - extension may have been reloaded during detection
    if (!chrome.runtime?.id) return;

    if (isCPsite) {
      // Content scripts run at document_start — wait for body to exist
      // before calling tools that may need DOM access (MutationObservers, etc.)
      if (document.body) {
        callback();
      } else {
        document.addEventListener("DOMContentLoaded", function () {
          if (chrome.runtime?.id) callback();
        });
      }
    }
  } catch (err) {
    // Silently ignore "Extension context invalidated" errors (extension was reloaded)
    if (err.message?.includes('Extension context invalidated')) return;
    console.error("[CP Toolkit] Site detection error:", err);
    // Don't call callback on error
  }
}
