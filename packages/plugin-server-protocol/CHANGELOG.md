# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package
adheres to [Semantic Versioning](https://semver.org/).

Wire compatibility is tracked separately from package semver: every entry
below states the highest Protocol Server Protocol wire version it supports.
Minor wire versions (`1.x`) are additive by contract; a major wire version
bump is a breaking change that requires a new major of this package.

## [Unreleased]

### Added

- `ProtocolError` with a documented error-code-to-HTTP-status table
  (`PROTOCOL_ERROR_STATUS`). Extract implementations can throw typed
  failures instead of magic message strings; the runtime maps them to the
  protocol error envelope, the documented status, and a `Retry-After`
  header when `retryAfterSeconds` is provided. `PERMANENT_FAILURE`,
  `AUTH_REQUIRED`, and `NODE_EXPIRED` are now reachable from extract
  implementations instead of being schema-only codes.
- Node factory helpers: `createPlayableNode`, `createResolvableNode`, and
  `createGroupNode` construct schema-conforming Media Nodes and make
  required fields impossible to omit.
- `PROTOCOL_VERSION` constant for manifest authors, alongside the existing
  `SUPPORTED_PROTOCOL_VERSIONS`.
- Minor wire-version negotiation: `isCompatibleProtocolVersion` accepts any
  manifest whose major version matches, since minors are additive by
  contract. The manifest schema now accepts `1.x` and the spec documents
  the `X-Lynvo-Protocol-Version` request header Lynvo sends on every
  request.

- Deferred extraction: extract success responses may carry a `pending`
  object (`retryAfterSeconds`, optional `resumeNodeId`) so poll-based
  sources can answer immediately instead of holding the request open.
  Clients re-issue the same request after the interval; the spec section
  "Deferred Extraction" defines the contract.

### Changed

- Usage metric `resetsAt` must now be an ISO 8601 timestamp; the spec
  already required it and the schema now enforces it.
- Spec: unknown non-extension fields are ignored rather than rejected
  (matching the additive-minor rule and actual decoding behavior), and the
  error-code-to-HTTP-status table is now part of the contract.

## [0.1.5] — 2026-08-27

Highest supported wire version: `1.0`.

### Added

- Per-plugin proxy usage display (`proxyCreditUsage`) and BYO proxy key
  support (`proxy: { provider: "scrape-do", token }` on extract requests,
  gated by the manifest `extensions.lynvo.proxyProvider` declaration).
- `usageMultiplier` plugin metadata so servers can warn about multi-unit
  extractions before they run.

## [0.1.4] — 2026-08-25

Highest supported wire version: `1.0`.

### Added

- Match strategy declarations (`static` and `probe`) with probe as the
  lowest-priority fallback.
- Credential capability metadata on plugins (`domain-password`,
  `http-basic`).

## [0.1.3] — 2026-08-20

Highest supported wire version: `1.0`.

### Added

- Discovery endpoint contract (`/discover`) for URL-to-plugin matching.

## [0.1.2] — 2026-08-14

Highest supported wire version: `1.0`.

### Added

- Runtime helpers `createPluginServerRuntime` and request builders for
  source and node extraction.

## [0.1.1] — 2026-08-08

Highest supported wire version: `1.0`.

### Added

- Initial public contract: manifest, verify, usage, and extract schemas
  with shared Effect schemas on both sides.
