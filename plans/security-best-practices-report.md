# Lynvo security best-practices report

Date: July 31, 2026

Scope: Lynvo, its Cloudflare Worker, Convex functions, the shared extractor
protocol, and the Lynvo Official Extractor. Test fixtures and the example
extractor are considered only where they affect the production build.

## Executive result

No committed private keys or common provider-token patterns were found, and
`pnpm audit --prod` reports no known production dependency vulnerabilities.
Authorization checks are consistently present on account-owned Convex data,
plugin domain credentials use AES-256-GCM with contextual additional data, the
Official Extractor is private behind a service binding, and production builds
complete successfully.

Production deployment is not yet recommended. Three high-severity findings and
the unresolved Turnstile/rate-limit configuration must be handled first.

## Findings

Implementation status: SEC-001, SEC-004, SEC-007, SEC-009, and the
password-policy portion of SEC-005 are remediated. SEC-008 pagination,
repeated-token bounds, external-worker fan-out, and registration amplification
are remediated.
SEC-002 remains open. SEC-003 is code-complete pending the authorized database
reset, and the cryptographic-code portion of SEC-006 is remediated.
SEC-002 now has a tested server-side session Durable Object, and SEC-003 has a
tested context-bound encryption Durable Object plus deployment preflight; the
browser/session cutover and persisted-row migration are not complete.
The session widening path now covers encrypted storage, opaque-cookie sign-in,
session reads, idle/absolute expiry, logout, and revocation. The external-worker
schema now accepts versioned ciphertext alongside the legacy plaintext field.
New registrations use a credential-free pending row followed by context-bound
Worker encryption and ciphertext finalization; Worker service reads decrypt
only after authenticated ownership checks. The plaintext schema field, write
mutation, and compatibility reader are removed. SEC-003 remains operationally
open only until both remote Convex deployments are confirmed empty before the
narrowed schema is applied.
TV approval codes now use unbiased Web Crypto rejection sampling, and creation
fails when the bounded collision loop cannot prove uniqueness. The atomic
Worker limiter continues to protect approval attempts by account and IP.

### SEC-001 — High — Authentication rate limiting fails open and is not atomic

- Evidence: `apps/lynvo/workers/app.ts:83-103` returns `true` when the binding
  is absent and performs a KV `get` followed by `put`. The production binding
  still contains a placeholder at `apps/lynvo/wrangler.jsonc:23-27`.
- Impact: a missing binding silently removes throttling. Concurrent attempts can
  read the same counter and undercount, weakening protection against credential
  stuffing, username targeting, signup abuse, and device-code creation abuse.
- Recommended fix: replace this counter with an atomic Durable Object or an
  appropriately configured Cloudflare rate-limiting binding. Fail closed in
  production when the limiter is unavailable, expose a generic 503, and alert
  on configuration failures.
- Compensating controls: Turnstile and generic authentication errors reduce
  automated abuse once Turnstile is configured.
- False-positive note: KV expiration is useful for approximate counters, but it
  does not make a read-modify-write sequence atomic.

### SEC-002 — High — Long-lived authentication tokens are readable by JavaScript

- Evidence: `apps/lynvo/app/lib/convex-auth-storage.ts:3-31` stores access and
  refresh tokens in `localStorage` and JavaScript-created cookies for one year.
  Those cookies cannot be `HttpOnly`.
- Impact: an XSS or compromised same-origin script can exfiltrate both tokens
  and retain account access beyond the current page session.
- Recommended fix: move browser session continuity behind a same-origin Worker
  session using `Secure; HttpOnly; SameSite=Lax` cookies. Keep refresh tokens out
  of browser JavaScript, rotate sessions, and shorten absolute and idle lifetime.
- Compensating controls: same-site cookies, session revocation, and the current
  CSP provide partial protection.
- False-positive note: this is an architectural exposure, not evidence that an
  XSS vulnerability currently exists.

### SEC-003 — High — External extractor API keys are stored as plaintext

- Evidence: `apps/lynvo/convex/schema.ts:112-124` defines `apiKey` as a plain
  string; `apps/lynvo/convex/userWorkers.ts:62-87` writes the supplied value
  directly. Service reads are authenticated and additionally signed, but the
  stored value is not encrypted.
- Impact: database access, an overly broad diagnostic export, or a future server
  authorization bug would disclose credentials for user-configured workers.
- Recommended fix: use envelope encryption with a Worker-held master key,
  versioned ciphertext, a unique nonce, and user/worker identity as additional
  authenticated data. Migrate existing rows before removing the plaintext
  field. If that cannot be completed before launch, hide and reject external
  worker registration until it is complete.
- Compensating controls: public list responses omit the key and service reads
  require both the user session and a short-lived signed service token.
- False-positive note: the Privacy Policy accurately says these keys are stored;
  it does not claim that they are encrypted.

### SEC-004 — Medium — Turnstile verification is incomplete

- Evidence: the request schema permits 4,096 characters at
  `apps/lynvo/app/lib/auth-gateway-schemas.ts:3-9`. The widget at
  `apps/lynvo/app/components/turnstile.tsx:93-101` does not set an `action`.
  Siteverify at `apps/lynvo/workers/app.ts:106-141` has no explicit timeout,
  accepts a successful response with no hostname, and cannot validate an
  expected action. The production site key is empty at
  `apps/lynvo/wrangler.jsonc:50-55`.
- Impact: production sign-in and signup cannot pass as configured. Once keys are
  added, validation will still be less tightly bound to the intended form and
  deployment than Cloudflare's canonical pattern.
- Recommended fix: retain explicit rendering, add stable `lynvo-sign-in` and
  `lynvo-sign-up` actions, require the matching action and exact production
  hostname, enforce the documented 2,048-character token maximum, and put a
  timeout around Siteverify. Keep the secret in Worker secrets only.
- Compensating controls: tokens are sent to Siteverify, reset after failed form
  submissions, and the current code checks a returned hostname when present.
- False-positive note: Turnstile Spin and manual setup create the same widget;
  Spin is a provisioning workflow, not a separate runtime defense.

### SEC-005 — Medium — Password rules do not match current OWASP guidance

- Evidence: `apps/lynvo/app/lib/auth-policy.ts:1-4` permits 11-character
  passwords and `:72-77` requires upper- and lowercase characters. Lynvo has no
  MFA. A short local list is used instead of a breached-password corpus.
- Impact: accepted passwords may have less resistance to offline or credential-
  stuffing attacks, while composition rules create friction without reliably
  increasing entropy.
- Recommended fix: require at least 15 characters while MFA is unavailable,
  keep the 128-character maximum, allow all characters without composition
  rules, and block common or breached passwords. Apply the new policy to new or
  changed passwords without locking out existing sessions.
- Compensating controls: PBKDF2-SHA-256 uses a random 16-byte salt, 600,000
  iterations, and constant-time hash comparison.
- False-positive note: this is a standards mismatch, not proof that an existing
  password has been compromised.

### SEC-006 — Medium — TV approval codes use non-cryptographic randomness

- Evidence: `apps/lynvo/convex/tv.ts:14-15` generates the eight-digit approval
  code with `Math.random`; `:51-61` stops after five collision checks without a
  final uniqueness assertion. Approval lookups and mutations have no dedicated
  attempt limiter.
- Impact: an authenticated attacker can attempt to discover a pending code and
  bind a victim's device to the attacker's account. A collision after the retry
  loop can also violate the query's uniqueness assumption.
- Recommended fix: use rejection sampling over `crypto.getRandomValues`, fail if
  a unique code is not obtained, and rate-limit approval attempts per account
  and IP. Preserve the cryptographic poll secret.
- Compensating controls: codes expire after ten minutes; code creation is
  preflight-gated and rate-limited; polling also requires a 256-bit secret.
- False-positive note: the display code is intentionally human-entered and need
  not be a full bearer secret, but it still authorizes a security-sensitive link.

### SEC-007 — Medium — Arbitrary-source fetch defenses do not cover redirects or DNS

- Evidence: `apps/official-extractor/src/url-policy.ts:3-25` rejects literal
  private/loopback host strings. Bhadoo discovery intentionally accepts arbitrary
  HTTPS hosts. Fetches use the default redirect behavior, and destination hosts
  are not revalidated after a redirect or DNS resolution.
- Impact: a hostile or compromised index can make the Worker send subrequests to
  a destination that was not represented by the validated URL. Unbounded JSON
  response bodies also create memory and execution-time pressure.
- Recommended fix: use manual redirect handling with a small redirect cap,
  validate every `Location`, reject credentials and malformed IP literals, and
  cap response bytes before parsing. Document any Cloudflare platform-level
  private-network restriction being relied upon.
- Compensating controls: schemes and common literal private IPv4/IPv6 ranges are
  rejected, Google Drive extraction uses fixed Google hosts, and upstream calls
  have ten-second attempt timeouts.
- False-positive note: Cloudflare's network may block some private destinations;
  the application currently does not encode or test that assumption.

### SEC-008 — Medium — Unbounded fan-out and pagination permit resource exhaustion

- Evidence: Bhadoo loops while any next token is returned at
  `apps/official-extractor/src/sources/bhadoo-google-drive-index.ts:187-208`.
  OneDrive does the same at
  `apps/official-extractor/src/sources/onedrive-index.ts:147-205` and ignores the
  continuation token embedded in the initial page. External usage checks use
  `Effect.all(..., { concurrency: "unbounded" })` in
  `apps/lynvo/app/lib/effect/api/handlers/WorkersHandlers.ts:60-101`.
- Impact: a malicious or broken upstream can loop, return excessive data, or
  exhaust Worker subrequest/CPU/memory limits. A user with many configured
  workers can amplify outbound requests.
- Recommended fix: set maximum pages, nodes, response bytes, elapsed time, and
  repeated-token detection. Bound external-worker concurrency and registration
  count.
- Compensating controls: per-attempt timeouts and account storage limits provide
  partial bounds.
- False-positive note: ordinary upstreams normally terminate pagination; the
  missing bound matters precisely when they do not.

### SEC-009 — Low — Security headers are not applied uniformly to API responses

- Evidence: document responses receive the complete header set in
  `apps/lynvo/app/entry.server.tsx:45-64`; `/api/*` handlers return before the
  fallback header wrapper in `apps/lynvo/workers/app.ts:473-514`.
- Impact: direct API responses omit defense-in-depth headers such as
  `X-Content-Type-Options` and HSTS on a client's first request to the host.
- Recommended fix: add one outer Hono response middleware that applies the
  appropriate shared headers to every response, with CSP limited to documents.
- Compensating controls: the app is served on an HTTPS-only Workers domain and
  JSON responses use explicit content types.
- False-positive note: CSP is not needed on JSON APIs; this finding concerns the
  shared transport/header baseline.

## Policy review

- The Cookie Policy discloses the auth cookies and local authentication storage,
  including their one-year duration.
- The Privacy Policy accurately distinguishes encrypted plugin-domain passwords
  from stored external-worker API keys.
- The 90-day account inactivity period, selectable 7/30/90/180-day link
  retention, five-minute remote commands, and daily cleanup claims match code.
- Support now links to Telegram and GitHub Issues.
- Before public launch, replace the circular operator wording (“Lynvo operates
  Lynvo”) with the actual legal operator and add the governing law/jurisdiction
  after appropriate legal review. These details cannot be inferred from code.

## References

- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/index.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Server Side Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Cloudflare Turnstile Spin](https://developers.cloudflare.com/turnstile/spin/)
- [Cloudflare Turnstile token validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
