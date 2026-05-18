#!/usr/bin/env bash
# Security guardrails for the CP Toolkit.
# Encodes the five checks from Findings #7 and #8 of the April 2026 security review.
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

# Allowlist of remote hosts permitted to appear in mv3-extension/ JS/CSS/HTML.
# Each entry is an EXACT host string (compared with POSIX [ "$a" = "$b" ],
# not regex match — dots in host names are literal, not wildcards).
# Lower the list (remove a host) when its references are vendored.
ALLOWED_REMOTE_HOSTS=(
  # --- Operational APIs (runtime fetches by extension) ---
  fonts.googleapis.com       # Dynamic font import for Fancy Button preview
                             # (cp-ImportFancyButton.js:492 + the mirrored
                             # button-library-page.js:313). NOTE: transitively
                             # triggers fetches from fonts.gstatic.com at
                             # runtime; that is also a remaining external
                             # dependency for Finding #7 documentation purposes.
  api.github.com             # Extension update check (popup.js:64)

  # --- Navigation targets (passed to chrome.tabs.create or rendered as <a href>) ---
  cp-vlasak.github.io        # Toolkit download page (popup.js:5)
  connect.civicplus.com      # "Powered by CivicPlus" referral link in HTML template (insertPoweredByHTML.js:32)

  # --- Google Translate clipboard template class (copyGoogleTranslate.js,
  # Setup default widget option sets.js) — strings copied to user clipboard
  # or POSTed to CMS for execution in CMS-site runtime, NOT fetched by extension ---
  www.gstatic.com            # Google Translate icon in clipboard CSS template
  translate.google.com       # Google Translate JS bootstrap (protocol-relative) and CMS-rendered window.open URL
)

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

# ---- Check 5: no remote third-party hosts outside the allowlist ---------
# Scans .js/.css/.html in mv3-extension/ (excluding external/ vendored
# libraries) for absolute and protocol-relative URLs. Any host not in
# ALLOWED_REMOTE_HOSTS (exact string match) fails the check.
#
# URL forms detected:
#   - https://host[:port]/...
#   - http://host[:port]/...
#   - ["'`(=]//host[:port]/...  (protocol-relative, MUST be preceded by a
#                                URL-context delimiter so JS line comments
#                                like //object.method do NOT match)
#
# Multi-label host requirement: (\.[a-zA-Z0-9-]+)+ after the first label
# means at least one internal '.', so //translate.google.com matches but
# //Create, //Add, // some comment do NOT. (CP2 BLOCKER 1 + CP3 BLOCKER 1.)
#
# Comments policy: this check does NOT filter URLs in comments. Rationale:
#   (1) consistency with the other 4 checks (none filter comments),
#   (2) bash multi-line comment detection is brittle,
#   (3) commented-out remote URLs are still in the shipped artifact and
#       one Ctrl+/ from being live — cleaning them up is good hygiene.
#
# Host comparison: exact string equality via POSIX [ "$a" = "$b" ], NOT
# regex match. This avoids the dot-as-wildcard trap (e.g. fonts.googleapis.com
# would also regex-match fontsxgoogleapisxcom). (CP1 WARNING 1.)
#
# XML namespace special case: www.w3.org is skipped, not allowlisted.
# xmlns="http://www.w3.org/2000/svg" is a spec-defined identifier, not a
# runtime fetch. Keeping it out of ALLOWED_REMOTE_HOSTS preserves the
# allowlist as a "hosts we accept fetches to" list. (CP2 BLOCKER 2.)
check_no_remote_assets() {
  local matches
  matches=$(grep -RInoE '(https?://|["'"'"'`(=]//)[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(:[0-9]+)?' \
    --include='*.js' --include='*.css' --include='*.html' \
    --exclude-dir=external \
    mv3-extension/ 2>/dev/null || true)

  if [ -z "$matches" ]; then
    echo "[guardrail:no-remote-assets] PASS: no http(s)/protocol-relative URLs found in mv3-extension/"
    return 0
  fi

  local bad_lines=""
  while IFS= read -r line; do
    # grep -no emits: file:line:match. Parse deterministically by splitting
    # on the first two ':' from the left. The previous ${line##*:[0-9]*:}
    # glob was too greedy and stripped through port colons.
    local rest="${line#*:}"        # drop the file path
    local url="${rest#*:}"         # drop the line number; $url is the match

    # Strip leading scheme + // (or just delimiter+//) → leaves host[:port]
    local host_with_port="${url#*//}"
    host_with_port="${host_with_port%%/*}"   # drop path
    host_with_port="${host_with_port%%\?*}"  # drop query (defensive)
    host_with_port="${host_with_port%%#*}"   # drop fragment

    # Drop port for allowlist comparison: today's allowlist has no port-pinned
    # entries. If a future entry needs port-pinning, change the loop to
    # compare against ${host_with_port} and store entries as "host:port".
    local host="${host_with_port%%:*}"

    # XML namespace special case: skip W3C namespace literals entirely.
    # They are URN-style identifiers, never resolved as network endpoints.
    if [ "$host" = "www.w3.org" ]; then
      continue
    fi

    # Exact-string match against allowlist.
    local allowed=0
    local h
    for h in "${ALLOWED_REMOTE_HOSTS[@]}"; do
      if [ "$host" = "$h" ]; then
        allowed=1
        break
      fi
    done

    if [ "$allowed" -eq 0 ]; then
      bad_lines+="$line"$'\n'
    fi
  done <<< "$matches"

  if [ -n "$bad_lines" ]; then
    echo "[guardrail:no-remote-assets] FAIL: non-allowlisted remote host(s) in mv3-extension/"
    printf '%s' "$bad_lines" | sed 's/^/  /'
    return 1
  fi
  echo "[guardrail:no-remote-assets] PASS: all http(s)/protocol-relative hosts in mv3-extension/ are in ALLOWED_REMOTE_HOSTS"
  return 0
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
