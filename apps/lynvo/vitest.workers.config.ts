import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers"
import path from "node:path"
import { defineConfig } from "vitest/config"

const WORKER_TEST_TIMEOUT_MS = 15_000

const migrations = await readD1Migrations(
  path.join(import.meta.dirname, "migrations")
)

export default defineConfig({
  resolve: {
    alias: {
      "~": path.resolve(import.meta.dirname, "app"),
      "virtual:react-router/server-build": path.resolve(
        import.meta.dirname,
        "tests/workers/empty-server-build.ts"
      ),
    },
  },
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: "2026-08-08",
        compatibilityFlags: ["nodejs_compat"],
        d1Databases: ["DB"],
        bindings: { TEST_MIGRATIONS: migrations },
      },
    }),
  ],
  test: {
    include: ["tests/workers/**/*.test.ts"],
    setupFiles: ["./tests/workers/setup.ts"],
    testTimeout: WORKER_TEST_TIMEOUT_MS,
  },
})
