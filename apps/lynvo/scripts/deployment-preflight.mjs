import { readFile } from "node:fs/promises"

const lynvoConfigPath = process.argv[2]
  ? new URL(`file://${process.argv[2]}`)
  : new URL("../wrangler.jsonc", import.meta.url)

const lynvoConfig = await readFile(lynvoConfigPath, "utf8")

const requiredLynvoFragments = [
  '"workers_dev": true',
  '"ENVIRONMENT": "production"',
  '"binding": "DB"',
  '"database_name": "lynvo-db"',
  '"name": "AUTH_RATE_LIMITER"',
  '"name": "PLUGIN_SERVER_CREDENTIAL_VAULT"',
  '"name": "USER_REALTIME_ROOM"',
  '"binding": "LYNVO_PLUGIN_SERVER"',
  '"service": "lynvo-plugin-server"',
  '"GOOGLE_CLIENT_ID"',
  '"GOOGLE_CLIENT_SECRET"',
  '"PLUGIN_CREDENTIAL_ENCRYPTION_KEY"',
  '"MANAGED_PLUGIN_SERVER_API_KEY"',
]

const hasMissingFragment = (config, requiredFragments) =>
  requiredFragments.some((fragment) => !config.includes(fragment))
const hasPlaceholder = (config) =>
  /REPLACE_WITH_|00000000-0000-0000-0000-000000000000|00000000000000000000000000000000/.test(
    config
  )
const dbBindingCount = lynvoConfig.split('"binding": "DB"').length - 1
const doBindingCount = (bindingName) =>
  lynvoConfig.split(`"name": "${bindingName}"`).length - 1
const commitHash = process.env.COMMIT_HASH
const serviceVersion = process.env.SERVICE_VERSION
const hasValidReleaseIdentity =
  Boolean(commitHash) &&
  commitHash !== "unknown" &&
  Boolean(serviceVersion) &&
  serviceVersion !== "0.1.0" &&
  serviceVersion !== "unknown"

if (
  hasMissingFragment(lynvoConfig, requiredLynvoFragments) ||
  hasPlaceholder(lynvoConfig) ||
  dbBindingCount !== 2 ||
  doBindingCount("AUTH_RATE_LIMITER") !== 2 ||
  doBindingCount("PLUGIN_SERVER_CREDENTIAL_VAULT") !== 2 ||
  doBindingCount("USER_REALTIME_ROOM") !== 2 ||
  !hasValidReleaseIdentity
) {
  throw new Error("Production deployment configuration preflight failed.")
}
