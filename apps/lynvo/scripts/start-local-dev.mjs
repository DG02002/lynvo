import { spawn, spawnSync } from "node:child_process"

const disableUsageLimitsFlag = "--no-usage"

const quoteShellArgument = (argument) =>
  `'${argument.replaceAll("'", "'\\''")}'`

const developmentArguments = process.argv.slice(2)
const disableUsageLimits = developmentArguments.includes(disableUsageLimitsFlag)
const reactRouterArguments = developmentArguments
  .filter((argument) => argument !== disableUsageLimitsFlag)
  .map(quoteShellArgument)

const usageEnvironmentResult = spawnSync(
  "pnpm",
  [
    "exec",
    "convex",
    "env",
    "set",
    "DISABLE_USAGE_LIMITS",
    String(disableUsageLimits),
  ],
  { stdio: "inherit" }
)

if (usageEnvironmentResult.status !== 0) {
  process.exitCode = usageEnvironmentResult.status ?? 1
  process.exit()
}
const reactRouterCommand = [
  "node scripts/prepare-local-dev-vars.mjs",
  "&&",
  "CLOUDFLARE_ENV=local react-router dev",
  ...reactRouterArguments,
].join(" ")

const convexProcess = spawn(
  "pnpm",
  ["exec", "convex", "dev", "--start", reactRouterCommand],
  { stdio: "inherit" }
)

convexProcess.on("exit", (exitCode, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exitCode = exitCode ?? 1
})
