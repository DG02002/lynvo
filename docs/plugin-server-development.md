# Plugin Server development and release

Lynvo Plugin Servers are independently deployed HTTPS Workers. Lynvo owns
registration, credential storage, routing, response validation, saved state,
and playback. A Plugin Server owns source matching, extraction, staged lazy
resolution, its bearer secret, finite usage accounting, and deployment.

## Start a standalone Plugin Server

Use the published creator from a directory outside the Lynvo repository:

```sh
pnpm create lynvo-plugin-server@latest my-plugin-server
cd my-plugin-server
pnpm test
pnpm build
```

The generated project uses Hono, Cloudflare Workers, Wrangler, Vitest, and the
published `@dg02002/lynvo-plugin-server-protocol` package. Copy `.dev.vars.example` to
`.dev.vars`, set a local-only `LYNVO_PLUGIN_SERVER_API_KEY`, and run `pnpm dev`
before connecting a deployed Worker to Lynvo.

## Protocol and package versions

The manifest wire protocol is currently v1:

```json
{ "protocolVersion": "1.0" }
```

The npm package follows semver independently. Use a compatible published
version in standalone projects. Inside this monorepo, use `workspace:*` so
the application and examples exercise the same source. Never carry
`workspace:`, `link:`, or a relative Lynvo path into an external project.

Upgrade the protocol package and the manifest protocol version deliberately;
an incompatible manifest should be rejected as a protocol mismatch rather
than silently interpreted.

## Local monorepo development

From the `lynvo/` repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @dg02002/lynvo-plugin-server-protocol check
pnpm --filter @lynvo/example-plugin-server check
pnpm --filter @lynvo/example-plugin-server test
pnpm --filter create-lynvo-plugin-server check
pnpm check:plugin-server-release
```

The canonical starter template lives at
`packages/create-lynvo-plugin-server/template/`. Keep it minimal and
independent of Lynvo application services. The workspace example is a test
fixture; it may continue to use the workspace protocol.

## External compatibility consumer

`plnk-plugin-server` is maintained outside this repository and exercises the
public protocol package. After a protocol release, its dependency should be a
published semver range, not `link:../lynvo/packages/plugin-server-protocol`.
Run its typecheck and tests from its own directory after installing the
published package.

## Manual first release

Do not publish until the npm account, scope, license, repository URL, and
maintainer details are confirmed. The packages are configured for public
scoped/unscoped publishing and run release checks before packing.

```sh
pnpm --filter @dg02002/lynvo-plugin-server-protocol release:check
pnpm --filter @dg02002/lynvo-plugin-server-protocol pack --dry-run
pnpm --filter @dg02002/lynvo-plugin-server-protocol publish --access public

pnpm --filter create-lynvo-plugin-server check
pnpm --filter create-lynvo-plugin-server pack --dry-run
pnpm --filter create-lynvo-plugin-server publish --access public
```

Publish the protocol package first. The creator's generated projects depend on
that published semver version. Keep npm 2FA enabled and credentials out of
the repository. Publication is manual for now; add npm trusted publishing
later when the project needs an automated release workflow.

## Troubleshooting

- `PROTOCOL_MISMATCH`: check the Worker manifest's `protocolVersion`, package
  version, and `/manifest` response against the protocol specification.
- `AUTH_INVALID`: confirm the secret stored in Wrangler matches the bearer
  credential registered in Lynvo; do not put it in a URL or browser code.
- `UNSUPPORTED_URL`: update the Worker manifest matcher and the Plugin metadata
  together, then rerun contract tests.
- Generated project installs a local package: inspect `package.json` for
  `workspace:`, `link:`, `file:`, or a relative Lynvo path and regenerate from
  the published creator package.
