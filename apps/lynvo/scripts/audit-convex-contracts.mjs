import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const CONVEX_DIRECTORY =
  process.env.CONVEX_CONTRACT_AUDIT_DIRECTORY ??
  fileURLToPath(new URL("../convex/", import.meta.url))
const DATABASE_CALL = /ctx\.db\.(?:get|patch|replace|delete)\(/g
const PUBLIC_FUNCTION =
  /export const (\w+) = (?:query|mutation|action)\(\{([\s\S]*?)(?=\nexport const |$)/g
const STRING_ID = /args:\s*\{[\s\S]*?\bid:\s*v\.string\(\)/g
const STRING_ID_ALLOWLIST = new Set([
  "convex/links.ts",
  "convex/pluginDomains.ts",
  "convex/userPluginServers.ts",
])

const listTypeScriptFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.name === "_generated") {
      return []
    }
    if (entry.isDirectory()) {
      return listTypeScriptFiles(path)
    }
    return entry.name.endsWith(".ts") ? [path] : []
  })

const failures = []
const schemaSource = readFileSync(join(CONVEX_DIRECTORY, "schema.ts"), "utf8")
const ownershipSource = readFileSync(
  join(CONVEX_DIRECTORY, "accountDataOwnership.ts"),
  "utf8"
)
const schemaTables = new Set(
  Array.from(
    schemaSource.matchAll(/^\s+(\w+): defineTable/gm),
    (match) => match[1]
  )
)
const classifiedTables = new Set(
  Array.from(ownershipSource.matchAll(/"(\w+)"/g), (match) => match[1])
)

for (const tableName of schemaTables) {
  if (!classifiedTables.has(tableName)) {
    failures.push(
      `convex/schema.ts: unclassified account data table ${tableName}`
    )
  }
}
for (const tableName of classifiedTables) {
  if (!schemaTables.has(tableName)) {
    failures.push(
      `convex/accountDataOwnership.ts: unknown classified table ${tableName}`
    )
  }
}

for (const file of listTypeScriptFiles(CONVEX_DIRECTORY)) {
  if (!statSync(file).isFile()) {
    continue
  }
  const source = readFileSync(file, "utf8")
  const displayPath = `convex/${relative(CONVEX_DIRECTORY, file)}`

  for (const match of source.matchAll(DATABASE_CALL)) {
    const firstArgument = source
      .slice((match.index ?? 0) + match[0].length)
      .trimStart()
    if (!firstArgument.startsWith('"') && !firstArgument.startsWith("'")) {
      failures.push(
        `${displayPath}: legacy database call near offset ${match.index}`
      )
    }
  }

  for (const match of source.matchAll(PUBLIC_FUNCTION)) {
    if (!/\bargs\s*:/.test(match[2])) {
      failures.push(`${displayPath}:${match[1]} is missing args validation`)
    }
    if (!/\breturns\s*:/.test(match[2])) {
      failures.push(`${displayPath}:${match[1]} is missing return validation`)
    }
  }

  if (STRING_ID.test(source) && !STRING_ID_ALLOWLIST.has(displayPath)) {
    failures.push(`${displayPath}: unexplained string document-id boundary`)
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exitCode = 1
} else {
  console.log("Convex contract audit passed")
}
