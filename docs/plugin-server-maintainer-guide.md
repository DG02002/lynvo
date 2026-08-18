# Internal Plugin Server maintainer guide

This guide is for Lynvo maintainers working in this repository. It covers
monorepo development, protocol compatibility, external consumers, and package
release work.

The public how-to for creating, testing, deploying, and connecting a
Lynvo-compatible Plugin Server lives in the in-app docs at
`/docs/plugin-server`. Its source is under
`apps/lynvo/app/features/site/docs/plugin-server/`. Use that guide for the
standalone author workflow; this file is not a second copy of those steps.

## Repository boundary

Lynvo Plugin Servers are independently deployed HTTPS Workers. Lynvo owns
registration, credential storage, routing, response validation, saved-link
state, player selection, and link launching. Lynvo’s opened markers record only
that an item was opened; Lynvo does not store playback positions or resume
state. A Plugin Server owns source matching, extraction, staged lazy resolution,
its bearer secret, finite usage accounting, and deployment.

The public protocol contract lives in
`packages/plugin-server-protocol/docs/spec.md`. The package author guide and
the public in-app docs serve different audiences: the package docs explain the
technical contract, while the in-app docs explain the supported author
workflow.

## Protocol and package versions

The manifest wire protocol is currently v1:

```json
{ "protocolVersion": "1.0" }
```

The npm package follows semver independently. Use a compatible published
version in standalone projects. Inside this monorepo, use `workspace:*` so the
application and internal package tests exercise the same source. Never carry
`workspace:`, `link:`, or a relative Lynvo path into an external project.

Upgrade the protocol package and the manifest protocol version deliberately;
an incompatible manifest should be rejected as a protocol mismatch rather than
silently interpreted.

## Maintain the monorepo packages

From the `lynvo/` repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @dg02002/lynvo-plugin-server-protocol check
pnpm --filter create-lynvo-plugin-server check
pnpm check:plugin-server-release
```

The canonical starter template lives at
`packages/create-lynvo-plugin-server/template/`. Keep it minimal and
independent of Lynvo application services. The generated project uses the
published protocol package; only this monorepo uses `workspace:*`.

## External compatibility consumer

`plnk-plugin-server` is maintained outside this repository and exercises the
public protocol package. After a protocol release, its dependency should be a
published semver range, not `link:../lynvo/packages/plugin-server-protocol`.
Run its typecheck and tests from its own directory after installing the
published package.

## Automated package release

Do not publish until the npm account, scope, license, repository URL, and
maintainer details are confirmed. Configure `publish-npm.yml` as the trusted
GitHub publisher for both npm packages, restrict it to the `npm` GitHub
Environment, and allow `npm publish`.

```sh
pnpm --filter @dg02002/lynvo-plugin-server-protocol release:check
pnpm --filter @dg02002/lynvo-plugin-server-protocol pack --dry-run

pnpm --filter create-lynvo-plugin-server check
pnpm --filter create-lynvo-plugin-server pack --dry-run
```

Publish the protocol package first. Generated projects depend on that
published semver version. Keep npm two-factor authentication enabled and
credentials out of the repository. GitHub publishes through npm trusted
publishing and does not use a long-lived npm token.

After the version bump is reviewed and merged, tag the exact commit:

```sh
git tag protocol-v0.1.3
git push origin protocol-v0.1.3
```

or:

```sh
git tag creator-v0.1.1
git push origin creator-v0.1.1
```

The tag version must exactly match the selected package's `package.json`.
The tagged commit must already be part of `main`.

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
