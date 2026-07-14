# Chrome Web Store Readiness Plan

Last updated: 2026-07-14

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

The extension is MV3, but the current manifest still declares broad page access:

- `content_scripts[0].matches`: `*://*/*`
- `content_scripts[0].all_frames`: `true`
- `content_scripts[0].run_at`: `document_start`
- The declared content script chain loads `detect_cp_site.js`, jQuery, shared helpers, and the on-load tools on every matched page.
- `host_permissions`: `*://*/*`
- `web_accessible_resources.matches`: `*://*/*`

The current CP-site gate is `js/detect_cp_site.js`, which performs a `HEAD` request to:

```text
/Assets/Mystique/Shared/Components/ModuleTiles/Templates/cp-Module-Tile.html
```

This reduces per-tool behavior only after scripts have already been injected. It also has a known false-positive class on some `*.civicplus.pro` Evolve SPA routes that return a 200 HTML shell for missing paths.

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
- New finding recorded during registry work: `adfs.js` currently depends on jQuery even though it needs a narrow static identity/SAML lane. Before the manifest-scope refactor, either include jQuery only on that narrow lane or rewrite `adfs.js` to vanilla JS. Preferred path: rewrite `adfs.js` to vanilla so the static identity lane does not load jQuery.

Prior review conclusion: recent PR work did not add new permissions, host permissions, or web-accessible-resource exposure, and it did not add remote code execution patterns. The residual Chrome Store/internal-vetting issue remained extension-wide broad access: `*://*/*` content-script matching, `*://*/*` host permissions, and broad WAR exposure.

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

4. Split detector from toolkit activation.
   - Manifest-declared content scripts should be tiny and detector-only on known CP domains.
   - Full toolkit scripts load only after detection passes.
   - Use `chrome.scripting.executeScript` for current-tab activation.
   - Use `chrome.scripting.registerContentScripts` for future navigations on approved origins.

5. Replace the network `HEAD` probe with DOM-marker detection.
   - Prefer path plus DOM shell markers over probing a Mystique asset.
   - This improves privacy and avoids the Evolve SPA false positive.

6. Rework `web_accessible_resources`.
   - Current `matches: ["*://*/*"]` is too broad.
   - Content scripts usually do not need files to be web-accessible.
   - Keep only resources that page context truly loads by URL, and restrict matches to approved origins.

7. Handle `adfs.js` separately.
   - `adfs.js` intentionally does not call `detect_if_cp_site`.
   - It self-gates on `/admin/saml/logonrequest` and redirects to `/Admin/?saml=off`.
   - A DOM-shell-only activator could break this unless ADFS gets its own narrow host/path lane.
   - Registry follow-up: `adfs.js` uses jQuery today, so either the narrow static lane must include jQuery or `adfs.js` should be rewritten to vanilla JS before manifest narrowing. Prefer the vanilla rewrite to keep jQuery out of static lanes.

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
- Use a path prefilter for `/Admin`, `/DesignCenter`, and known Live Edit/editor routes.
- Use a bounded `MutationObserver`.
- Observe `documentElement` until `body` exists.
- Watch `body.class`, head link/script additions, and key shell nodes.
- Coalesce checks with `requestAnimationFrame`.
- Disconnect on hit or timeout.
- Require independent marker categories, not one marker.
- Ignore any `cp-toolkit-*` elements so the toolkit cannot self-confirm.

Candidate marker categories:

- Path class: `/Admin`, `/DesignCenter`, SAML login, Live Edit/editor paths.
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
   - Replace `*://*/*` in `host_permissions`.
   - Narrow `content_scripts.matches`.
   - Narrow or remove broad `web_accessible_resources.matches`.
   - Add `activeTab` and `optional_host_permissions`.

5. Service worker audit
   - Recheck any broad tab queries or messaging loops, especially prevent-timeout alarm behavior.
   - Avoid scanning or messaging every HTTP(S) tab when only approved CP origins should be active.

6. Store/release readiness
   - Confirm whether publishing will use a CivicPlus account or an approved personal account.
   - Prepare privacy/security justification for remaining permissions.
   - Decide whether GitHub update checks and external release links are still appropriate once distributed through the Chrome Web Store.
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
- Should the Chrome Web Store version continue checking GitHub releases, or should update messaging change for Store distribution?

## Implementation Order

1. Lock the two Phase 0 decisions: `custom-css-deployer` all-pages lane and frame-aware injection.
2. Confirm required host list.
3. Create a central injection registry. Status: implemented on `codex/security-multi-skins-data-validation`, pending review/merge.
4. Rewrite `adfs.js` to vanilla JS or otherwise plan the narrow identity lane jQuery load.
5. Create a detector module with weighted DOM markers and bounded observation.
6. Add activation orchestration in the service worker.
7. Split manifest loading so only tiny detector lanes are declared up front.
8. Move full toolkit injection to ordered `chrome.scripting.executeScript` calls / dynamic registered content scripts.
9. Preserve the ADFS static lane.
10. Add per-origin optional permission request flow for vanity domains.
11. Narrow web-accessible resources.
12. Remove dead legacy HEAD probe code, starting with `mini-ide.js`.
13. Add/ratchet guardrails for broad matches and WAR exposure.
14. Run manual QA on known CP domains, vanity domains, Live Edit, ADFS, Widget Manager, Theme Manager, Graphic Links, image-picker iframe behavior, custom CSS all-pages behavior, and on-demand context-menu tools.

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
   - separate ADFS static lane;
   - service worker ordered toolkit injection;
   - no broad WAR matches.
4. Fix `copy-multiple-skins.js` stored component-data validation before packaging. This is smaller than the manifest refactor and removes a clear security-review finding. Status: implemented on `codex/security-multi-skins-data-validation`, pending review/merge.
5. Defer nice-to-have management UI if needed, but do not defer the permission model.
6. Package as the next patch version if `1.1.4` is already in review.

## Working Standard

When a Web Store/security architecture decision is made, update this file in the same branch. Do not rely on Codex, Claude, or chat history as the only copy of the plan.
