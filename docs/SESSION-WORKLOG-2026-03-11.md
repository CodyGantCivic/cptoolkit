# CivicPlus Toolkit Worklog and Documentation

Date: 2026-03-11

This document summarizes the recent multi-day development session, the merge strategy used, and the resulting architecture/behavior so future contributors can quickly understand what changed and why.

## 1) Session Objectives
- Improve Theme Manager and Layout Manager quality-of-life workflows.
- Add safer tooling for rapid UI iteration without affecting production templates directly.
- Merge latest upstream work from Cody's GitHub into current local work.
- Keep local feature additions while absorbing upstream updates.
- Align session-timeout behavior to Cody's latest implementation.

## 2) Major Features Added/Updated

### Theme Manager Skin Organizer
Path:
- `js/tools/on-load/theme-manager-skin-organizer.js`

Capabilities:
- Adds category manager to Container Preview Options modal in Theme Manager.
- Supports category creation/edit/delete with color assignment.
- Assigns categories to skins.
- Adds skin ID badges with category colors.
- Adds include/exclude/all filtering by category.
- Persists category/filter state with `chrome.storage.local`.
- Scope-limited to `/DesignCenter/Themes/Index` (and admin equivalent).

UX refinements completed:
- Filter controls moved into modal flow to avoid pushing list content.
- Badge format uses numeric ID only (no `#`).
- Color swatch styling rounded and padded for both color pickers.
- Button hover specificity hardened where CMS styles were overriding toolkit styles.

### Layout Manager Sorter
Path:
- `js/tools/on-load/layout-manager-sorter.js`

Capabilities:
- Adds sorting controls on `/Admin/DesignCenter/Layouts`.
- Persists sorting choice across page reloads.
- Supports a custom "Default" ordering that prioritizes base layouts before alpha sorting.

### Custom CSS Deployment Manager
Paths:
- `html/custom-css-deployments.html`
- `css/custom-css-deployments.css`
- `js/custom-css-deployments-page.js`
- `js/tools/on-load/custom-css-deployer.js`

Purpose:
- Provides internal workflow for safely applying scoped CSS uplift/QoL tweaks for CMS admin UI scenarios.
- Supports repeatable deployment/import/export style management patterns.

### Mini IDE / Theme Manager Enhancements
Paths:
- `js/tools/on-load/mini-ide.js`
- `js/tools/on-load/theme-manager-enhancer.js`

Highlights:
- Added pseudo-element workflow shortcuts and theme-manager-focused utility controls.
- Iterated styling scope to keep UI enhancements isolated from customer site output.

## 3) Upstream Merge Strategy (Cody GitHub)
Source upstream:
- `https://github.com/CodyGantCivic/MV3-Toolkit`

Approach used:
1. Pull latest Cody snapshot locally.
2. Overlay upstream files into local source.
3. Restore intentional local feature files and integration points.
4. Verify no upstream files were missing after merge.
5. Rebuild dev/prod outputs.

Result summary:
- Upstream files integrated.
- Local-only feature files preserved (skin organizer, layout sorter, custom css manager, etc.).
- Core integration files intentionally kept local where necessary:
  - `manifest.json`
  - `data/on-load-tools.json`
  - `js/popup.js`
  - `js/options.js`
  - `html/main.html`
  - `js/background/service-worker.js` (later updated again for timeout alignment)
  - `js/tools/on-load/mini-ide.js`
  - `js/tools/on-load/theme-manager-enhancer.js`

## 4) Session Timeout Final State
Per latest direction: match Cody exactly for timeout logic.

Aligned to Cody 1:1:
- `js/tools/on-load/prevent-timeout.js`
- `js/background/service-worker.js`

Removed older banner path:
- Removed tool entry from `data/on-load-tools.json`:
  - `session-expired-banner`
- Removed content script registration in `manifest.json`:
  - `js/tools/on-load/session-expired-banner.js`
- Deleted file:
  - `js/tools/on-load/session-expired-banner.js`

## 5) Important Scope/Safety Notes
- Toolkit on-load tools are path-scoped where applicable to avoid unintended side effects.
- Theme Manager-specific enhancements are constrained to admin UI contexts.
- UI styling changes for toolkit controls are isolated to toolkit-injected classes/selectors.

## 6) Build Outputs
Build script:
- `../build-dev-prod.ps1` (run from extension root parent)

Outputs:
- `../mv3-extension-dev`
- `../mv3-extension-prod`

## 7) Recommended Team Git Workflow Going Forward
- Use one canonical upstream repo.
- Require PRs for merge to protected `main`.
- Keep feature work in branches.
- Keep generated builds (`-dev`, `-prod`) as release artifacts or generated outputs.
- Include this worklog (or changelog entries) in each significant merge/release.

## 8) Quick Review Checklist for Teammates
- Theme Manager: verify category assignment/filter flow and badge rendering.
- Layout Manager: verify default and custom sorting behavior persists after reload.
- Custom CSS manager: verify page load, save/import/export flows.
- Timeout: verify modal auto-refresh behavior without old banner.
- Popup/options: verify tool visibility and category grouping.

---
Prepared as a handoff/reference document for team collaboration and future merges.
