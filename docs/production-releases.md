# Production releases

Lynvo uses GitHub Actions as the single production deployment authority. A
push to `main` must pass the read-only `Verify` workflow before the exact
verified commit can enter the `production` GitHub Environment.

The deployment first applies pending D1 migrations to the production
database. It then deploys `lynvo-plugin-server` followed by `lynvo`,
applying any Durable Object migrations. If release verification fails,
the workflow rolls the deployments back.

## Version identities

The application and Plugin Server start at independent SemVer versions:

- `lynvo`: `0.1.0`
- `lynvo-plugin-server`: `0.1.0`

Each CI deployment appends the verified commit as SemVer build metadata, for
example `0.1.0+439b561abc12`. Cloudflare separately assigns an immutable Worker
version ID. The shared protocol package has its own version because it is a
published compatibility contract; it does not need to match either service.

Increment a service's package version in the pull request when its public
behavior changes. Use patch versions for compatible fixes, minor versions for
compatible features, and major versions for incompatible behavior. Protocol
breaking changes require a new supported protocol version and a compatibility
migration before either service is promoted.

## Required one-time setup

Create a Cloudflare API token scoped to the one Cloudflare account with the
`Workers Scripts: Edit` and `D1: Edit` permissions. Do not use a global API key.

Create a GitHub Environment named `production`, then add these environment
secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Configure Google OAuth credentials for sign-in and register the production
callback URI (`https://lynvo.dg02002.workers.dev/api/auth/callback/google`)
in the Google Cloud console. The remaining Worker secrets
(`PLUGIN_CREDENTIAL_ENCRYPTION_KEY`, `LYNVO_PLUGIN_SERVER_API_KEY`) stay in
Cloudflare and are inherited by new versions.

Protect `main` and require the `Verify / verify` status check before merging.
Disable direct pushes and require pull requests. Optionally require an approver
on the `production` Environment if every release needs a manual gate.

Cloudflare Worker secrets remain configured in Cloudflare and are inherited by
new versions. They must not be copied into GitHub unless a workflow actually
needs their plaintext value.

## Normal workflow

1. Create a branch and commit changes.
2. Open a pull request. `Verify` rejects unformatted, unlinted, mistyped,
   failing, or unbuildable changes without access to deployment credentials.
3. Merge only after `Verify / verify` passes.
4. GitHub uploads and promotes both Worker versions. No local deployment is
   required.

## D1 schema and data migrations

Schema changes are versioned SQL files under `apps/lynvo/migrations/`, applied
by CI through `wrangler d1 migrations apply DB --remote` before any new Worker
version is promoted.

Use an expand-and-contract migration:

1. Ship additive columns or tables first; deployed code ignores them until it
   is updated.
2. Deploy the Worker version that reads and writes the new shape.
3. In a later release, remove compatibility code once no active version needs
   the old representation.

D1 provides Time Travel point-in-time recovery (7 days on the free tier) as
the rollback story for data; Worker versions roll back independently through
the Cloudflare dashboard or `wrangler rollback`. Before a destructive or
unusually large migration, export the database and rehearse against a scratch
D1 database first.

Do not run local production deploys during ordinary development, because that
bypasses the verified commit and coordinated release sequence.

## Caching policy

CI uses pnpm's content-addressed dependency cache, while the lockfile remains
the source of truth. Production API responses are not globally cached by the
release workflow. The Plugin Server uses authorization and user-specific usage
state, and Cloudflare normally bypasses shared caching for authorized requests.
Static assets can use Cloudflare's asset caching independently. Add runtime
caching only endpoint by endpoint with explicit cache keys and invalidation;
the Cache API is data-center-local and is not a durable coordination store.

## npm package releases

npm package publication is independent from production application deployment.
Version changes are reviewed in pull requests, then an immutable tag starts the
trusted-publishing workflow:

- `protocol-v0.1.3` publishes
  `@dg02002/lynvo-plugin-server-protocol@0.1.3`.
- `creator-v0.1.1` publishes `create-lynvo-plugin-server@0.1.1`.

The tag version must match the package manifest. The workflow rebuilds and
rechecks the complete workspace, refuses an existing npm version, and publishes
from a GitHub-hosted runner using npm OIDC provenance. Dependency installation,
tests, builds, and packing run without OIDC permission. A separate minimal job
receives the packed artifact and obtains OIDC only after the `npm` Environment
gate. Configure both packages on npmjs.com with `publish-npm.yml` as their
trusted GitHub publisher, the `npm` environment, and the `npm publish` action.
No `NPM_TOKEN` is stored in GitHub.

Install the Socket Security GitHub App for this repository and require `Socket
Security: Pull Request Alerts` on `main`. The root `socket.yml` keeps pull
request alerts, dependency reports, comments, and check runs enabled. Review
Socket ignores like code changes; do not use `ignore-all` to make a blocked
dependency update mergeable.
