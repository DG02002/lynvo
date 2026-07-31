# Example Lynvo Plugin Server

This is the minimal tested implementation of a Lynvo-compatible Plugin Server.
It is intentionally independent of Lynvo's official Plugins.

```sh
pnpm --filter @lynvo/example-plugin-server check
pnpm --filter @lynvo/example-plugin-server test
pnpm --filter @lynvo/example-plugin-server build
```

Read the package-owned documentation before adapting the example:

1. [Protocol specification](../../packages/plugin-server-protocol/docs/spec.md)
2. [Plugin Server author guide](../../packages/plugin-server-protocol/docs/author-guide.md)
3. [Compatibility checklist](../../packages/plugin-server-protocol/docs/compatibility-checklist.md)
4. [Metadata flow](../../packages/plugin-server-protocol/docs/metadata-flow.md)
