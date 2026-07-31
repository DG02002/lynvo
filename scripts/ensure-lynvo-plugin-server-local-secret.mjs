import { randomBytes } from "node:crypto"
import { chmod, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const SECRET_NAME = "LYNVO_PLUGIN_SERVER_API_KEY"
const secretFiles = [
  resolve("apps/lynvo/.dev.vars"),
  resolve("apps/lynvo-plugin-server/.dev.vars"),
]

const readSecretFile = async (path) => {
  try {
    return await readFile(path, "utf8")
  } catch (error) {
    if (error?.code === "ENOENT") return ""
    throw error
  }
}

const readSecretValue = (contents) =>
  contents
    .split(/\r?\n/)
    .find((line) => line.startsWith(`${SECRET_NAME}=`))
    ?.slice(SECRET_NAME.length + 1)

const contents = await Promise.all(secretFiles.map(readSecretFile))
const existingValues = contents.map(readSecretValue).filter(Boolean)
const distinctValues = new Set(existingValues)

if (distinctValues.size > 1) {
  throw new Error(`${SECRET_NAME} differs between local Worker secret files.`)
}

const secret = existingValues[0] ?? randomBytes(32).toString("base64url")

await Promise.all(
  secretFiles.map(async (path, index) => {
    if (!readSecretValue(contents[index])) {
      const prefix = contents[index].length
        ? contents[index].endsWith("\n")
          ? contents[index]
          : `${contents[index]}\n`
        : ""
      await writeFile(path, `${prefix}${SECRET_NAME}=${secret}\n`, {
        encoding: "utf8",
        mode: 0o600,
      })
    }
    await chmod(path, 0o600)
  })
)

console.log(`${SECRET_NAME} is configured for both local Workers.`)
