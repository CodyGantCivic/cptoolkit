# Chrome Web Store Submission Packet

Last updated: 2026-10-19

Purpose: keep the upload/review notes for the MV3 Web Store readiness submission in the repo.

## Package

- Extension name: `CivicPlus Internal Toolkit`
- Submission version: `1.2.1` (late patch; `1.2.0` was submitted first on 2026-10-18 and this replaces it; last shipped version before that: `1.1.71`)
- Source folder: `mv3-extension`
- Local unpacked test folder: the same `mv3-extension` source folder
- Production build folder: none; the Store package is assembled directly from the tested source tree
- Upload artifact: `mv3-extension/dist/civicplus-internal-toolkit-1.2.1.zip`
- Verified size: 2,241,850 bytes
- Verified runtime file count: 191
- SHA-256: `A6D2964040C79A69133E8B2AC28D5C361F19F5643FBFF5A89EE8D97A6E66DF4D`
- Privacy policy URL: `https://cp-vlasak.github.io/cptoolkit/privacy.html`
- Submission type: update to the existing Chrome Web Store item. If the 1.2.0 submission is still pending review, cancel it in the dashboard and upload this 1.2.1 package in its place (the version must be higher than 1.2.0); if 1.2.0 has already published, submit 1.2.1 as a normal update. This update adds one new permission, `declarativeContent` (green toolbar dot on CivicPlus-looking pages); its justification is in the permissions section below.

## Single Purpose

CivicPlus employee-only toolkit that adds approved workflow helpers to CivicPlus CMS, Design Center, Live Edit, identity, and trusted customer vanity-domain admin/editor pages.

## Remote Code Declaration

Select: no remote code execution.

Notes:

- Extension scripts are bundled local files.
- The MV3 activation pipeline selects fixed local files from `js/background/toolkit-injection-registry.js`.
- On-demand tools are injected by the service worker using fixed files from `data/on-demand-tools.json`.
- Some tools can copy or write customer-site HTML/CSS snippets that contain external URLs, but those are site content outputs, not extension-loaded remote code.

## Permission Justifications

- `storage`: stores toolkit settings, saved snippets, saved skins/buttons, trusted vanity origins, and user workflow preferences locally in Chrome.
- `contextMenus`: provides employee-invoked on-demand tools from the browser context menu.
- `scripting`: injects bundled toolkit scripts only after CivicPlus CMS/Live Edit/identity detection or a user action.
- `alarms`: runs the session-timeout check reliably in background tabs without relying on throttled page timers.
- `webNavigation`: locates specific CMS iframe targets for image picker and upload workflows that require frame-aware behavior. It also reports the URL of top-level navigations so the toolbar popup can offer to approve a vanity domain whose address looks like a CivicPlus admin path (`/admin`, `/designcenter`); no script is injected and no page content is read for this.
- `activeTab`: lets the popup inspect the current tab after a user gesture, especially before requesting an exact-origin vanity-domain permission.
- `declarativeContent`: lets Chrome itself match a short list of CivicPlus-specific page markers (for example the admin header and Live Edit toolbar) and show a green dot on the toolbar icon. Chrome performs the match; no extension code runs on the page and no page content is read or transmitted. The dot only hints that the user can open the popup and choose whether to trust the site.
- Required host permissions: limited to enumerated CivicPlus-owned platform and QA hosts so the detector/bootstrap can run on known CivicPlus surfaces.
- Optional host permissions: `https://*/*` is used only to request the current exact customer vanity origin after the user clicks Trust in the toolbar popup and approves Chrome's own permission prompt. The popup may open automatically for an admin-looking URL, but it never grants access by itself, and nothing runs on the site until the user approves.

## Web Accessible Resources Justification

Web-accessible resources are limited to assets that activated tools must load into CMS pages.

- CP platform hosts can access bundled JSON, images, helper scripts, social assets, custom CSS, and Font Awesome assets needed by activated tools.
- Trusted vanity domains can access selected JSON/images/helper scripts through a dynamic HTTPS entry after origin trust.
- Font Awesome CSS/fonts are listed in a separate static HTTPS entry because the stylesheet loads fonts by relative URL on activated vanity pages.
- On-demand tool scripts are not web-accessible; they are injected by the service worker.

## Privacy Practices Draft

Recommended disclosure: no sale or transfer of user data. Data is stored locally in Chrome extension storage for employee workflow preferences and reusable snippets/skins/buttons. The extension does not send browsing data or saved toolkit data to CivicPlus or third-party analytics.

Public policy page: `https://cp-vlasak.github.io/cptoolkit/privacy.html`

If the dashboard asks for data categories, review carefully with the final privacy owner. The working assumption is local extension storage only, not external collection.

## Upload Checklist

1. Confirm local QA by loading the source-of-truth `mv3-extension` folder unpacked.
2. Run release checks and guardrails.
3. Create `mv3-extension/dist/civicplus-internal-toolkit-1.2.1.zip` directly from the tested source tree, including only `manifest.json`, `css/`, `data/`, `html/`, `images/`, `js/`, and `socials/`.
4. Verify `manifest.json` is at the ZIP root, the packaged version is `1.2.1`, and every packaged file matches the source tree.
5. Upload the ZIP in Chrome Developer Dashboard.
6. Review Package, Store Listing, Privacy Practices, and Distribution tabs.
7. Submit for review.

The artifact above was assembled and byte-compared against the source tree on 2026-10-19. If any runtime source file changes during acceptance testing, rebuild the ZIP and replace the size, file count, and SHA-256 recorded here.

Version 1.2.1 is a bugfix patch on top of 1.2.0: (1) the View All visited-state background on the Calendar and News Flash skin defaults was red and is now gray (`#757575`); (2) Multiple Category Upload no longer lets Submit be clicked twice while categories are saving; (3) the CSS editor no longer shows `PH0` for a skin class inside `:has()`/`:not()`; (4) an unsaved skin's temporary ID (`-1`, `-2`, ...) is no longer written into CSS, snippets or copied selectors, and leftover `.skin-N` text is repaired to the real ID when a saved skin is opened. The 1.2.0 package that was submitted first had SHA-256 `AB101DA3D279FB6E0DA79782FDFE15D51E8F5044BAE92A1F25FACD548A75C0BA`. Local unpacked acceptance testing for 1.2.1 is pending with the release owner; do not upload until it passes. Rollback checkpoint for the 1.1.6 release: `pre-v1.1.6-2026-07-27`.

## Manual QA Still Worth Doing Before Clicking Submit

- Known CP admin host activates toolkit normally.
- Known CP public Live Edit activates toolkit only when editor chrome is present.
- Trusted vanity Admin/DesignCenter and public Live Edit activate after the trust flow.
- Unknown non-CP page stays inactive and does not show extension errors.
- Theme Manager, Widget Manager, Graphic Links, snippet library, and Fancy Button library load without console regressions.
- Context-menu on-demand tools still appear and run on matching pages.
- Prevent-timeout has no extension errors after a two-minute alarm cycle with several CP tabs open.
- New in 1.2.0: the green dot appears on CivicPlus-looking pages; the Copy selector menu (media queries, row prefixes) works; the Skin Manager lists the new News Flash, Footer and Utilities defaults first; a View All button on a Calendar or News Flash default skin stays gray after it has been visited (1.2.1); in a skin's Advanced Styles, typing `:has(.widget.skin1)` shows the skin class (not `PH0`) and an unsaved skin never gets `.skin-2` written in (1.2.1); the Rectangular arrow snippet shows in the flyout for a news skin's Footer.
