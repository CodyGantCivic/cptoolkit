# External Dependencies

This document records every external (non-first-party) network host the
extension's own code references, and why each one must remain. It is the
companion to **Finding #7** (remote third-party assets) of the April 2026
security review.

The `check_no_remote_assets` guardrail in `scripts/security-guardrails.sh`
enforces this list. It scans `mv3-extension/js` and `mv3-extension/css`
(excluding vendored `*/external/` libraries) for `https://`, `http://`, and
quoted protocol-relative (`"//host`) references, strips any userinfo so a
`user@host` bypass resolves to the real host, and reconciles the result against
two allowlist buckets **in both directions** — a new host fails, and an
allowlisted host that no longer appears also fails (the floor must track
reality). **Every host below must match an allowlist entry, and vice versa.** If
you add a remote reference, add the host to the correct bucket in
`security-guardrails.sh` *and* document it here in the same PR.

## Hosts the extension itself contacts

These are loaded, fetched, or navigated to by the extension at runtime
(`ALLOWED_REMOTE_HOSTS`).

None. The Chrome Web Store build relies on Chrome's automatic extension update
flow and does not call GitHub release APIs, external download pages, or Store
listing pages from the popup.

## Hosts in markup the toolkit emits into customer sites

These appear only in clipboard snippets / inserted HTML the toolkit generates
for a customer's published site — **not** loaded by the extension itself
(`ALLOWED_SNIPPET_HOSTS`). They are still tracked so any new third party
surfaces in review.

| Host | Used by | Purpose |
|------|---------|---------|
| `www.gstatic.com` | `js/tools/on-demand/copyGoogleTranslate.js` | Google Translate widget icon, part of the mobile-compatible Translate script copied to the clipboard for pasting into a customer site. |
| `translate.google.com` | `js/tools/on-demand/copyGoogleTranslate.js`, `js/tools/on-demand/Setup default widget option sets.js` | The Google Translate widget script / link emitted into customer markup. |
| `connect.civicplus.com` | `js/tools/on-demand/insertPoweredByHTML.js` | First-party CivicPlus referral link in the "Government Websites by CivicPlus" byline inserted into customer layouts. |
| `www.w3.org` | `js/tools/on-demand/insertPoweredByHTML.js` | SVG `xmlns` namespace identifier in inserted markup — a constant string, **not a network request**. |


## Vendored (no external load)

These libraries are bundled locally under `mv3-extension/js/external/` and
`mv3-extension/css/external/`; their upstream/license URLs appear only in
file headers and are intentionally **out of guardrail scope**:

- **jQuery 3.3.1** — `js/external/jquery-3.3.1.min.js`
- **Bootstrap 4.0.0** — `css/external/bootstrap.min.css`
- **Font Awesome Free 5.0.10** — `css/external/fontawesome-all.min.css` + `css/external/fontawesome-fonts/`

## Removed in Finding #7

These remote references were eliminated by deleting the orphaned tools that used
them (same PR that added this doc):

- `ajax.googleapis.com` + `code.jquery.com` — jQuery 1.7.1 (was: `Generate client timeline.js`)
- `irp-cdn.multiscreensite.com` — CivicPlus product wordmark logos (was: `Generate client timeline.js`)
- `fonts.googleapis.com` @import in `fancybutton.css` and font links in `Generate client pdf.js` (both files deleted)
- `fonts.googleapis.com` preview stylesheet links in the fancy-button library pages (removed to avoid remote stylesheet loads from extension-rendered previews)
