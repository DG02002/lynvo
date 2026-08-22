# ADR 0003: Replace Convex with Cloudflare D1 + Workers

## Status

Accepted. Supersedes the realtime sections of
[ADR 0001](0001-saved-link-realtime-synchronization.md) and the browser-Convex
authentication ADR. Implementation tracked in `plans/001-replace-convex-with-d1.md`
with phase breakdowns `plans/001a` … `plans/001e`.

Cutover addendum (2026-08-21): the cutover (plan 001e) removed Convex
completely. **Phase 4 (data export/import rehearsal) was skipped by owner
decision** — Lynvo had no real users and nothing deployed, so there was no data
to migrate. Password accounts were abandoned rather than migrated, resolving
the plan's open questions #1 and #2: sign-in is Google-only. The Convex project
was never put into production and needs no 30-day disaster-recovery freeze.

## Context

Every recurring bug class in Lynvo came from having two of something: two session
systems (Worker Auth Session DO vs Convex Auth), two freshness mechanisms (blocked
Convex subscriptions plus manual polling), two sources of truth (client operation
ledger vs server snapshot), two write paths (browser→Convex and browser→BFF→Convex),
and two client data stacks (Convex react client plus TanStack Query). Roughly
800–1,000 LOC of dead or vestigial code exists as scar tissue from these designs.

## Decision

One platform, one of everything:

- **Cloudflare Workers + D1 + Durable Objects** run everything. Convex is fully
  removed at cutover; no dual-backend flag period.
- **One session system**: opaque HttpOnly cookie → `sessions` row in D1. No JWTs,
  refresh tokens, token bridges, or outbox tables. Revocation is a row delete.
- **No auth library** (verdict against Better Auth for now): Google OAuth is
  exchanged server-to-server so no JWT/JWKS verification exists to get wrong;
  sessions are ~100 LOC of boring D1 CRUD with 128-bit random opaque IDs. A
  mandatory security review gates production cutover; unresolvable findings flip
  us to Better Auth around a one-table swap.
- **Custom QR/device sign-in is first-class**: the proven state-machine semantics
  from `convex/deviceAuth.ts` (poll-secret digests, exchange attempt IDs,
  monotonic generations, time-boxed leases, stale-generation rejection) port
  verbatim onto D1.
- **Google-only sign-in at cutover**; password accounts are not migrated.
- **Realtime by version echo**: monotonic per-account `data_version` increments in
  the same transaction as every owned-data write, echoed on every API response.
  WebSocket push is a latency optimization only — a lost frame costs milliseconds,
  never correctness.
- **Single write path**: all mutations through the Worker API with client-generated
  `operationId`s deduped by a server-side idempotency ledger. The server snapshot
  is the only persisted client state; entities are keyed by server-assigned IDs.

## Consequences

- The entire `apps/lynvo/convex/` directory, the Worker↔Convex token bridge, the
  client operation ledger, and TanStack Query are deleted at cutover.
- While on `*.workers.dev` the Google consent screen stays in Testing status
  (unverifiable Public Suffix domain); a custom domain must be purchased and
  verified before public launch.
- Existing password-based accounts cannot sign in after cutover unless they use
  Google with the same email (open question in plan 001).
- D1 limits apply (500 MB free tier, 1 MB rows, 30 s query timeout); Time Travel
  PITR is 7 days on free tier, so periodic exports to R2 are scheduled post-beta.
