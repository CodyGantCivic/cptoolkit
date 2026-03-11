# CP Toolkit (Single Source of Truth)

This repository is the canonical source for the CivicPlus internal MV3 toolkit.

## Repository Goals
- Keep one clean source of truth for extension development.
- Avoid branch drift and zip-based merge conflicts.
- Ship reproducible `dev` and `prod` builds from one source folder.

## Structure
- `mv3-extension/` -> extension source code (authoritative)
- `build-dev-prod.ps1` -> build script that creates:
  - `mv3-extension-dev`
  - `mv3-extension-prod`
- `docs/` -> contributor and session documentation

## Important Current Features
- Theme Manager Skin Organizer (`js/tools/on-load/theme-manager-skin-organizer.js`)
- Layout Manager Sorter (`js/tools/on-load/layout-manager-sorter.js`)
- Custom CSS Deployment Manager:
  - `html/custom-css-deployments.html`
  - `css/custom-css-deployments.css`
  - `js/custom-css-deployments-page.js`
  - `js/tools/on-load/custom-css-deployer.js`

## Session Timeout Behavior
Timeout handling is aligned to Cody's simplified implementation:
- `js/tools/on-load/prevent-timeout.js`
- `js/background/service-worker.js`

`session-expired-banner` was removed intentionally.

## Local Development
1. Load `mv3-extension` as unpacked extension in Chrome.
2. Make changes in `mv3-extension` only.
3. Validate JS syntax where relevant:
   - `node --check <file.js>`
4. Rebuild outputs:
   - `./build-dev-prod.ps1`

## Release Workflow (Recommended)
1. Work on a short-lived branch.
2. Open PR into `main`.
3. After merge, run `build-dev-prod.ps1`.
4. Package `mv3-extension-prod` for release candidate / store prep.

## Versioning
- Extension version is in: `mv3-extension/manifest.json` (`version` field).
- Bump version before release tags.

## Guardrails
- Do not edit `mv3-extension-dev` or `mv3-extension-prod` directly.
- Do not merge zip files manually into `main`.
- Keep all feature docs and migration notes in `docs/`.
