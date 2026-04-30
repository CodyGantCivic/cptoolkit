#!/usr/bin/env bash
# Security guardrails for the CP Toolkit.
# Encodes the four checks from Finding #8 of the April 2026 security review.
# Source of truth for *why* each check exists:
#   .claude/documents/security-review-roadmap-2026-04-07.md
#
# Each check_* function prints a single PASS/FAIL line and (on FAIL) the
# offending matches. The script exits non-zero if any check fails.
#
# Run locally:    bash scripts/security-guardrails.sh
# CI:             .github/workflows/security-guardrails.yml (per-PR)
#                 .github/workflows/release.yml (guardrails job, blocks tag)
# Local release:  scripts/release.ps1 invokes this before any git side-effect.

set -u

# ---- Tuneable thresholds -----------------------------------------------
# Ratchet: lower these as Findings #4 (broad host matches) and #7 (remote
# third-party assets) narrow the surface area. The cap must always equal
# today's actual count, not just an upper bound — see check_broad_matches.
ALLOWED_BROAD_MATCHES=3

# ---- Setup -------------------------------------------------------------
REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$REPO_ROOT"

# ---- Check 1: no eval() or Function() in mv3-extension/js/ -------------
# No directory allowlist. mv3-extension/js/external/jquery-3.3.1.min.js has
# zero literal eval(/Function( matches today; a blanket --exclude-dir would
# only create a future blind spot. If a future vendored dep forces a use,
# allowlist that specific file here with an explicit comment.
check_no_eval_or_function() {
  local matches
  matches=$(grep -RInE '\b(eval|Function)[[:space:]]*\(' \
    --include='*.js' \
    mv3-extension/js/ 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo "[guardrail:no-eval-or-function] FAIL: forbidden eval()/Function() pattern in mv3-extension/js/"
    printf '%s\n' "$matches" | sed 's/^/  /'
    return 1
  fi
  echo "[guardrail:no-eval-or-function] PASS: no eval() or Function() constructor in mv3-extension/js/"
  return 0
}

# ---- Check 2: cap *://*/* occurrences in manifest.json -----------------
# Whole-file occurrence count via `grep -o ... | wc -l` (NOT `grep -c`).
# `grep -c` counts matching lines, which works today because each match is
# on its own line, but breaks if the manifest is reformatted such that two
# matches share a line. `grep -o` prints each match on its own line.
#
# Two-sided: fails if count > cap (regression) AND if count < cap (a PR
# narrowed the surface but didn't lower the cap to track reality).
check_broad_matches() {
  local count
  count=$(grep -o -F '*://*/*' mv3-extension/manifest.json 2>/dev/null | wc -l | tr -d '[:space:]')
  if [ -z "$count" ]; then count=0; fi
  if [ "$count" -gt "$ALLOWED_BROAD_MATCHES" ]; then
    echo "[guardrail:broad-matches] FAIL: $count occurrences of '*://*/*' in mv3-extension/manifest.json; cap is $ALLOWED_BROAD_MATCHES"
    return 1
  fi
  if [ "$count" -lt "$ALLOWED_BROAD_MATCHES" ]; then
    echo "[guardrail:broad-matches] FAIL: only $count occurrences of '*://*/*'; lower ALLOWED_BROAD_MATCHES to $count in scripts/security-guardrails.sh (the cap must track reality)"
    return 1
  fi
  echo "[guardrail:broad-matches] PASS: $count occurrences of '*://*/*' in mv3-extension/manifest.json (cap $ALLOWED_BROAD_MATCHES)"
  return 0
}

# ---- Check 3: storage-bridge listener files include the whitelist guard
# Any file that *listens* for cp-toolkit-storage-{get,set} events must
# contain both ALLOWED_STORAGE_KEYS (the key whitelist) and hasOwn.call
# (the prototype-pollution guard). Files that *dispatch* the events are
# correctly not flagged.
#
# Null-delimited iteration is required: the repo already has JS filenames
# with spaces (e.g. "Copy containers to another layout.js"), so a
# space-naive `for f in $(...)` would split the path and fail-open.
check_storage_bridge() {
  local failed=0 f
  while IFS= read -r -d '' f; do
    if ! grep -qE 'ALLOWED_STORAGE_KEYS' "$f"; then
      echo "[guardrail:storage-bridge] FAIL: $f registers a cp-toolkit-storage listener but is missing ALLOWED_STORAGE_KEYS whitelist"
      failed=1
    fi
    if ! grep -qE 'hasOwn\.call' "$f"; then
      echo "[guardrail:storage-bridge] FAIL: $f registers a cp-toolkit-storage listener but is missing hasOwn.call guard"
      failed=1
    fi
  done < <(grep -RIlZE \
    "addEventListener\([[:space:]]*['\"]cp-toolkit-storage-(get|set)['\"]" \
    --include='*.js' \
    mv3-extension/js/ 2>/dev/null)

  if [ "$failed" -eq 0 ]; then
    echo "[guardrail:storage-bridge] PASS: all cp-toolkit-storage listener files include ALLOWED_STORAGE_KEYS and hasOwn.call"
  fi
  return "$failed"
}

# ---- Check 4: no HTTP server primitives in mv3-extension/ --------------
# Scoped to mv3-extension/ only — relay-server/ is a separate stdio-only
# sub-project. Catches:
#   - require('http') / require ( 'http' )
#   - import http from 'http'
#   - import { createServer } from 'http'
#   - bare side-effect: import 'http'
#   - node:http(s) prefix forms
#   - createServer( anywhere
#   - .listen( anywhere (broader than numeric-port — there are zero
#     .listen( hits in mv3-extension/ today, so the broader pattern is
#     cost-free and catches app.listen(process.env.PORT) style invocations)
check_no_server() {
  local failed=0 matches
  # Quote-class is built via single-quote concatenation to keep the regex
  # readable without bash backslash gymnastics: '['"'"'"]' = ['"]
  local pattern='(require[[:space:]]*\(|from[[:space:]]+|import[[:space:]]+)['"'"'"](express|http|https|fastify|koa|node:https?)['"'"'"]|\bcreateServer[[:space:]]*\(|\.listen[[:space:]]*\('
  matches=$(grep -RInE "$pattern" --include='*.js' mv3-extension/ 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo "[guardrail:no-server] FAIL: HTTP server primitives found in mv3-extension/"
    printf '%s\n' "$matches" | sed 's/^/  /'
    failed=1
  fi
  if [ -d mv3-extension/server ]; then
    echo "[guardrail:no-server] FAIL: mv3-extension/server/ directory exists (Finding #1 removed the MCP collector — directory must not return)"
    failed=1
  fi
  if [ "$failed" -eq 0 ]; then
    echo "[guardrail:no-server] PASS: no HTTP server primitives in mv3-extension/ and no mv3-extension/server/ directory"
  fi
  return "$failed"
}

# ---- Driver ------------------------------------------------------------
exit_code=0
check_no_eval_or_function || exit_code=1
check_broad_matches       || exit_code=1
check_storage_bridge      || exit_code=1
check_no_server           || exit_code=1

if [ "$exit_code" -eq 0 ]; then
  echo "[guardrails] All 4 checks PASS."
else
  echo "[guardrails] One or more checks FAILED. See above."
fi
exit "$exit_code"
