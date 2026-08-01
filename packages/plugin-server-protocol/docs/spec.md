# Lynvo Plugin Server Protocol v1

## Status

- Protocol owner: Lynvo
- Version: `1.0`
- Transport: `HTTPS + JSON`
- Recommended runtime: Cloudflare Workers
- Recommended framework: Hono
- Protocol scope: staged extraction by Plugin Servers
- Out of scope: Lynvo direct-link core flow

## Goal

Lynvo supports user-provided Custom Plugin Servers. A Plugin Server accepts a source URL or a previously emitted lazy node target, resolves it in stages, and returns normalized extraction data that Lynvo can render.

Lynvo owns:

- routing
- Plugin Server registration and verification
- Plugin Server credential storage
- response validation
- UI rendering
- playback behavior
- saved-item state

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
4. User clicks an lazy item node.
5. Lynvo calls the same Plugin Server again with only that clicked node target.
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

- Once a saved item is created, Lynvo must persist the originating Plugin Server entry id.
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

- watched state
- saved selection state
- mirror cache owned by Lynvo
- UI layout instructions
- button styling or placement

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

- `protocolVersion`: required string. Lynvo must enforce compatibility at add-time and refresh-time.
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

Under `extensions.lynvo.plugins`, each source may declare optional `description`, HTTPS `homepage`, and `credential` capability metadata. A credential has `kind` (`domain-password` or `http-basic`), `scope` (`domain`), and `required` (boolean). These optional fields are backward-compatible protocol extensions and never contain credential values.

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

1. matcher specificity
2. Custom Plugin Server priority
3. stable deterministic tie-break

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
- Lynvo removes URL userinfo before forwarding a target and sends `basicAuth` only when the Plugin Server declares `features.basicAuth`.
- The Plugin Server bearer token authenticates Lynvo to the Plugin Server; `basicAuth` authenticates the Plugin Server to the source. They are separate credentials.
- Lynvo should not send the original top-level source URL on lazy follow-up requests.

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

- core schema is strict
- optional custom data must live under `extensions`
- unknown non-extension fields should be rejected

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
- Lynvo-owned playback state

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
- Plugin Server-managed playback state
- framework-specific protocol behavior
- WebSocket or SSE transport between Lynvo and the Plugin Server
