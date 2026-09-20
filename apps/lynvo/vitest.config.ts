import { resolve } from "path"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", ".repos", "tests/workers"],
  },
  resolve: {
    alias: {
      "~": resolve(import.meta.dirname, "./app"),
      "~shared": resolve(import.meta.dirname, "./shared"),
    },
  },
})
