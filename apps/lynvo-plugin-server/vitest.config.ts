import { cloudflareTest } from "@cloudflare/vitest-pool-workers"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          PLUGIN_SERVER_AUTH_KEY: "test-api-key",
        },
      },
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
  },
})
