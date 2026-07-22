# Lynvo

Lynvo turns supported source pages and direct media URLs into organized,
playable links that can be saved and opened again later.

## What Lynvo does

- Extracts playable files from supported OneDrive and Google Drive index deployments.
- Accepts direct media URLs without sending them through an external extractor.
- Supports user-provided extractor Workers for additional sources.
- Saves Recent Links with source identity, playable items, and playback state.
- Resolves folders and lazy items progressively instead of loading an entire source at once.
- Sends playback to connected devices and supported players.

## Extractors

Lynvo’s official sources run in a private, separately deployed extractor
service. User-provided extractors use the same versioned protocol over HTTPS.
This keeps source-specific parsing outside the main application while giving
every extractor the same request, response, metadata, and error contract.

Direct links remain inside Lynvo and do not cross the extractor boundary.

## Privacy and trust

Plugin Domain credentials are encrypted and used only on the server for the
selected extraction request. Extractor bearer secrets are never exposed to the
browser. Saved links retain the extractor identity needed for refresh and lazy
resolution without persisting extraction credentials.

## Project information

- [Contributing and operating Lynvo](CONTRIBUTING.md)
- [Extractor protocol](packages/extractor-protocol/README.md)
- [Usage-limit policy](docs/usage-limits.md)
- [Project terminology](CONTEXT.md)
