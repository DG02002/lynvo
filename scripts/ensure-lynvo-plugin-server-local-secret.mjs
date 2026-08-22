import { randomBytes } from "node:crypto"
import { chmod, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const secretConfigs = [
  {
    path: resolve("apps/lynvo/.dev.vars"),
    secretName: "MANAGED_PLUGIN_SERVER_API_KEY",
  },
  {
    path: resolve("apps/lynvo-plugin-server/.dev.vars"),
    secretName: "PLUGIN_SERVER_AUTH_KEY",
  },
]

const readSecretFile = async (path) => {
  try {
    return await readFile(path, "utf8")
  } catch (error) {
    if (error?.code === "ENOENT") {
      return ""
    }
    throw error
  }
}

const readSecretValue = (contents, secretName) =>
  contents
    .split(/\r?\n/)
    .find((line) => line.startsWith(`${secretName}=`))
    ?.slice(secretName.length + 1)

const contents = await Promise.all(
  secretConfigs.map((config) => readSecretFile(config.path))
)
const existingValues = secretConfigs
  .map((config, index) => readSecretValue(contents[index], config.secretName))
  .filter(Boolean)
const distinctValues = new Set(existingValues)

if (distinctValues.size > 1) {
  throw new Error(
    "Plugin server API key differs between local Worker secret files."
  )
}

const secret = existingValues[0] ?? randomBytes(32).toString("base64url")

await Promise.all(
  secretConfigs.map(async (config, index) => {
    if (!readSecretValue(contents[index], config.secretName)) {
      const prefix = contents[index].length
        ? contents[index].endsWith("\n")
          ? contents[index]
          : `${contents[index]}\n`
        : ""
      await writeFile(
        config.path,
        `${prefix}${config.secretName}=${secret}\n`,
        {
          encoding: "utf8",
          mode: 0o600,
        }
      )
    }
    await chmod(config.path, 0o600)
  })
)

console.log("Plugin server secret is configured for both local Workers.")
