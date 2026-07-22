# External Extractor Compatibility Checklist

Use this before registering an external extractor worker in Lynvo.

## Ownership Boundary

- Lynvo defines the protocol and renders worker-provided metadata.
- The external extractor owns its plugin logic, deployment, icons, status, and versions.
- Do not add source-specific code to Lynvo for Resolver Beta, File Source Delta, or similar services.

## Required Endpoints

- `GET /manifest` returns the extractor manifest.
- `POST /verify` validates the bearer token Lynvo will use.
- `GET /usage` returns authenticated finite usage metrics for the bearer credential.
- `POST /extract` returns protocol nodes for a source URL or lazy node.

## Manifest Rules

- `protocolVersion` is `1.0`.
- `extractorId` is stable and namespaced, for example `com.example.extractor`.
- `displayName` is human readable.
- `auth.type` is `bearer`.
- `matchers` declare the URLs the worker can handle.
- `features.password`, `features.lazyNodes`, and `features.basicAuth` describe supported behavior.
- `usage.endpoint` is `/usage`.
- Workers declaring `features.basicAuth` receive source credentials in `request.basicAuth`, never in the target URL.

## Source / Plugin Metadata

Declare each user-visible plugin under `extensions.lynvo.sources`.

Each source should include:

- Stable `id`.
- Human readable `displayName`.
- Direct HTTPS WebP `iconUrl`.
- `status`: `active`, `maintenance`, `degraded`, or `down`.
- `version`, updated when source behavior changes.
- `hosts` or `matchers`, so Lynvo can match URLs to the correct source.

## Icon Rules

- Use direct WebP URLs, not favicon proxy URLs.
- Serve icons from the extractor worker or its own CDN.
- Keep icons small; the shared optimizer resizes WebP icons to fit within 256x256.
- Run image optimization as part of deploy, not as a one-off manual step.

## Contract Tests

External extractors should validate:

- Manifest schema.
- Source/plugin metadata.
- Direct WebP icon URLs.
- Duplicate source ids.
- Extract response schema.
- Usage response schema and duplicate metric ids.

The shared local helpers are:

- `validateExtractorManifestContract(value)`
- `validateExtractSuccessContract(value)`

See [`examples/extractor-worker/tests/contract.test.ts`](../../../examples/extractor-worker/tests/contract.test.ts)
for the workspace contract-test example.
