# Local development

## First checkout

Use the Node.js version in [`.node-version`](../../.node-version), currently
26.9.0, and pnpm 12. Update pnpm with:

```sh
pnpm self-update
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

The generated `worker-configuration.d.ts` files are gitignored; the apps
regenerate them inside `check`/`typecheck`. Do not commit them.

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

## Runtime testing in a real browser

Coding agents can drive a real Chrome against the local app through the
[chrome-devtools MCP server](https://github.com/ChromeDevTools/chrome-devtools-mcp).
This lets agents verify runtime behavior instead of only reading code.

`.agents/mcp.json` registers the server for agent apps that read workspace
MCP configuration, using the portable `pnpm dlx` form. Clients with their own
MCP registry can use the same command, for example Codex:

```sh
codex mcp add chrome-devtools -- pnpm dlx chrome-devtools-mcp@latest
```

Clients launched from the macOS GUI may not resolve `pnpm` when spawning
servers; on such machines, override the command with the absolute path to the
globally installed `chrome-devtools-mcp` binary (install it with `pnpm add -g
chrome-devtools-mcp`) in user-level MCP configuration, which takes precedence
over the workspace entry.

Start the app for agent-driven testing with the fixed local development
account so no Google sign-in is needed:

```sh
pnpm dev --no-auth
```

Then ask the agent to test against `http://localhost:5173`, for example "open
the library and report console errors and failed network requests" or "run a
Lighthouse audit of the sign-in page". Combine the browser's device emulation
with the `TV Bro/1.0` user-agent prefix to exercise the TV layout.

The MCP server launches Chrome with a dedicated persistent profile, separate
from your personal Chrome profile. State in that profile persists between runs,
and it never attaches to a personal browser session.

## Test TV Bro-specific UI

Run `pnpm dev`, sign in, and open Settings > Development. Turn on **Use TV
Bro-specific UI**, then open the library. The setting applies only to the
current browser and is available only in the development build. Turn it off to
return to the standard browser UI.

To test the TV Bro layout before signing in, configure a Chrome custom device
with the desired TV dimensions and prepend `TV Bro/1.0` to its user-agent
string. The development build recognizes that prefix, so the sign-in and device
sign-in pages can be tested without an authenticated session. Production still
requires TV Bro's native bridge.

The same settings section contains **Freeze usage** for local extraction
testing. It is enabled by default in development builds and skips Lynvo's
per-account daily and monthly usage counters for that browser; global capacity
and Plugin Server limits still apply. Turn it off when you need to test usage
accounting.

Public builds do not include the Development settings UI. A direct request to
`/settings/development` redirects to `/settings/general` instead.

## Preview the production bundle

Build the workspace, then serve the app's generated Worker locally with Vite's
preview server:

```sh
pnpm build
pnpm --filter @lynvo/app exec vite preview --host 127.0.0.1 --port 4173
```

The app package also has a `preview` script that builds only the app before
starting Vite. Keep the explicit commands above when the check needs the full
workspace build.

The preview uses local Worker bindings and `.dev.vars`. It does not deploy or
connect to production. Production bundles do not enable the `--no-auth`
development bypass, so use Google sign-in or an existing local session before
opening authenticated routes. Use one hostname consistently because a cookie
created for `localhost` is not sent to `127.0.0.1`, or vice versa. Use the
Chrome DevTools MCP against `http://127.0.0.1:4173` when checking route
transitions or hard reloads.

## Test without Google OAuth

Start the app with a fixed local development account when you need to test
without signing in through Google:

```sh
pnpm --filter @lynvo/app dev --no-auth
```

From the repository root, `pnpm dev --no-auth` is equivalent; the filtered
command above also works from any directory in the workspace.

Every request is signed in as a fixed local development user and session
backed by local D1. The mode is not specific to the TV Bro layout: the account
can use any authenticated surface, including saving real URLs, running
extraction through the managed Plugin Server, and changing settings. Combine
it with the `TV Bro/1.0` user-agent prefix above to exercise the TV Bro
layout while signed in.

The mode does not disable CSRF checks, usage limits, Plugin Server limits, or
any other application behavior. The development launcher sets the local
`LYNVO_NO_AUTH` binding; production builds ignore the bypass. Each request
restores the fixed local user and session in D1, so this mode cannot test
signed-out behavior or the Google OAuth flow.

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

The checks cover formatting, lint, unused-code detection in both default and
production modes (knip), type generation and typechecking, browser tests,
Worker tests, builds, and the standalone generated Plugin Server smoke test.
`pnpm build` produces dry-run artifacts; it does not deploy them.

Knip scans generated shadcn UI files for unused files while ignoring export
noise inside them. Vendored code stays outside its scope: `.repos/**` and
`tools/oxlint/anti-slop/**` belong to no Knip project. Resolve a finding in
vendored code by excluding it in configuration, never by editing the file.

Oxlint follows semver, but new rules arrive in minor versions, and warnings
fail by configuration. A dependency bump can therefore turn CI red with
findings the previous version could not see — treat that as stronger
analysis, not a broken upgrade, and fix the new findings in the bump PR.
Three surfaces Oxlint explicitly exempts from semver entirely are in use
here: JS plugins (the anti-slop rules), type-aware linting, and nursery
rules if ever enabled; their behavior may change in any release.

For a docs-only change, check changed repository links and run the affected
in-app documentation tests. Do not deploy as a verification step.
