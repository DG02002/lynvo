import { exec, execFileSync } from "node:child_process"
import { statSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

import { cloudflare } from "@cloudflare/vite-plugin"
import mdx from "@mdx-js/rollup"
import { reactRouter } from "@react-router/dev/vite"
import rehypeShikiFromHighlighter from "@shikijs/rehype/core"
import { transformerMetaHighlight } from "@shikijs/transformers"
import tailwindcss from "@tailwindcss/vite"
import { Result, Schema } from "effect"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkMdxFrontmatter from "remark-mdx-frontmatter"
import { createHighlighterCore } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"
import { defineConfig, type Plugin, type ViteDevServer } from "vite"
import { parse as parseYaml } from "yaml"

// Copy the launcher flag into the Worker binding; app code reads only env.LYNVO_NO_AUTH.
const developmentAuthBypass = process.env.LYNVO_NO_AUTH === "true"
const documentationFrontmatterSchema = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  navLabel: Schema.String,
  contentType: Schema.Literals([
    "Tutorial",
    "How-to",
    "Reference",
    "Conceptual",
  ]),
})

const loadDocumentationFrontmatter = async (
  filePath: string,
  addWatchFile: (filePath: string) => void
) => {
  addWatchFile(filePath)
  const content = await readFile(filePath, "utf8")
  const frontmatterMatch = content.match(
    /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
  )

  if (!frontmatterMatch) {
    throw new Error(`Documentation frontmatter is missing: ${filePath}`)
  }

  const parsedFrontmatter = parseYaml(frontmatterMatch[1])
  const frontmatter = Schema.decodeUnknownResult(
    documentationFrontmatterSchema
  )(parsedFrontmatter)

  if (Result.isFailure(frontmatter)) {
    throw new Error(`Documentation frontmatter is invalid: ${filePath}`)
  }

  return `export default ${JSON.stringify(frontmatter.success)}`
}

const loadDocumentationLastModified = (
  filePath: string,
  addWatchFile: (filePath: string) => void
) => {
  addWatchFile(filePath)
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

const loadRawDocumentation = async (
  filePath: string,
  addWatchFile: (filePath: string) => void
) => {
  addWatchFile(filePath)
  const content = await readFile(filePath, "utf8")
  return `export default ${JSON.stringify(content)}`
}

const docsHighlighter = await createHighlighterCore({
  themes: [
    import("@shikijs/themes/github-light-default"),
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

const docsRaw = (): Plugin => ({
  name: "docs-raw",
  enforce: "pre" as const,
  resolveId(source: string, importer: string | undefined) {
    if (!importer) {
      return undefined
    }

    const query = [
      "?docs-raw",
      "?docs-last-modified",
      "?docs-frontmatter",
    ].find((candidate) => source.endsWith(candidate))
    if (!query) {
      return undefined
    }

    const sourcePath = source.slice(0, -query.length)
    const filePath = sourcePath.startsWith("/")
      ? sourcePath
      : resolve(dirname(importer), sourcePath)

    return `\0${query.slice(1)}:${filePath}`
  },
  load(id: string) {
    if (id.startsWith("\0docs-frontmatter:")) {
      return loadDocumentationFrontmatter(
        id.slice("\0docs-frontmatter:".length),
        (filePath) => this.addWatchFile(filePath)
      )
    }

    if (id.startsWith("\0docs-last-modified:")) {
      return loadDocumentationLastModified(
        id.slice("\0docs-last-modified:".length),
        (filePath) => this.addWatchFile(filePath)
      )
    }

    return id.startsWith("\0docs-raw:")
      ? loadRawDocumentation(id.slice("\0docs-raw:".length), (filePath) =>
          this.addWatchFile(filePath)
        )
      : undefined
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
          exec("pnpm run cf-typegen", (err, _stdout, stderr) => {
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
  // Lazy routes, always-mounted providers, and deferred UI reach these packages
  // through separate entry paths. Pre-bundle them up front so Vite does not
  // change the module graph mid-session or duplicate React during hydration.
  optimizeDeps: {
    include: [
      "@base-ui/react/*",
      "@hugeicons/core-free-icons",
      "@hugeicons/react",
      "@shikijs/langs/json",
      "@shikijs/themes/github-dark",
      "@shikijs/themes/github-light-default",
      "@tanstack/react-form",
      "class-variance-authority",
      "effect",
      "lucide-react",
      "shiki/core",
      "shiki/engine/javascript",
    ],
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
                light: "github-light-default",
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
      config: (config) => ({
        vars: {
          ...config.vars,
          LYNVO_NO_AUTH: developmentAuthBypass ? "true" : "false",
        },
      }),
      viteEnvironment: { name: "ssr" },
      auxiliaryWorkers: [
        {
          configPath: "../lynvo-plugin-server/wrangler.jsonc",
        },
      ],
    }),
    tailwindcss(),
    reactRouter(),
  ],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    "process.env.DISABLE_USAGE_LIMITS": JSON.stringify(
      process.env.DISABLE_USAGE_LIMITS ?? ""
    ),
  },
})
