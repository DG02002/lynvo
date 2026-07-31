# Lynvo

Lynvo turns supported source pages and direct media URLs into organized,
playable links that can be saved and opened again later.

## What Lynvo does

- Extracts playable files from supported OneDrive and Google Drive index deployments.
- Accepts direct media URLs through Lynvo's Direct Media Adapter.
- Supports Custom Plugin Servers for additional Sources.
- Saves Recent Links with source identity, playable items, and playback state.
- Resolves folders and lazy items progressively instead of loading an entire source at once.
- Sends playback to connected devices and supported players.

## Plugin Servers

Lynvo Plugins run in the private, separately deployed Lynvo Plugin
Server. Custom Plugin Servers use the same versioned protocol over HTTPS.
This keeps source-specific parsing outside the main application while giving
every Plugin Server the same request, response, metadata, and error contract.

Direct links remain inside Lynvo and use the final Direct Media Adapter fallback.

## Privacy and trust

Plugin Domain credentials are encrypted and used only on the server for the
selected extraction request. Plugin Server bearer secrets are never exposed to the
browser. Saved links retain the Plugin Server identity needed for refresh and lazy
resolution without persisting extraction credentials.

## Project information

- [Contributing and operating Lynvo](CONTRIBUTING.md)
- [Plugin Server Protocol](packages/plugin-server-protocol/README.md)
- [Usage-limit policy](docs/usage-limits.md)
- [Project terminology](CONTEXT.md)
