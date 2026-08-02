import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const GENERATED_OR_IMMUTABLE_PATHS = new Set([
  "apps/lynvo/worker-configuration.d.ts",
  "apps/lynvo-plugin-server/worker-configuration.d.ts",
  "scripts/check-plugin-server-terminology.mjs",
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

const files = execFileSync(
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

const failures = []

for (const path of files) {
  const lines = readFileSync(path, "utf8").split("\n")
  for (const [lineIndex, line] of lines.entries()) {
    if (FORBIDDEN_TERMS.some((pattern) => pattern.test(line))) {
      failures.push(`${path}:${lineIndex + 1}:${line.trim()}`)
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exitCode = 1
} else {
  console.log("Plugin Server terminology check passed")
}
