# Architecture

Lynvo is a React Router web app backed by a Cloudflare Worker. The Worker owns
authentication, saved-link state, extraction orchestration, and the API
boundary. A service binding connects it to the Lynvo-managed Plugin Server.

```text
┌─────────────────────────────────────────────────────┐
│ Browser                                             │
│ React Router UI, Saved links, settings, Remote Play │
│ In-app MDX documentation                            │
└──────────────────────┬──────────────────────────────┘
                       │ same-origin HTTPS and WebSocket
┌──────────────────────▼──────────────────────────────┐
│ apps/lynvo                                          │
│ React Router server + Hono Worker entry             │
│ Effect API services and extraction orchestration    │
└───────────────┬───────────────────┬─────────────────┘
                │                   │
                │ D1 + Durable      │ service binding
                │ Objects           │
┌───────────────▼───────┐   ┌───────▼─────────────────┐
│ Lynvo application data │  │ apps/lynvo-plugin-server│
│ users, sessions, links │  │ protocol runtime +      │
│ settings, usage        │  │ source-specific Plugins │
└────────────────────────┘  └─────────────────────────┘
```

## Application boundary

`apps/lynvo/workers/app.ts` is the Cloudflare entry point. It applies security
headers and request logging, serves the React Router build, mounts API routes,
accepts `/api/realtime` WebSocket connections, and runs scheduled maintenance.
The typed Effect API is grouped under
`apps/lynvo/app/lib/effect/api/`; D1-specific routes and transactions live in
`apps/lynvo/workers/d1/`.

The browser calls Lynvo's same-origin API. It does not call the Plugin Server
directly and never receives the Plugin Server's bearer credential.

## Saved-link synchronization

Saved-link writes use one path:

1. The browser creates an `operationId` and sends a mutation to the Worker API.
2. The Worker authenticates the session, validates the request, and applies the
   owned-data mutation with its idempotency record in D1.
3. The same D1 transaction increments the account's `data_version` when data
   changed.
4. The response returns the mutation result and current data version. A links
   read returns the server snapshot and the same version in the response
   header.
5. The user's realtime Durable Object sends a `data-changed` hint. Clients
   compare versions and fetch a fresh snapshot when needed. The
   `X-Lynvo-Data-Version` response header mirrors the body or snapshot value.

The snapshot from the server is the persisted client state for Saved links.
Entities use server-assigned IDs. URLs are values inside an entity, not entity
identity. A lost WebSocket frame may delay a refresh, but it cannot make a
newer server version look older.

The main implementation points are
[`use-links`](../../apps/lynvo/app/features/links/use-links/),
[`data-routes.ts`](../../apps/lynvo/workers/d1/data-routes.ts),
[`links.ts`](../../apps/lynvo/workers/d1/links.ts),
[`data-version.ts`](../../apps/lynvo/workers/d1/data-version.ts), and
[`storage-ledger.ts`](../../apps/lynvo/workers/d1/storage-ledger.ts).

## Authentication and secrets

Google OAuth creates or finds a D1 user. Lynvo stores an opaque session ID in
the `lynvo_session` HttpOnly cookie and resolves it to a D1 session row on the
server. Browser storage is not a credential store.

Plugin credentials are encrypted before persistence and resolved only by the
server. The credential vault Durable Object protects the encryption key
boundary. The Plugin Server binding connects Lynvo to the managed Worker
without exposing its API key to the browser.

## Extraction

The application selects a Plugin Server from its manifest and sends an
authenticated extraction request through the service binding or a configured
Custom Plugin Server adapter. The Plugin Server returns normalized Media Nodes
through the versioned contract in
[`packages/plugin-server-protocol/docs/spec.md`](../../packages/plugin-server-protocol/docs/spec.md).

Saved-link extraction can be queued. The queue claims work with a lease,
records attempts, and settles the Saved link through idempotent operations. A
Plugin Server owns Source-specific interpretation and staged resolution.
Lynvo owns routing, validation, saved-link state, selection, opened markers,
and player handoff.

The queue and runner are in
[`link-extraction-queue.ts`](../../apps/lynvo/workers/d1/link-extraction-queue.ts)
and [`link-extraction-runner.ts`](../../apps/lynvo/workers/link-extraction-runner.ts).

Product quotas and storage limits are defined in
[`workers/constants.ts`](../../apps/lynvo/workers/constants.ts) and surfaced
through the settings and pricing UI. Update those sources together when a
limit changes; do not copy a stale number into maintainer docs.

## Realtime and Remote Play

`USER_REALTIME_ROOM` is a Durable Object named for each user. Lynvo uses it to
deliver data-change hints, session revocation, and Remote Play messages between
the user's connected browser sessions. The destination browser opens the URL
in its selected external Android player. Lynvo never streams the media.

The WebSocket route and Durable Object are in
[`workers/app.ts`](../../apps/lynvo/workers/app.ts); the browser connection is
in [`context/realtime`](../../apps/lynvo/app/context/realtime/).

## Cloudflare resources

`apps/lynvo/wrangler.jsonc` defines the application resources:

- D1 for users, sessions, Saved links, settings, usage, and idempotency data
- Durable Objects for authentication rate limits, the Plugin Credential Vault,
  and per-user realtime rooms
- a service binding to `lynvo-plugin-server`
- scheduled cleanup, retention, manifest refresh, and extraction work

The managed Plugin Server has its own Worker configuration and usage-limiter
Durable Object. Keep its boundary separate from the application Worker.

## Code map

- `apps/lynvo/app/`: React Router UI, feature modules, typed API client, and
  public in-app docs.
- `apps/lynvo/workers/`: Worker entry point, D1 modules, Durable Objects, and
  scheduled or queued work.
- `apps/lynvo-plugin-server/src/`: protocol routes, authentication, usage
  limits, and Source adapters.
- `packages/plugin-server-protocol/`: public schemas, runtime helpers, and
  protocol docs.
- `packages/create-lynvo-plugin-server/`: standalone generator and template.

When the code disagrees with this overview, verify the code first and update
this document in the same change.
