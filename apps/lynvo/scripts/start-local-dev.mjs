import { spawn, spawnSync } from "node:child_process"

import { assertLocalHttpOrigin } from "./local-origin.mjs"

const DEFAULT_APP_ORIGIN = "http://localhost:5173"
const SEED_PLUGIN_SERVER_ORIGIN = "http://localhost:8788"
// The docs scenario is the only scenario registered in scripts/seed.ts today.
const SEED_SCENARIO_NAME = "docs"
const READINESS_TIMEOUT_MS = 120_000
const READINESS_INTERVAL_MS = 500
const READINESS_REQUEST_TIMEOUT_MS = 5_000

class DevServerExitedError extends Error {}

const quoteShellArgument = (argument) =>
  `'${argument.replaceAll("'", "'\\''")}'`

const writeMessage = (text) => {
  process.stdout.write(`${text}\n`)
}

const writeFailure = (text) => {
  process.stderr.write(`${text}\n`)
}

const delay = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })

const rawArguments = process.argv.slice(2)
const isNoUsageEnabled =
  rawArguments.includes("--no-usage") ||
  rawArguments.includes("--disable-usage")
const seedArgumentIndex = rawArguments.indexOf("--seed")
const isSeedEnabled = seedArgumentIndex !== -1
// The seed CLI signs in as the fixed development account, so seeding implies --no-auth.
const isNoAuthEnabled = rawArguments.includes("--no-auth") || isSeedEnabled
const seedValueArgument = isSeedEnabled
  ? rawArguments[seedArgumentIndex + 1]
  : undefined
const seedUsageError =
  seedValueArgument !== undefined && !seedValueArgument.startsWith("-")
    ? "`--seed` takes no value; the docs scenario runs automatically. Usage: pnpm dev --seed"
    : undefined

const filteredArguments = rawArguments.filter(
  (argument) =>
    argument !== "--no-usage" &&
    argument !== "--disable-usage" &&
    argument !== "--no-auth" &&
    argument !== "--seed"
)

if (isSeedEnabled) {
  // The seed CLI writes to the default local origin, so a silent port shift
  // must fail loudly instead of pointing the seed at the wrong server.
  filteredArguments.push("--strictPort")
}

const reactRouterArguments = filteredArguments.map(quoteShellArgument)

const reactRouterCommand = ["react-router dev", ...reactRouterArguments].join(
  " "
)

const environmentPrefix = [
  "CLOUDFLARE_ENV=local",
  ...(isNoUsageEnabled ? ["DISABLE_USAGE_LIMITS=true"] : []),
  ...(isNoAuthEnabled ? ["LYNVO_NO_AUTH=true"] : []),
].join(" ")

const createDevServerExitGuard = (devProcess) => () => {
  if (devProcess.exitCode !== null || devProcess.signalCode !== null) {
    throw new DevServerExitedError(
      "The app dev server exited before seeding could begin."
    )
  }
}

const withDevServerExitGuard = (exitGuard, probe) => async () => {
  exitGuard()
  return await probe()
}

const appReadinessProbe = (appOrigin) => async () => {
  const response = await fetch(new URL("/", appOrigin), {
    headers: { Accept: "text/html" },
    signal: AbortSignal.timeout(READINESS_REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!response.ok) {
    await response.body?.cancel()
    return false
  }
  const html = await response.text()
  // The seed CLI reads its CSRF credential from this page, so the meta tag
  // proves the app can serve the seed's first request.
  return html.includes('name="csrf-token"')
}

const anyResponseProbe = (origin) => async () => {
  const response = await fetch(origin, {
    signal: AbortSignal.timeout(READINESS_REQUEST_TIMEOUT_MS),
  })
  await response.body?.cancel()
  return true
}

const waitForLocalServer = async ({ label, origin, probe }) => {
  const deadline = Date.now() + READINESS_TIMEOUT_MS
  for (;;) {
    try {
      // SAFETY: Every probe must settle before the next attempt is scheduled.
      // oxlint-disable-next-line eslint/no-await-in-loop
      if (await probe()) {
        return
      }
    } catch (error) {
      if (error instanceof DevServerExitedError) {
        throw error
      }
      // Refused connections and slow first responses are retried until the
      // deadline below surfaces the failure.
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `${label} was not ready at ${origin} within ${READINESS_TIMEOUT_MS / 1000} seconds.`
      )
    }
    // SAFETY: The retry delay must pass before the next probe starts.
    // oxlint-disable-next-line eslint/no-await-in-loop
    await delay(READINESS_INTERVAL_MS)
  }
}

const isSeedFixtureWorkerRunning = async () => {
  try {
    return await anyResponseProbe(SEED_PLUGIN_SERVER_ORIGIN)()
  } catch {
    // Nothing is listening on the seeding Plugin Server port yet.
    return false
  }
}

const spawnSeedFixtureWorker = () =>
  spawn("pnpm", ["--filter", "@lynvo/lynvo-plugin-server", "dev:docs-seed"], {
    stdio: "inherit",
    // A detached process group lets the stop path signal the whole pnpm,
    // wrangler, and workerd chain; pnpm alone does not forward signals.
    detached: true,
  })

const stopSeedFixtureWorker = (fixtureProcess) => {
  try {
    // SIGINT to the group matches Ctrl-C, which wrangler dev handles by
    // shutting down cleanly.
    process.kill(-fixtureProcess.pid, "SIGINT")
  } catch {
    // The fixture Worker process group already exited.
  }
}

const runSeedProcess = async () => {
  const seedProcess = spawn("pnpm", ["run", "seed", SEED_SCENARIO_NAME], {
    stdio: "inherit",
  })
  return await new Promise((resolve) => {
    seedProcess.on("exit", (exitCode, signal) =>
      resolve(signal ?? exitCode ?? 1)
    )
  })
}

const seedLocalDevelopmentEnvironment = async (devProcess) => {
  const appOrigin = assertLocalHttpOrigin(
    process.env.LYNVO_SEED_ORIGIN ?? DEFAULT_APP_ORIGIN,
    "LYNVO_SEED_ORIGIN must be a local HTTP origin such as http://localhost:5173."
  )
  const reuseRunningFixtureWorker = await isSeedFixtureWorkerRunning()
  if (reuseRunningFixtureWorker) {
    writeMessage(
      `Reusing the seeding Plugin Server already running at ${SEED_PLUGIN_SERVER_ORIGIN}.`
    )
  }
  const fixtureProcess = reuseRunningFixtureWorker
    ? undefined
    : spawnSeedFixtureWorker()
  const stopFixtureWorker = () => {
    if (fixtureProcess) {
      stopSeedFixtureWorker(fixtureProcess)
    }
  }
  devProcess.on("exit", stopFixtureWorker)

  try {
    const guardedProbe = (probe) =>
      withDevServerExitGuard(createDevServerExitGuard(devProcess), probe)
    await waitForLocalServer({
      label: "The app dev server",
      origin: appOrigin.origin,
      probe: guardedProbe(appReadinessProbe(appOrigin)),
    })
    await waitForLocalServer({
      label: "The seeding Plugin Server",
      origin: SEED_PLUGIN_SERVER_ORIGIN,
      probe: guardedProbe(anyResponseProbe(SEED_PLUGIN_SERVER_ORIGIN)),
    })
    const seedExitCode = await runSeedProcess()
    if (seedExitCode !== 0) {
      throw new Error(`The seed CLI exited with code ${seedExitCode}.`)
    }
    writeMessage(
      `Seeded the local development environment. The app keeps running at ${appOrigin.origin}.`
    )
  } finally {
    stopFixtureWorker()
  }
}

if (seedUsageError) {
  writeFailure(`Error: ${seedUsageError}`)
  process.exitCode = 1
} else {
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

    if (isSeedEnabled) {
      seedLocalDevelopmentEnvironment(devProcess).catch((cause) => {
        writeFailure(
          `Seeding failed: ${cause instanceof Error ? cause.message : String(cause)}`
        )
        writeFailure(
          "The app keeps running. Resolve the issue and restart with `pnpm dev --seed`."
        )
      })
    }

    devProcess.on("exit", (exitCode, signal) => {
      if (signal) {
        process.kill(process.pid, signal)
        return
      }

      process.exitCode = exitCode ?? 1
    })
  }
}
