# Lynvo

Lynvo turns supported source pages and direct media URLs into organized,
playable links that can be saved and opened again later.

## What Lynvo does

- Extracts playable files from supported OneDrive and Google Drive index deployments.
- Accepts direct media URLs through Lynvo's Direct Media Adapter.
- Supports Custom Plugin Servers for additional Sources.
- Saves links with source identity, playable items, and playback state.
- Resolves folders and lazy items progressively instead of loading an entire source at once.
- Sends playback to connected devices and supported players.

## Plugin Servers

Lynvo Plugins run in the private, separately deployed Lynvo Plugin
Server. Custom Plugin Servers use the same versioned protocol over HTTPS.
This keeps source-specific parsing outside the main application while giving
every Plugin Server the same request, response, metadata, and error contract.

Direct links remain inside Lynvo and use the final Direct Media Adapter fallback.

Public instructions for creating, testing, deploying, and connecting an
independent Lynvo-compatible Plugin Server are rendered in Lynvo at
`/docs/plugin-server`. Their source is in
[`apps/lynvo/app/features/site/docs/plugin-server/`](apps/lynvo/app/features/site/docs/plugin-server/).
The versioned
[`@dg02002/lynvo-plugin-server-protocol`](packages/plugin-server-protocol/README.md)
package owns the shared wire contract. Maintainers working in this repository
can use the [internal Plugin Server maintainer guide](docs/plugin-server-maintainer-guide.md)
for monorepo, compatibility, and release work.

## Privacy and trust

Plugin Domain credentials are encrypted and used only on the server for the
selected extraction request. Plugin Server bearer secrets are never exposed to the
browser. Saved links retain the Plugin Server identity needed for refresh and lazy
resolution without persisting extraction credentials.

## Project information

- [Contributing and operating Lynvo](CONTRIBUTING.md)
- [Plugin Server Protocol](packages/plugin-server-protocol/README.md)
- [Plugin Server maintainer guide](docs/plugin-server-maintainer-guide.md)
- [Project terminology](CONTEXT.md)

## License

Lynvo core is licensed under the GNU Affero General Public License v3.0. The
publishable `@dg02002/lynvo-plugin-server-protocol` and
`create-lynvo-plugin-server` packages are MIT licensed independently; see the
`LICENSE` file in each package directory.
