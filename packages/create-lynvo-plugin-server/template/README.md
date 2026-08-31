# **PROJECT_DISPLAY_NAME**

A standalone Cloudflare Worker for a Lynvo-compatible Custom Plugin Server.

This generated project owns the source-specific matcher, extraction logic,
usage accounting, secrets, and deployment. Lynvo owns the protocol contract,
registration, credential storage, response validation, player selection, and
link launching.

## Start locally

Install dependencies and create a local secret file:

```sh
pnpm install
cp .dev.vars.example .dev.vars
```

Set `LYNVO_PLUGIN_SERVER_API_KEY` in `.dev.vars` to a local-only value, then
run the quality gates:

```sh
pnpm check
pnpm test
pnpm build
pnpm dev
```

Register `http://localhost:8787` when Lynvo runs on the same machine. Use the
origin only, without `/manifest`. Lynvo permits local HTTP only for the exact
`localhost` hostname.

For a remote Lynvo instance, start an HTTPS tunnel from Wrangler's interactive
development server with the `t` shortcut, then verify its public origin:

```sh
curl https://your-tunnel.example/manifest
```

Keep the tunnel running while testing. If you later generate absolute manifest
URLs from the incoming request, account for TLS termination by honoring a
trusted `X-Forwarded-Proto: https` header or by configuring the public origin
explicitly. Do not hardcode a temporary tunnel hostname.

Deploy after configuring your Cloudflare account:

```sh
pnpm wrangler login
pnpm deploy
```

Register the deployed Worker URL and the same bearer secret in Lynvo. Never
send the secret to a browser or commit `.dev.vars`.

## Optimize Plugin icons

Place PNG or WebP Plugin icons in `public/icons/sources/`. The `pnpm build` and
`pnpm deploy` commands optimize them to WebP at up to 256 pixels per side. Run
`pnpm images:optimize` directly when you want to update the assets without a
deployment.

## Customize the example

Replace the example matcher in `src/index.ts` and the implementation in
`src/plugins/example.ts`. Keep every lazy node resolvable by this same Worker.
Use the shared runtime for `/manifest`, `/verify`, `/usage`, and `/extract`
instead of copying protocol validation into local route handlers.

Keep `matchStrategy: "static"` when the Plugin has known hosts or matchers. A
Plugin that can only identify support through a bounded capability probe may
use `matchStrategy: "probe"`, an empty `hosts` array, and no `matchers`. Probe
Plugins run as routing fallbacks and must not use wildcard matchers.

## Protocol references

- [Protocol specification](https://github.com/DG02002/lynvo/blob/main/packages/plugin-server-protocol/docs/spec.md)
- [Plugin Server author guide](https://github.com/DG02002/lynvo/blob/main/packages/plugin-server-protocol/docs/author-guide.md)
- [Compatibility checklist](https://github.com/DG02002/lynvo/blob/main/packages/plugin-server-protocol/docs/compatibility-checklist.md)

The generated project uses `@dg02002/lynvo-plugin-server-protocol` version
`__LYNVO_PROTOCOL_VERSION__`. Keep it on a compatible protocol version when
upgrading the Worker.

## License

The initial template files use the MIT License. See [LICENSE](LICENSE). You may
choose different terms for your own Plugin Server after generation.
