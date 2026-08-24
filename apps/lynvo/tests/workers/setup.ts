import { applyD1Migrations } from "cloudflare:test"
import { env } from "cloudflare:workers"

await applyD1Migrations(
  env.DB,
  // SAFETY: The Workers test pool injects TEST_MIGRATIONS into its generated environment.
  (env as { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS
)
