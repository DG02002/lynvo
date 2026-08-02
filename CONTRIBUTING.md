# Contributing to Lynvo

This is the single setup, development, testing, and deployment guide for the
workspace.

## Repository map

- `apps/lynvo`: product application and direct-link extraction core.
- `apps/lynvo-plugin-server`: private managed OneDrive and Bhadoo Worker.
- `packages/plugin-server-protocol`: shared schemas, runtime, specification, and author guide.
- `packages/create-lynvo-plugin-server`: public standalone Worker generator and canonical template.
- `examples/plugin-server`: minimal compatible Worker used by root CI.
- `apps/lynvo/app/features/site/docs/plugin-server/`: public Plugin Server author docs rendered at `/docs/plugin-server`.
- `docs/plugin-server-maintainer-guide.md`: internal monorepo, compatibility, and package release guide.
- `docs/apple-HIG/`: read-only design and writing references used by contributors.

## Prerequisites

Use Node.js 22.11 or newer and the pnpm version pinned in the root
`packageManager` field.

Create the following accounts before setting up Lynvo:

- [Convex](https://dashboard.convex.dev/) for the application database and
  backend functions.
- [Cloudflare](https://dash.cloudflare.com/sign-up) for Workers, Turnstile, KV,
  and Durable Objects.

You need a Convex project and deployment, Cloudflare Turnstile keys, and a
Cloudflare KV namespace for authentication rate limits. The free tiers are
enough for local development.

## Install the workspace

```sh
corepack enable
corepack install
pnpm install --frozen-lockfile
pnpm secrets:local
```

`pnpm secrets:local` configures one shared, cryptographically random
`LYNVO_PLUGIN_SERVER_API_KEY` in the ignored local secret files for Lynvo and
the Lynvo Plugin Server. It preserves existing variables, refuses to overwrite
conflicting keys, never prints the key, and sets both files to owner-only
permissions (`0600`). It is safe to run repeatedly.

Never commit `.dev.vars`, `.env`, credentials, test links, `plans/`,
`animation-plans/`, or `.repos/`.

## Create and connect a Convex project

1. Log in to the [Convex dashboard](https://dashboard.convex.dev/) and create
   an account if you do not have one.
2. Log the Convex CLI into that account. If this checkout already has an
   anonymous local deployment, the CLI offers to link it to your account.
3. Create a new Convex project or select an existing development project.

```sh
pnpm --filter @lynvo/app exec convex login
pnpm --filter @lynvo/app exec convex dev --once
```

This command connects the checkout to the selected Convex project, creates
`apps/lynvo/.env.local`, pushes the schema and backend functions, and generates
the Convex client types. Keep `.env.local`; both `convex dev` and
`pnpm dev:local` use the selected deployment from that file.

Initialize Convex Auth from the app directory:

```sh
cd apps/lynvo
pnpx @convex-dev/auth
cd ../..
```

Use `http://localhost:5173` for `SITE_URL` unless you changed the local web
server port. The initializer configures these values on the selected
development deployment:

- `SITE_URL`: browser-facing Lynvo URL
- `JWT_PRIVATE_KEY`: private signing key
- `JWKS`: public JSON Web Key Set

The initializer detects the existing `convex/auth.config.ts`, `convex/auth.ts`,
and `convex/http.ts` files. Do not replace their customized implementations.
Confirm each file already satisfies the initializer prompt, then continue.

Verify the deployment contains all three keys without copying their values:

```sh
pnpm --filter @lynvo/app exec convex env list | sed 's/=.*/=<redacted>/'
```

Keep `JWT_PRIVATE_KEY` and `JWKS` in the Convex deployment environment. Do not
add them to `.dev.vars`; that file configures the Cloudflare Worker and cannot
configure Convex functions.

Create a random gateway secret and store the same value in Convex and
`apps/lynvo/.dev.vars`:

```sh
openssl rand -base64 32
pnpm --filter @lynvo/app exec convex env set AUTH_GATEWAY_SECRET
```

Paste the generated value when the Convex CLI prompts for it. Add the same
value to `.dev.vars` in the next section.

Run `convex dev --once` again whenever you want to push and validate Convex
changes without leaving the watcher running.

## Local configuration

Create `apps/lynvo/.dev.vars` with the Worker-only configuration:

```env
VITE_CONVEX_URL=https://your-deployment.convex.cloud
AUTH_GATEWAY_SECRET=replace-with-the-same-secret-used-in-convex
TURNSTILE_SITE_KEY=0x...
TURNSTILE_SECRET_KEY=0x...
PLUGIN_CREDENTIAL_ENCRYPTION_KEY=base64-encoded-32-byte-key
```

Generate `PLUGIN_CREDENTIAL_ENCRYPTION_KEY` with `openssl rand -base64 32`. Keep
the same key for the lifetime of an environment; replacing it makes existing
encrypted Plugin Credentials unreadable.

Use the gateway secret generated in the previous section as
`AUTH_GATEWAY_SECRET`. Copy `VITE_CONVEX_URL` from `apps/lynvo/.env.local`.

Use unquoted values for URLs and ordinary single-line values. Use `""` for an
intentionally empty value. Quote values that contain spaces, `#`, or leading
or trailing whitespace.

`pnpm dev` starts the Lynvo web application and the Lynvo Plugin Server as an
auxiliary Worker, using the Convex URL in `.dev.vars`. `pnpm dev:local` starts
those two processes plus the Convex watcher. It first validates the selected
Convex deployment, then creates an ignored `.dev.vars.local` and replaces only
`VITE_CONVEX_URL` with the URL from `.env.local`.

## Development commands

```sh
# Lynvo web application and auxiliary Lynvo Plugin Server using .dev.vars
pnpm dev

# Lynvo, auxiliary Lynvo Plugin Server, and Convex watcher using .env.local
pnpm dev:local

# Same local stack, exposed to other devices on the local network
pnpm dev:local --host

# Same local stack without per-account usage limits for plugin testing
pnpm dev:local --host --no-usage

# Lynvo Plugin Server by itself for standalone debugging
pnpm --filter @lynvo/lynvo-plugin-server dev

# Regenerate Lynvo Cloudflare bindings
pnpm --filter @lynvo/app cf-typegen

# Inspect dependency updates
pnpm -r outdated
```

Use `--no-usage` for repeated plugin testing without advancing account usage
counters. Omit it to test the normal daily and monthly limits. The global
extraction safety limit remains enabled in both modes.

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
  Lynvo Plugins and direct links.
- 15 Lynvo Plugin extractions per account per UTC day.
- 20,000 Lynvo Plugin extraction operations globally per UTC day.

The global daily ceiling intentionally reserves most of the Workers Free daily
allowance for authentication, settings, saved links, realtime connections, and
other dynamic application traffic.

The Lynvo Plugin Server enforces its own finite global service capacity before
upstream work and reports that service-credential usage through the Plugin
Server Protocol. Lynvo separately keeps the per-account quotas above because
the binding credential identifies Lynvo as a service, not an individual
account.

Use `pnpm dev:local --host --no-usage` for repeated Plugin Server testing
without advancing account usage counters. Omit `--no-usage` to test the normal
daily and monthly account quotas. The global daily extraction safety limit
always remains enabled.

### Reset every Lynvo account

Run this from the repository root against the configured Convex deployment:

```bash
pnpm --filter @lynvo/app usage:reset
```

The reset advances a global usage epoch. Existing counter rows remain available
for later cleanup but stop affecting every account immediately.

## Required quality gates

Run all gates from the repository root before committing:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm check:plugin-server-release
```

`pnpm build` includes dry-run bundles for the Lynvo Plugin Server and example
Worker. After building Lynvo, verify its generated deployment bundle with:

```sh
pnpm --filter @lynvo/app exec wrangler deploy --dry-run
```

The Lynvo dry-run intentionally uses React Router's generated Wrangler deploy
configuration. Do not pass the source `wrangler.jsonc` directly to that final
command.

## Production configuration

Before deployment:

- Use `https://lynvo.dg02002.workers.dev` as the production Lynvo URL and
  Convex Auth `SITE_URL`.
- Replace the placeholder `AUTH_RATE_LIMITS` KV namespace id in `apps/lynvo/wrangler.jsonc`.
- Configure the production Convex URL and Turnstile values.
- Choose the production Lynvo URL before initializing production Convex Auth.
- Use the same `AUTH_GATEWAY_SECRET` in Lynvo and Convex.
- Generate a production-only `PLUGIN_CREDENTIAL_ENCRYPTION_KEY` and retain it securely.
- Set `LYNVO_PLUGIN_SERVER_API_KEY` independently on both Workers with the same value.
- Confirm the Lynvo Plugin Server has `workers_dev` disabled and no public route.
- Confirm `LYNVO_PLUGIN_SERVER` targets the intended Worker in the same Cloudflare account.

Convex is the application database. Lynvo’s Durable Object coordinates realtime
connections; the Lynvo Plugin Server’s Durable Object enforces global extraction
capacity. Keep both Wrangler migrations intact.

## Deployment order

Deployment requires explicit authorization. Never deploy as part of routine
implementation or verification.

1. Run `wrangler whoami` and verify the intended Cloudflare account.
2. Configure the Lynvo Plugin Server secret and usage-limiter Durable Object migration.
3. Deploy `@lynvo/lynvo-plugin-server` first.
4. Validate `/manifest`, `/verify`, `/usage`, and `/extract` in a controlled environment.
5. Deploy the Convex schema and functions to create or update the production deployment.
6. Run the Convex Auth initializer with `--prod` from `apps/lynvo`.
7. Generate a production gateway secret and set the same value in Convex and Lynvo.
8. Configure the remaining Lynvo Worker secrets and production Convex URL.
9. Confirm production contains `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`, and `AUTH_GATEWAY_SECRET`.
10. Deploy `@lynvo/app` with `LYNVO_PLUGIN_SERVER` bound to the exact target.
11. Smoke-test account creation, login, device login, extraction, logs, and counters.

```sh
pnpm --filter @lynvo/lynvo-plugin-server deploy
pnpm --filter @lynvo/app exec convex deploy
cd apps/lynvo
pnpx @convex-dev/auth --prod
cd ../..
openssl rand -base64 32
pnpm --filter @lynvo/app exec convex env set --prod AUTH_GATEWAY_SECRET
pnpm --filter @lynvo/app exec convex env list --prod | sed 's/=.*/=<redacted>/'
pnpm deploy:lynvo
```

Enter the production Lynvo URL when the Auth initializer asks for `SITE_URL`.
Paste the generated gateway secret when the Convex CLI prompts for it, then set
the same value as the Lynvo Worker’s `AUTH_GATEWAY_SECRET`. Generate separate
Auth keys for development and production. Never copy `JWT_PRIVATE_KEY` between
deployments.

For rollback, restore the recorded Lynvo Worker version before removing or
rolling back a target version it still expects. Do not restore the deleted
in-process Lynvo Plugin Servers as an emergency fallback.

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
- [Typography reference](<docs/apple-HIG/Typography - Apple HIG.md>)
- [Writing reference](<docs/apple-HIG/Writing - Apple HIG.md>)
- [Inclusive-writing reference](<docs/apple-HIG/Writing Inclusively - Apple HIG.md>)
