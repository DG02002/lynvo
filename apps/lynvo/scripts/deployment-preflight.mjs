import { readFile } from "node:fs/promises"

const lynvoConfigPath = process.argv[2]
  ? new URL(`file://${process.argv[2]}`)
  : new URL("../wrangler.jsonc", import.meta.url)
const officialConfigPath = process.argv[3]
  ? new URL(`file://${process.argv[3]}`)
  : new URL("../../lynvo-plugin-server/wrangler.jsonc", import.meta.url)

const [lynvoConfig, officialConfig] = await Promise.all([
  readFile(lynvoConfigPath, "utf8"),
  readFile(officialConfigPath, "utf8"),
])

const requiredLynvoFragments = [
  '"workers_dev": true',
  '"ENVIRONMENT": "production"',
  '"TURNSTILE_SITE_KEY": "0x4AAAAAAEC1SvszqvkGdIr2"',
  '"name": "AUTH_RATE_LIMITER"',
  '"name": "WORKER_AUTH_SESSION"',
  '"name": "EXTERNAL_WORKER_CREDENTIAL_VAULT"',
  '"name": "USER_REALTIME_ROOM"',
  '"binding": "LYNVO_PLUGIN_SERVER"',
  '"service": "lynvo-plugin-server"',
  '"VITE_CONVEX_URL"',
  '"AUTH_GATEWAY_SECRET"',
  '"AUTH_SESSION_MASTER_KEY"',
  '"TURNSTILE_SECRET_KEY"',
  '"PLUGIN_CREDENTIAL_MASTER_KEY"',
  '"LYNVO_PLUGIN_SERVER_API_KEY"',
]
const requiredOfficialFragments = [
  '"name": "lynvo-plugin-server"',
  '"workers_dev": false',
  '"name": "LYNVO_PLUGIN_SERVER_USAGE_LIMITER"',
  '"PUBLIC_ASSET_ORIGIN": "https://lynvo.dg02002.workers.dev/lynvo-plugin-server-assets"',
  '"LYNVO_PLUGIN_SERVER_API_KEY"',
]

const hasMissingFragment = (config, requiredFragments) =>
  requiredFragments.some((fragment) => !config.includes(fragment))
const hasPlaceholder = (config) =>
  /REPLACE_WITH_|00000000000000000000000000000000/.test(config)
const limiterBindingCount =
  lynvoConfig.split('"name": "AUTH_RATE_LIMITER"').length - 1
const sessionBindingCount =
  lynvoConfig.split('"name": "WORKER_AUTH_SESSION"').length - 1
const credentialVaultBindingCount =
  lynvoConfig.split('"name": "EXTERNAL_WORKER_CREDENTIAL_VAULT"').length - 1
const sessionKeyDeclarationCount =
  lynvoConfig.split('"AUTH_SESSION_MASTER_KEY"').length - 1

if (
  hasMissingFragment(lynvoConfig, requiredLynvoFragments) ||
  hasMissingFragment(officialConfig, requiredOfficialFragments) ||
  hasPlaceholder(lynvoConfig) ||
  hasPlaceholder(officialConfig) ||
  limiterBindingCount !== 2 ||
  sessionBindingCount !== 2 ||
  credentialVaultBindingCount !== 2 ||
  sessionKeyDeclarationCount !== 2
) {
  throw new Error("Production deployment configuration preflight failed.")
}
