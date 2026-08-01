# @dg02002/lynvo-plugin-server-protocol

Public protocol package for Lynvo-compatible Custom Plugin Servers.

It provides:

- protocol schemas and TypeScript interfaces
- `createPluginServerRuntime` for Plugin Server route behavior
- URL matcher helpers
- optional standardized source discovery
- Lynvo source metadata helpers
- protocol error/request builders
- canonical contract parsers and diagnostic validation helpers
- mandatory finite usage schemas and authenticated runtime handling

The package is the canonical versioned contract for standalone Plugin Servers.
It is framework-agnostic and can run in Cloudflare Workers or another runtime
that provides the web platform APIs used by the runtime helper.

For the fastest standalone setup, use the published starter:

```sh
pnpm create lynvo-plugin-server@latest my-plugin-server
```

Inside the Lynvo monorepo, keep using the workspace protocol so local changes
are tested together:

```json
{
  "@dg02002/lynvo-plugin-server-protocol": "workspace:*"
}
```

Outside the monorepo, install a published semver version instead:

```sh
pnpm add @dg02002/lynvo-plugin-server-protocol
```

Do not use `workspace:`, `link:`, or a relative Lynvo path in a standalone
Plugin Server.

Documentation:

- [Protocol specification](docs/spec.md)
- [Plugin Server author guide](docs/author-guide.md)
- [Compatibility checklist](docs/compatibility-checklist.md)
- [Metadata flow](docs/metadata-flow.md)

See [`examples/plugin-server`](https://github.com/DG02002/lynvo/tree/main/examples/plugin-server)
for the minimal tested workspace implementation, or inspect the canonical
starter template in [`create-lynvo-plugin-server`](https://github.com/DG02002/lynvo/tree/main/packages/create-lynvo-plugin-server/template).

The package follows semver for its JavaScript API. Protocol compatibility is
declared separately by the manifest's `protocolVersion` field; the current
protocol is v1 (`"1.0"`). Keep the protocol package and the manifest version
compatible when upgrading a deployed Worker.

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

## License

This package is licensed under the MIT License. See [LICENSE](LICENSE).
