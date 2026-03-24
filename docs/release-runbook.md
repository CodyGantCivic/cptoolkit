# CP Toolkit Release Runbook

This is the single process for organizing work, publishing releases, and rolling back safely.

## 1) Working Layout
- Canonical repo: `cp-toolkit-source-of-truth`
- Authoritative extension folder: `cp-toolkit-source-of-truth/mv3-extension`
- Generated output folders: `mv3-extension-dev`, `mv3-extension-prod`
- Historical copies: sibling `Archive/` folder only

## 2) Day-to-Day Feature Flow
1. `git checkout main`
2. `git pull origin main`
3. `git checkout -b feature/<short-name>`
4. Make edits in `mv3-extension` only.
5. Reload unpacked extension from `mv3-extension`.
6. Push branch + open PR.
7. Merge PR to `main`.

## 3) Pre-Release Safety Snapshot
Run before version bump or rollout:

```powershell
./scripts/snapshot.ps1 -CreateGitTag
```

This creates:
- A timestamped folder in `Archive/`
- A zip snapshot in `Archive/`
- A git backup tag on current commit

## 4) Release (Guarded)
1. Ensure `mv3-extension/manifest.json` has the target version.
2. Run:

```powershell
./scripts/release.ps1
```

`release.ps1` enforces:
- On `main`
- Clean git working tree
- Manifest version is semantic (`x.y.z`)
- Local `main` not behind origin
- Pushes `main` if ahead
- Creates/pushes tag `v<manifest_version>`
- Blocks existing tag reuse unless `-AllowTagMove` is used

## 5) Verify Rollout
1. GitHub Actions: `Package and Release` succeeds.
2. `https://github.com/cp-vlasak/cptoolkit/releases/latest` shows expected tag.
3. `https://cp-vlasak.github.io/cptoolkit/` shows expected version badge.
4. `chrome://extensions` -> reload extension card.

## 6) Rollback Paths
- Quick runtime rollback in Chrome:
  - Load unpacked from previous snapshot in `Archive/`.
- Code rollback:
  - `git revert <commit_sha>` on `main`.
- Release rollback:
  - Re-tag prior good commit with new patch version (preferred) or use `-AllowTagMove` when absolutely necessary.
