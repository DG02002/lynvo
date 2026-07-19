# Lynvo Extractor Worker Author Guide

## Goal

This guide explains how to build a Lynvo-compatible external extractor worker.

The recommended stack is:

- Cloudflare Workers
- Hono
- the local `@lynvo/extractor-protocol` contract package

The protocol itself is framework-agnostic. Hono is the recommended reference stack because it gives a clean routing model for `GET /manifest`, `POST /verify`, `GET /usage`, and `POST /extract`. Lynvo owns the protocol contract through the local `@lynvo/extractor-protocol` package; extractor workers should use that package or mirror its documented contract instead of copying schemas from Lynvo or another worker.

Start with:

- `compatibility-checklist.md` for the compatibility rules Lynvo expects.
- `templates/cloudflare-worker-basic/` for a standalone external Worker example.

## Recommended Project Setup

Cloudflare currently documents a Hono full-stack starter based on the `create cloudflare` CLI and a Vite React template. That is useful when you want a full-stack app, but Lynvo extractor workers do not need a React frontend by default.

For extractor workers, prefer a minimal Worker-first Hono project rather than scaffolding a UI you do not need.

Use the Cloudflare docs as the authoritative source for current Hono scaffolding options:

- Hono on Cloudflare Workers:
  [Cloudflare Hono docs](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/)
- Workers best practices:
  [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- Node.js compatibility:
  [Cloudflare Node.js compatibility docs](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)

## Design Constraints

Your worker should be:

- stateless from Lynvo’s perspective
- JSON-only at the Lynvo seam
- server-to-server authenticated with a bearer API key
- able to resolve staged extraction flows
- responsible for all source-specific interpretation

Lynvo will send:

- an API key in the `Authorization` header
- a source URL or lazy node target
- an optional content password

Lynvo will not send:

- browser cookies
- UI instructions
- playback state
- worker-specific mode names

## Suggested File Shape

```text
src/
  index.ts
  auth.ts
  extractors/
    source-alpha.ts
    resolver-beta.ts
    source-epsilon.ts
```

Recommended module responsibilities:

- `index.ts`: Hono app and route wiring
- `auth.ts`: bearer key validation
- `extractors/*`: source-specific extraction logic

Do not define a local protocol schema unless you are writing an adapter around `@lynvo/extractor-protocol`. Local copies drift and make the worker harder to trust.

## Protocol Package

In this repository, use the local protocol package:

```sh
pnpm add @lynvo/extractor-protocol@file:../lynvo/packages/extractor-protocol
```

Use it for:

- validating `POST /extract` bodies with `extractRequestSchema`
- building structured errors with `createProtocolError`
- serving protocol routes with `createExtractorRuntime`
- declaring manifest data with the exported interfaces
- testing routing with `matchExtractorUrl`
- returning nodes with the exported `ExtractorNode` shapes

This keeps the extractor worker’s public interface small and stable. This does not require publishing to npm. Your worker can have as much source-specific implementation as it needs behind that interface, but Lynvo should only see the protocol.

## Suggested Runtime Configuration

### Compatibility Date

Keep the Worker on a current compatibility date and update it intentionally.

### Node.js Compatibility

Enable `nodejs_compat` only when you actually need npm packages or Node APIs that require it.

Cloudflare currently documents that:

- `nodejs_compat` requires a compatibility date of `2024-09-23` or later
- it enables built-in Node APIs plus Wrangler polyfills

Do not enable it by reflex. Many extractors can stay on pure web-standard APIs:

- `fetch`
- `URL`
- `Headers`
- `Request`
- `Response`
- `WebSocket`
- Web Crypto

That usually leads to smaller and simpler workers.

## Secrets and Configuration

Follow Cloudflare best practices:

- store secrets with `wrangler secret`
- do not commit secrets into source
- prefer runtime bindings over hard-coded values

Suggested secrets and variables:

- `LYNVO_API_KEYS` or similar server-side auth material
- upstream helper endpoints if your worker needs them
- optional feature flags for experimental extractor behavior

## Hono Structure

Recommended route layout:

- `GET /manifest`
- `POST /verify`
- `GET /usage`
- `POST /extract`

Keep the Hono layer thin. The extraction logic should sit behind small route handlers.

## Authentication

Use `Authorization: Bearer <apiKey>`.

Recommended behavior:

- reject missing auth on `POST /verify`, `GET /usage`, and `POST /extract`
- validate the bearer token before doing expensive extraction work
- report finite credential-scoped usage and enforce it before extraction work
- return structured protocol errors

Do not:

- accept API keys in query strings
- rely on browser cookies
- expose worker API keys to clients

## Manifest Guidance

The manifest is public. Keep it simple and stable.

Recommended contents:

- protocol version
- extractor id
- display metadata
- HTTPS icon URL
- auth type
- local matchers
- feature flags

The manifest is not the place for:

- private credentials
- dynamic per-user state
- source-specific extraction examples that can go stale quickly

### Icons

External extractors should provide an `iconUrl` when they have a stable HTTPS icon. Lynvo displays that icon in the external extractor settings table and may reuse it anywhere extractor identity is shown.

Recommended:

- serve a small square WebP icon
- use an HTTPS URL
- keep the image stable after users register the worker
- omit `iconUrl` in local HTTP development if you do not have an HTTPS asset URL

If the icon is served by the worker itself, expose it as a static asset such as `/icons/plugins/example.webp` and set `iconUrl` to the deployed HTTPS origin plus that path.

### Source Plugin Icons

If one worker supports multiple source plugins, publish those source identities under `extensions.lynvo.sources`.

Example:

```json
{
  "extensions": {
    "lynvo": {
      "sources": [
        {
          "id": "resolver-beta",
          "displayName": "Resolver Beta",
          "description": "Resolves playable media from Resolver Beta deployments.",
          "homepage": "https://resolver-beta.example",
          "iconUrl": "https://example.com/icons/resolver-beta.webp",
          "status": "active",
          "version": "1.2.3",
          "hosts": ["resolver-beta.example"],
          "matchers": [
            {
              "hosts": ["resolver-beta.example"],
              "hostPatterns": ["*resolver-beta*"],
              "pathPatterns": ["/**"]
            }
          ],
          "credential": {
            "kind": "domain-password",
            "scope": "domain",
            "required": false
          }
        }
      ]
    }
  }
}
```

Lynvo displays these source icons in the external extractor settings table. This is distinct from the top-level worker `iconUrl`.

`status` is optional and may be `active`, `maintenance`, `degraded`, or `down`. `version` is optional and should describe the worker's source-specific adapter version, not the upstream site's version.

`routesToSourceId` is optional. Set it to another source id from the same manifest when this source resolves into that downstream source. Lynvo can then show the source route before extraction starts.

`matchers` is optional but recommended. Lynvo uses it to show which source plugin is likely to handle a URL before extraction starts.

`description`, `homepage`, and `credential` are optional source capability metadata. A credential `kind` is either `domain-password` or `http-basic`, its `scope` is `domain`, and `required` states whether every extraction needs it. These fields describe configuration requirements and must not contain credentials or UI layout instructions.

Lynvo v1 does not define a live health endpoint. Source status is read from the manifest and refreshed when the user refreshes the worker manifest in settings. This keeps the protocol predictable and avoids polling every external worker.

## Extract Handler Guidance

`POST /extract` handles both:

- top-level source URLs
- lazy follow-up node targets

Your handler should:

1. validate the request body
2. authenticate the API key
3. dispatch based on `input.kind`
4. resolve the current target
5. return normalized nodes

Recommended behavior:

- if input is `source`, begin initial extraction
- if input is `node`, resolve the current target only
- if the target requires a password, return `PASSWORD_REQUIRED`
- if a password is provided and invalid, return `INVALID_PASSWORD`

## Stage-Based Extraction

Lynvo expects staged extraction.

Example:

1. `source-alpha` page returns season and episode nodes.
2. Episode node carries a lazy `nodeUrl`.
3. Lynvo calls `POST /extract` again with that `nodeUrl`.
4. The worker resolves the next step.
5. If the next step is final, return playable nodes.
6. If the next step is still intermediate, return more resolvable nodes.

This means:

- your worker owns the entire source-specific chain
- Lynvo does not chain between different workers
- any lazy node you emit must be resolvable by the same worker

## Normalization Rules

Return only Lynvo-normalized nodes:

- `group`
- `resolvable`
- `playable`

Do not return custom UI instructions.

Do not return raw implementation details unless you place them under `extensions`.

## UI Metadata

You may return minimal source metadata:

- `displayName`
- `iconUrl`
- `sourceId`
- `sourceName`
- `sourceIconUrl`
- `pageTitle`
- `audio`

This is presentation data only.

Do not assume:

- it controls layout
- it controls button styles
- it overrides Lynvo UX rules

## Error Handling

Return structured errors with standard codes.

Recommended approach:

- use protocol codes as the machine contract
- keep `message` human-readable
- include provider-specific diagnostics only as secondary detail

Use `TEMPORARY_FAILURE` when retrying later might succeed.

Use `PERMANENT_FAILURE` when the source is broken in a non-retryable way.

Use `UNSUPPORTED_URL` only when the URL is outside the worker’s supported scope.

## Performance Guidance

External workers may run on Cloudflare free plans. Design with that in mind.

Prefer:

- low CPU parsing
- bounded redirect depth
- minimal upstream requests
- deduplication of repeated mirror probes
- avoiding large client bundles or unnecessary dependencies

Do not hard-code operational timing assumptions from Lynvo into the worker.

## Security Guidance

Treat worker display metadata as untrusted input on the Lynvo side, and design responsibly on the worker side too.

Recommended:

- use HTTPS-only `iconUrl`
- keep icons optional
- do not return HTML snippets
- do not embed scripts or markup inside response fields

## Testing Guidance

At minimum, test:

- manifest schema
- verify success and auth failure
- source extraction success
- lazy node follow-up success
- password-required flow
- invalid password flow
- malformed request handling

If you use Cloudflare-native testing, prefer running tests in the Workers runtime rather than only in a generic Node environment.

## Suggested Hono Skeleton

```ts
import { Hono } from "hono"
import { createExtractorRuntime } from "@lynvo/extractor-protocol"

const app = new Hono()

const sources = [
  {
    id: "example-source",
    displayName: "Example Source",
    iconUrl: "https://example.com/icons/source.webp",
    status: "active",
    version: "1.0.0",
    hosts: ["example.com"],
    matchers: [{ hosts: ["example.com"], pathPatterns: ["/**"] }],
  },
]

const runtime = createExtractorRuntime({
  manifest: ({ request }) => {
    const url = new URL(request.url)
    const iconUrl =
      url.protocol === "https:"
        ? `${url.origin}/icons/plugins/source.webp`
        : undefined

    return {
      protocolVersion: "1.0",
      extractorId: "com.example.lynvo.extractor",
      displayName: "Example Extractor",
      ...(iconUrl ? { iconUrl } : {}),
      auth: { type: "bearer" },
      matchers: [{ hosts: ["example.com"], pathPatterns: ["/**"] }],
      features: { password: true, lazyNodes: true, basicAuth: true },
      extensions: {
        lynvo: { sources },
      },
    }
  },
  auth: {
    validate: ({ request }) =>
      request.headers.get("Authorization") === "Bearer expected-key",
  },
  extract: async ({ request, targetUrl }) => {
    if (request.input.kind === "source") {
      return {
        source: {
          extractorId: "com.example.lynvo.extractor",
          displayName: "Example Extractor",
          sourceId: "example-source",
          sourceName: "Example Source",
          sourceIconUrl: "https://example.com/icons/source.webp",
        },
        nodes: [
          {
            kind: "resolvable",
            id: "example-node",
            label: "Resolve example",
            nodeUrl: targetUrl,
          },
        ],
        extensions: {},
      }
    }

    return {
      source: {
        extractorId: "com.example.lynvo.extractor",
        displayName: "Example Extractor",
        sourceId: "example-source",
        sourceName: "Example Source",
        sourceIconUrl: "https://example.com/icons/source.webp",
      },
      nodes: [
        {
          kind: "playable",
          id: "example-playable",
          label: "Play example",
          url: targetUrl,
        },
      ],
      extensions: {},
    }
  },
})

app.get("/manifest", (c) => runtime.handleManifest(c.req.raw, c.env))
app.post("/verify", (c) => runtime.handleVerify(c.req.raw, c.env))
app.post("/extract", (c) => runtime.handleExtract(c.req.raw, c.env))

export default app
```

## Final Advice

Keep the worker deep and the interface narrow.

That means:

- one public manifest
- one auth check
- one extract seam
- staged resolution entirely inside the worker
- normalized output only

If your worker requires Lynvo-specific branching outside this contract, the design is drifting in the wrong direction.
