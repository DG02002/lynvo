import { reactRouter } from "@react-router/dev/vite"
import { cloudflare } from "@cloudflare/vite-plugin"
import mdx from "@mdx-js/rollup"
import rehypeShikiFromHighlighter from "@shikijs/rehype/core"
import { transformerMetaHighlight } from "@shikijs/transformers"
import tailwindcss from "@tailwindcss/vite"
import remarkGfm from "remark-gfm"
import { createHighlighterCore } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"
import { defineConfig, type ViteDevServer } from "vite"
import { exec } from "node:child_process"

const docsHighlighter = await createHighlighterCore({
  themes: [
    import("@shikijs/themes/github-light"),
    import("@shikijs/themes/github-dark"),
  ],
  langs: [
    import("@shikijs/langs/typescript"),
    import("@shikijs/langs/json"),
    import("@shikijs/langs/jsonc"),
    import("@shikijs/langs/shellscript"),
    import("@shikijs/langs/dotenv"),
  ],
  engine: createJavaScriptRegexEngine(),
})

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
    {
      enforce: "pre",
      ...mdx({
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          [
            rehypeShikiFromHighlighter,
            docsHighlighter,
            {
              themes: {
                light: "github-light",
                dark: "github-dark",
              },
              transformers: [transformerMetaHighlight()],
            },
          ],
        ],
      }),
    },
    wranglerTypesWatcher(),
    cloudflare({
      viteEnvironment: { name: "ssr" },
      auxiliaryWorkers: [
        {
          configPath: "../official-extractor/wrangler.jsonc",
        },
      ],
    }),
    tailwindcss(),
    reactRouter(),
  ],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
