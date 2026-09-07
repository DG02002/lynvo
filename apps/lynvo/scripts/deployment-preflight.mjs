import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const args = process.argv.slice(2).filter((argument) => argument !== "--")
const isGeneratedConfig = args.includes("--generated")
const configArgument = args.find((argument) => argument !== "--generated")
const lynvoConfigPath = configArgument
  ? pathToFileURL(resolve(configArgument))
  : pathToFileURL(fileURLToPath(new URL("../wrangler.jsonc", import.meta.url)))

const lynvoConfig = await readFile(lynvoConfigPath, "utf8")

const requiredLynvoChecks = [
  ["workers_dev must be enabled", /"workers_dev"\s*:\s*true/],
  ["production environment variable", /"ENVIRONMENT"\s*:\s*"production"/],
  ["D1 database binding", /"binding"\s*:\s*"DB"/],
  ["Lynvo database name", /"database_name"\s*:\s*"lynvo-db"/],
  ["Auth rate limiter binding", /"name"\s*:\s*"AUTH_RATE_LIMITER"/],
  [
    "Plugin Server credential vault binding",
    /"name"\s*:\s*"PLUGIN_SERVER_CREDENTIAL_VAULT"/,
  ],
  ["User realtime room binding", /"name"\s*:\s*"USER_REALTIME_ROOM"/],
  [
    "managed Plugin Server service binding",
    /"binding"\s*:\s*"LYNVO_PLUGIN_SERVER"/,
  ],
  [
    "managed Plugin Server service name",
    /"service"\s*:\s*"lynvo-plugin-server"/,
  ],
  ["Google client ID secret", /"GOOGLE_CLIENT_ID"/],
  ["Google client secret", /"GOOGLE_CLIENT_SECRET"/],
  [
    "Plugin credential encryption key secret",
    /"PLUGIN_CREDENTIAL_ENCRYPTION_KEY"/,
  ],
  ["managed Plugin Server API key secret", /"MANAGED_PLUGIN_SERVER_API_KEY"/],
]

const hasPlaceholder = (config) =>
  /REPLACE_WITH_|00000000-0000-0000-0000-000000000000|00000000000000000000000000000000/.test(
    config
  )
const countMatches = (config, pattern) => config.match(pattern)?.length ?? 0
const expectedBindingCount = isGeneratedConfig ? 1 : 2
const bindingChecks = [
  ["D1 database binding", /"binding"\s*:\s*"DB"/g],
  ["Auth rate limiter binding", /"name"\s*:\s*"AUTH_RATE_LIMITER"/g],
  [
    "Plugin Server credential vault binding",
    /"name"\s*:\s*"PLUGIN_SERVER_CREDENTIAL_VAULT"/g,
  ],
  ["User realtime room binding", /"name"\s*:\s*"USER_REALTIME_ROOM"/g],
]
const failures = requiredLynvoChecks
  .filter(([, pattern]) => !pattern.test(lynvoConfig))
  .map(([description]) => `missing ${description}`)

if (hasPlaceholder(lynvoConfig)) {
  failures.push("contains a placeholder production binding")
}

for (const [description, pattern] of bindingChecks) {
  const count = countMatches(lynvoConfig, pattern)
  if (count !== expectedBindingCount) {
    failures.push(
      `${description} appears ${count} time${count === 1 ? "" : "s"}; expected ${expectedBindingCount}`
    )
  }
}

const commitHash = process.env.COMMIT_HASH?.trim()
const serviceVersion = process.env.SERVICE_VERSION?.trim()
if (!commitHash || commitHash === "unknown") {
  failures.push("COMMIT_HASH must identify the release commit")
}
if (
  !serviceVersion ||
  serviceVersion === "0.1.0" ||
  serviceVersion === "unknown"
) {
  failures.push("SERVICE_VERSION must identify the release version")
}

if (failures.length > 0) {
  throw new Error(
    [
      "Production deployment configuration preflight failed:",
      ...failures.map((failure) => `- ${failure}`),
    ].join("\n")
  )
}
