# Setup Instructions

## Requirements

- Node.js 22.11 or newer
- pnpm 10.26.1
- A Convex deployment
- A Cloudflare Workers account for deployment
- A Cloudflare Turnstile site
- A Cloudflare KV namespace for auth rate limits

## Local configuration

Install dependencies and provision or select the Convex development deployment:

```bash
pnpm install
pnpm --filter @lynvo/app exec convex dev --once
```

Create `apps/lynvo/.dev.vars` with the Worker-only configuration:

```env
VITE_CONVEX_URL=https://your-deployment.convex.cloud
AUTH_GATEWAY_SECRET=replace-with-the-same-secret-used-in-convex
TURNSTILE_SITE_KEY=0x...
TURNSTILE_SECRET_KEY=0x...
PLUGIN_CREDENTIAL_MASTER_KEY=base64-encoded-32-byte-key
OFFICIAL_EXTRACTOR_API_KEY=shared-private-binding-secret
```

Generate the plugin credential encryption key with `openssl rand -base64 32`.
Keep the same key for the lifetime of the environment; replacing it makes
existing encrypted plugin passwords unreadable.

Initialize Convex Auth and set the same gateway secret on the Convex deployment:

```bash
pnpm dlx @convex-dev/auth
pnpm --filter @lynvo/app exec convex env set AUTH_GATEWAY_SECRET "<same value as .dev.vars>"
```

Run Lynvo against the configured cloud Convex deployment:

```bash
pnpm run dev
```

The Cloudflare Vite plugin starts `apps/official-extractor` as an auxiliary
Worker and routes official extraction through `OFFICIAL_EXTRACTOR`. Use
`pnpm --filter @lynvo/official-extractor dev` only when developing that Worker
through its own local URL. Put the same ignored `OFFICIAL_EXTRACTOR_API_KEY` in
both Workers' local secret files.

Run Lynvo and Convex entirely locally:

```bash
pnpm run dev:local
```

`dev:local` creates an ignored `.dev.vars.local` from `.dev.vars` and replaces
only `VITE_CONVEX_URL` with the local deployment URL from `.env.local`.

## Production configuration

Set every required Worker secret declared in `apps/lynvo/wrangler.jsonc` with Wrangler. Use the production Convex URL, the production Turnstile keys, the same `AUTH_GATEWAY_SECRET` value in both Convex and the Worker, and a separately generated `PLUGIN_CREDENTIAL_MASTER_KEY`.

Create the `AUTH_RATE_LIMITS` KV namespace and replace the placeholder namespace ID in `apps/lynvo/wrangler.jsonc` before deployment.

Deploy the private official Worker first, then Convex, then Lynvo:

```bash
pnpm --filter @lynvo/official-extractor deploy
pnpm --filter @lynvo/app exec convex deploy
pnpm run deploy:lynvo
```

Before deployment, run both Wrangler dry-runs. The official Worker has
`workers_dev` disabled and must have no public route. Verify the Cloudflare
account and exact binding target before any real deploy.

Convex is the application database. The Cloudflare Durable Object is used only for realtime connection coordination; its migration in `apps/lynvo/wrangler.jsonc` must remain.
