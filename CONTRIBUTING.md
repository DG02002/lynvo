# Contributing to Lynvo

This is the single setup, development, testing, and deployment guide for the
workspace.

## Repository map

- `apps/lynvo`: product application and direct-link extraction core.
- `apps/official-extractor`: private managed OneDrive and Bhadoo Worker.
- `packages/extractor-protocol`: shared schemas, runtime, specification, and author guide.
- `examples/extractor-worker`: minimal compatible Worker used by root CI.
- `docs/usage-limits.md`: account and extractor capacity policy.
- `docs/apple-HIG/`: design and writing references used by contributors.

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
`OFFICIAL_EXTRACTOR_API_KEY` in the ignored local secret files for Lynvo and
the official extractor. It preserves existing variables, refuses to overwrite
conflicting keys, never prints the key, and sets both files to owner-only
permissions (`0600`). It is safe to run repeatedly.

Never commit `.dev.vars`, `.env`, credentials, test links, `plans/`,
`animation-plans/`, or `.repos/`.

## Create and connect a Convex project

1. Sign in to the [Convex dashboard](https://dashboard.convex.dev/) and create
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
PLUGIN_CREDENTIAL_MASTER_KEY=base64-encoded-32-byte-key
```

Generate `PLUGIN_CREDENTIAL_MASTER_KEY` with `openssl rand -base64 32`. Keep
the same key for the lifetime of an environment; replacing it makes existing
encrypted Plugin Credentials unreadable.

Use the gateway secret generated in the previous section as
`AUTH_GATEWAY_SECRET`. Copy `VITE_CONVEX_URL` from `apps/lynvo/.env.local`.

Use unquoted values for URLs and ordinary single-line values. Use `""` for an
intentionally empty value. Quote values that contain spaces, `#`, or leading
or trailing whitespace.

`pnpm dev` starts the Lynvo web application and the official extractor as an
auxiliary Worker, using the Convex URL in `.dev.vars`. `pnpm dev:local` starts
those two processes plus the Convex watcher. It first validates the selected
Convex deployment, then creates an ignored `.dev.vars.local` and replaces only
`VITE_CONVEX_URL` with the URL from `.env.local`.

## Development commands

```sh
# Lynvo web application and auxiliary official extractor using .dev.vars
pnpm dev

# Lynvo, auxiliary official extractor, and Convex watcher using .env.local
pnpm dev:local

# Same local stack, exposed to other devices on the local network
pnpm dev:local --host

# Official extractor by itself for standalone debugging
pnpm --filter @lynvo/official-extractor dev

# Regenerate Lynvo Cloudflare bindings
pnpm --filter @lynvo/app cf-typegen

# Inspect dependency updates
pnpm -r outdated
```

Workspace dependencies use `workspace:*`; shared third-party versions belong
in the root `pnpm-workspace.yaml` catalog. Do not upgrade TypeScript beyond the
version supported by React Router.

## Required quality gates

Run all gates from the repository root before committing:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

`pnpm build` includes dry-run bundles for the official extractor and example
Worker. After building Lynvo, verify its generated deployment bundle with:

```sh
pnpm --filter @lynvo/app exec wrangler deploy --dry-run
```

The Lynvo dry-run intentionally uses React Router's generated Wrangler deploy
configuration. Do not pass the source `wrangler.jsonc` directly to that final
command.

## Production configuration

Before deployment:

- Replace the placeholder `AUTH_RATE_LIMITS` KV namespace id in `apps/lynvo/wrangler.jsonc`.
- Configure the production Convex URL and Turnstile values.
- Choose the production Lynvo URL before initializing production Convex Auth.
- Use the same `AUTH_GATEWAY_SECRET` in Lynvo and Convex.
- Generate a production-only `PLUGIN_CREDENTIAL_MASTER_KEY` and retain it securely.
- Set `OFFICIAL_EXTRACTOR_API_KEY` independently on both Workers with the same value.
- Confirm the official Worker has `workers_dev` disabled and no public route.
- Confirm `OFFICIAL_EXTRACTOR` targets the intended Worker in the same Cloudflare account.

Convex is the application database. Lynvo’s Durable Object coordinates realtime
connections; the official extractor’s Durable Object enforces global extraction
capacity. Keep both Wrangler migrations intact.

## Deployment order

Deployment requires explicit authorization. Never deploy as part of routine
implementation or verification.

1. Run `wrangler whoami` and verify the intended Cloudflare account.
2. Configure the official extractor secret and usage-limiter Durable Object migration.
3. Deploy `@lynvo/official-extractor` first.
4. Validate `/manifest`, `/verify`, `/usage`, and `/extract` in a controlled environment.
5. Deploy the Convex schema and functions to create or update the production deployment.
6. Run the Convex Auth initializer with `--prod` from `apps/lynvo`.
7. Generate a production gateway secret and set the same value in Convex and Lynvo.
8. Configure the remaining Lynvo Worker secrets and production Convex URL.
9. Confirm production contains `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`, and `AUTH_GATEWAY_SECRET`.
10. Deploy `@lynvo/app` with `OFFICIAL_EXTRACTOR` bound to the exact target.
11. Smoke-test account creation, sign-in, TV sign-in, extraction, logs, and counters.

```sh
pnpm --filter @lynvo/official-extractor deploy
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
in-process official extractors as an emergency fallback.

## Cloudflare Builds monorepo setup

Connect the same Git repository to two separate Cloudflare Worker projects.
Configure each project with the directory that owns its Wrangler configuration:

| Worker project     | Root directory             | Deploy command |
| ------------------ | -------------------------- | -------------- |
| Lynvo              | `/apps/lynvo`              | `pnpm deploy`  |
| Official extractor | `/apps/official-extractor` | `pnpm deploy`  |

Keep the Workers as separate build targets even though they share one atomic
repository. Include `packages/extractor-protocol/**`, the root lockfile, and
workspace configuration in both projects' build watch paths because protocol
or dependency changes can affect both Workers. Include each app's own path only
for changes specific to that Worker.

The workspace intentionally uses pnpm recursive scripts instead of Turborepo.
Add a task orchestrator only after measured build times justify caching and its
extra configuration.

## Specialized references

- [Usage limits](docs/usage-limits.md)
- [Protocol package and documentation](packages/extractor-protocol/README.md)
- [Project terminology](CONTEXT.md)
- [Typography reference](<docs/apple-HIG/Typography - Apple HIG.md>)
- [Writing reference](<docs/apple-HIG/Writing - Apple HIG.md>)
- [Inclusive-writing reference](<docs/apple-HIG/Writing Inclusively - Apple HIG.md>)
