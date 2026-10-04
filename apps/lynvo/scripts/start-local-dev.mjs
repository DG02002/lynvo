import { spawn, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import { readSeedAppOrigin } from "./local-origin.mjs"

const SEED_PLUGIN_SERVER_ORIGIN = "http://localhost:8788"
const SEED_PLUGIN_SERVER_PORT = new URL(SEED_PLUGIN_SERVER_ORIGIN).port
// The docs scenario is the only scenario registered in scripts/seed.ts today.
const SEED_SCENARIO_NAME = "docs"
const DEFAULT_DEV_SERVER_PORT = "5173"
// The unauthenticated /manifest route reports this pluginServerId; it identifies
// the Lynvo Plugin Server on the fixture port.
const SEED_MANIFEST_MARKER = "dev.lynvo.plugin-server"
const READINESS_TIMEOUT_MS = 120_000
const READINESS_INTERVAL_MS = 500
const READINESS_REQUEST_TIMEOUT_MS = 5_000
const MAXIMUM_PROBE_BODY_BYTES = 256 * 1024

// A readiness failure that retrying cannot fix, such as the dev server exiting
// or a foreign service holding the fixture Worker port.
class ReadinessAbortError extends Error {}

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

const filteredArguments = rawArguments.filter(
  (argument) =>
    argument !== "--no-usage" &&
    argument !== "--disable-usage" &&
    argument !== "--no-auth" &&
    argument !== "--seed"
)

if (isSeedEnabled) {
  // The seed CLI writes to the seed app origin, so a silent port shift must
  // fail loudly instead of pointing the seed at the wrong server.
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

const readBodyPrefix = async (body, maximumBytes) => {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let text = ""
  let receivedBytes = 0
  for (;;) {
    // SAFETY: The cap counts accumulated bytes, so each read must settle before the next.
    // oxlint-disable-next-line eslint/no-await-in-loop
    const { done, value } = await reader.read()
    if (done) {
      return text
    }
    receivedBytes += value.byteLength
    text += decoder.decode(value, { stream: true })
    if (receivedBytes >= maximumBytes) {
      // Both probed pages place their marker near the start, so the truncated
      // prefix still carries the marker the probes search for.
      // SAFETY: Cancelling releases the connection without reading further.
      // oxlint-disable-next-line eslint/no-await-in-loop
      await reader.cancel()
      return text
    }
  }
}

const appReadinessProbe = (appOrigin) => async () => {
  const response = await fetch(new URL("/", appOrigin), {
    headers: { Accept: "text/html" },
    signal: AbortSignal.timeout(READINESS_REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    return false
  }
  // The seed CLI reads its CSRF credential from this page, so the meta tag
  // proves the app can serve the seed's first request.
  const html = await readBodyPrefix(response.body, MAXIMUM_PROBE_BODY_BYTES)
  return html.includes('name="csrf-token"')
}

export const createSeedFixtureWorkerProbe =
  ({
    fetchFunction = fetch,
    manifestUrl = new URL("/manifest", SEED_PLUGIN_SERVER_ORIGIN),
  } = {}) =>
  async () => {
    let response
    try {
      response = await fetchFunction(manifestUrl, {
        signal: AbortSignal.timeout(READINESS_REQUEST_TIMEOUT_MS),
      })
    } catch {
      // Nothing is listening on the seeding Plugin Server port yet.
      return false
    }
    let manifest = ""
    if (response.ok && response.body) {
      manifest = await readBodyPrefix(response.body, MAXIMUM_PROBE_BODY_BYTES)
    } else {
      await response.body?.cancel()
    }
    if (manifest.includes(SEED_MANIFEST_MARKER)) {
      return true
    }
    // The same failure covers a foreign service and a genuine Lynvo Plugin
    // Server whose manifest failed protocol validation, so the message must not
    // claim which one holds the port.
    throw new ReadinessAbortError(
      `Port ${SEED_PLUGIN_SERVER_PORT} did not serve the Lynvo Plugin Server manifest. Free the port or restart the Lynvo Plugin Server on it, then rerun \`pnpm dev --seed\`.`
    )
  }

const seedFixtureWorkerProbe = createSeedFixtureWorkerProbe()

export const waitForLocalServer = async ({
  label,
  origin,
  probe,
  timeoutHint,
  timeoutMs = READINESS_TIMEOUT_MS,
}) => {
  const deadline = Date.now() + timeoutMs
  let lastFailure
  for (;;) {
    try {
      // SAFETY: Every probe must settle before the next attempt is scheduled.
      // oxlint-disable-next-line eslint/no-await-in-loop
      if (await probe()) {
        return
      }
    } catch (error) {
      if (error instanceof ReadinessAbortError) {
        throw error
      }
      // Retried until the deadline below, which reports this failure as its cause.
      lastFailure = error
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `${label} was not ready at ${origin} within ${timeoutMs / 1000} seconds.${timeoutHint ? ` ${timeoutHint}` : ""}`,
        { cause: lastFailure }
      )
    }
    // SAFETY: The retry delay must pass before the next probe starts.
    // oxlint-disable-next-line eslint/no-await-in-loop
    await delay(READINESS_INTERVAL_MS)
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
    seedProcess.on("exit", (exitCode, signal) => resolve({ exitCode, signal }))
  })
}

const readDevServerPort = () => {
  const portArgumentIndex = rawArguments.findIndex(
    (argument) => argument === "--port" || argument.startsWith("--port=")
  )
  if (portArgumentIndex === -1) {
    return DEFAULT_DEV_SERVER_PORT
  }
  const argument = rawArguments[portArgumentIndex]
  return argument === "--port"
    ? (rawArguments[portArgumentIndex + 1] ?? DEFAULT_DEV_SERVER_PORT)
    : argument.slice("--port=".length) || DEFAULT_DEV_SERVER_PORT
}

const readSeedStartup = () => {
  if (!isSeedEnabled) {
    return {}
  }
  const valueArgument = rawArguments[seedArgumentIndex + 1]
  if (valueArgument !== undefined && !valueArgument.startsWith("-")) {
    return {
      error:
        "`--seed` takes no value; the docs scenario runs automatically. Usage: pnpm dev --seed",
    }
  }
  let appOrigin
  try {
    appOrigin = readSeedAppOrigin(
      process.env,
      "LYNVO_SEED_ORIGIN must be a local HTTP origin such as http://localhost:5173."
    )
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
  const devServerPort = readDevServerPort()
  if (appOrigin.port !== devServerPort) {
    return {
      error: `The seed writes to ${appOrigin.origin}, but the dev server will use port ${devServerPort}. Set LYNVO_SEED_ORIGIN to http://localhost:${devServerPort} or drop --port.`,
    }
  }
  return { appOrigin }
}

const waitForSeedReadiness = async (appOrigin, devProcess) => {
  const guardedProbe = (probe) => async () => {
    if (devProcess.exitCode !== null || devProcess.signalCode !== null) {
      throw new ReadinessAbortError(
        "The app dev server exited before seeding could begin."
      )
    }
    return await probe()
  }
  await waitForLocalServer({
    label: "The app dev server",
    origin: appOrigin.origin,
    probe: guardedProbe(appReadinessProbe(appOrigin)),
    timeoutHint:
      appOrigin.hostname === "localhost"
        ? undefined
        : `If the dev server listens on another loopback address, set LYNVO_SEED_ORIGIN to http://localhost:${appOrigin.port}.`,
  })
  await waitForLocalServer({
    label: "The seeding Plugin Server",
    origin: SEED_PLUGIN_SERVER_ORIGIN,
    probe: guardedProbe(seedFixtureWorkerProbe),
  })
}

export const writeSpawnedWorkerExitNotice = async (
  fixtureProcess,
  { probe = seedFixtureWorkerProbe, write = writeMessage } = {}
) => {
  if (
    !fixtureProcess ||
    (fixtureProcess.exitCode === null && fixtureProcess.signalCode === null)
  ) {
    return
  }
  // A re-probe separates the port race from an unrelated Worker crash; the
  // notice must not assert the race without confirming another server holds
  // the port.
  let servedByAnotherWorker = false
  try {
    servedByAnotherWorker = await probe()
  } catch {
    // The notice must not fail a successful seed; an unknown port state
    // reports the plain exit.
  }
  write(
    servedByAnotherWorker
      ? `The spawned seeding Plugin Server exited; the seed ran against another Lynvo Plugin Server already serving port ${SEED_PLUGIN_SERVER_PORT}, which stays running.`
      : "The spawned seeding Plugin Server is no longer running."
  )
}

const seedLocalDevelopmentEnvironment = async (appOrigin, devProcess) => {
  const reuseRunningFixtureWorker = await seedFixtureWorkerProbe()
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
    await waitForSeedReadiness(appOrigin, devProcess)
    const seedResult = await runSeedProcess()
    if (seedResult.signal) {
      throw new Error(`The seed CLI was terminated by ${seedResult.signal}.`)
    }
    if (seedResult.exitCode !== 0) {
      throw new Error(
        `The seed CLI exited with code ${seedResult.exitCode ?? 1}.`
      )
    }
    await writeSpawnedWorkerExitNotice(fixtureProcess)
    writeMessage(
      `Seeded the local development environment. The app keeps running at ${appOrigin.origin}.`
    )
  } finally {
    stopFixtureWorker()
  }
}

const runLauncher = () => {
  const seedStartup = readSeedStartup()

  if (seedStartup.error) {
    writeFailure(`Error: ${seedStartup.error}`)
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
        seedLocalDevelopmentEnvironment(
          seedStartup.appOrigin,
          devProcess
        ).catch((cause) => {
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
}

const [invokedFile] = process.argv.slice(1)
if (invokedFile && fileURLToPath(import.meta.url) === invokedFile) {
  runLauncher()
}
