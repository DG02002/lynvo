import { reactRouter } from "@react-router/dev/vite"
import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, type ViteDevServer } from "vite"
import { exec } from "node:child_process"

function wranglerTypesWatcher() {
  return {
    name: "wrangler-types-watcher",
    configureServer(server: ViteDevServer) {
      server.watcher.add("wrangler.jsonc")
      server.watcher.on("change", (path: string) => {
        if (path.endsWith("wrangler.jsonc")) {
          console.log("wrangler.jsonc changed, running wrangler types...")
          exec("pnpm run cf-typegen", (err, stdout, stderr) => {
            if (err) {
              console.error("Error running wrangler types:", stderr)
            } else {
              console.log("Worker types updated.")
            }
          })
        }
      })
    },
  }
}

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    wranglerTypesWatcher(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
  ],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
