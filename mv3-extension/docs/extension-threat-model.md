# CP Toolkit Security Threat Model

Last updated: 2026-07-20

Purpose: define the trust boundaries for CP Toolkit activation and mutation tools. This record is intentionally separate from activation reliability: reliable CivicPlus detection is useful, but it is not authentication or authorization.

## Decision

Treat every client-visible CivicPlus marker as reproducible. Hostnames, DOM classes, admin-shell markup, static asset paths, Swagger metadata, and public API responses may classify a page as CivicPlus-shaped, but none of them proves that the site is genuine, that the current user is a CivicPlus employee, or that the user may perform a particular write.

Therefore:

1. Product/site detection is an activation and containment control only.
2. Chrome Web Store distribution or enterprise policy controls who should be able to install the toolkit.
3. CivicPlus server-side authentication and per-operation authorization are the authoritative controls for data access and mutation.
4. The extension must assume its packaged source, detection rules, routes, and request formats are visible to an attacker.
5. No API key, shared secret, database credential, or durable bearer token may be embedded in the extension.

## Current State

Reviewed extension version: `1.1.5`.

Positive controls observed:

- Required host access is limited to enumerated CivicPlus platform domains. Unknown HTTPS vanity origins never get access automatically. The toolbar popup may open on its own for admin-looking URLs and a passive icon cue marks pages Chrome matches against CivicPlus markers, but nothing runs on the site until the user clicks Trust and approves Chrome's own exact-origin permission prompt. Both signals (URL path, page markers) are reproducible by an attacker, so they only decide whether to ask, never whether to trust.
- The activation service worker maps detector lanes to a fixed registry of packaged files. A page message cannot supply an arbitrary script path.
- Activation messages validate the extension sender ID and verify that the sender URL is on an approved origin before full-toolkit injection.
- `manifest.json` does not declare `externally_connectable`, and the service worker does not register an external-message listener. Ordinary web pages therefore do not have a direct public Chrome messaging endpoint into the extension.
- A source-pattern review found no obvious embedded API key, password, bearer token, client secret, or access token. Page request-verification tokens are read from the signed-in page when a native workflow requires them; they are not bundled credentials.
- Several mutation tools use same-origin URLs and the current page session. Examples include NewsFlash item creation, Quick Links category creation, Option Set creation, skin operations, and Graphic Link workflows.
- The MAIN-world-to-extension storage bridge restricts access to an explicit storage-key allowlist, and copied-skin import validates stored data against a schema before applying it.

Important residual exposure:

- The vanity-origin trust decision currently relies on evidence that an attacker can imitate. If a user installs the extension, visits a convincing fake, invokes the popup, and grants that exact origin, toolkit code can run on the attacker's page.
- Some tools intentionally execute in the page's MAIN world or communicate through document `CustomEvent`s. Host-page JavaScript can observe, imitate, or interfere with those interactions.
- The storage bridge accepts writes for `cp-toolkit-multi-skins` from page-visible events. Schema validation protects the later import path, but the bridge remains an untrusted input boundary and should enforce size/shape constraints before storage as defense in depth.
- The central service-worker message listener exposes a fixed allowlist of Fancy Button operations to extension contexts. Although ordinary pages cannot call it directly, each operation should independently validate sender URL, frame, operation arguments, and expected workflow state.
- The live Web Store item is currently **Unlisted**. It is omitted from Store search, but anyone with the listing URL can install it; this reduces discovery but is not an employee authorization control.
- Server-side authorization behavior for every mutation endpoint has not yet been verified. Client-side UI visibility, admin DOM markers, and possession of a valid session are not sufficient evidence of per-operation authorization.

## Threat Scenarios

### 1. Attacker-owned fake CivicPlus site

An attacker can reproduce public CivicPlus API/Swagger responses and admin-shell markers. This can fool classification and may persuade an extension user to grant the fake origin.

If the fake page only copies markers and otherwise does nothing, toolkit activation there is primarily a false positive and UI nuisance. Same-origin requests use the fake site's cookies and endpoints, not cookies or endpoints for a real CivicPlus customer origin.

If the fake page deliberately runs hostile JavaScript after the user grants that exact origin, the current page-visible storage bridge can read or overwrite the whitelisted `cp-toolkit-multi-skins` value. That can disclose or corrupt the user's saved copied-skin data, but it does not expose arbitrary extension storage or grant CivicPlus database access. Later import validation limits accepted structure, although a user could still be misled into importing attacker-supplied but structurally valid data.

The fake does not gain real CivicPlus database access unless another flaw turns the extension into a confused deputy—for example, an arbitrary-destination request broker, an embedded credential, cross-origin cookie/API access, or a server endpoint that fails authorization.

### 2. Unauthorized person installs the extension

If distribution is Public or Unlisted, assume outsiders can obtain and inspect the complete client bundle. They can use client-only utilities and reproduce request formats. They should still be unable to read or mutate CivicPlus resources without a valid identity and the required server-side role on every endpoint.

### 3. Hostile script on a legitimate signed-in site

This is the highest-priority browser-side scenario. Stored/reflected XSS, a compromised site widget, or compromised first-party/third-party page code runs on a real origin with the user's session. It can manipulate DOM markers and interfere with MAIN-world helpers or DOM event bridges. It may be able to trigger native endpoints directly even without the extension; the toolkit can increase speed, scope, or convenience of abuse.

### 4. Compromised or over-privileged authorized user

The extension amplifies the actions available to the signed-in account. Server role checks, object-level authorization, rate limits, explicit confirmations, audit records, and recovery paths must contain misuse and mistakes.

### 5. Compromised extension update or publisher account

A malicious extension update would inherit granted origins and extension capabilities. Publisher account protection, group ownership, least-privilege Store roles, review gates, reproducible release artifacts, and a revocation/kill procedure are part of the security boundary.

## Required Controls Before Expanding Activation or Mutation Scope

### Distribution and identity

- Prefer Private/domain-restricted Chrome Web Store distribution or managed enterprise deployment to an employee group. Do not count Unlisted visibility as an authorization control.
- If managed distribution is not available and installation entitlement is important, add a CivicPlus-controlled entitlement service that returns a short-lived, signed assertion bound to the authenticated employee, intended extension, and expiry. Never put the signing secret in the extension.
- Confirm how contractors, support partners, and test accounts should be entitled and revoked.

### Server-side authorization

- Inventory every GET/POST/PUT/PATCH/DELETE endpoint used by the toolkit.
- This check concerns a real CivicPlus site and a real signed-in account, not a fake site. For example, if the native CMS hides a Publish button from a lower-privileged user but the user manually sends the same POST request, the server must still reject it. If it rejects the request, the toolkit cannot give that account extra authority. If it accepts the request merely because the user is signed in, the endpoint has an authorization defect that the toolkit could make easier to exercise.
- For each mutation, verify anonymously, as a signed-in user without the relevant role, with the expected role, and against a resource in another tenant/site.
- Require authorization on every request and object, not only on the page that exposes the button.
- Verify CSRF protection for cookie-authenticated state changes and server-side validation of workflow state, content type, IDs, tenant/partition, and payload size.
- Do not allow the extension to connect directly to a database. All writes must pass through an authenticated, authorized, audited application endpoint.

### Extension containment

- Keep API/Swagger and DOM markers as corroborating classification signals, not security credentials.
- Keep exact-origin grants and show the user the hostname before persisting trust. Provide a visible way to review and revoke trusted vanity origins.
- Bind optional vanity-origin permission grants to a short-lived pending trust record created before requesting access. Match the exact origin and initiating tab in `permissions.onAdded`; do not treat an unrelated exact HTTPS host grant as a completed toolkit trust workflow. Status: implemented for the 1.1.6 candidate.
- Separate “recognized CivicPlus product,” “authenticated power-user shell,” and “tool allowed on this route” into distinct decisions.
- Move privileged decisions into the service worker. Treat every content-script and page-world message as attacker-controlled.
- For each service-worker operation, use a fixed operation allowlist, exact approved sender origin, expected top-frame/frame rules, strict payload schemas and size limits, and fixed same-origin destinations.
- Do not accept arbitrary URLs, script paths, code strings, database targets, tenant IDs, or unrestricted filenames from a page bridge.
- Reduce MAIN-world execution and document-level event bridges where practical. When they are necessary, minimize returned data, use per-operation capability/nonces where useful, and revalidate at the privileged boundary.
- Add explicit preview/confirmation for bulk or destructive writes, with record counts and target site prominently shown.

### Monitoring and release safety

- Log privileged toolkit operations server-side with user, tenant/site, operation, record count, result, and correlation ID; never log credentials or request-verification token values.
- Define rate limits and bulk-operation ceilings appropriate to each endpoint.
- Maintain a way to revoke extension entitlement, disable a hazardous tool, and withdraw/replace a compromised release.
- Protect publisher accounts with phishing-resistant MFA where available and use organization/group publishing rather than a personal account.

## Open Questions

1. Is CivicPlus domain publishing enabled for the publisher account, and are intended users signed into Chrome with managed CivicPlus Google accounts?
2. Can CivicPlus Chrome management target the extension to the actual employee/power-user group or organizational unit?
3. If domain publishing is unavailable, how many trusted testers need access and what account type do they use?
4. Does CivicPlus have a suitable employee identity/entitlement endpoint, or should Store/enterprise distribution be the only installation gate?
5. Which mutation endpoints enforce role and tenant/object authorization server-side today?
6. Which tools can perform bulk, publish, delete, overwrite, upload, or cross-site copy operations, and what confirmation/limit should each require?
7. Can client-controlled widgets or custom HTML execute JavaScript inside signed-in Admin/Live Edit origins under current CSP rules?
8. What audit logs and incident-response controls already exist on the underlying CivicPlus endpoints?

## Next Actions

1. Ask the CivicPlus Chrome/Google Workspace administrator whether domain-private publishing is available and whether access should cover the full domain or a power-user group/organizational unit.
2. Build a machine-readable mutation inventory: tool, route, HTTP method, authentication mode, CSRF mechanism, tenant/object inputs, destructive/bulk impact, and required role.
3. Test server-side authorization for the highest-impact mutation endpoints with least-privileged and cross-tenant cases in an approved non-production environment.
4. Harden all service-worker handlers and page bridges around explicit sender/origin/frame/payload contracts.
5. Add safe-operation UX and audit correlation for bulk/publish/destructive actions.
6. Perform a focused legitimate-origin hostile-page test covering DOM spoofing, CustomEvent bridge abuse, MAIN-world function tampering, and oversized/malformed import data.

## Acceptance Criteria

- Copying CivicPlus DOM/API markers onto an attacker origin cannot obtain real CivicPlus data or trigger a request to a real CivicPlus origin.
- A person who can download and inspect the extension learns no reusable secret and cannot bypass server authorization by recreating its requests.
- A signed-in account without the required role receives a server-side denial for every protected mutation, including direct endpoint calls.
- Cross-tenant/site identifiers are rejected or scoped server-side even when supplied outside the native UI workflow.
- Hostile page code cannot make the service worker perform an arbitrary request, inject an arbitrary file, open an arbitrary privileged extension page, or store unbounded/unvalidated privileged data.
- Bulk and destructive actions identify the target origin and impact, require deliberate user action, and produce an auditable server-side record.
