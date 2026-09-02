# Release and deployment

GitHub Actions is the production deployment path. A push to `main` runs the
read-only verification job first. The production job enters the `production`
GitHub Environment only after verification succeeds.

The deployment applies pending D1 migrations, deploys the managed Plugin
Server, deploys Lynvo, verifies the expected release identity and homepage, and
rolls back Worker versions when post-promotion verification fails. Database
migrations are not rolled back automatically with Worker code.

## Version identities

The application and managed Plugin Server have independent semver versions in
their package manifests. The shared protocol package has its own version
because it is a published compatibility contract.

The production workflow appends the verified commit hash as build metadata to
each service version. Cloudflare also assigns an immutable Worker version ID.
Read the package manifests and generated release identity at release time;
do not hard-code current version numbers in this guide.

Increment a service's package version in the pull request when its public
behavior changes. Use patch versions for compatible fixes, minor versions for
compatible features, and major versions for incompatible behavior. Protocol
breaking changes require a new supported protocol version and a compatibility
migration before either service is promoted.

## Required one-time setup

Create a Cloudflare API token scoped to the Lynvo Cloudflare account with the
permissions required by Workers and D1. Do not use a global API key.

Create a GitHub Environment named `production` and add these environment
secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Register the production Google OAuth callback:

```text
https://lynvo.dg02002.workers.dev/api/auth/callback/google
```

Keep Worker-only secrets in Cloudflare. The application Worker requires
`PLUGIN_CREDENTIAL_ENCRYPTION_KEY`, `MANAGED_PLUGIN_SERVER_API_KEY`, and
`TMDB_API_READ_ACCESS_TOKEN`. The managed Plugin Server requires
`PLUGIN_SERVER_AUTH_KEY`; its value must match the application's managed
Plugin Server key. Never copy a secret into the repository or GitHub unless a
workflow genuinely needs its plaintext value.

Protect `main`, require pull requests, and require the successful
`Verify / Repository verification` check before merging. Configure an
approver for the `production` Environment when a manual release gate is
needed. These GitHub settings are external to this repository and must be
checked in the GitHub UI.

## Normal production workflow

1. Create a focused branch and pull request.
2. Wait for `Verify` to pass on the pull request.
3. Merge the pull request into `main`.
4. Let the `Verify` workflow build and upload the verified artifacts.
5. Let `Deploy production` apply migrations and deploy both Workers.
6. Check the release identity endpoint and the homepage health check in the
   workflow output.

Do not deploy from a laptop during ordinary development. A local deployment
can bypass the verified commit and the coordinated Worker order.

The workflow files are [`verify.yml`](../../.github/workflows/verify.yml) and
[`release.yml`](../../.github/workflows/release.yml). The product deployment
is in `verify.yml`; `release.yml` creates a named GitHub Release only.

## Worker deployment order

The production job uses this order:

1. verify the production configuration and release identity
2. download the artifacts built from the verified commit
3. apply pending D1 migrations remotely
4. deploy `lynvo-plugin-server`
5. deploy `lynvo`
6. verify the expected commit, service version, deployment ID, and homepage
7. roll back Worker versions if post-promotion verification fails

Preserve this order when changing the workflow. Lynvo must not serve code that
expects a migration or Plugin Server change that has not landed yet.

## GitHub product releases

Production deploys happen for every verified merge to `main`. A GitHub Release
is a separate named milestone created from a stable tag on a verified commit.

Use a `vX.Y.Z` tag for a Lynvo product release. The release workflow accepts
stable `v*.*.*` tags, verifies that the tagged commit is already on `main`, and
generates release notes from merged pull requests using
[`.github/release.yml`](../../.github/release.yml).

There are no scheduled or nightly product releases. The hosted web app is
already deployed from verified `main` commits.

The generated release notes are not a committed `CHANGELOG.md` and are not the
in-app changelog. The protocol package keeps its own hand-maintained changelog
because that file ships in the npm package.

## D1 and Durable Object changes

Schema changes are SQL files under `apps/lynvo/migrations/`. CI applies them
with `wrangler d1 migrations apply DB --remote` before promoting a new Worker
version.

Use an expand-and-contract migration:

1. Add new tables or columns while the current Worker still works.
2. Deploy code that reads and writes the new shape.
3. Remove compatibility code only after no active Worker version needs it.

Test destructive or unusually large migrations against a scratch database and
take a recoverable database backup first. D1 data recovery and Worker code
rollback are separate operations. Use the Cloudflare D1 recovery tools for
data and the recorded Worker version for code.

Durable Object class changes are deployment changes. Keep Wrangler migrations
intact and review class additions, deletions, and state assumptions with the
same care as a schema migration.

## Cloudflare deployment strategy

The Workers in this repository use Durable Objects, so do not introduce a
gradual deployment or preview strategy without a compatibility plan for D1,
Durable Object state, Worker protocols, and server-rendered assets.

Runtime caching is not a general coordination mechanism. Add caching endpoint
by endpoint with an explicit key, ownership, and invalidation rule. Do not use
the Cache API as durable application state.

## Cloudflare build projects

Connect the repository to two separate Cloudflare Worker projects. Configure
each project with the directory that owns its Wrangler configuration:

| Worker project | Root directory | Deploy command |
| --- | --- | --- |
| Lynvo | `/apps/lynvo` | `pnpm deploy` |
| Lynvo Plugin Server | `/apps/lynvo-plugin-server` | `pnpm deploy` |

Keep the Workers as separate build targets even though they share one
repository. Include `packages/plugin-server-protocol/**`, the root lockfile,
and workspace configuration in both projects' build watch paths. Protocol or
dependency changes can affect either Worker.

The workspace intentionally uses pnpm recursive scripts instead of Turborepo.
Add a task orchestrator only after measured build times justify its caching and
additional configuration.

## Published package releases

Package publication is independent from product deployment. Use these tags:

- `protocol-vX.Y.Z` for `@dg02002/lynvo-plugin-server-protocol`
- `creator-vX.Y.Z` for `create-lynvo-plugin-server`

The tag version must match the selected package manifest and must already be
on `main`. `publish-npm.yml` rebuilds and checks the workspace, packs the
selected package, verifies its checksum, and publishes through npm trusted
publishing with provenance in the `npm` GitHub Environment. It then creates a
package-specific GitHub Release.

Publish the protocol package before a creator release. Generated projects use
the published protocol package rather than a local workspace path.
