#!/usr/bin/env bash
# Security guardrails for the CP Toolkit.
# Encodes five checks from the April 2026 security review (Finding #8 added the
# first four; Finding #7 added the remote-asset check).
# Source of truth for *why* each check exists:
#   .claude/docs/security/security-review-roadmap-2026-04-07.md
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

# Finding #7: remote hosts our OWN (non-vendored) JS/CSS may reference, split by
# scope for honesty. Both lists are ratchet floors — they must list EXACTLY the
# hosts present today (check_no_remote_assets fails in both directions). Every
# entry is documented in docs/external-dependencies.md. Vendored libs under
# */external/ are out of scope (see check_no_remote_assets).
#
# Hosts the EXTENSION itself contacts (fetch / link-inject / navigate):
ALLOWED_REMOTE_HOSTS="fonts.googleapis.com api.github.com cp-vlasak.github.io"
# Hosts that only appear in markup the toolkit EMITS into customer sites
# (clipboard snippets, inserted HTML, SVG namespace) — not loaded by the
# extension itself, but still tracked so new third parties surface in review:
ALLOWED_SNIPPET_HOSTS="www.gstatic.com translate.google.com connect.civicplus.com www.w3.org"

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

# ---- Check 5: no non-allowlisted remote hosts in our JS/CSS (Finding #7)
# Scans our OWN JS/CSS for remote hosts and reconciles them against the union of
# ALLOWED_REMOTE_HOSTS + ALLOWED_SNIPPET_HOSTS, in BOTH directions:
#   - a found host not in the allowlist FAILs (new third party snuck in)
#   - an allowlisted host no longer found FAILs (ratchet floor must track reality)
#
# Host extraction notes:
#   - Matches https://, http://, and quoted protocol-relative ("//host, '//host)
#     so a plain `http://` or `getScript("//cdn")` can't slip past a https-only
#     scan. Bare `//comment` lines are NOT matched (no leading quote/scheme).
#   - Strips userinfo before the host (`s#.*@##`), so the bypass
#     `https://api.github.com@evil.example/x` resolves to host `evil.example`
#     (the real browser host), not the allowlisted prefix.
#   - Strips `:port` and is fail-closed on URLs even inside comments — mirrors
#     Check 1's no-blind-spot stance.
#   - Vendored libs under */external/ are excluded (--exclude-dir=external);
#     their license/header URLs are vetted at vendor-time, not here.
#   - IPv6-literal hosts (https://[::1]/) can't be host-parsed reliably here (the
#     :port strip would mangle the address's colons), so rather than silently
#     miss them they are rejected outright — see the bracket guard below.
# On FAIL: remove the reference, or add the host to the correct allowlist bucket
# above AND document it in docs/external-dependencies.md.
check_no_remote_assets() {
  local failed=0 host found
  local allow="$ALLOWED_REMOTE_HOSTS $ALLOWED_SNIPPET_HOSTS"

  # Reject IPv6-literal remotes outright (fail-closed) — we don't parse them.
  # Match a bare `//[` so every form is caught regardless of how it's written:
  # scheme'd (https://[), quoted ("//[, '//[), unquoted CSS url(//[), or backtick
  # (`//[). There are no legitimate `//[` sequences in our js/css today.
  if grep -RqIE '//\[' \
       --include='*.js' --include='*.css' --exclude-dir=external \
       mv3-extension/js mv3-extension/css 2>/dev/null; then
    echo "[guardrail:no-remote-assets] FAIL: IPv6-literal remote URL found in mv3-extension js/css; use a hostname or add explicit IPv6 handling"
    failed=1
  fi

  found=$(grep -RhoIE '(https?://|["'"'"']//)[A-Za-z0-9._~%@:.-]+' \
    --include='*.js' --include='*.css' --exclude-dir=external \
    mv3-extension/js mv3-extension/css 2>/dev/null \
    | sed -E 's#^.*//##; s#.*@##; s#:.*##' | sort -u)

  # Direction 1: every found host must be allowlisted.
  while IFS= read -r host; do
    [ -z "$host" ] && continue
    case " $allow " in
      *" $host "*) ;;
      *)
        echo "[guardrail:no-remote-assets] FAIL: non-allowlisted remote host '$host' in mv3-extension js/css; add it to the right allowlist bucket + docs/external-dependencies.md, or remove the reference"
        failed=1
        ;;
    esac
  done <<< "$found"

  # Direction 2: every allowlisted host must still be present (no stale floor).
  for host in $allow; do
    if ! printf '%s\n' "$found" | grep -qxF "$host"; then
      echo "[guardrail:no-remote-assets] FAIL: allowlisted host '$host' no longer appears in mv3-extension js/css; remove it from the allowlist (the floor must track reality)"
      failed=1
    fi
  done

  if [ "$failed" -eq 0 ]; then
    echo "[guardrail:no-remote-assets] PASS: remote hosts in mv3-extension js/css exactly match the allowlist"
  fi
  return "$failed"
}

# ---- Driver ------------------------------------------------------------
exit_code=0
check_no_eval_or_function || exit_code=1
check_broad_matches       || exit_code=1
check_storage_bridge      || exit_code=1
check_no_server           || exit_code=1
check_no_remote_assets    || exit_code=1

if [ "$exit_code" -eq 0 ]; then
  echo "[guardrails] All 5 checks PASS."
else
  echo "[guardrails] One or more checks FAILED. See above."
fi
exit "$exit_code"
