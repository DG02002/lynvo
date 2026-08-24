import { spawn, spawnSync } from "node:child_process"

const quoteShellArgument = (argument) =>
  `'${argument.replaceAll("'", "'\\''")}'`

const rawArguments = process.argv.slice(2)
const isNoUsageEnabled =
  rawArguments.includes("--no-usage") ||
  rawArguments.includes("--disable-usage")
const filteredArguments = rawArguments.filter(
  (argument) => argument !== "--no-usage" && argument !== "--disable-usage"
)

const reactRouterArguments = filteredArguments.map(quoteShellArgument)

const reactRouterCommand = ["react-router dev", ...reactRouterArguments].join(
  " "
)

const environmentPrefix = isNoUsageEnabled
  ? "CLOUDFLARE_ENV=local DISABLE_USAGE_LIMITS=true"
  : "CLOUDFLARE_ENV=local"

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
