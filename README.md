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
- `scripts/release.ps1` -> guarded release/tag automation
- `scripts/snapshot.ps1` -> rollback snapshot automation
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

## Branch and Folder Rules
- Keep one active repo: `cp-toolkit-source-of-truth`.
- Keep one unpacked extension source: `mv3-extension` inside that repo.
- Treat `mv3-extension-dev` and `mv3-extension-prod` as generated outputs only.
- Use `Archive/` for snapshots; do not fork ad-hoc working folders.

## Release Workflow (Enforced)
1. Merge feature PRs into `main`.
2. Bump `mv3-extension/manifest.json` `version` field.
3. Optional safety snapshot:
   - `./scripts/snapshot.ps1 -CreateGitTag`
4. Run guarded release command:
   - `./scripts/release.ps1`
5. Wait for GitHub Action `Package and Release` to finish.
6. Reload unpacked extension in `chrome://extensions`.

If you must republish the same version tag intentionally:
- `./scripts/release.ps1 -AllowTagMove`

## Versioning
- Extension version is in: `mv3-extension/manifest.json` (`version` field).
- Bump version before release tags.

## Rollback
- Restore code to an older release:
  - `git checkout v1.1.2`
- Create a revert commit on `main`:
  - `git checkout main`
  - `git revert <bad_commit_sha>`
- Restore from snapshot archive:
  - unzip from `Archive/snapshot-v...zip` and reload unpacked extension.

## Guardrails
- Do not edit `mv3-extension-dev` or `mv3-extension-prod` directly.
- Do not merge zip files manually into `main`.
- Keep all feature docs and migration notes in `docs/`.
- Full release SOP: `docs/release-runbook.md`.
