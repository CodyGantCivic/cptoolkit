// CivicPlus Toolkit - Version Update Badge (MV3)
// Paints a red dot on the toolbar icon when a newer release is published.
//
// The popup (js/popup.js) shows the in-popup "Update available" banner, but the
// popup only runs when opened. This module runs in the service worker so the
// badge appears while the popup is closed, prompting the user to open it.
//
// Source of truth: same GitHub repo the popup checks (keep UPDATE_REPO in sync
// with GITHUB_REPO in js/popup.js). Releases are tagged vX.Y.Z; we compare the
// tag against the installed manifest version.

// Keep in sync with GITHUB_REPO in js/popup.js
var UPDATE_REPO = 'cp-vlasak/cptoolkit';
var UPDATE_RELEASES_API = 'https://api.github.com/repos/' + UPDATE_REPO + '/releases/latest';

// Re-check on each SW spin-up only if the last check is older than this, so a
// frequently-respawned service worker doesn't burn the unauthenticated GitHub
// rate limit (60/hr). The periodic alarm forces a fresh check regardless.
var VERSION_CHECK_THROTTLE_MS = 6 * 60 * 60 * 1000; // 6 hours

// Numeric semver compare. Mirrors compareSemver() in js/popup.js.
// Returns 1 if a > b, -1 if a < b, 0 if equal.
function compareSemverParts(a, b) {
  var pa = String(a || '').replace(/^v/i, '').split('.');
  var pb = String(b || '').replace(/^v/i, '').split('.');
  var max = Math.max(pa.length, pb.length);
  for (var i = 0; i < max; i++) {
    var av = parseInt(pa[i], 10) || 0;
    var bv = parseInt(pb[i], 10) || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

// Show or clear the red update badge. "!" signals an update is available; an
// empty string clears the badge.
function setUpdateBadge(show) {
  if (show) {
    chrome.action.setBadgeBackgroundColor({ color: '#af282f' }); // CivicPlus red
    chrome.action.setBadgeText({ text: '!' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Fetch the latest release tag and reconcile the badge against the installed
// version. The badge is recomputed purely from (latest vs installed), so once
// the user updates and the installed version catches up, the dot clears itself
// on the next check — no popup interaction required.
async function checkForUpdateBadge(force) {
  try {
    if (!force) {
      var stored = await chrome.storage.local.get('cp-version-checked-at');
      var lastAt = stored['cp-version-checked-at'] || 0;
      // Date.now() is fine in the service worker (this isn't a workflow script).
      if (lastAt && (Date.now() - lastAt) < VERSION_CHECK_THROTTLE_MS) {
        return; // checked recently — leave the existing badge as-is
      }
    }

    var currentVersion = chrome.runtime.getManifest().version;
    var resp = await fetch(UPDATE_RELEASES_API);
    // On a transient failure (offline, rate limit, 5xx) leave the badge
    // untouched rather than clearing a legitimately-pending update.
    if (!resp.ok) return;

    var release = await resp.json();
    var latestTag = (release.tag_name || '').replace(/^v/i, '');
    if (!latestTag) return;

    var updateAvailable = compareSemverParts(latestTag, currentVersion) === 1;
    setUpdateBadge(updateAvailable);

    await chrome.storage.local.set({
      'cp-latest-version': latestTag,
      'cp-update-available': updateAvailable,
      'cp-version-checked-at': Date.now()
    });

    console.log('[CP Toolkit] Version check: installed v' + currentVersion +
      ', latest v' + latestTag + ' -> ' +
      (updateAvailable ? 'update available' : 'up to date'));
  } catch (e) {
    // Network/JSON errors are non-fatal — badge stays as-is until next check.
    console.warn('[CP Toolkit](version-check) error:', e);
  }
}

// Export for the service worker to drive from its lifecycle listeners.
self.versionCheck = {
  checkForUpdateBadge: checkForUpdateBadge,
  setUpdateBadge: setUpdateBadge,
  compareSemverParts: compareSemverParts,
  VERSION_CHECK_ALARM: 'cp-version-check'
};

console.log('[CP Toolkit] Version-check module loaded');
