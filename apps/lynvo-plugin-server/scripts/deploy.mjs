import { spawn } from "node:child_process"

const serviceVersion = process.env.SERVICE_VERSION?.trim()
const commitHash = process.env.COMMIT_HASH?.trim()
const missingVariables = [
  ["SERVICE_VERSION", serviceVersion],
  ["COMMIT_HASH", commitHash],
]
  .filter(([, value]) => !value)
  .map(([name]) => name)

if (missingVariables.length > 0) {
  throw new Error(
    `Managed Plugin Server deployment requires ${missingVariables.join(" and ")} to be set.`
  )
}

const wranglerCommand =
  process.platform === "win32" ? "wrangler.cmd" : "wrangler"
const child = spawn(
  wranglerCommand,
  [
    "deploy",
    "--config",
    "wrangler.jsonc",
    "--env=",
    "--var",
    `SERVICE_VERSION:${serviceVersion}`,
    "--var",
    `COMMIT_HASH:${commitHash}`,
  ],
  { shell: process.platform === "win32", stdio: "inherit" }
)

const exitCode = await new Promise((resolve) => {
  child.once("error", (error) => {
    console.error(error)
    resolve(1)
  })
  child.once("exit", (code, signal) => {
    if (signal) {
      console.error(`Wrangler exited after receiving ${signal}.`)
      resolve(1)
      return
    }

    resolve(code ?? 1)
  })
})

process.exitCode = exitCode
