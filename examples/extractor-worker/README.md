# Example Lynvo Extractor Worker

This is the minimal tested implementation of a Lynvo-compatible extractor. It
is intentionally independent of the official OneDrive and Bhadoo source code.

```sh
pnpm --filter @lynvo/example-extractor-worker check
pnpm --filter @lynvo/example-extractor-worker test
pnpm --filter @lynvo/example-extractor-worker build
```

Read the package-owned documentation before adapting the example:

1. [Protocol specification](../../packages/extractor-protocol/docs/spec.md)
2. [Extractor author guide](../../packages/extractor-protocol/docs/author-guide.md)
3. [Compatibility checklist](../../packages/extractor-protocol/docs/compatibility-checklist.md)
4. [Metadata flow](../../packages/extractor-protocol/docs/metadata-flow.md)
