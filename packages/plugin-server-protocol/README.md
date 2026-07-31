# @lynvo/plugin-server-protocol

Shared protocol package for Lynvo-compatible Custom Plugin Servers.

It provides:

- protocol schemas and TypeScript interfaces
- `createPluginServerRuntime` for Plugin Server route behavior
- URL matcher helpers
- optional standardized source discovery
- Lynvo source metadata helpers
- protocol error/request builders
- contract validation helpers for Custom Plugin Server tests
- mandatory finite usage schemas and authenticated runtime handling

Custom Plugin Servers in this workspace can import this local package instead of copying Lynvo schemas. It is private and does not require npm publishing.

Documentation:

- [Protocol specification](docs/spec.md)
- [Plugin Server author guide](docs/author-guide.md)
- [Compatibility checklist](docs/compatibility-checklist.md)
- [Metadata flow](docs/metadata-flow.md)

See [`examples/plugin-server`](../../examples/plugin-server/) for the
minimal tested workspace implementation.

Useful test helpers:

- `validatePluginServerManifestContract(value)`
- `validateExtractSuccessContract(value)`
- `validateUsageContract(value)`
