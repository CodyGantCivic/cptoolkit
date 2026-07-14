# Store Activation Phase 0 Tool Audit

Last updated: 2026-07-14

Purpose: preserve the per-tool activation audit from the Claude artifact `Phase 0 Tool Audit - Handoff for George.mhtml` in a tracked repo document.

Source artifact:

- `C:\Users\vlasak.NWP_MAN\Downloads\Phase 0 Tool Audit - Handoff for George.mhtml`
- Claude artifact URL saved in the MHTML: `https://claude.ai/code/artifact/306b5b00-575e-47b2-93ea-4e83a0e98648`
- Artifact date: 2026-07-09
- Method stated in artifact: dual read-only audit by Claude + Codex

## Summary

The detect-then-inject architecture is viable. Most on-load tools already wait for `detect_if_cp_site()` and body/ready state, so injecting them after a DOM marker detector passes should not change behavior.

The risky work is not the common case. The risky work is the exception handling:

- `custom-css-deployer` creates a third activation context: all pages on approved CP hosts.
- `remember-image-picker-state` requires frame-aware injection.
- `adfs` needs a narrow static identity/SAML lane at `document_start`.
- Several tools need "scan existing, then observe future" fixes before they can safely move from static `document_start` loading to later programmatic injection.
- MAIN-world helper injection and load order must be preserved.

## Open Decisions

### F1: custom-css-deployer all-pages lane

`custom-css-deployer` supports rule scope `all-pages`, which applies employee-authored CSS to any matching CP-host page, not just `/Admin`, `/DesignCenter`, or Live Edit shells.

Verified in `js/tools/on-load/custom-css-deployer.js`:

- `sanitizeScope()` accepts `admin-only` and `all-pages`.
- `buildCssText()` skips non-admin pages only when the rule scope is `admin-only`.

Decision needed:

- Option A: give this tool a dedicated all-paths lane on enumerated CP hosts. This preserves the feature on canonical/platform hosts and keeps broad access host-enumerable for review. Vanity public URLs would require opt-in.
- Option B: limit or rework the feature so it only applies in admin/design/editor contexts.

Audit recommendation: Option A.

Working interpretation as of 2026-07-14: choose Option A, but keep it narrow. `custom-css-deployer` is an employee-local affordance for fixing or reskinning CMS UI/site issues in their own browser. Its `all-pages` scope should be keyed to approved hosts and matching rules, not to a fixed admin URL array. This should not activate the full toolkit on every page; it should activate only the minimal CSS applicator when an enabled rule matches the current page.

### F2: injection must be frame-aware

`remember-image-picker-state` genuinely runs inside the image-picker iframe.

Verified in `js/tools/on-load/remember-image-picker-state.js`:

- It checks `window.frameElement`.
- It identifies `/DocumentCenter/FolderForModal` and `/Admin/DocumentCenter` paths.
- It derives storage keys from `window.parent.location.hostname` when possible.

Decision needed: confirm the service worker injection pipeline can target specific frames per tool. Do not blindly keep `all_frames` for every tool, but do not make the new pipeline top-frame-only.

## Five Findings

1. `custom-css-deployer` needs an all-pages lane or a product decision to reduce scope.
2. Programmatic injection must support specific frame targeting.
3. `adfs.js` must stay in its own narrow static lane.
4. MAIN-world helpers must preserve MAIN-world execution and load order.
5. Remove dead legacy HEAD probe code from `mini-ide.js` when detection is centralized.

## Timing-Sensitive Tools

These tools need extra care when moved from static `document_start` injection to detector-triggered programmatic injection:

| Tool | Risk | Why |
| --- | --- | --- |
| `adfs` | High | Early identity/SAML redirect race; deliberately skips CP-site detection. |
| `remember-image-picker-state` | High | Runs in image-picker iframe; breaks if injection is top-frame-only. |
| `graphic-link-advanced-style-helper` | Medium | `.insertFancy` handler is observer-driven and can miss an existing button unless it scans existing DOM first. |
| `mini-ide` | Medium | Some handlers watch future mutations; also has a dead legacy HEAD probe. |
| `custom-css-deployer` | Medium | Needs all-pages lane; may flash before CSS applies if injected late. |
| `widget-skin-*` / `fix-copied-skin-references` | Medium | MAIN-world helpers and workflows may already be in progress. |

## Per-Tool Activation Table

| Tool | Lane | Start dependency | Frame target | Timing risk |
| --- | --- | --- | --- | --- |
| `title-changer` | admin | no | top | low |
| `keyboard-shortcuts` | either | no | top | low; keep double-init guard |
| `auto-dismiss-help-welcome` | either | maybe | top | flash if late |
| `helpers/advanced-styles-limits` | admin | no | helper order-critical | order-critical |
| `enforce-advanced-styles-text-limits` | admin | no | top | falls back if helper late |
| `theme-manager-enhancer` | admin | no | top | flash only |
| `theme-manager-skin-organizer` | admin | no | top | low |
| `widget-skin-default-override` | admin | maybe | top | can miss early workflow |
| `module-icons` | either | no | top | needs Live Edit lane |
| `cp-MultipleCategoryUpload` | admin | no | top | low |
| `cp-MultipleQuickLinks` | admin | no | top | low |
| `cp-InfoAdvancedImportExport` | admin | no | top plus service worker frame bridge | avoid duplicate frame injection |
| `widget-skin-advanced-style-helper` | admin | maybe | top | helper relay must survive |
| `graphic-link-advanced-style-helper` | admin | maybe | top | observer can miss existing `.insertFancy` |
| `option-set-importer` | admin | no | top | Widget Manager only |
| `css-snippets` | admin | no | top | preserve order |
| `mini-ide` | admin | maybe | top | future-mutation handlers; remove HEAD probe |
| `custom-css-deployer` | all-pages/admin | maybe | top | F1 and possible CSS flash |
| `prevent-timeout` | either | no | top | low |
| `graphic-link-autofill` | admin | no | top | low |
| `quick-link-autofill` | admin | no | top | low |
| `input-focus` | admin | no | top | low |
| `xml-change-alerts` | admin | no | top | low |
| `download-xml-css` | admin | no | top | low |
| `layout-manager-sorter` | admin | no | top | low |
| `cp-ImportFancyButton` | admin | no | top plus service worker frame bridge | keep frame bridge |
| `remember-image-picker-state` | admin | maybe | selected frames | F2 |
| `fix-copied-skin-references` | admin | maybe | top | keep MAIN world |
| `adfs` | identity | yes | top | F3 |
| `cp-MultipleInfoAdvancedItems` | admin | no | top | low |
| `redesign-manager-skin-sorter` | admin | no | top | low |

Lane meanings:

- `admin`: `/Admin` or `/DesignCenter` with CMS shell markers.
- `live-edit`: logged-in public-style Live Edit/editor shell.
- `either`: admin/design or Live Edit.
- `identity`: ADFS/account/identity SAML path.
- `all-pages`: any path on an approved CP host.

## Verification Notes From This Repo

- Current `manifest.json` still injects the full content script chain at `document_start` on `*://*/*` with `all_frames: true`.
- `adfs.js` self-gates on `/admin/saml/logonrequest`, `account.civicplus.com`, and `identityserver.cpqa.ninja`.
- `mini-ide.js` still contains its own `isCivicPlusSite()` HEAD probe to the Mystique module tile path.
- `graphic-link-advanced-style-helper.js` calls `setupInsertButtonHandler()`, but that function only binds `.insertFancy` from a `MutationObserver` callback. It should also scan existing DOM when initialized.
- Manifest order currently has `helpers/advanced-styles-limits.js` before `enforce-advanced-styles-text-limits.js`, and `css-snippets.js` before `mini-ide.js`. Preserve those dependencies in the injection manifest/list.

## Phase 2 Preconditions

Before implementing the injection pipeline:

1. Decide F1: preserve `custom-css-deployer` as an all-pages lane on enumerated CP hosts, or limit/rework it.
2. Confirm F2: pipeline supports per-tool frame targeting.
3. Confirm required host list: `*.civicplus.com`, `*.civic.place`, `*.civicplus.pro`, `*.cpqa.ninja`, plus any missing staging/legacy/identity hosts.
4. Preserve ADFS as a narrow static lane.
5. Build the injection list from this table, not from the current broad manifest content script list.

## Phase 2 Registry Checkpoint

Implementation branch `codex/security-multi-skins-data-validation` added `js/background/toolkit-injection-registry.js` on 2026-07-14.

The registry is now the code-level inventory for the next activation refactor. It preserves current manifest order and records each automatic script's activation lane, frame target, execution world, jQuery dependency, timing risk, and ordering notes.

Follow-up found during registry work: `adfs.js` used jQuery even though ADFS needs a narrow `document_start` identity/SAML lane. This was resolved on the implementation branch by rewriting `adfs.js` to vanilla JS, so the future static ADFS lane does not need to include jQuery.
