import { spawn, spawnSync } from "node:child_process"

const quoteShellArgument = (argument) =>
  `'${argument.replaceAll("'", "'\\''")}'`

const rawArguments = process.argv.slice(2)
const isNoUsageEnabled =
  rawArguments.includes("--no-usage") ||
  rawArguments.includes("--disable-usage")
const isNoAuthEnabled = rawArguments.includes("--no-auth")
const filteredArguments = rawArguments.filter(
  (argument) =>
    argument !== "--no-usage" &&
    argument !== "--disable-usage" &&
    argument !== "--no-auth"
)

const reactRouterArguments = filteredArguments.map(quoteShellArgument)

const reactRouterCommand = ["react-router dev", ...reactRouterArguments].join(
  " "
)

const environmentPrefix = [
  "CLOUDFLARE_ENV=local",
  ...(isNoUsageEnabled ? ["DISABLE_USAGE_LIMITS=true"] : []),
  ...(isNoAuthEnabled ? ["LYNVO_NO_AUTH=true"] : []),
].join(" ")

const migrationProcess = spawnSync(
  "pnpm",
  [
    "exec",
    "wrangler",
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--env",
    "local",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, CI: "1" },
  }
)

if (migrationProcess.status !== 0) {
  process.exitCode = migrationProcess.status ?? 1
} else {
  const devProcess = spawn(`${environmentPrefix} ${reactRouterCommand}`, {
    stdio: "inherit",
    shell: true,
  })

  devProcess.on("exit", (exitCode, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exitCode = exitCode ?? 1
  })
}
