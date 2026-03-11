# Contributor Workflow

## Branch Strategy
- `main`: protected, deployable source of truth
- Feature branches: `feature/<short-name>`
- Hotfix branches: `hotfix/<short-name>`

## Pull Request Checklist
- [ ] Scoped change to intended area/pages only
- [ ] `manifest.json` still valid JSON
- [ ] `data/on-load-tools.json` still valid JSON
- [ ] Changed JS files pass `node --check`
- [ ] Built with `build-dev-prod.ps1`
- [ ] Added or updated docs in `docs/` when behavior changed

## Merge Rules
- Prefer squash merge for clean history.
- Require at least one review when possible.
- No direct pushes to `main` except emergency patch with follow-up PR.

## Conflict Policy
If local work and upstream differ:
1. Keep critical production-safe behavior first.
2. Preserve page-scoped tooling guards.
3. Document conflict resolution in `docs/`.
