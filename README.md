# Lynvo Workspace

Lynvo is a pnpm monorepo containing the web application, the private official
extractor Worker, the shared extractor protocol, and a minimal extractor
example.

## Packages

- `apps/lynvo`: Lynvo application and direct-link extraction core.
- `apps/official-extractor`: private OneDrive and Bhadoo extractor Worker.
- `packages/extractor-protocol`: shared schemas, runtime, and contract helpers.
- `examples/extractor-worker`: minimal compatible extractor Worker.

## Commands

Use the pnpm version pinned in `packageManager`.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm test
pnpm build
```

Deployment is intentionally separate. Deploy the official extractor before
Lynvo so the caller's Service Binding always has a live target.
