import { cloudflareTest } from "@cloudflare/vitest-pool-workers"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          LYNVO_PLUGIN_SERVER_API_KEY: "test-api-key",
        },
      },
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
  },
})
