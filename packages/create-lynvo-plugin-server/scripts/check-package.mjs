import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const packageJson = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8")
)
const failures = []

const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

assert(packageJson.private !== true, "package must not be private")
assert(
  packageJson.bin?.["create-lynvo-plugin-server"] ===
    "bin/create-lynvo-plugin-server.mjs",
  "bin entry must point to the CLI"
)
assert(
  packageJson.publishConfig?.access === "public",
  "publish access must be public"
)
assert(
  /^\d+\.\d+\.\d+$/.test(packageJson.lynvo?.protocolPackageVersion ?? ""),
  "lynvo.protocolPackageVersion must be a concrete semver version"
)
const protocolPackageJson = JSON.parse(
  readFileSync(
    join(packageRoot, "..", "plugin-server-protocol", "package.json"),
    "utf8"
  )
)
assert(
  packageJson.lynvo.protocolPackageVersion === protocolPackageJson.version,
  "lynvo.protocolPackageVersion must match @dg02002/lynvo-plugin-server-protocol"
)

const requiredFiles = [
  "bin/create-lynvo-plugin-server.mjs",
  "template/package.json",
  "template/src/index.ts",
  "template/tests/contract.test.ts",
  "template/pnpm-workspace.yaml",
  "template/gitignore",
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

for (const path of walk(join(packageRoot, "template"))) {
  const content = readFileSync(path, "utf8")
  const relativePath = relative(packageRoot, path)
  assert(
    !/\b(?:workspace:|link:|catalog:)/.test(content),
    `${relativePath} has a local dependency protocol`
  )
  assert(
    !/(?:\.dev\.vars$|\.env(?:\.|$)|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY)/i.test(
      relativePath
    ),
    `${relativePath} is a private file`
  )
  assert(
    !/LYNVO_PLUGIN_SERVER_API_KEY\s*=\s*[^\s#]+/.test(content),
    `${relativePath} contains a credential value`
  )
}

const cli = readFileSync(
  join(packageRoot, "bin/create-lynvo-plugin-server.mjs"),
  "utf8"
)
assert(cli.startsWith("#!/usr/bin/env node"), "CLI must have a Node shebang")
assert(
  !/from ["']\.\/|import\(["']\.\//.test(cli),
  "CLI must not depend on source-only relative modules"
)

if (failures.length > 0) {
  console.error("Creator package check failed:")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Creator package ${packageJson.name}@${packageJson.version} is publish-ready.`
)
