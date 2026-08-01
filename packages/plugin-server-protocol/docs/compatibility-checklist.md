# Custom Plugin Server Compatibility Checklist

Use this before registering an Custom Plugin Server in Lynvo.

## Ownership Boundary

- Lynvo defines the protocol and renders Plugin Server-provided metadata.
- The Custom Plugin Server owns its plugin logic, deployment, icons, status, and versions.
- Do not add source-specific code to Lynvo for Resolver Beta, File Source Delta, or similar services.

## Required Endpoints

- `GET /manifest` returns the Plugin Server Manifest.
- `POST /verify` validates the bearer token Lynvo will use.
- `GET /usage` returns authenticated finite usage metrics for the bearer credential.
- `POST /extract` returns protocol nodes for a source URL or lazy node.
- Plugin Servers advertising `features.discovery` implement authenticated
  `POST /discover` and return a stable source id with pattern or verified
  confidence.

## Manifest Rules

- `protocolVersion` is `1.0`.
- `pluginServerId` is stable and namespaced, for example `com.example.plugin-server`.
- `displayName` is human readable.
- `auth.type` is `bearer`.
- `matchers` declare the URLs the Plugin Server can handle.
- `features.password`, `features.lazyNodes`, and `features.basicAuth` describe supported behavior.
- `usage.endpoint` is `/usage`.
- Plugin Servers declaring `features.basicAuth` receive Source credentials in `request.basicAuth`, never in the target URL.

## Source / Plugin Metadata

Declare each user-visible plugin under `extensions.lynvo.plugins`.

Each source should include:

- Stable `id`.
- Human readable `displayName`.
- Direct HTTPS WebP `iconUrl`.
- `status`: `active`, `maintenance`, `degraded`, or `down`.
- `version`, updated when source behavior changes.
- `hosts` or `matchers`, so Lynvo can match URLs to the correct source.

## Icon Rules

- Use direct WebP URLs, not favicon proxy URLs.
- Serve icons from the Plugin Server or its own CDN.
- Keep icons small; the shared optimizer resizes WebP icons to fit within 256x256.
- Run image optimization as part of deploy, not as a one-off manual step.

## Contract Tests

Custom Plugin Servers should validate:

- Manifest schema.
- Plugin metadata.
- Direct WebP icon URLs.
- Duplicate source ids.
- Extract response schema.
- Usage response schema and duplicate metric ids.

The shared local helpers are:

- `validatePluginServerManifestContract(value)`
- `validateExtractSuccessContract(value)`
- `validateUsageContract(value)`
- `parsePluginServerManifestContract(value)`
- `parseExtractSuccessContract(value)`
- `parseUsageResponseContract(value)`

Use the typed `parse*Contract` helpers when accepting live protocol values;
successful results expose `.value` and rejected results expose detailed
`.issues`. Use the `validate*Contract` helpers for diagnostics and contract
tests. Structural schemas are reserved for narrow decoding or display-only
paths.

See [`examples/plugin-server/tests/contract.test.ts`](../../../examples/plugin-server/tests/contract.test.ts)
for the workspace contract-test example.
