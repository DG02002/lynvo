# Production releases

Lynvo uses GitHub Actions as the single production deployment authority. A
push to `main` must pass the read-only `Verify` workflow before the exact
verified commit can enter the `production` GitHub Environment.

The deployment first pushes backward-compatible Convex functions and schema,
runs the reviewed data migrations, and verifies their invariants. It then
uploads inactive Cloudflare versions for both Workers before it changes
production traffic. It promotes `lynvo-plugin-server` followed by `lynvo`. If
Lynvo promotion fails, the workflow rolls the Plugin Server back to its
preceding deployment.

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
`Workers Scripts: Edit` permission. Do not use a global API key.

Create a GitHub Environment named `production`, then add these environment
secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CONVEX_DEPLOY_KEY`
- `CONVEX_MIGRATION_KEY`

Create `CONVEX_DEPLOY_KEY` for the production Convex deployment with only
`deployment:deploy`. Create a separate `CONVEX_MIGRATION_KEY` scoped to the
same deployment with only `deployment:data:write`,
`deployment:functions:runInternalMutations`, and
`deployment:functions:runInternalQueries`. Keeping these keys separate prevents
the normal code-deployment credential from invoking data mutations.

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

## Convex schema and data migrations

Convex code and schema deploy before the Workers. Every Convex change must be
compatible with the currently deployed Workers because Convex becomes live as
soon as its deploy succeeds.

Use an expand-and-contract migration:

1. Add the new field as optional and deploy code that understands old and new
   records.
2. Define a resumable migration in `convex/migrations.ts` and add it to the
   explicit `runProduction` sequence.
3. Add an internal verification query that proves the migration invariant.
4. Let CI run and verify the migration before promoting either Worker.
5. In a later release, make the field required and remove compatibility code.

Never combine adding a required field, backfilling it, and removing the old
representation in one release. Convex data is not rolled back when a Worker is
rolled back. Before a destructive or unusually large migration, create a
Convex backup and rehearse the migration against a separate preview or staging
deployment.

Use the Cloudflare dashboard's deployment history for an emergency manual
rollback. Do not run local production deploys during ordinary development,
because that bypasses the verified commit and coordinated release sequence.

## Caching policy

CI uses pnpm's content-addressed dependency cache, while the lockfile remains
the source of truth. Production API responses are not globally cached by the
release workflow. The Plugin Server uses authorization and user-specific usage
state, and Cloudflare normally bypasses shared caching for authorized requests.
Static assets can use Cloudflare's asset caching independently. Add runtime
caching only endpoint by endpoint with explicit cache keys and invalidation;
the Cache API is data-center-local and is not a durable coordination store.
