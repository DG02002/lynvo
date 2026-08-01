# @lynvo/plugin-server-protocol

Shared protocol package for Lynvo-compatible Custom Plugin Servers.

It provides:

- protocol schemas and TypeScript interfaces
- `createPluginServerRuntime` for Plugin Server route behavior
- URL matcher helpers
- optional standardized source discovery
- Lynvo source metadata helpers
- protocol error/request builders
- canonical contract parsers and diagnostic validation helpers
- mandatory finite usage schemas and authenticated runtime handling

Custom Plugin Servers in this workspace can import this local package instead of copying Lynvo schemas. It is private and does not require npm publishing.

Documentation:

- [Protocol specification](docs/spec.md)
- [Plugin Server author guide](docs/author-guide.md)
- [Compatibility checklist](docs/compatibility-checklist.md)
- [Metadata flow](docs/metadata-flow.md)

See [`examples/plugin-server`](../../examples/plugin-server/) for the
minimal tested workspace implementation.

Contract helpers:

- `validatePluginServerManifestContract(value)`
- `validateExtractSuccessContract(value)`
- `validateUsageContract(value)`
- `parsePluginServerManifestContract(value)`
- `parseExtractSuccessContract(value)`
- `parseUsageResponseContract(value)`

Use the typed `parse*Contract` helpers at runtime: an accepted value is
available as `.value`, while a rejected value includes detailed `.issues`.
Use the `validate*Contract` helpers for diagnostics and contract-test
assertions. The exported structural schemas are for narrow decoding or
display-only paths, not for accepting live Plugin Server responses.
