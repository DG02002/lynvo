# create-lynvo-plugin-server

Create a standalone Cloudflare Worker that implements Lynvo Plugin Server
Protocol v1:

```sh
pnpm create lynvo-plugin-server@latest my-plugin-server
```

The creator contains the canonical Worker-first Hono template. It does not
depend on the Lynvo application or on a local Lynvo checkout. The generated
project consumes the published `@lynvo/plugin-server-protocol` package.

Options:

- `--skip-install` or `--no-install` generates files without installing dependencies.
- `--force` permits overwriting generated files in a non-empty directory.
- `--help` prints command usage.

The generated project includes:

- Hono route wiring through `createPluginServerRuntime`.
- Cloudflare Worker and Wrangler configuration.
- A small example Plugin and source extraction function.
- Contract tests for the manifest, authentication, usage, and extraction routes.
- A blank `.dev.vars.example` showing the local secret name without credentials.

The protocol package owns the wire contract. The generated project owns source
matching, extraction logic, usage accounting, secrets, and deployment.

See the [protocol specification](https://github.com/DG02002/lynvo/blob/main/packages/plugin-server-protocol/docs/spec.md),
[author guide](https://github.com/DG02002/lynvo/blob/main/packages/plugin-server-protocol/docs/author-guide.md),
and [compatibility checklist](https://github.com/DG02002/lynvo/blob/main/packages/plugin-server-protocol/docs/compatibility-checklist.md).
