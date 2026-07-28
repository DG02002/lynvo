import { spawn } from "node:child_process"

const quoteShellArgument = (argument) =>
  `'${argument.replaceAll("'", "'\\''")}'`

const reactRouterArguments = process.argv.slice(2).map(quoteShellArgument)
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
