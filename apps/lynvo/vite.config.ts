import { reactRouter } from "@react-router/dev/vite"
import { cloudflare } from "@cloudflare/vite-plugin"
import mdx from "@mdx-js/rollup"
import rehypeShikiFromHighlighter from "@shikijs/rehype/core"
import { transformerMetaHighlight } from "@shikijs/transformers"
import tailwindcss from "@tailwindcss/vite"
import remarkGfm from "remark-gfm"
import remarkFrontmatter from "remark-frontmatter"
import remarkMdxFrontmatter from "remark-mdx-frontmatter"
import { createHighlighterCore } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"
import { defineConfig, type ViteDevServer } from "vite"
import { exec, execFileSync } from "node:child_process"
import { statSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

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

const docsRaw = () => ({
  name: "docs-raw",
  enforce: "pre" as const,
  resolveId(source: string, importer: string | undefined) {
    if (!importer) {
      return
    }

    const query = ["?docs-raw", "?docs-last-modified"].find((candidate) =>
      source.endsWith(candidate)
    )
    if (!query) {
      return
    }

    const sourcePath = source.slice(0, -query.length)
    const filePath = sourcePath.startsWith("/")
      ? sourcePath
      : resolve(dirname(importer), sourcePath)

    return `\0${query.slice(1)}:${filePath}`
  },
  async load(id: string) {
    if (id.startsWith("\0docs-last-modified:")) {
      const filePath = id.slice("\0docs-last-modified:".length)
      let lastModified = ""

      try {
        lastModified = execFileSync(
          "git",
          ["log", "-1", "--format=%cs", "--", filePath],
          {
            cwd: dirname(filePath),
            encoding: "utf8",
          }
        ).trim()
      } catch {
        // Git metadata may not be available in packaged build environments.
      }

      if (!lastModified) {
        lastModified = statSync(filePath).mtime.toISOString().slice(0, 10)
      }

      return `export default ${JSON.stringify(lastModified)}`
    }

    if (!id.startsWith("\0docs-raw:")) {
      return
    }

    const content = await readFile(id.slice("\0docs-raw:".length), "utf8")
    return `export default ${JSON.stringify(content)}`
  },
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
    docsRaw(),
    {
      ...mdx({
        remarkPlugins: [
          remarkGfm,
          remarkFrontmatter,
          [remarkMdxFrontmatter, { name: "frontmatter" }],
        ],
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
