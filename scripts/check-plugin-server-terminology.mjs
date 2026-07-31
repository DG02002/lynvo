import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"

const GENERATED_OR_IMMUTABLE_PATHS = new Set([
  "apps/lynvo/worker-configuration.d.ts",
  "apps/lynvo-plugin-server/worker-configuration.d.ts",
  "scripts/check-plugin-server-terminology.mjs",
  "docs/POLICY-WRITING-FINDINGS.md",
])
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".wrangler",
  "coverage",
  "dist",
  "node_modules",
])

const TEXT_FILE_PATTERN =
  /\.(?:cjs|css|html|js|json|jsonc|md|mdx|mjs|ts|tsx|yaml|yml)$/
const FORBIDDEN_TERMS = [
  /\bexternal extractors?\b/i,
  /\bofficial extractors?\b/i,
  /\bextractor workers?\b/i,
  /\bextractors?\b/i,
  /extractor[-_]|[-_]extractor/i,
  /\buserWorkers\b/,
  /\bworkerId\b/,
  /\/api\/workers\b/,
  /\bofficial plugins?\b/i,
  /\bofficial sources?\b/i,
  /\bofficial workers?\b/i,
]

const lynvoFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" }
)
  .split("\0")
  .filter(Boolean)
  .filter(existsSync)
  .filter((path) => TEXT_FILE_PATTERN.test(path))
  .filter((path) => !path.startsWith("plans/"))
  .filter((path) => !GENERATED_OR_IMMUTABLE_PATHS.has(path))

const collectTextFiles = (directory, root = directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name)
        ? []
        : collectTextFiles(path, root)
    }
    return TEXT_FILE_PATTERN.test(entry.name)
      ? [{ path, displayPath: `../${relative(root, path)}` }]
      : []
  })

const plnkDirectory = "../plnk-plugin-server"
const plnkFiles = existsSync(plnkDirectory)
  ? collectTextFiles(plnkDirectory)
  : []
const files = [
  ...lynvoFiles.map((path) => ({ path, displayPath: path })),
  ...plnkFiles,
]

const failures = []

for (const { path, displayPath } of files) {
  const lines = readFileSync(path, "utf8").split("\n")
  for (const [lineIndex, line] of lines.entries()) {
    if (FORBIDDEN_TERMS.some((pattern) => pattern.test(line))) {
      failures.push(`${displayPath}:${lineIndex + 1}:${line.trim()}`)
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exitCode = 1
} else {
  console.log("Plugin Server terminology check passed")
}
