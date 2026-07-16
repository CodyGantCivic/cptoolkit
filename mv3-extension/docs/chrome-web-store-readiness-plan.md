# Chrome Web Store Readiness Plan

Last updated: 2026-07-15

Purpose: preserve the Chrome Web Store / MV3 action plan in the repo so future work does not depend on Codex task history.

## Source Context

- Codex task history: `019f41f1-425c-7152-9cf5-9be881c7c48a` (`Assess Chrome Store security`)
- Cody/Claude/Codex architecture note supplied by George: 2026-07-08, task id `784fc30c-f921-4738-b5c5-1a0f3e611f1e`
- Claude artifact supplied by George: `Phase 0 Tool Audit - Handoff for George.mhtml`, saved locally at `C:\Users\vlasak.NWP_MAN\Downloads\Phase 0 Tool Audit - Handoff for George.mhtml`
- Repo audit note from that artifact: `docs/store-activation-phase0-tool-audit.md`
- Current extension folder reviewed: `mv3-extension`
- Policy references used in the prior review:
  - Chrome MV3 remote-hosted-code requirements: `https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements`
  - Chrome web-accessible-resources docs: `https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources`
  - Chrome `activeTab` concept docs: `https://developer.chrome.com/docs/extensions/develop/concepts/activeTab`

## Current State

The extension is MV3. As of the 2026-07-14 activation checkpoint, the manifest no longer declares required all-sites access:

- `content_scripts[0].matches`: enumerated CivicPlus platform/identity hosts only:
  - `*://civicplus.com/*`, `*://*.civicplus.com/*`
  - `*://civic.place/*`, `*://*.civic.place/*`
  - `*://civicplus.pro/*`, `*://*.civicplus.pro/*`
  - `*://cpqa.ninja/*`, `*://*.cpqa.ninja/*`
- `content_scripts[0].all_frames`: `true`, but the static chain is now tiny detector-only:
  - `js/content/cp-dom-detector.js`
  - `js/content/toolkit-activation-bootstrap.js`
- `permissions`: `activeTab` has been added for user-invoked surfaces.
- `host_permissions`: narrowed to the same enumerated CivicPlus platform/identity host list.
- `optional_host_permissions`: `https://*/*`, used only to request exact customer vanity origins such as `https://coz.org/*` after user approval.
- `web_accessible_resources.matches`: the primary asset entry is narrowed to the same enumerated host list.
- Vanity-domain assets are split into a dynamic HTTPS entry for selected JSON/images/helper scripts and a static HTTPS entry for the public vendored Font Awesome CSS/font files that page-injected stylesheets must load by relative URL.
- jQuery and the automatic on-load toolkit files are now delayed until the detector activates a specific lane.
- `js/popup.js` no longer runs the legacy Mystique `HEAD` probe on arbitrary active tabs, which prevents SPA/fallback 200 false positives such as `reddit.com`.
- Vanity domains use a user-gesture flow: the popup runs the tiny DOM detector under `activeTab` on the current HTTPS tab, then offers `Trust this domain` only if CMS/admin/Live Edit markers pass.

The legacy CP-site gate is still present in `js/detect_cp_site.js`, which performs a `HEAD` request to:

```text
/Assets/Mystique/Shared/Components/ModuleTiles/Templates/cp-Module-Tile.html
```

That legacy gate is no longer part of the static content-script chain. `mini-ide.js` previously had its own copy of the same `HEAD` probe, but that redundant check was removed on 2026-07-15 after central detector activation landed. The old probe has a known false-positive class on some `*.civicplus.pro` Evolve SPA routes that return a 200 HTML shell for missing paths.

The Phase 0 audit adds one important correction to the simple two-lane model: the toolkit has three activation contexts, not two:

1. Admin/design: `/Admin` or `/DesignCenter` plus CMS shell markers.
2. Live Edit/editor shell: public-style URL, but logged-in editor UI is present.
3. All-pages CP-host CSS: `custom-css-deployer` rules with scope `all-pages`.

## Fetched Security Items

These were the previously identified security/workflow items to work through:

1. Attribute-context XSS: fix quote-unsafe escaping in HTML attributes and textarea/template sinks.
2. Partial option-set import failure: prevent duplicate/orphaned option sets if create succeeds but save fails.
3. Form scoping: avoid saving fields from the wrong Widget Manager form.
4. Broad activation/scope: only run tools on CMS/admin/live-edit contexts where they are actually needed.
5. Broad web-accessible resources: reduce extension files exposed to all websites.
6. Remote assets: remove or document external loads like Google Fonts/API calls.
7. Manifest permissions / broad host matches: reduce `*://*/*` and justify what remains.
8. Storage bridge hardening: whitelist storage keys and guard against prototype-pollution style keys.
9. Slideout UX: prevent menus/modals from closing during normal drag/select interactions.
10. Multi-skin stored data validation: `copy-multiple-skins.js` must validate the value stored under `cp-toolkit-multi-skins`, not just trust that the storage bridge only permits an allowed key.

Work already done in the recent security pass included hardening imported/library rendering, fixing several quote-escaping sinks, removing Google Fonts preview stylesheet injection, tightening imported image URL protocols, and updating the remote-host guardrail allowlist after Google Fonts removal.

New confirmed item from Cody's review: the storage bridge allowlist prevents arbitrary storage keys, but page JavaScript on a CP-detected page can still write attacker-controlled data to allowed key `cp-toolkit-multi-skins` through the `cp-toolkit-storage-set` CustomEvent. `copy-multiple-skins.js` later trusts `savedSkin.components[*].data` and writes it into `DesignCenter.themeJSON.WidgetSkins[*].Components[idx]` before `saveTheme()`. Fix before Store submission because the mitigation is one-file and low-risk: validate component data shape, whitelist expected fields, reject unknown fields, type-check values, cap string lengths, and abort the whole import on failure.

Step 1 implementation status as of 2026-07-14:

- Rollback checkpoint created locally at branch `codex/backup-pre-store-step1-2026-07-14`.
- Working branch: `codex/security-multi-skins-data-validation`.
- `js/tools/on-demand/copy-multiple-skins.js` now preflights selected saved skins before any Theme Manager mutation, skin creation, `saveTheme()`, or page refresh.
- The validator derives an allowed component-field schema from the current Theme Manager `DesignCenter.themeJSON.WidgetSkins[*].Components[*]`, rejects unexpected fields and unsafe keys, rejects arrays/functions/non-plain objects, validates nested spacing/value objects against observed nested keys, caps string size, requires valid component indexes/views, and shows an error toast/status message when import is cancelled.
- This contains the storage-bridge value-trust issue without changing the broader manifest/activation model yet.

Step 2 implementation status as of 2026-07-14:

- Added `js/background/toolkit-injection-registry.js` as the central automatic-injection inventory.
- `js/background/service-worker.js` imports the registry, but no runtime injection behavior is switched over yet.
- The registry preserves current manifest order and classifies each automatic file by kind, activation lane, frame target, execution world, jQuery dependency, timing risk, and ordering notes.
- The registry explicitly separates automatic on-load tooling from existing on-demand context-menu tooling (`data/on-demand-tools.json`).
- Registry follow-up completed: `adfs.js` was rewritten to vanilla JS so the future narrow static identity/SAML lane does not need jQuery.

Detector module checkpoint as of 2026-07-14:

- Added `js/content/cp-dom-detector.js` as an additive bounded DOM-marker detector.
- `js/background/toolkit-injection-registry.js` records this detector as the `document_start` static detector.
- The detector does not use jQuery and does not perform the legacy Mystique `HEAD` request.
- It classifies lanes instead of returning a single yes/no:
  - `admin`: `/Admin` or `/DesignCenter` path plus independent CMS DOM evidence.
  - `live-edit`: public-style editor shell markers plus host/form/asset evidence.
  - `identity`: SAML login or known CivicPlus identity paths.
  - `all-pages-cp-host-css`: known CivicPlus platform host only, for the future minimal custom CSS lane.
- It uses path/host markers, CMS shell selectors, Live Edit markers, CP asset/link/script markers, and hidden form inputs.
- It ignores `cp-toolkit-*` elements so toolkit UI cannot self-confirm a page.
- It uses a bounded `MutationObserver`, `requestAnimationFrame` coalescing, and a 7-second timeout.
- Activation orchestration has been added: run this tiny detector first, then load lane-appropriate files from the registry.

Activation orchestration checkpoint as of 2026-07-14:

- Added `js/content/toolkit-activation-bootstrap.js` as the detector companion content script.
- Added `js/background/toolkit-activation.js` and wired it into `js/background/service-worker.js`.
- The bootstrap sends only lane names and activation kind. It does not send script paths or detector marker details.
- The service worker validates sender URL against approved CivicPlus hosts and maps lanes to fixed local extension files from `CPToolkitInjectionRegistry`.
- `full-toolkit` activation injects jQuery plus ordered on-load tools only after `admin` or `live-edit` detection.
- `all-pages-cp-host-css` activation injects only `custom-css-deployer.js` on approved CP host top frames.
- `identity` activation injects only `adfs.js`.
- `image-picker-frame` activation injects only `remember-image-picker-state.js` into selected image-picker frames.
- Duplicate injection is guarded per frame with an extension-world marker.
- Vanity-domain optional permissions are implemented for HTTPS pages after positive DOM detection. Public vanity Live Edit pages can be trusted from the popup; ordinary public vanity pages without editor/CMS markers still do not auto-run.

Vanity-domain optional permission checkpoint as of 2026-07-15:

- `manifest.json` declares optional HTTPS host access without adding required all-sites access.
- On unknown HTTPS hosts, the popup uses `activeTab` to inject only `cp-dom-detector.js` and run bounded DOM detection on the active tab. It does not use the URL path alone as proof.
- If detector lanes include `admin`, `live-edit`, or `identity`, the popup shows `Trust this domain`.
- The trust button requests only the current exact origin pattern, for example `https://coz.org/*`.
- After grant, the service worker verifies `chrome.permissions.contains()`, stores the trusted origin, registers detector/bootstrap content scripts for future navigations on that origin, and activates the current tab through the registry-controlled injection path.
- The service worker accepts content-script activation from unknown hosts only when the exact origin permission is already granted.
- No script path is accepted from the popup or page; script selection remains centralized in `CPToolkitInjectionRegistry`.
- Runtime assets used by activated tools on trusted vanity domains are exposed through separate `web_accessible_resources` entries. Selected JSON/images/helper scripts remain behind `use_dynamic_url: true`; Font Awesome CSS/font files are listed separately without `use_dynamic_url` so CSS-relative font URLs resolve on activated vanity pages. This is required because optional host permission does not by itself make bundled extension assets loadable by a webpage origin.
- Current limitation: all-pages custom CSS on non-editor public vanity pages is not auto-activated by this optional-origin flow.

Prior review conclusion: earlier PR work did not add new permissions, host permissions, or web-accessible-resource exposure, and it did not add remote code execution patterns. The activation checkpoint directly addresses the biggest residual Chrome Store/internal-vetting issue by removing required `*://*/*` from content-script matching, host permissions, and WAR exposure. Remaining review work is focused on manual CMS QA, dead legacy probe cleanup, resource-list pruning, and permission/behavior justification.

## Cody Architecture Verdict

The "tiny detector, then activate toolkit" proposal is sound but incomplete.

It is a real performance, privacy, and attack-surface improvement because non-CP pages would no longer load jQuery and the full toolkit. However, by itself it does not solve Chrome Web Store review risk because Chrome evaluates install-time warnings and reviewer scrutiny from declared manifest fields:

- `content_scripts.matches`
- `host_permissions`
- `web_accessible_resources.matches`

If those remain `*://*/*`, runtime gating only changes behavior after Chrome has accepted all-sites reach.

Hard constraint: zero-click auto-detection on arbitrary customer vanity domains conflicts with avoiding broad declared all-sites access. We need a per-surface access model.

## Target Architecture

1. Remove broad required host permissions.
   - Required host permissions should include only enumerable CivicPlus-owned platform/identity domains.
   - Current proposed list from the Phase 0 artifact: `*://*.civicplus.com/*`, `*://*.civic.place/*`, `*://*.civicplus.pro/*`, `*://*.cpqa.ninja/*`.
   - `*.civicplus.com` is important because the artifact says every tenant has a canonical host there, even when a vanity domain is configured.
   - The exact list is still a blocking input.

2. Add `activeTab`.
   - Use popup/context-menu/user gesture access for on-demand tools and first-use checks.
   - This avoids asking for all-sites access up front.

3. Use `optional_host_permissions` for customer vanity domains.
   - Request origin-specific grants only after a user action and positive detector result.
   - Example shape: request `https://city.gov/*`, not blanket `*://*/*`.
   - Do not request all-sites as a normal activation path.
   - Status: implemented for exact HTTPS vanity origins after positive admin, identity, or Live Edit DOM detection.

4. Split detector from toolkit activation.
   - Manifest-declared content scripts should be tiny and detector-only on known CP domains.
   - Full toolkit scripts load only after detection passes.
   - Use `chrome.scripting.executeScript` for current-tab activation.
   - Current checkpoint uses `chrome.scripting.executeScript` for detector-triggered activation.
   - Optional vanity-origin work uses `chrome.scripting.registerContentScripts` for approved origins.

5. Replace the network `HEAD` probe with DOM-marker detection.
   - Prefer path plus DOM shell markers over probing a Mystique asset.
   - This improves privacy and avoids the Evolve SPA false positive.
   - Detector module added and wired into the current runtime.

6. Rework `web_accessible_resources`.
   - Previous `matches: ["*://*/*"]` was too broad.
   - Content scripts usually do not need files to be web-accessible.
   - Current checkpoint restricts matches to approved origins.
   - A narrow `https://*/*` dynamic-resource entry exists for vanity-origin runtime assets after user trust; keep that list specific and do not add scripts/tools casually.

7. Handle `adfs.js` separately.
   - `adfs.js` intentionally does not call `detect_if_cp_site`.
   - It self-gates on `/admin/saml/logonrequest` and redirects to `/Admin/?saml=off`.
   - A DOM-shell-only activator could break this unless ADFS gets its own narrow host/path lane.
   - Registry follow-up completed: `adfs.js` no longer depends on jQuery, so the future static identity/SAML lane can stay tiny.

8. Preserve `custom-css-deployer` as a third activation lane if the product decision is to keep `all-pages` rules.
   - Recommended by the Phase 0 audit: keep a dedicated all-paths lane on enumerated CP hosts.
   - Vanity public URLs would require one-time opt-in before all-pages CSS can apply there.
   - This lane should be host-scoped, not admin-path-scoped. The point of `all-pages` rules is employee-local CSS fixes for public-style CMS pages and system UI issues that may not live under `/Admin` or `/DesignCenter`.
   - Do not use this as a reason to load the full toolkit on all pages. The all-pages lane should load only the minimal custom CSS applicator when a matching enabled rule exists.

9. Make the injection pipeline frame-aware.
   - Most tools should be top-frame only.
   - `remember-image-picker-state` must run in selected image-picker frames.
   - `cp-InfoAdvancedImportExport` and `cp-ImportFancyButton` need top-frame code plus the existing service worker frame bridge, not blanket injection into every frame.

## Detector Requirements

The detector should be bounded and multi-signal:

- `document_start` is too early for reliable CMS markers.
- Use path markers for `/Admin`, `/DesignCenter`, and known editor routes, but do not path-prefilter away public Live Edit pages.
- Use a bounded `MutationObserver`.
- Observe `documentElement` until `body` exists.
- Watch `body.class`, head link/script additions, and key shell nodes.
- Coalesce checks with `requestAnimationFrame`.
- Disconnect on hit or timeout.
- Require independent marker categories, not one marker.
- Ignore any `cp-toolkit-*` elements so the toolkit cannot self-confirm.

Candidate marker categories:

- Path class: `/Admin`, `/DesignCenter`, SAML login, known editor paths.
- CMS shell DOM: admin wrappers, editor shell nodes, live-edit body classes.
- CP asset/script/link markers: first-party CMS script/link URLs, known CMS bundles.
- Hidden form inputs: ASP.NET/CMS form fields that appear in the admin shell.

## Required Audits Before Implementation

1. Product/architecture decisions
   - Decide F1 from the Phase 0 audit: keep `custom-css-deployer` all-pages support on enumerated CP hosts, or limit/rework the feature.
   - Confirm F2 from the Phase 0 audit: service worker injection supports per-tool frame targeting before implementation starts.

2. Domain inventory
   - Get the exact enumerable CivicPlus platform/identity domain list.
   - Decide whether any customer vanity domains must auto-run without user approval. If yes, broad access remains hard to avoid.

3. Tool activation audit
   - Use `docs/store-activation-phase0-tool-audit.md` as the starting inventory.
   - Classify any newly added on-load scripts the same way:
     - admin-only
     - DesignCenter-only
     - public Live Edit
     - all-pages CP-host CSS
     - ADFS/login special-case
     - on-demand only
   - Identify scripts that truly need `document_start`.
   - Identify scripts that need frames and which frame URL patterns they need.

4. Manifest audit
   - Replace `*://*/*` in `host_permissions`. Status: implemented for required hosts.
   - Narrow `content_scripts.matches`. Status: implemented for static detector bootstrap.
   - Narrow or remove broad `web_accessible_resources.matches`. Status: matches narrowed; resource list still needs pruning.
   - Add `activeTab` and `optional_host_permissions`. Status: implemented; optional requests are exact HTTPS origins after detector success.

5. Service worker audit
   - Recheck any broad tab queries or messaging loops, especially prevent-timeout alarm behavior.
   - Avoid scanning or messaging every HTTP(S) tab when only approved CP origins should be active.

6. Store/release readiness
   - Confirm whether publishing will use a CivicPlus account or an approved personal account.
   - Prepare privacy/security justification for remaining permissions.
   - Decide whether GitHub update checks and external release links are still appropriate once distributed through the Chrome Web Store. Status: GitHub release checks and GitHub Pages links removed; no replacement popup update UI is planned because Chrome Web Store distribution handles update checks and installs automatically.
   - Run existing guardrails and add a new guardrail for broad permission ratcheting once the manifest is narrowed.
   - If version `1.1.4` is already in Chrome Web Store review, do not withdraw it only to swap in this larger refactor. Build the refactor as `1.1.5` and use it as the proactive next submission or the resubmission if review pushes back on host scope.

## Open Questions

- What is the exact CivicPlus-owned platform domain list?
- Is `*.cpqa.ninja` sufficient for QA/identity, or are there other staging/legacy hosts?
- Is arbitrary-domain ADFS auto-bypass a hard requirement, or can it become a user-activated/permissioned flow?
- Should `custom-css-deployer` keep `all-pages` support on enumerated CP hosts? Current working answer: yes, as a host-scoped minimal CSS-applicator lane, not as full-toolkit activation.
- Which tools must run in iframes, and can frame matching be narrowed by URL/path?
- Should public Live Edit support be automatic on known CP domains only, or optional on vanity domains?
- What Chrome warning text appears for path-restricted broad matches versus host-scoped optional grants?
- Should the Chrome Web Store version continue checking GitHub releases, or should update messaging change for Store distribution? Answer: no GitHub release checks or replacement popup update banner for the Store build.

## Implementation Order

1. Lock the two Phase 0 decisions: `custom-css-deployer` all-pages lane and frame-aware injection.
2. Confirm required host list.
3. Create a central injection registry. Status: implemented on `codex/security-multi-skins-data-validation`, pending review/merge.
4. Rewrite `adfs.js` to vanilla JS or otherwise plan the narrow identity lane jQuery load. Status: implemented on `codex/security-multi-skins-data-validation`, pending review/merge.
5. Create a detector module with weighted DOM markers and bounded observation. Status: implemented on `codex/security-multi-skins-data-validation`, pending review/merge.
6. Add activation orchestration in the service worker. Status: implemented with lane-only messages and fixed registry-selected files.
7. Split manifest loading so only tiny detector lanes are declared up front. Status: implemented for enumerated CP hosts.
8. Move full toolkit injection to ordered `chrome.scripting.executeScript` calls / dynamic registered content scripts. Status: implemented with `executeScript`; dynamic detector/bootstrap registration implemented for trusted vanity origins.
9. Preserve the ADFS static lane. Status: implemented as a detector-triggered identity lane with jQuery-free `adfs.js`; manual timing QA required.
10. Add per-origin optional permission request flow for vanity domains. Status: implemented for exact HTTPS vanity origins after positive admin, identity, or Live Edit DOM detection.
11. Narrow web-accessible resources. Status: broad matches narrowed; resource list pruning remains.
12. Remove dead legacy HEAD probe code, starting with `mini-ide.js`. Status: `mini-ide.js` probe removed; legacy `js/detect_cp_site.js` remains only for compatibility cleanup.
13. Add/ratchet guardrails for broad matches and WAR exposure. Status: implemented in `scripts/security-guardrails.sh` with manifest-scope checks for required hosts, optional vanity access, and HTTPS WAR asset lists.
14. Run manual QA on known CP domains, vanity domains, Live Edit, ADFS, Widget Manager, Theme Manager, Graphic Links, image-picker iframe behavior, custom CSS all-pages behavior, and on-demand context-menu tools.

## Manual CMS QA Needed

After reloading the unpacked extension from this branch, test these before Store packaging:

1. Known CP admin host: `/Admin` dashboard loads normal toolkit on-load tools after detector activation.
2. DesignCenter/Theme Manager: skin organizer/enhancer, copy/import workflows, mini IDE entry points, and advanced-style helpers still appear.
3. Public Live Edit on an enumerated CP host: Live Edit lane activates without loading the toolkit on ordinary non-editor public pages.
4. Custom CSS deployer: an enabled `all-pages` rule applies on a matching known CP host top-frame page, without full toolkit UI appearing on unrelated public pages.
5. ADFS/SAML: `/admin/saml/logonrequest` and `account.civicplus.com` / `identityserver.cpqa.ninja` identity redirects still happen quickly enough.
6. Image picker: folder state restore still works inside `/DocumentCenter/FolderForModal` or `/Admin/DocumentCenter` frames.
7. On-demand context menus: user-invoked tools still run under `activeTab` without required all-sites host permission.
8. Non-CP site: no jQuery/toolkit on-load scripts are injected.
9. Vanity Admin/DesignCenter host such as `https://coz.org/Admin/...`: popup should show the trust-domain prompt, request only that exact origin, activate the current tab after approval, and continue activating after reload.
10. Vanity public Live Edit page such as a customer homepage with the CMS editor chrome visible: popup should show the trust-domain prompt, request only that exact origin, activate the current tab after approval, and continue activating after reload.
11. Unknown non-admin host such as `https://www.reddit.com/`: popup should show `Not a CivicPlus site` without a permission prompt.
12. Graphic Links fancy button library: saving a button under a brand-new library name should create the entry without a `savedAt` console error.
13. Fancy button Socials import: opening folder lookup should list Document Center folders, or show the manual-entry fallback only on a real load timeout.

## EOW Submission Track

Target: have a Chrome Web Store submission or resubmission ready by Friday, 2026-07-17.

Recommended scope for this week:

1. Treat the manifest-scope refactor as the store-readiness blocker, not additional feature work.
2. Make the two Phase 0 decisions immediately.
3. Implement the smallest complete architecture that removes required `*://*/*`:
   - required host list for enumerated CP hosts;
   - `activeTab`;
   - `optional_host_permissions`;
   - detector-only static content script on enumerated hosts;
   - separate ADFS identity lane;
   - service worker ordered toolkit injection;
   - no broad WAR matches.
   - Current status: all above are implemented; WAR matches are narrowed, but resource list pruning remains.
4. Fix `copy-multiple-skins.js` stored component-data validation before packaging. This is smaller than the manifest refactor and removes a clear security-review finding. Status: implemented on `codex/security-multi-skins-data-validation`, pending review/merge.
5. Defer nice-to-have management UI if needed, but do not defer the permission model.
6. Package as the next patch version if `1.1.4` is already in review.

## Working Standard

When a Web Store/security architecture decision is made, update this file in the same branch. Do not rely on Codex, Claude, or chat history as the only copy of the plan.
