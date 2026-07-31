# Lynvo launch-readiness plan

Date: July 31, 2026

Production origin: `https://lynvo.dg02002.workers.dev`

Current verdict: **no-go until Phase 0 and Phase 1 are complete**. The repository
itself is healthy: 303 tests pass, all checks pass, both production builds pass,
the production dependency audit is clean, and no common committed-secret pattern
was found.

## Changes completed during this audit

- Set the production identity to `https://lynvo.dg02002.workers.dev` in the
  Official Extractor manifest, official catalog fallback, Android TV guide, and
  homepage demo.
- Set Official Extractor assets to
  `https://lynvo.dg02002.workers.dev/official-extractor-assets`.
- Made Lynvo's intended `workers.dev` exposure explicit while keeping the
  Official Extractor private behind the service binding.
- Added the production origin to the deployment documentation.
- Preserved pre-existing local work and did not push or deploy anything.

## Implementation progress

- [x] Removed `/ui-test-list` from the production route table and robots file.
- [x] Added an atomic Durable Object authentication limiter for signup,
  sign-in, and TV device-code creation, with production fail-closed behavior.
- [x] Route TV approval attempts through the Worker limiter.
- [x] Hardened explicit Turnstile actions, hostname/action validation, the
  2,048-character token boundary, Siteverify timeout, and widget resets.
- [x] Configured the supplied non-secret production Turnstile site key.
- [x] Continued OneDrive's initial token, bounded OneDrive/Bhadoo pagination,
  detected repeated tokens, aligned the caller timeout, and settled the exact
  reserved UTC quota period.
- [x] Add bounded response-body and manually validated redirect handling.
- [x] Added the Lynvo deploy quality gate and shared API transport headers.
- [x] Add configuration-preflight behavioral coverage for placeholders, empty
  values, required bindings, production topology, origin, and service target.
- [x] Verify generated `.dev.vars` files are excluded from Wrangler uploads.
- [x] Updated new-password validation to the OWASP no-MFA minimum length model
  without composition rules.
- [ ] Complete the remaining Phase 1 architecture and Phase 2 work below.

Migration boundaries are documented in `plans/session-migration-boundary.md`
and `plans/external-worker-credential-migration-boundary.md` before the
architectural increments begin.

The first widening increments are complete: Worker session storage has tested
encryption, absolute and idle expiry, revocation, parallel sign-in issuance,
and opaque-session reads. The internal external-worker credential
vault has tested context-bound AES-256-GCM behavior and fail-closed key
configuration. New external-worker registrations now persist only versioned
ciphertext; plaintext writes, schema storage, and compatibility reads have been
removed. The authorized development/production Convex reset and zero-row
verification remain external prerequisites before applying the narrowed
schema. The session migration has not reached its narrow phase.

## Phase 0 — Decisions and external configuration

These inputs cannot be safely invented:

1. Create one managed Turnstile widget for
   `lynvo.dg02002.workers.dev`. Use the existing explicit-rendering component;
   Spin is optional provisioning assistance and does not replace the current
   integration.
2. Put the public site key in `TURNSTILE_SITE_KEY` and the secret in the Lynvo
   Worker's `TURNSTILE_SECRET_KEY` secret. Never commit or paste the secret into
   a plan, command argument, log, or chat.
3. Confirm the production Convex deployment URL and initialize Convex Auth with
   `SITE_URL=https://lynvo.dg02002.workers.dev`.
4. Supply production-only `AUTH_GATEWAY_SECRET`,
   `PLUGIN_CREDENTIAL_MASTER_KEY`, and `OFFICIAL_EXTRACTOR_API_KEY`; the gateway
   secret must also exist in Convex, and the extractor key must match on the two
   Workers.
5. Supply the legal operator identity and governing jurisdiction for policy
   review.
6. Confirm these TDD seams before implementation: Worker HTTP request/response,
   Official Extractor public APIs and outcomes, and React Router rendered route
   behavior. Tests should assert observable behavior, not private helpers.

Exit criteria: all production identifiers and secrets exist in the intended
Cloudflare/Convex accounts, without any secret entering source control.

## Phase 1 — Required code work

### 1. Atomic authentication abuse protection

- Replace KV read-modify-write with an atomic Durable Object limiter.
- Fail closed with a generic 503 if the production binding is unavailable.
- Cover signup, sign-in, device-code creation, and TV approval attempts.
- Record a structured configuration/limiter event without usernames or secrets.

Acceptance tests through Worker HTTP requests:

- the first N requests are allowed and N+1 returns 429;
- concurrent requests cannot exceed the configured allowance;
- a missing production binding returns 503, never success;
- windows expire deterministically under a supplied clock.

### 2. Complete the Turnstile contract

- Keep explicit rendering and retained widget IDs.
- Add distinct stable actions for signup and sign-in.
- Reset after every consumed token and on expiration/error.
- Require `success`, exact `action`, and the exact deployment hostname from
  Siteverify; enforce the 2,048-character token maximum and a request timeout.
- Add a deployment preflight that rejects an empty site key.

Acceptance tests through auth preflight HTTP requests:

- correct hostname/action succeeds;
- missing, oversized, expired, replayed, wrong-host, and wrong-action tokens fail;
- missing site key or server secret fails closed with a service error;
- Siteverify network timeout returns a generic response and logs no token.

### 3. Remove browser-readable refresh credentials

- Introduce a same-origin Worker session boundary with `HttpOnly`, `Secure`, and
  `SameSite=Lax` cookies.
- Keep refresh credentials server-side and rotate them.
- Shorten absolute/idle duration and preserve session revocation.
- Replace production `unsafe-eval` and broad `unsafe-inline` with a nonce or
  hash-based CSP for React Router scripts and the constant theme bootstrap.

Acceptance tests through rendered route/API behavior:

- auth cookies are HttpOnly, Secure, SameSite, and scoped correctly;
- browser JavaScript cannot read access or refresh tokens;
- authenticated SSR and API calls continue to work;
- logout and session revocation invalidate both server and browser state;
- production CSP contains no `unsafe-eval` and permits Turnstile/Convex only.

### 4. Protect stored external-worker credentials

- Decide whether external worker registration ships in v1. If not, remove the
  route/UI/API capability from production until encryption is complete.
- If it ships, add versioned envelope encryption and migrate plaintext rows with
  widen-migrate-narrow.
- Never return plaintext credentials to browser queries.

Acceptance tests through the registration/service boundary:

- newly stored records contain ciphertext, nonce, algorithm, and key version;
- service extraction decrypts only for the owning authenticated user;
- copied ciphertext fails under another user/worker context;
- migration is restartable and no plaintext field remains after narrowing.

### 5. Bound Official Extractor work and fix correctness

- Preserve and continue the OneDrive token embedded in initial page data.
- Add page, node, byte, redirect, elapsed-time, and repeated-token limits to
  OneDrive and Bhadoo.
- Make Official Extractor upstream/retry budgets fit inside Lynvo's caller
  timeout, or raise the caller budget deliberately.
- Return a reservation identifier/period from `/reserve` and settle that exact
  period so a failure crossing UTC midnight releases the correct counter.
- Manually validate each redirect destination before following it.

Acceptance tests through extractor requests and Durable Object requests:

- initial OneDrive continuation pages are included;
- repeated tokens and excessive pages fail with a bounded protocol error;
- oversized bodies and redirect chains are rejected;
- a reserve-before-midnight/fail-after-midnight scenario restores the original
  day's counter;
- caller timeout exceeds the documented worst-case extractor budget.

### 6. Close launch-only exposure and deployment gaps

- Remove `/ui-test-list` from the production route table; `robots.txt` is not an
  access control.
- Make the Lynvo deploy script run formatting/lint/type checks, all tests, and
  the build before `wrangler deploy`, matching the Official Extractor gate.
- Add a non-secret configuration preflight for placeholder IDs, empty variables,
  production origin, required bindings, and service target.
- Apply shared transport security headers to API and document responses.

Acceptance tests:

- production route generation has no `/ui-test-list`;
- deploy preflight fails on every known placeholder/empty required value;
- API responses include the shared header baseline;
- the deployment command cannot reach Wrangler deploy after a failed gate.

## Phase 2 — Prelaunch quality and policy work

1. Update the no-MFA password policy to the current OWASP length/blocklist model.
2. [x] Generate TV approval codes with Web Crypto, assert uniqueness, and limit
   approval attempts.
3. [x] Bound external-worker usage fan-out and cap saved registrations instead
   of using unbounded concurrency.
4. Add canonical URLs, Open Graph/Twitter metadata, and `sitemap.xml` using the
   production origin; keep private routes `noindex`.
5. Remove nested `<main>` landmarks from child routes, improve the root error
   boundary with recovery navigation, and run keyboard/screen-reader checks.
6. Replace Effect-internal `Date.now()` calls with an injected clock/DateTime
   service where behavior depends on time. Keep Effect services/layers at I/O
   boundaries and React components at rendering boundaries.
7. Replace circular policy operator wording and add legally reviewed operator,
   jurisdiction, and contact details.

## Verification before deployment

Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm audit --prod
pnpm check
pnpm test
pnpm build
pnpm --filter @lynvo/app exec wrangler deploy --dry-run
```

Then inspect the dry-run bundle to confirm `.dev.vars`, secret values, test-only
routes, and source maps are not uploaded as public assets.

## Authorized deployment sequence

Do not execute this phase without explicit deployment authorization.

1. Verify the Cloudflare account and both Worker names.
2. Deploy the private Official Extractor first and validate its manifest,
   authenticated verify/usage, extraction, timeout, and quota behavior.
3. Deploy production Convex schema/functions and initialize Auth with the exact
   production `SITE_URL`.
4. Deploy Lynvo with the service binding targeting that exact Official Extractor.
5. Smoke-test `https://lynvo.dg02002.workers.dev` in a real browser:
   signup, sign-in, sign-out, session revocation, TV pairing, official Google
   Drive/OneDrive/Bhadoo extraction, asset icons, retention settings, policies,
   and rate-limit behavior.
6. Check Cloudflare/Convex logs and quota counters for secret leakage, unexpected
   retries, errors, and cross-day settlement.
7. Record Worker versions and rollback steps.

The live URL is needed only after deployment for hostname-bound Turnstile,
browser cookie/header, real service-binding, and end-to-end extraction checks.
