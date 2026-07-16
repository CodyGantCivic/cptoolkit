# Chrome Web Store Submission Packet

Last updated: 2026-07-16

Purpose: keep the upload/review notes for the MV3 Web Store readiness submission in the repo.

## Package

- Extension name: `CivicPlus Internal Toolkit`
- Submission version: `1.1.5`
- Source folder: `mv3-extension`
- Production build folder: `mv3-extension-prod`
- Upload artifact: `dist/civicplus-internal-toolkit-1.1.5.zip`
- Privacy policy URL: `https://cp-vlasak.github.io/cptoolkit/privacy.html`
- Submission type: existing Chrome Web Store item update if the old listing can be recovered; otherwise new item submission using the same package.

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
- `webNavigation`: locates specific CMS iframe targets for image picker and upload workflows that require frame-aware behavior.
- `activeTab`: lets the popup inspect the current tab after a user gesture, especially before requesting an exact-origin vanity-domain permission.
- Required host permissions: limited to enumerated CivicPlus-owned platform and QA hosts so the detector/bootstrap can run on known CivicPlus surfaces.
- Optional host permissions: `https://*/*` is used only to request the current exact customer vanity origin after user action and positive DOM-marker detection.

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

1. Confirm local QA on `mv3-extension-dev` or `mv3-extension-prod`.
2. Run release checks and guardrails.
3. Build `mv3-extension-prod`.
4. Create `dist/civicplus-internal-toolkit-1.1.5.zip` with `manifest.json` at the ZIP root.
5. Upload the ZIP in Chrome Developer Dashboard.
6. Review Package, Store Listing, Privacy Practices, and Distribution tabs.
7. Submit for review.

## Manual QA Still Worth Doing Before Clicking Submit

- Known CP admin host activates toolkit normally.
- Known CP public Live Edit activates toolkit only when editor chrome is present.
- Trusted vanity Admin/DesignCenter and public Live Edit activate after the trust flow.
- Unknown non-CP page stays inactive and does not show extension errors.
- Theme Manager, Widget Manager, Graphic Links, snippet library, and Fancy Button library load without console regressions.
- Context-menu on-demand tools still appear and run on matching pages.
- Prevent-timeout has no extension errors after a two-minute alarm cycle with several CP tabs open.
