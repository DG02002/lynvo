# Lynvo

Lynvo is a link library for saving supported source URLs, extracting playable
links, and opening them in external Android players. It began with a simple
Android TV problem: move a link from a phone or browser to a TV without typing
a long URL with a remote.

Keep the product simple, predictable, and useful as it grows.

## What makes Lynvo special?

We now have 100 users. It is important to maintain the things that make Lynvo
useful as we iterate. Here is what we cannot compromise on.

Lynvo is not another Stremio-style catalogue. It starts with links people
choose and helps them get those links to the player they already use.

### 1. A link library, not a media catalogue

Lynvo does not provide a catalogue, supply media, or decide what belongs in a
user's library. People add their own supported URLs and are responsible for
having permission to access and play them.

### 2. Built around the player handoff

The core workflow is saving a link in a browser, finding it on Android TV or
another signed-in session, and opening it in Just (Video) Player, VLC for
Android, MPV, or MX Player without typing a long media URL with a TV remote.
Lynvo does not stream media or own playback position.

### 3. Source integrations without a media-player fork

Plugins resolve supported direct media links and source pages such as Bhadoo
Google Drive Index and OneDrive Index. The Plugin Server Protocol lets other
compatible Sources connect without moving Source-specific complexity into the
application core.

### 4. The user's selections stay theirs

Catalogue products organize around their own catalogue. Lynvo starts with the
link a user chooses, so the Saved link reflects that selection instead of an
add-on's catalogue.

## Priorities

Performance, stability, and reliability come first. Treat retries, reconnects,
partial streams, stale clients, and failed upstream calls as normal product
states. If a tradeoff is required, choose correctness and robustness over
short-term convenience.

Long-term maintainability is a core priority. If you add new functionality,
first check if shared logic can be extracted into a separate module. Duplicate
logic across multiple files is a code smell and should be avoided. Don't be
afraid to change existing code. Don't take shortcuts by just adding local
logic to solve a problem.

## A note from Lynvo

I like ambitious ideas, simple systems, and software that feels obvious. Do not preserve complexity just because it already exists. Do not introduce machinery because it looks architecturally impressive. Understand the real constraint, then fight for the smallest model that makes the correct behavior unsurprising.

Channel both "measure twice, cut once" and "yagni". Fight scope creep. Try to honor the dev's intent in both a minimal and realistic fashion.

The rest of this document is meant to help you navigate the codebase and make changes effectively. Think of these instructions less as "hard rules", more as "good defaults". The developer's preferences should be able to override anything here.

## A small glossary

Use the product terms in `CONTEXT.md` instead of inventing synonyms.

- **you** means the agent reading this file and changing Lynvo.
- **agent** means the coding agent working in this repository.
- **we**, **us**, and **maintainers** mean the people building and maintaining
  Lynvo.
- **user** means a person using the hosted Lynvo service or a generated Plugin
  Server project.
- **environment** means a Lynvo deployment and the bindings, data, and
  services it owns.
- **Lynvo app** means the React Router application and its Cloudflare Worker.
- **managed Plugin Server** means the Worker operated by Lynvo for first-party
  Plugins.
- **Custom Plugin Server** means a server a Lynvo user connects and manages.
- **public package** means the published protocol package or standalone Plugin
  Server creator package.

## Product invariants

- D1 is the only Lynvo application database.
- Every Saved link mutation goes through the Worker API with a client-generated
  `operationId`. The server idempotency ledger handles retries.
- The server snapshot is the persisted client state for Saved links. Use
  server-assigned IDs, not URLs, as entity identity.
- Each owned-data write increments the account `data_version` in the same D1
  transaction and returns it in the response body and
  `X-Lynvo-Data-Version` header.
- WebSocket `data-changed` messages reduce latency. They never establish
  freshness by themselves. Compare versions and fetch the server snapshot.
- Browser code uses only the opaque HttpOnly `lynvo_session` cookie for
  authentication. Sign-in is Google-only.
- Plugin Server API keys stay on the server. Browser code talks to Lynvo, not
  directly to a Plugin Server.

## Hit every surface

- **Entry points.** Save, settings, Plugin configuration, link selection,
  Remote Play, and in-app docs.
- **Contracts.** Browser and Worker APIs, D1, Durable Objects, realtime
  messages, the Plugin Server Protocol, public packages, and generated
  projects.
- **Reverse states.** Retry, refresh, reconnect, reopen, remove, cancel, and
  sign out.
- **Docs.** User-visible behavior belongs in the in-app MDX. Architecture and
  maintainer procedures belong in `docs/internals/` or `docs/operations/`.

## Dev servers

- `pnpm dev` applies local D1 migrations and runs the app with the auxiliary
  managed Plugin Server.
- `pnpm --filter @lynvo/lynvo-plugin-server dev` runs the managed Plugin Server
  alone.
- The local resource explorer is for read-only inspection; prefer `SELECT`
  queries and never use it to bypass application write paths.

## Verifying

- Use the smallest proof that demonstrates the change.
- Test meaningful logic and observable behavior through the public interface.
- Backend behavior changes need focused tests for the behavior they change.
- Docs-only changes need a changed-link check and tests for affected in-app
  documentation.
- Before handoff, use the repository gates in the local development guide.

## Pull requests

- Never make a PR unless the developer explicitly asks you to do so.
- Conventional commit titles, plain language: `fix(app): saved links no longer lose freshness after reconnect`.
- Body: the problem in a sentence or two, then how you fixed it. End with the model and harness that did the work.
- UI changes need before/after images. Motion or timing needs a short video.
- Upload PR evidence to GitHub. Never commit PR-only screenshots or assets such as `.github/pr-assets/`.
- One concern per PR. If the description says "also", split it.
- When babysitting: poll checks and comments newer than the last push, verify each bot finding against the source, fix real ones, dismiss false positives with a written reason. Stay quiet when nothing is new. Stop when the bots are green on the latest commit.

## Plans and work artifacts

- Do not commit implementation plans, research notes, or agent scratch files.
  Keep temporary working material outside the worktree. `.plans/` is ignored
  as a safety net, not as an accepted project-artifact directory.
- Track active maintainer work in the GitHub issue or project item that owns
  it.
- Put durable architecture, constraints, and decisions in
  `docs/internals/`. Put deployment and operational procedures in
  `docs/operations/`.
- A merged PR is the implementation record. Update the tracking item when the
  work lands; do not preserve a second checklist in the repository.

## How it works

The browser calls Lynvo's same-origin API. The app Worker authenticates the
session, owns D1 transactions and Durable Object coordination, and routes
extraction through the managed or Custom Plugin Server. Plugin Servers return
versioned Media Nodes. Lynvo stores the account snapshot and hands selected
Playable links to an external Android player.

## Where code lives

- `apps/lynvo` - React Router UI, Hono/Worker, D1, Durable Objects, extraction,
  realtime, and in-app docs.
- `apps/lynvo-plugin-server` - managed Worker, protocol routes, and Source
  adapters.
- `packages/plugin-server-protocol` - Effect/Schema contracts, runtime
  helpers, and protocol docs.
- `packages/create-lynvo-plugin-server` - standalone generator and template.
- `apps/lynvo/app/components/ui/` - generated shadcn primitives. Treat them as
  read-only and compose them from feature code outside this directory.
- `.repos/` - vendored read-only references. Prefer their patterns over
  invented ones. Never edit or import from them. Sync with
  `pnpm run sync:repos` when bumping the matching dependency. Read
  `.repos/effect/LLMS.md` before writing Effect code.

## Taste

- Put Source-specific complexity at the Plugin boundary. Keep shared
  orchestration and UI state explicit.
- Measure before adding a cache, queue, or task orchestrator.
- A lying spinner, stale label, or dropped realtime update is a product bug.

## Additional tips

- Don't verify with browsers or computer use unless the user explicitly agrees
  or requests it.
