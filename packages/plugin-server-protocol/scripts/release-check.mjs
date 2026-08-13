import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const packageJsonPath = join(packageRoot, "package.json")
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))

const failures = []

const assert = (condition, message) => {
  if (!condition) {
    failures.push(message)
  }
}

assert(packageJson.private !== true, "package must not be private")
assert(
  packageJson.main === "./dist/index.js",
  "main must point to dist/index.js"
)
assert(
  packageJson.types === "./dist/index.d.ts",
  "types must point to dist/index.d.ts"
)
assert(
  packageJson.exports?.["."]?.import === "./dist/index.js",
  "exports.import must point to dist/index.js"
)
assert(
  packageJson.exports?.["."]?.types === "./dist/index.d.ts",
  "exports.types must point to dist/index.d.ts"
)
assert(
  packageJson.publishConfig?.access === "public",
  "publish access must be public"
)
assert(packageJson.files?.includes("dist"), "package files must include dist")
assert(packageJson.files?.includes("docs"), "package files must include docs")
assert(
  packageJson.files?.includes("LICENSE"),
  "package files must include LICENSE"
)

for (const [section, dependencies] of Object.entries(packageJson)) {
  if (!section.endsWith("Dependencies") || !dependencies) {
    continue
  }
  for (const [name, version] of Object.entries(dependencies)) {
    assert(
      !/^(workspace:|link:|file:(?:\.\.?[/\\]|[/\\]))/.test(String(version)),
      `${section}.${name} must not use a local dependency: ${version}`
    )
  }
}

const requiredFiles = [
  "dist/index.js",
  "dist/index.d.ts",
  "README.md",
  "LICENSE",
]
for (const path of requiredFiles) {
  assert(
    statSync(join(packageRoot, path), { throwIfNoEntry: false }),
    `${path} is missing`
  )
}

const walk = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })

const distFiles = walk(join(packageRoot, "dist"))
for (const path of distFiles) {
  if (path.endsWith(".map")) {
    continue
  }
  const content = readFileSync(path, "utf8")
  const relativePath = relative(packageRoot, path)
  assert(
    !/(?:workspace:|link:|file:(?:\.\.?[/\\]|[/\\]))/.test(content),
    `${relativePath} contains a local dependency reference`
  )
  assert(
    !/(?:\.dev\.vars|\.env(?:\.|$)|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY)/i.test(
      content
    ),
    `${relativePath} contains a credential or environment-file marker`
  )

  for (const match of content.matchAll(
    /(?:from\s+|import\s*\()(["'])(\.[^"']+)\1/g
  )) {
    const specifier = match[2]
    assert(
      specifier.endsWith(".js"),
      `${relativePath} contains a source-only relative import: ${specifier}`
    )
  }
}

let dryRun
try {
  dryRun = execFileSync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    { cwd: packageRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  )
} catch (error) {
  failures.push(`npm pack --dry-run failed: ${error.message}`)
}

if (dryRun) {
  try {
    const result = JSON.parse(dryRun)
    const files = result[0]?.files?.map(({ path }) => path) ?? []
    const allowed = /^(?:package\.json|README\.md|LICENSE|dist\/|docs\/)/
    for (const path of files) {
      assert(allowed.test(path), `unexpected file in package: ${path}`)
      assert(
        !/(?:\.dev\.vars|\.env(?:\.|$)|node_modules|src\/|scripts\/)/i.test(
          path
        ),
        `private or source file would enter package: ${path}`
      )
    }
  } catch (error) {
    failures.push(`could not parse npm pack --dry-run output: ${error.message}`)
  }
}

if (failures.length > 0) {
  console.error("Protocol package release check failed:")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log(
  `Protocol package ${packageJson.name}@${packageJson.version} is publish-ready.`
)
