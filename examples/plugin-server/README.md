# Example Lynvo Extractor Worker

This is the minimal tested implementation of a Lynvo-compatible extractor. It
is intentionally independent of the official OneDrive and Bhadoo source code.

```sh
pnpm --filter @lynvo/example-plugin-server check
pnpm --filter @lynvo/example-plugin-server test
pnpm --filter @lynvo/example-plugin-server build
```

Read the package-owned documentation before adapting the example:

1. [Protocol specification](../../packages/plugin-server-protocol/docs/spec.md)
2. [Extractor author guide](../../packages/plugin-server-protocol/docs/author-guide.md)
3. [Compatibility checklist](../../packages/plugin-server-protocol/docs/compatibility-checklist.md)
4. [Metadata flow](../../packages/plugin-server-protocol/docs/metadata-flow.md)
