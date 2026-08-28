# Lynvo Plugin Server Protocol v1

## Status

- Protocol owner: Lynvo
- Version: `1.0`
- Transport: `HTTPS + JSON`
- Recommended runtime: Cloudflare Workers
- Recommended framework: Hono
- Protocol scope: staged extraction by Plugin Servers
- Direct Media is a first-party Plugin hosted by the Lynvo Plugin Server.

## Goal

Lynvo supports user-provided Custom Plugin Servers. A Plugin Server accepts a source URL or a previously emitted lazy node target, resolves it in stages, and returns normalized extraction data that Lynvo can render.

Lynvo owns:

- routing
- Plugin Server registration and verification
- Plugin Server credential storage
- response validation
- UI rendering
- player selection and link launching
- saved-link state

Plugin Servers own:

- source-specific matching declarations
- source-specific extraction logic
- staged resolution logic
- password-gated extraction logic
- normalization into the Lynvo response shape
- finite per-credential usage limits, accounting, reset periods, and enforcement

## Core Model

Extraction is stage-based.

Example:

1. User submits a `source-alpha` URL.
2. Lynvo selects one matching Plugin Server.
3. The Plugin Server returns a tree with lazy nodes.
4. The user selects a lazy item node.
5. Lynvo calls the same Plugin Server again with only that selected node target.
6. The Plugin Server resolves it further and returns the next result, such as final `FLS` and `Source Route Beta` playable links.

## Protocol Rules

### Ownership

- Lynvo defines the protocol.
- Plugin Servers must adapt to the Lynvo contract.
- Lynvo must not add Plugin-specific protocol exceptions.

### Routing

- Lynvo routes locally using the cached Plugin Server Manifest.
- A Plugin Server Manifest must declare machine-readable matchers.
- Lynvo must not broadcast user URLs to all Plugin Servers for capability checks.

### Plugin Server Affinity

- Once a saved link is created, Lynvo must persist the originating Plugin
  Server entry id.
- Refresh and lazy follow-up must use that same Plugin Server first.
- If the original Plugin Server is unavailable, Lynvo should fail closed and only offer explicit user-triggered re-routing from the original top-level source URL.

### Lazy Resolution Invariant

- Any lazy node emitted by a Plugin Server must be resolvable by that same Plugin Server.
- Lynvo must not hand Plugin Server-emitted lazy node targets to another Plugin Server automatically.

### Data Ownership

Plugin Servers may return:

- normalized nodes
- minimal source metadata needed for UI
- structured errors

Plugin Servers must not return or control:

- opened markers
- playback positions or resume state
- selected links
- mirror cache owned by Lynvo
- UI layout instructions
- button styling or placement

### Playable Health Metadata

Playable nodes may report the result of a bounded media probe:

```json
{
  "kind": "playable",
  "label": "Example video",
  "url": "https://media.example/video",
  "status": "up",
  "rangeRequest": "supported",
  "expiry": 1798761600000,
  "expirySource": "signed-url"
}
```

`rangeRequest` reports whether the media endpoint honored `Range: bytes=0-0`:

- `supported`: the probe returned `206` with `Content-Range`.
- `unsupported`: the probe returned `200`, so the endpoint ignored the range.
- `unknown`: the response did not establish either behavior.

`status` is `up` only when the endpoint returned a usable non-HTML response;
`down` is used for failed statuses or HTML responses. Plugin Servers should
cancel the response body after reading the headers so a probe never downloads
the media file.

When expiry metadata is available, `expiry` is a Unix timestamp in
milliseconds. `expirySource` identifies the source, in this priority order:
`signed-url`, `cache-control`, or `expires-header`. Response-header-derived
expiry (`Expires` or `Cache-Control`) is an estimate and must not be treated
as a cryptographic guarantee.

Health metadata may be omitted when a final endpoint requires a
source-specific or credentialed proxy that the Plugin Server cannot reproduce
for a safe bounded probe.

### Security

- Plugin Server API keys are server-side only.
- Browsers must talk only to Lynvo.
- Lynvo must call Plugin Servers from server-side routes.
- Plugin Server display metadata is untrusted input.

## Endpoints

### `GET /manifest`

Purpose:

- declare protocol compatibility
- declare auth scheme
- declare routing matchers
- declare Plugin Server display metadata and features

Auth:

- none

### `POST /verify`

Purpose:

- verify API key
- verify Plugin Server reachability
- verify Plugin Server readiness against this protocol

Auth:

- `Authorization: Bearer <apiKey>`

### `POST /extract`

Purpose:

- initial extraction from a user-submitted URL
- lazy follow-up resolution from a previously emitted node target
- password retry when required

Auth:

- `Authorization: Bearer <apiKey>`

### `POST /discover`

Purpose:

- let an Plugin Server identify a source implementation without teaching Lynvo
  source-specific URL or HTML signatures
- return a stable `pluginId` and either `pattern` or `verified` confidence
- decline unsupported URLs with `{ "matched": false }`

This endpoint is optional and must be advertised with
`features.discovery: true`. Discovery must be bounded, safe against SSRF, and
must not persist credentials.

Auth:

- `Authorization: Bearer <apiKey>`

### `GET /usage`

Purpose:

- report every finite usage metric attached to the bearer credential
- expose daily Plugin Server operation and monthly provider/source capacity independently
- allow Lynvo to render authoritative usage without owning third-party accounting

Auth:

- `Authorization: Bearer <apiKey>`

## Manifest Schema

```json
{
  "protocolVersion": "1.0",
  "pluginServerId": "com.example.lynvo.source-alpha",
  "displayName": "Example source-alpha Plugin Server",
  "hasIcon": true,
  "iconUrl": "https://example.com/icon.webp",
  "homepage": "https://example.com",
  "auth": {
    "type": "bearer"
  },
  "usage": {
    "endpoint": "/usage"
  },
  "matchers": [
    {
      "hosts": ["source-alpha.com", "www.source-alpha.com"],
      "pathPatterns": ["/**"]
    },
    {
      "hosts": ["redirector-zeta.example"],
      "pathPatterns": ["/**"]
    }
  ],
  "features": {
    "password": true,
    "lazyNodes": true,
    "basicAuth": true
  },
  "extensions": {}
}
```

### Manifest Field Rules

- `protocolVersion`: required string in `MAJOR.MINOR` form. A manifest is
  wire-compatible when its major version matches the protocol major Lynvo
  implements; minor versions are additive by contract, so Lynvo accepts any
  `1.x` manifest and must ignore fields it does not know. Lynvo enforces
  compatibility at add-time and refresh-time and sends its own version on
  every request via the `X-Lynvo-Protocol-Version` header so servers can
  adapt responses. A major-version mismatch is reported as
  `PROTOCOL_MISMATCH`.
- `pluginServerId`: required stable identifier. Do not use `displayName` as the stable id.
- `displayName`: required human-readable name.
- `hasIcon`: optional boolean. When present, `true` requires `iconUrl`; `false` forbids it.
- `iconUrl`: optional HTTPS URL only. Existing manifests may omit `hasIcon`; Lynvo infers it from this field.
- `homepage`: optional HTTPS URL.
- `auth.type`: required. v1 supports only `bearer`.
- `usage.endpoint`: required and must be `/usage`.
- `matchers`: required non-empty array.
- `features.password`: whether the Plugin Server may return `PASSWORD_REQUIRED`.
- `features.lazyNodes`: whether the Plugin Server may return lazy resolvable nodes.
- `features.basicAuth`: whether Lynvo may forward structured HTTP Basic Auth credentials to this Plugin Server.
- `extensions`: optional vendor namespace for non-core data.

Under `extensions.lynvo.plugins`, each Plugin may declare `matchStrategy` as
`static` or `probe`. The default is `static`, which requires `hosts` or
`matchers`. A `probe` Plugin declares neither because it performs a bounded
capability check only after explicit selection, configured domains, and static
matches have been considered. Probe matching is a generic fallback mechanism;
it must not be represented by a wildcard matcher. Plugins may also declare
optional `description`, HTTPS `homepage`, and `credential` capability metadata.
A credential has `kind` (`domain-password` or `http-basic`), `scope` (`domain`),
and `required` (boolean). These optional fields never contain credential values.
Plugins may also declare an optional `usageMultiplier`: a positive integer that
states how many units of the Plugin Server's metered extraction limit a single
extraction through that Plugin can consume, so Lynvo can warn before use.
`proxyCreditUsage` may describe the Plugin's proxy-credit request pattern in
human-readable text. Use it when the total varies by redirects, mirrors, cache
state, or another runtime condition. Lynvo displays this text in the Plugin
info tooltip.
The Lynvo extension may also declare `proxyProvider: "scrape-do"` when the
Plugin Server accepts a user-supplied Scrape.do token per extract request and
uses it for that request's proxy calls; Lynvo only offers the proxy-key field
for servers that declare it.

## Usage Response

```json
{
  "metrics": [
    {
      "id": "plugin-server-operations",
      "label": "Plugin Server operations",
      "used": 7,
      "limit": 100,
      "unit": "operations",
      "period": "daily",
      "resetsAt": "2026-07-20T00:00:00.000Z"
    }
  ]
}
```

Every metric requires a unique id, a finite positive limit, non-negative usage,
a human-readable label and unit, a daily or monthly period, and an ISO reset
timestamp. Source-specific metrics include `pluginId`. Plugin Servers must enforce the
reported limits and return `RATE_LIMITED` from `/extract` when capacity is
exhausted.

### Matcher Rules

Lynvo should rank matches using:

1. saved Plugin affinity
2. explicitly requested Plugin
3. configured Plugin Domain
4. static matcher specificity
5. `matchStrategy: "probe"`
6. stable deterministic tie-break

Each matcher may contain:

- `hosts`: exact hosts
- `hostPatterns`: optional wildcard host patterns
- `pathPatterns`: optional path constraints
- `schemes`: optional, default `["https"]`

## Verify Request

```json
{}
```

v1 does not require any JSON fields in the verify body. The API key in the `Authorization` header is the primary input.

## Verify Success Response

```json
{
  "ok": true
}
```

## Verify Error Response

```json
{
  "ok": false,
  "error": {
    "code": "AUTH_INVALID",
    "message": "API key was rejected."
  }
}
```

## Extract Request Schema

### Source Extraction

```json
{
  "input": {
    "kind": "source",
    "sourceUrl": "https://example.com/source-page"
  }
}
```

### Lazy Node Follow-up

```json
{
  "input": {
    "kind": "node",
    "nodeUrl": "https://example.com/intermediate-step"
  }
}
```

### Password Retry

```json
{
  "input": {
    "kind": "node",
    "nodeUrl": "https://example.com/intermediate-step"
  },
  "password": "secret"
}
```

### Extract Request Rules

- `input.kind` is required.
- `input.kind = "source"` requires `sourceUrl`.
- `input.kind = "node"` requires `nodeUrl` or `resourceId`.
- `resourceId` is optional in v1.
- `password` is optional and attempt-scoped.
- `basicAuth` is optional and contains `username` and `password` for source-side HTTP Basic Auth.
- `proxy` is optional and contains `provider` (`"scrape-do"`) plus the user's own Scrape.do `token`. Lynvo sends it only when the Plugin Server's manifest declares `extensions.lynvo.proxyProvider: "scrape-do"` and the user saved a proxy key for that server. Plugin Servers must use it for that request's upstream proxy calls instead of their own shared proxy credentials, and must never log the token.
- Lynvo removes URL userinfo before forwarding a target and sends `basicAuth` only when the Plugin Server declares `features.basicAuth`.
- The Plugin Server bearer token authenticates Lynvo to the Plugin Server; `basicAuth` authenticates the Plugin Server to the source. They are separate credentials.
- Lynvo should not send the original top-level source URL on lazy follow-up requests.

## Deferred Extraction

Some sources complete work asynchronously (deferred downloads, poll-based
mirrors) and cannot finish inside one request. Instead of holding the
request open, a Plugin Server returns a success response with empty
`nodes` and a `pending` object:

```json
{
  "plugin": { "pluginServerId": "example", "displayName": "Example" },
  "nodes": [],
  "extensions": {},
  "pending": { "retryAfterSeconds": 30, "resumeNodeId": "task-42" }
}
```

- `pending.retryAfterSeconds`: positive seconds after which the client must
  re-issue the same extract request. Servers should keep it under 300.
- `pending.resumeNodeId`: optional opaque handle; the client echoes it back
  untouched as the node input's `resourceId` on the retry.
- A pending response is not an error and not an empty success; clients that
  cannot defer must map it to `TEMPORARY_FAILURE` with the given retry hint.
- Servers must eventually resolve a retry into nodes or an error; clients
  may cap the number of pending cycles and surface a failure past the cap.

### Usage Deltas

Extract success responses may carry `usageDelta`: an array of
`{ id, used, unit? }` entries reporting the units this specific extraction
consumed, with `id` matching the server's `/usage` metric ids. Clients can
use it to update displayed allowances without polling `/usage`; it is
advisory and never replaces the authoritative `/usage` response.

### Per-Node Extensions

Every Media Node accepts an optional `extensions` object with the same
rules as the response-level `extensions`: vendor-scoped, additive data that
clients must ignore when they do not understand it. New node-level facts
(sponsors, languages, subtitles) belong there rather than in new top-level
node fields.

## Extract Success Response Schema

```json
{
  "plugin": {
    "pluginServerId": "com.example.lynvo.source-alpha",
    "displayName": "Example source-alpha Plugin Server",
    "iconUrl": "https://example.com/icon.webp",
    "pageTitle": "Example Title",
    "audio": "Hindi + English"
  },
  "nodes": [
    {
      "kind": "group",
      "id": "folder-1",
      "label": "Folder 1",
      "badge": "S01",
      "selectable": false,
      "children": [
        {
          "kind": "group",
          "id": "folder-1-Variant Alpha",
          "label": "Variant Alpha",
          "badge": "8 EP",
          "selectable": true,
          "children": [
            {
              "kind": "resolvable",
              "id": "ep-1",
              "label": "Playable Item Alpha",
              "nodeUrl": "https://example.com/redirector-zeta-step",
              "size": "1.4 GB",
              "badge": "Variant Alpha"
            }
          ]
        }
      ]
    }
  ],
  "extensions": {}
}
```

### Playable Result Example

```json
{
  "plugin": {
    "pluginServerId": "com.example.lynvo.resolver-beta",
    "displayName": "Example Resolver Beta Plugin Server",
    "iconUrl": "https://example.com/icon.webp"
  },
  "nodes": [
    {
      "kind": "playable",
      "id": "route-alpha",
      "label": "Play from Source Route Alpha",
      "url": "https://example.com/route-alpha.m3u8",
      "status": "up"
    },
    {
      "kind": "playable",
      "id": "route-beta",
      "label": "Play from Source Route Beta",
      "url": "https://example.com/route-beta.m3u8",
      "status": "up"
    }
  ]
}
```

## Node Schema

### Shared Fields

- `id`: optional but recommended stable identifier
- `label`: required
- `badge`: optional
- `size`: optional human-readable size

### Group Node

```json
{
  "kind": "group",
  "id": "folder-1",
  "label": "Folder 1",
  "badge": "S01",
  "selectable": false,
  "children": []
}
```

Rules:

- `children` is required.
- `url` and `nodeUrl` are not used.
- `selectable` is allowed for folder selection flows.

### Resolvable Node

```json
{
  "kind": "resolvable",
  "id": "ep-1",
  "label": "Lazy Item 1",
  "nodeUrl": "https://example.com/intermediate-step",
  "resourceId": "opaque-id-optional",
  "resolutionKind": "folder",
  "badge": "Variant Alpha"
}
```

Rules:

- must contain `nodeUrl` or `resourceId`
- may represent an lazy item, redirector, container page, or any intermediate target
- must be resolvable by the same Plugin Server
- may set `resolutionKind` to `folder` for lazy folder contents or `mirrors`
  for alternative playable routes; omission remains backward-compatible and is
  interpreted as `mirrors` by Lynvo

### Playable Node

```json
{
  "kind": "playable",
  "id": "route-alpha",
  "label": "Play from Source Route Alpha",
  "url": "https://example.com/final-file-or-stream",
  "badge": "Source Route Alpha",
  "size": "1.4 GB",
  "expiry": 1767225600000,
  "status": "up"
}
```

Rules:

- `url` is required
- Lynvo renders these as final playable actions
- Plugin Server returns data only; Lynvo owns presentation

## Error Response Schema

```json
{
  "ok": false,
  "error": {
    "code": "PASSWORD_REQUIRED",
    "message": "This source requires a password.",
    "retryAfterSeconds": 60
  },
  "extensions": {}
}
```

## Standard Error Codes

- `UNSUPPORTED_URL`
- `AUTH_INVALID`
- `AUTH_REQUIRED`
- `RATE_LIMITED`
- `TEMPORARY_FAILURE`
- `PERMANENT_FAILURE`
- `PASSWORD_REQUIRED`
- `INVALID_PASSWORD`
- `NODE_EXPIRED`
- `PROTOCOL_MISMATCH`
- `BAD_REQUEST`

### Error Handling Rules

- Lynvo should map the error code to a user-friendly message.
- Lynvo may also show the Plugin Server error code and raw Plugin Server message as secondary debug detail.
- Plugin Server error strings must not be the primary UX contract.

## Validation Rules

Lynvo should validate:

- manifest responses on add and refresh
- verify responses
- extract responses on every call

Validation policy:

- core schema is strict about the fields it knows
- unknown non-extension fields are ignored by Lynvo (minor versions are
  additive, so newer servers may emit fields an older Lynvo has not seen yet)
- optional custom data must live under `extensions`
- Plugin Servers must not attach meaning to unknown fields they receive

### HTTP Status Mapping

Protocol error codes map to HTTP statuses on every endpoint. Lynvo prefers
the response body's `code` over the HTTP status when classifying failures.

| Code                 | HTTP |
| -------------------- | ---- |
| `BAD_REQUEST`        | 400  |
| `UNSUPPORTED_URL`    | 400  |
| `AUTH_INVALID`       | 401  |
| `AUTH_REQUIRED`      | 401  |
| `PASSWORD_REQUIRED`  | 401  |
| `INVALID_PASSWORD`   | 401  |
| `NODE_EXPIRED`       | 410  |
| `RATE_LIMITED`       | 429  |
| `TEMPORARY_FAILURE`  | 500  |
| `PERMANENT_FAILURE`  | 500  |
| `PROTOCOL_MISMATCH`  | 500  |

A `RATE_LIMITED` response should include `error.retryAfterSeconds` and a
`Retry-After` header so clients can back off to the reset boundary. Extract
implementations signal these failures by throwing the packaged
`ProtocolError`, which the runtime maps to this table.

## Registration Flow

1. User enters Plugin Server base URL and API key.
2. Lynvo fetches `GET /manifest`.
3. Lynvo validates the manifest and checks `protocolVersion`.
4. Lynvo calls `POST /verify` with `Authorization: Bearer <apiKey>`.
5. Lynvo saves the Plugin Server only if both steps succeed.

## Refresh Flow

- Lynvo should support manual refresh from settings.
- Lynvo should also refresh manifests automatically in the background.
- If a refreshed manifest remains protocol-compatible, Lynvo should apply it automatically and record the change.
- If the refreshed manifest is protocol-incompatible, Lynvo should disable or mark the Plugin Server unsupported.

## Storage Model Inside Lynvo

For each Custom Plugin Server entry, Lynvo should persist:

- base URL
- API key
- raw manifest snapshot
- normalized routing projection
- enabled state
- priority
- verification state
- timestamps for last verification and last manifest refresh

For each saved extracted item, Lynvo should persist:

- original source URL
- originating Plugin Server entry id
- normalized extraction data
- Lynvo-owned opened markers and selected links. An opened marker
  records that an item was opened; Lynvo does not persist playback positions
  or resume state.

## Operational Guidance

The protocol intentionally does not define fixed timeout numbers.

Cloudflare Workers constraints and pricing plans change over time. Plugin Server authors should design for:

- low CPU usage
- limited subrequests
- free-plan constraints when relevant

Lynvo deployments may still enforce their own operational request budgets.

## Non-Goals

- browser-to-Plugin Server direct calls
- UI instructions from Plugin Servers
- Playback positions or resume state
- framework-specific protocol behavior
- WebSocket or SSE transport between Lynvo and the Plugin Server
