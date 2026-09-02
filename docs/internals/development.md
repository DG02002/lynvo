# Local development

## First checkout

Use the Node.js version in [`.node-version`](../../.node-version), currently
26.8.1, and pnpm 12. Update pnpm with:

```sh
pnpm self-update next-12
```

Create a Google Cloud OAuth client for local sign-in.

## Install

From the repository root:

```sh
pnpm install --frozen-lockfile
[ -e apps/lynvo/.dev.vars ] || cp apps/lynvo/.dev.vars.example apps/lynvo/.dev.vars
[ -e apps/lynvo-plugin-server/.dev.vars ] || cp apps/lynvo-plugin-server/.dev.vars.example apps/lynvo-plugin-server/.dev.vars
```

Fill the Google OAuth values and the encryption key in
`apps/lynvo/.dev.vars`. Generate the encryption key with:

```sh
openssl rand -base64 32
```

Keep the same encryption key for the lifetime of a local environment. Replacing
it makes existing encrypted Plugin Credentials unreadable.

Register this redirect URI in the Google OAuth client:

```text
http://localhost:5173/api/auth/callback/google
```

The two `.dev.vars.example` files use the same local managed Plugin Server key.
Keep those values matching if you change either one. Never commit `.dev.vars`,
`.env`, credentials, test links, or local database state.

## Run the app

```sh
pnpm dev
```

`pnpm dev` applies `apps/lynvo/migrations/` to local D1 before starting the
app with the local Worker environment and auxiliary managed Plugin Server. Do
not use production bindings for local tests.

Run the managed Plugin Server alone when its Worker needs focused debugging:

```sh
pnpm --filter @lynvo/lynvo-plugin-server dev
```

Regenerate Cloudflare bindings after changing Wrangler configuration:

```sh
pnpm --filter @lynvo/app cf-typegen
```

## Inspect local state

[Cloudflare Local Explorer](https://developers.cloudflare.com/workers/local-development/local-explorer/)
is available from local Wrangler and Vite development servers. For this repo,
the local human UI is:

```text
http://localhost:5173/cdn-cgi/local/explorer/
```

The agent API root is:

```text
http://localhost:5173/cdn-cgi/local/explorer/api
```

Keep the human and agent paths distinct. Agent integrations in this repo should
use the explicit `/cdn-cgi/local/explorer/api` endpoint.

Fetch the OpenAPI description before choosing an operation:

```sh
curl -sS http://localhost:5173/cdn-cgi/local/explorer/api
curl -sS http://localhost:5173/cdn-cgi/local/explorer/api/d1/database
```

For a read-only D1 inspection, replace the local database ID returned by the
second command:

```sh
local_database_id="replace-with-id"
curl -sS -X POST "http://localhost:5173/cdn-cgi/local/explorer/api/d1/database/$local_database_id/raw" -H 'Content-Type: application/json' --data '{"sql":"SELECT name FROM sqlite_master ORDER BY name"}'
```

The raw SQL endpoint can mutate local state, so agents should prefer read-only
`SELECT` statements, never bypass application write paths, and never point it at
production.

## Start local development with both Workers

Use `pnpm dev` from the repository root. It runs
`apps/lynvo/scripts/start-local-dev.mjs`, which applies local D1 migrations
with Wrangler and then starts the React Router/Vite dev server.

The app's `apps/lynvo/vite.config.ts` configures
`apps/lynvo-plugin-server/wrangler.jsonc` as an auxiliary Worker. The local
environment in `apps/lynvo/wrangler.jsonc` maps `LYNVO_PLUGIN_SERVER` to
`lynvo-plugin-server-local`.

This is the one-command workflow for both Workers. To verify it, start
`pnpm dev` and press `b` in the terminal. The bindings output should list both
`lynvo-local` and `lynvo-plugin-server-local`, with
`env.LYNVO_PLUGIN_SERVER` pointing to the auxiliary Worker.

Do not start the Plugin Server in a second terminal for the normal app
workflow. The standalone command above is only for focused Worker debugging.

Cloudflare documents both the Wrangler multiple-config mode and the Vite
`auxiliaryWorkers` pattern in [Developing with multiple Workers](https://developers.cloudflare.com/workers/local-development/multi-workers/).
This React Router app depends on Vite's generated
`virtual:react-router/server-build`, so replacing the current command with raw
`wrangler dev` would be a migration, not a script rename.

## Test TV Bro-specific UI

To test the TV Bro profile without Android TV, install the
[User-Agent Switcher and Manager extension](https://github.com/ray-lothian/UserAgent-Switcher/)
and configure TV Bro's legacy user agent:

```text
Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.89 Mobile Safari/537.36
```

Open Lynvo on a route other than `/save`, then run this in the browser console:

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

Navigate to `/save` using Lynvo's Save link without reloading. A full reload
clears the simulated bridge. Remove the user-agent override when testing the
standard browser UI.

## Quality gates

Use targeted checks while iterating. Before handing off code changes, run all
repository gates from the root:

```sh
pnpm check
pnpm test
pnpm test:workers
pnpm build
pnpm check:plugin-server-release
```

The checks cover formatting, lint, type generation and typechecking, browser
tests, Worker tests, builds, and the standalone generated Plugin Server smoke
test. `pnpm build` produces dry-run artifacts; it does not deploy them.

For a docs-only change, check changed repository links and run the affected
in-app documentation tests. Do not deploy as a verification step.
