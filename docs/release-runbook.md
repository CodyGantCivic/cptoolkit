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
- Pre-tag security guardrails (see 4a)
- Local `main` not behind origin
- Pushes `main` if ahead
- Creates/pushes tag `v<manifest_version>`
- Blocks existing tag reuse unless `-AllowTagMove` is used

### 4a) Pre-tag guardrail check
After manifest validation and before any network operation, `release.ps1` runs `scripts/security-guardrails.sh` (the four CI security checks; see README "Security Guardrails"). The script must exit 0 or no tag is cut.

Requirements:
- **Git Bash on PATH.** `release.ps1` calls `Get-Command bash` first; if absent, it throws `Git Bash is required to run security guardrails before release. Install Git for Windows.` before any side-effect.

Common failure modes contributors hit:
- A new tool added an `eval(...)` or `new Function(...)` call → check 1 fails. Refactor to named operations or, if a vendored dependency forces the use, allowlist the specific file in `scripts/security-guardrails.sh` with an explicit comment.
- A manifest edit changed the count of `*://*/*` host matches → check 2 fails on either side. If the count went up, justify and increment `ALLOWED_BROAD_MATCHES`; if it went down (a Finding #4 narrowing), lower the constant in the same PR.
- A new `cp-toolkit-storage-{get,set}` listener was added without the whitelist guard → check 3 fails. Copy the `ALLOWED_STORAGE_KEYS` + `hasOwn.call` pattern from `mv3-extension/js/tools/on-load/css-snippets.js`.
- An HTTP server primitive returned to `mv3-extension/` → check 4 fails. The MCP collector was deliberately removed (Finding #1); a server has no place in the extension build.

The `Package and Release` GitHub Actions workflow runs the same checks as a `guardrails` job before the release job, so a misconfigured local environment cannot ship a release that the CI checks would have blocked.

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
