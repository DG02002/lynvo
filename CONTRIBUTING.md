# Contributing to Lynvo

This file covers setup, development, testing, and deployment for the workspace.

## Repository map

- `apps/lynvo`: product application and Plugin Server extraction orchestration.
- `apps/lynvo-plugin-server`: private managed OneDrive and Bhadoo Worker.
- `packages/plugin-server-protocol`: shared schemas, runtime, specification, and author guide.
- `packages/create-lynvo-plugin-server`: public standalone Worker generator and template.
- `apps/lynvo/app/features/site/docs/plugin-server/`: public Plugin Server author docs rendered at `/docs/plugin-server`.
- `docs/plugin-server-maintainer-guide.md`: internal monorepo, compatibility, and package release guide.
- `.agents/skills/product-interface-guidelines/references/`: read-only interface writing, accessibility, inclusion, and terminology references used by contributors.

## Prerequisites

Use the latest Node.js and pnpm releases.

Create the following accounts before setting up Lynvo:

- [Cloudflare](https://dash.cloudflare.com/sign-up) for Workers, D1, and
  Durable Objects.
- [Google](https://console.cloud.google.com/) for OAuth sign-in credentials.

You need a local D1 database (Miniflare provisions one automatically for
development) and Google OAuth client credentials. The free tiers cover local
development.

## Install the workspace

```sh
corepack enable
corepack prepare pnpm@latest --activate
pnpm install --frozen-lockfile
pnpm secrets:local
```

`pnpm secrets:local` configures matching local secret values
(`MANAGED_PLUGIN_SERVER_API_KEY` for Lynvo and `PLUGIN_SERVER_AUTH_KEY` for
the Lynvo Plugin Server). It preserves existing variables, refuses to overwrite
conflicting keys, never prints the key, and sets both files to owner-only
permissions (`0600`). It is safe to run repeatedly.

Never commit `.dev.vars`, `.env`, credentials, test links, or `.repos/`.

## Local configuration

Create `apps/lynvo/.dev.vars` with the Worker configuration:

```env
GOOGLE_CLIENT_ID=your-oauth-client-id
GOOGLE_CLIENT_SECRET=your-oauth-client-secret
PLUGIN_CREDENTIAL_ENCRYPTION_KEY=base64-encoded-32-byte-key
```

Generate `PLUGIN_CREDENTIAL_ENCRYPTION_KEY` with `openssl rand -base64 32`. Keep
the same key for the lifetime of an environment; replacing it makes existing
encrypted Plugin Credentials unreadable.

Register `http://localhost:5173/api/auth/callback/google` as an authorized
redirect URI on the Google OAuth client so local sign-in completes.

Use unquoted values for URLs and ordinary single-line values. Use `""` for an
intentionally empty value. Quote values that contain spaces, `#`, or leading
or trailing whitespace.

`pnpm dev` starts the Lynvo web application and the Lynvo Plugin Server as an
auxiliary Worker. `pnpm dev:local` starts the same stack against the local
Cloudflare environment (`CLOUDFLARE_ENV=local`), where Miniflare provides the
D1 database and applies `apps/lynvo/migrations/` automatically.

## Development commands

```sh
# Lynvo web application and auxiliary Lynvo Plugin Server using .dev.vars
pnpm dev

# Same stack against the local Cloudflare environment (Miniflare D1)
pnpm dev:local

# Same local stack, exposed to other devices on the local network
pnpm dev:local --host

# Lynvo Plugin Server by itself for standalone debugging
pnpm --filter @lynvo/lynvo-plugin-server dev

# Regenerate Lynvo Cloudflare bindings
pnpm --filter @lynvo/app cf-typegen

# Inspect dependency updates
pnpm -r outdated
```

## Test TVBro-specific UI

Install the [User-Agent Switcher and Manager browser extension](https://github.com/ray-lothian/UserAgent-Switcher/)
to test TVBro-specific UI without an Android TV. Configure it to use TV Bro's
legacy user agent:

```text
Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.89 Mobile Safari/537.36
```

Lynvo also checks for TV Bro's JavaScript bridge so that the user agent alone
cannot accidentally enable the TV interface. Open Lynvo on a route other than
`/save`, then run this in the browser's developer console:

```js
Object.defineProperty(window, "TVBro", {
  configurable: true,
  value: {},
})
document.documentElement.setAttribute(
  "data-lynvo-client-profile",
  "tvbro-android-tv"
)
```

Navigate to `/save` using Lynvo's Save link without reloading the page. A full
page reload clears the simulated bridge, so repeat the console setup after a
reload. Remove the user-agent override when testing the standard browser UI.

Workspace dependencies use `workspace:*`; shared third-party versions belong
in the root `pnpm-workspace.yaml` catalog. Do not upgrade TypeScript beyond the
version supported by React Router.

The public protocol package and creator package are intentionally different
from the private application packages. Use `workspace:*` only inside this
monorepo. A generated or external Plugin Server must use the published
`@dg02002/lynvo-plugin-server-protocol` semver package and must not contain `workspace:`
or `link:` dependencies.

## Usage limits and reset

Lynvo separates extraction capacity into two independent resources:

- Lynvo account quotas reserve per-user capacity before a Lynvo Plugin Server
  binding call.
- Lynvo Plugin Server capacity reserves global upstream capacity before Source
  work begins.

Lynvo Plugins use Lynvo-owned counters. Custom Plugin Servers expose and
enforce their own finite counters through the mandatory authenticated
`GET /usage` protocol endpoint.

### Current Lynvo Plugin limits

- 200 Lynvo Plugin extractions per account per UTC month, shared across all
  first-party Plugins hosted by the Lynvo Plugin Server.
- 30 Lynvo Plugin extractions per account per UTC day.
- 20,000 Lynvo Plugin extraction operations globally per UTC day.

The global daily ceiling intentionally reserves most of the Workers Free daily
allowance for authentication, settings, saved links, realtime connections, and
other dynamic application traffic.

The Lynvo Plugin Server enforces its own finite global service capacity before
upstream work and reports that service-credential usage through the Plugin
Server Protocol. Lynvo separately keeps the per-account quotas above because
the binding credential identifies Lynvo as a service, not an individual
account.

The limit values live in `apps/lynvo/workers/constants.ts`. Adjust them there
when a change is intended for review; do not disable limits locally through
environment flags.

## Required quality gates

Run all gates from the repository root before committing:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm check:plugin-server-release
```

`pnpm build` includes dry-run bundles for the Lynvo application and private
Lynvo Plugin Server Worker. After building Lynvo, verify its generated
deployment bundle with:

```sh
pnpm --filter @lynvo/app exec wrangler deploy --dry-run
```

The Lynvo dry run uses React Router's generated Wrangler deploy
configuration. Do not pass the source `wrangler.jsonc` directly to that final
command.

## Production configuration

Before deployment:

- Run `wrangler d1 create lynvo-db` (plus a preview database) and replace the
  placeholder database IDs in `apps/lynvo/wrangler.jsonc` (`d1_databases` block
  at top level and under `env.local`).
- Register `https://lynvo.dg02002.workers.dev/api/auth/callback/google` in the
  Google Cloud console and configure the `GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET` Worker secrets.
- Generate a production-only `PLUGIN_CREDENTIAL_ENCRYPTION_KEY` and retain it securely.
- Set `MANAGED_PLUGIN_SERVER_API_KEY` on Lynvo and `PLUGIN_SERVER_AUTH_KEY` on Lynvo Plugin Server with the same matching value.
- Confirm the Lynvo Plugin Server has `workers_dev` disabled and no public route.
- Confirm `LYNVO_PLUGIN_SERVER` targets the intended Worker in the same Cloudflare account.

D1 is the application database. Sessions are opaque HttpOnly cookies resolved
to D1 rows; sign-in is Google-only. Lynvo's Durable Object coordinates realtime
connections; the Lynvo Plugin Server's Durable Object enforces global extraction
capacity. Keep both Wrangler migrations intact. Schema changes ship as SQL
files under `apps/lynvo/migrations/`; CI applies them with
`wrangler d1 migrations apply DB --remote` before promoting a new version.

## Deployment order

Deployment requires explicit authorization. Never deploy as part of routine
implementation or verification.

1. Run `wrangler whoami` and verify the intended Cloudflare account.
2. Create the production D1 database and record its id in `wrangler.jsonc`.
3. Configure the Lynvo Plugin Server `PLUGIN_SERVER_AUTH_KEY` secret and usage-limiter Durable Object migration.
4. Deploy `@lynvo/lynvo-plugin-server` first.
5. Validate `/manifest`, `/verify`, `/usage`, and `/extract` in a controlled environment.
6. Apply D1 migrations: `pnpm --filter @lynvo/app exec wrangler d1 migrations apply DB --remote`.
7. Configure the remaining Lynvo Worker secrets (`GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `PLUGIN_CREDENTIAL_ENCRYPTION_KEY`,
   `MANAGED_PLUGIN_SERVER_API_KEY`).
8. Deploy `@lynvo/app` with `LYNVO_PLUGIN_SERVER` bound to the exact target.
9. Smoke-test Google sign-in, device login, extraction, logs, and counters.

```sh
pnpm --filter @lynvo/lynvo-plugin-server run deploy
pnpm --filter @lynvo/app exec wrangler d1 migrations apply DB --remote
pnpm deploy:lynvo
```

For data rollback, use D1 Time Travel point-in-time recovery. For code
rollback, restore the recorded Lynvo Worker version before removing or rolling
back a target version it still expects. Do not restore the deleted in-process
Lynvo Plugin Servers as an emergency fallback.

## Cloudflare Builds monorepo setup

Connect the same Git repository to two separate Cloudflare Worker projects.
Configure each project with the directory that owns its Wrangler configuration:

| Worker project      | Root directory              | Deploy command |
| ------------------- | --------------------------- | -------------- |
| Lynvo               | `/apps/lynvo`               | `pnpm deploy`  |
| Lynvo Plugin Server | `/apps/lynvo-plugin-server` | `pnpm deploy`  |

Keep the Workers as separate build targets even though they share one atomic
repository. Include `packages/plugin-server-protocol/**`, the root lockfile, and
workspace configuration in both projects' build watch paths because protocol
or dependency changes can affect both Workers. Include each app's own path only
for changes specific to that Worker.

The workspace intentionally uses pnpm recursive scripts instead of Turborepo.
Add a task orchestrator only after measured build times justify caching and its
extra configuration.

## Specialized references

- [Protocol package and documentation](packages/plugin-server-protocol/README.md)
- [Project terminology](CONTEXT.md)
- [Interface writing reference](.agents/skills/product-interface-guidelines/references/hig-writing.md)
- [Accessibility reference](.agents/skills/product-interface-guidelines/references/hig-accessibility.md)
- [Inclusive-design reference](.agents/skills/product-interface-guidelines/references/hig-inclusion.md)
- [Terminology reference](.agents/skills/product-interface-guidelines/references/apple-style-guide.md)
