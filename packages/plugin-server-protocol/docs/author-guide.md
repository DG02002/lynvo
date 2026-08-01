# Lynvo Plugin Server Author Guide

## Goal

This guide explains how to build a Lynvo-compatible Custom Plugin Server.

The recommended stack is:

- Cloudflare Workers
- Hono
- the published `@lynvo/plugin-server-protocol` contract package

The protocol itself is framework-agnostic. Hono is the recommended reference stack because it gives a clean routing model for `GET /manifest`, `POST /verify`, `GET /usage`, and `POST /extract`. Lynvo owns the protocol contract through the local `@lynvo/plugin-server-protocol` package; Plugin Servers should use that package or mirror its documented contract instead of copying schemas from Lynvo or another Plugin Server.

Start with the generator when creating a standalone Worker:

```sh
pnpm create lynvo-plugin-server@latest my-plugin-server
```

The generator creates the Worker, Hono route wiring, contract tests, and
Wrangler configuration. It installs the published protocol package rather
than requiring a Lynvo checkout.

Then read:

- `compatibility-checklist.md` for the compatibility rules Lynvo expects.
- `examples/plugin-server/` for the workspace example.

## Recommended Project Setup

Cloudflare currently documents a Hono full-stack starter based on the `create cloudflare` CLI and a Vite React template. That is useful when you want a full-stack app, but Lynvo Plugin Servers do not need a React frontend by default.

For Plugin Servers, prefer a minimal Worker-first Hono project rather than scaffolding a UI you do not need.

Use the Cloudflare docs as the authoritative source for current Hono scaffolding options:

- Hono on Cloudflare Plugin Servers:
  [Cloudflare Hono docs](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/)
- Workers best practices:
  [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- Node.js compatibility:
  [Cloudflare Node.js compatibility docs](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)

## Design Constraints

Your Plugin Server should be:

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
- Plugin-specific mode names

## Suggested File Shape

```text
src/
  index.ts
  auth.ts
  plugins/
    source-alpha.ts
    resolver-beta.ts
    source-epsilon.ts
```

Recommended module responsibilities:

- `index.ts`: Hono app and route wiring
- `auth.ts`: bearer key validation
- `plugins/*`: Source-specific extraction logic

Do not define a local protocol schema unless you are writing an adapter around `@lynvo/plugin-server-protocol`. Local copies drift and make the Plugin Server harder to trust.

## Protocol Package

Choose the dependency source based on where the Plugin Server lives:

Inside this monorepo, declare `"@lynvo/plugin-server-protocol": "workspace:*"`.
For a standalone repository, install a published version or package tarball:

```sh
pnpm add @lynvo/plugin-server-protocol
```

Do not use a `workspace:`, `link:`, or relative Lynvo path outside the
monorepo. The package's public entry point resolves to built `dist` files.

Use it for:

- validating `POST /extract` bodies with `extractRequestSchema`
- building structured errors with `createProtocolError`
- serving protocol routes with `createPluginServerRuntime`
- declaring manifest data with the exported interfaces
- testing routing with `matchPluginServerUrl`
- returning nodes with the exported `MediaNode` shapes

This keeps the Plugin Server’s public interface small and stable. Your Plugin
Server can have as much Source-specific implementation as it needs behind that
interface, but Lynvo should only see the protocol.

## Suggested Runtime Configuration

### Compatibility Date

Keep the Worker on a current compatibility date and update it intentionally.

### Node.js Compatibility

Enable `nodejs_compat` only when you actually need npm packages or Node APIs that require it.

Cloudflare currently documents that:

- `nodejs_compat` requires a compatibility date of `2024-09-23` or later
- it enables built-in Node APIs plus Wrangler polyfills

Do not enable it by reflex. Many Plugin Servers can stay on pure web-standard APIs:

- `fetch`
- `URL`
- `Headers`
- `Request`
- `Response`
- `WebSocket`
- Web Crypto

That usually leads to smaller and simpler Plugin Servers.

## Secrets and Configuration

Follow Cloudflare best practices:

- store secrets with `wrangler secret`
- do not commit secrets into source
- prefer runtime bindings over hard-coded values

Suggested secrets and variables:

- `LYNVO_API_KEYS` or similar server-side auth material
- upstream helper endpoints if your Plugin Server needs them
- optional feature flags for experimental Plugin behavior

## Hono Structure

Recommended route layout:

- `GET /manifest`
- `POST /verify`
- `GET /usage`
- `POST /discover` when `features.discovery` is true
- `POST /extract`

Keep the Hono layer thin. The extraction logic should sit behind small route handlers.

## Authentication

Use `Authorization: Bearer <apiKey>`.

Recommended behavior:

- reject missing auth on `POST /verify`, `GET /usage`, `POST /discover`, and
  `POST /extract`
- validate the bearer token before doing expensive extraction work
- report finite credential-scoped usage and enforce it before extraction work
- return structured protocol errors

Do not:

- accept API keys in query strings
- rely on browser cookies
- expose Plugin Server API keys to clients

## Manifest Guidance

The manifest is public. Keep it simple and stable.

Recommended contents:

- protocol version
- Plugin Server id
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

Custom Plugin Servers should publish `hasIcon` explicitly. Set it to `true` and provide `iconUrl` when a stable HTTPS icon exists. Set it to `false` and omit `iconUrl` when Lynvo should render its Plugin Server fallback.

Recommended:

- serve a small square WebP icon
- use an HTTPS URL
- keep the image stable after users register the Plugin Server
- set `hasIcon` to `false` and omit `iconUrl` when no public asset URL exists

If the icon is served by the Plugin Server itself, expose it as a static asset such as `/icons/sources/example.webp` and set `iconUrl` to the deployed HTTPS origin plus that path.

### Plugin Icons

If one Plugin Server supports multiple Plugins, publish those identities under `extensions.lynvo.plugins`.

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
          "hasIcon": true,
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

Lynvo displays these Plugin icons in the Custom Plugin Server settings table. Set Plugin `hasIcon` to `false` and omit `iconUrl` to request Lynvo's Plugin fallback. This is distinct from the top-level Plugin Server icon.

`status` is optional and may be `active`, `maintenance`, `degraded`, or `down`. `version` is optional and should describe the Plugin Server's source-specific adapter version, not the upstream site's version.

`routesToPluginId` is optional. Set it to another source id from the same manifest when this source resolves into that downstream source. Lynvo can then show the source route before extraction starts.

`matchers` is optional but recommended. Lynvo uses it to show which Plugin is likely to handle a URL before extraction starts.

`description`, `homepage`, and `credential` are optional source capability metadata. A credential `kind` is either `domain-password` or `http-basic`, its `scope` is `domain`, and `required` states whether every extraction needs it. These fields describe configuration requirements and must not contain credentials or UI layout instructions.

Lynvo v1 does not define a live health endpoint. Source status is read from the manifest and refreshed when the user refreshes the Plugin Server Manifest in settings. This keeps the protocol predictable and avoids polling every Custom Plugin Server.

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

1. `source-alpha` page returns folder and lazy item nodes.
2. Lazy Item node carries a lazy `nodeUrl`.
3. Lynvo calls `POST /extract` again with that `nodeUrl`.
4. The Plugin Server resolves the next step.
5. If the next step is final, return playable nodes.
6. If the next step is still intermediate, return more resolvable nodes.

This means:

- your Plugin Server owns the entire source-specific chain
- Lynvo does not chain between different Plugin Servers
- any lazy node you emit must be resolvable by the same Plugin Server

## Normalization Rules

Return only Lynvo-normalized nodes:

- `group`
- `resolvable`
- `playable`

Do not return custom UI instructions.

Do not return raw implementation details unless you place them under `extensions`.

## Node Implementation Reference

The protocol has three wire-level node kinds. Product terms such as “direct
link,” “container,” “folder,” and “lazy folder” map onto those kinds as follows:

| Product item           | Protocol kind | Important fields                |
| ---------------------- | ------------- | ------------------------------- |
| Direct playable link   | `playable`    | `url`                           |
| Display-only container | `group`       | `selectable: false`, `children` |
| Selectable folder      | `group`       | `selectable: true`, `children`  |
| Lazy folder            | `resolvable`  | `nodeUrl` and/or `resourceId`   |

Import `MediaNode` so TypeScript checks copyable implementations against
the shared contract.

### Direct link item

Use `playable` only for a final URL Lynvo can send to a player. Do not use it
for an HTML page that still needs resolution.

```ts
import type { MediaNode } from "@lynvo/plugin-server-protocol"

const directLink = {
  kind: "playable",
  id: "playable-item-primary",
  label: "Playable Item — Variant Alpha",
  url: "https://media.example.com/playable-item.mp4",
  badge: "Variant Alpha",
  size: "1.4 GB",
  status: "up",
} satisfies MediaNode
```

### Container item

A container is a display-only grouping. Lynvo renders its children, but the
container itself is not a selectable extraction target.

```ts
const folderContainer = {
  kind: "group",
  id: "folder-1",
  label: "Folder 1",
  badge: "10 playable items",
  selectable: false,
  children: [directLink],
} satisfies MediaNode
```

### Folder item

A folder uses the same `group` wire shape but opts into folder-selection flows
with `selectable: true`. Its current children must be included in the response.

```ts
const selectableFolder = {
  kind: "group",
  id: "playable-items-folder",
  label: "Collections",
  selectable: true,
  children: [folderContainer],
} satisfies MediaNode
```

### Lazy folder item

Use `resolvable` when the folder is intentionally not expanded yet. `nodeUrl`
is a server-side follow-up target, while `resourceId` is an optional opaque
identifier your Plugin Server can use. The same Plugin Server must handle the later node
request.

```ts
const lazyFolder = {
  kind: "resolvable",
  id: "shows-folder",
  label: "Collections",
  badge: "Open folder",
  nodeUrl: "https://source.example.com/0:/Collections/",
  resourceId: "folder_shows_v1",
  resolutionKind: "folder",
} satisfies MediaNode
```

When the user opens that lazy folder, Lynvo sends another extraction request:

```json
{
  "input": {
    "kind": "node",
    "nodeUrl": "https://source.example.com/0:/Collections/",
    "resourceId": "folder_shows_v1"
  }
}
```

Return a normal success envelope whose `nodes` contain the resolved folder
contents. Never expose credentials in `nodeUrl`, `resourceId`, labels, or
metadata.

Set `resolutionKind` to `folder` when resolving the node returns folder
contents. Set it to `mirrors` when resolving returns alternative playable
routes. Omit it only for backward compatibility; Lynvo treats an omitted value
as `mirrors`.

## UI Metadata

You may return minimal source metadata:

- `displayName`
- `iconUrl`
- `pluginId`
- `pluginName`
- `pluginIconUrl`
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

Use `UNSUPPORTED_URL` only when the URL is outside the Plugin Server’s supported scope.

## Performance Guidance

Custom Plugin Servers may run on Cloudflare free plans. Design with that in mind.

Prefer:

- low CPU parsing
- bounded redirect depth
- minimal upstream requests
- deduplication of repeated mirror probes
- avoiding large client bundles or unnecessary dependencies

Do not hard-code operational timing assumptions from Lynvo into the Plugin Server.

## Security Guidance

Treat Plugin Server display metadata as untrusted input on the Lynvo side, and design responsibly on the Plugin Server side too.

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
import { createPluginServerRuntime } from "@lynvo/plugin-server-protocol"

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

const runtime = createPluginServerRuntime({
  manifest: ({ request }) => {
    const url = new URL(request.url)
    const iconUrl =
      url.protocol === "https:"
        ? `${url.origin}/icons/sources/source.webp`
        : undefined

    return {
      protocolVersion: "1.0",
      pluginServerId: "com.example.lynvo.plugin-server",
      displayName: "Example Plugin Server",
      ...(iconUrl ? { iconUrl } : {}),
      auth: { type: "bearer" },
      matchers: [{ hosts: ["example.com"], pathPatterns: ["/**"] }],
      features: { password: true, lazyNodes: true, basicAuth: true },
      extensions: {
        lynvo: { plugins: sources },
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
        plugin: {
          pluginServerId: "com.example.lynvo.plugin-server",
          displayName: "Example Plugin Server",
          pluginId: "example-source",
          pluginName: "Example Source",
          pluginIconUrl: "https://example.com/icons/source.webp",
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
      plugin: {
        pluginServerId: "com.example.lynvo.plugin-server",
        displayName: "Example Plugin Server",
        pluginId: "example-source",
        pluginName: "Example Source",
        pluginIconUrl: "https://example.com/icons/source.webp",
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

Keep the Plugin Server deep and the interface narrow.

That means:

- one public manifest
- one auth check
- one extract seam
- staged resolution entirely inside the Plugin Server
- normalized output only

If your Plugin Server requires Lynvo-specific branching outside this contract, the design is drifting in the wrong direction.
