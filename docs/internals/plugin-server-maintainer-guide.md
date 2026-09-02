# Plugin Server maintainer guide

This guide is for maintainers working on the Lynvo monorepo. It covers the
managed Worker, protocol compatibility, standalone consumers, and package
contents.

The public how-to for creating, testing, deploying, and connecting a
Lynvo-compatible Plugin Server lives in the app's in-app docs at
`/docs/plugin-server`. Its source is under
[`apps/lynvo/app/features/site/docs/plugin-server/`](../../apps/lynvo/app/features/site/docs/plugin-server/).
Use that guide for the standalone author workflow. This file is not a second
copy of those steps.

## Repository boundary

Plugin Servers are independently deployed HTTPS Workers. Lynvo owns
registration, credential storage, routing, response validation, Saved link
state, player selection, and link launching. A Plugin Server owns Source
matching, extraction, staged lazy resolution, its bearer secret, finite usage
accounting, and deployment.

The public contract lives in
[`packages/plugin-server-protocol/docs/spec.md`](../../packages/plugin-server-protocol/docs/spec.md).
The package docs explain the technical contract. The in-app docs explain the
supported author workflow. Keep those roles separate.

## Protocol and package versions

The manifest wire protocol is currently v1:

```json
{ "protocolVersion": "1.0" }
```

The npm package follows semver independently. Inside this monorepo, use
`workspace:*` so local changes are tested together. Standalone projects must
use the published `@dg02002/lynvo-plugin-server-protocol` package with a
semver version. Never carry `workspace:`, `link:`, or a relative Lynvo path into
an external project.

Upgrade the protocol package and manifest protocol version deliberately. An
incompatible manifest should be rejected as a protocol mismatch instead of
being silently interpreted.

## Maintain the packages

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @dg02002/lynvo-plugin-server-protocol check
pnpm --filter create-lynvo-plugin-server check
pnpm check:plugin-server-release
```

The starter template lives at
[`packages/create-lynvo-plugin-server/template/`](../../packages/create-lynvo-plugin-server/template/).
Keep it minimal and independent of Lynvo application services. The generated
project uses the published protocol package; only this monorepo uses
`workspace:*`.

`pnpm check:plugin-server-release` packs both public packages, generates a
standalone project, replaces its protocol dependency with the packed package,
and runs the generated project's checks, tests, and build.

Package tags and publication are covered in the
[release and deployment runbook](../operations/release.md#published-package-releases).

## External compatibility consumer

`plnk-plugin-server` is maintained outside this repository and exercises the
public protocol package. After a protocol release, its dependency must be a
published semver range, not `link:../lynvo/packages/plugin-server-protocol`.
Run its typecheck and tests from its own directory after installing the
published package.

## Troubleshooting

- `PROTOCOL_MISMATCH`: compare the Worker manifest, package version, and
  `/manifest` response with the protocol specification.
- `AUTH_INVALID`: confirm the secret in Wrangler matches the registered bearer
  credential. Do not put it in a URL or browser code.
- `UNSUPPORTED_URL`: update the manifest matcher and Plugin metadata together,
  then rerun contract tests.
- A generated project installs a local package: inspect `package.json` for
  `workspace:`, `link:`, `file:`, or a relative Lynvo path and regenerate from
  the published creator package.
