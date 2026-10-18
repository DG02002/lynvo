import { spawnSync } from "node:child_process"
import { EventEmitter } from "node:events"

import { describe, expect, it } from "vitest"

import { DOCS_SEED_PLUGIN_SERVER_FIXTURES } from "../scripts/docs-seed-fixtures.mjs"
import {
  createSeedFixtureWorkerProbe,
  seedLocalDevelopmentEnvironment,
  waitForLocalServer,
  writeSpawnedWorkerExitNotice,
} from "../scripts/start-local-dev.mjs"

const runDevLauncher = (arguments_: readonly string[]) => {
  const environment = { ...process.env }
  delete environment.LYNVO_SEED_ORIGIN
  return spawnSync("node", ["scripts/start-local-dev.mjs", ...arguments_], {
    encoding: "utf8",
    env: environment,
    timeout: 15_000,
  })
}

describe("dev launcher seed flag", () => {
  it("rejects a value after --seed before running migrations", () => {
    const result = runDevLauncher(["--seed", "docs"])

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "Error: `--seed` takes no value; the docs scenario runs automatically. Usage: pnpm dev --seed"
    )
    expect(result.stderr).not.toContain("wrangler")
  })

  it("rejects a seed origin that disagrees with the requested dev server port", () => {
    const result = runDevLauncher(["--seed", "--port", "5175"])

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "Error: The seed writes to http://localhost:5173, but the dev server will use port 5175."
    )
    expect(result.stderr).toContain(
      "Set LYNVO_SEED_ORIGIN to http://localhost:5175 or drop --port."
    )
  })
})

describe("seed fixture Worker probe", () => {
  it("treats a manifest from the Lynvo Plugin Server as the fixture Worker", async () => {
    const probe = createSeedFixtureWorkerProbe({
      fetchFunction: async () =>
        new Response(
          JSON.stringify({ pluginServerId: "dev.lynvo.plugin-server" }),
          { status: 200 }
        ),
    })

    await expect(probe()).resolves.toBe(true)
  })

  it("aborts when the port serves something other than the manifest", async () => {
    const probe = createSeedFixtureWorkerProbe({
      fetchFunction: async () => new Response("Not found", { status: 404 }),
    })

    await expect(probe()).rejects.toThrow(
      "Port 8788 did not serve the Lynvo Plugin Server manifest. Free the port or restart the Lynvo Plugin Server on it, then rerun `pnpm dev --seed`."
    )
  })

  it("reports not listening for a refused connection", async () => {
    const probe = createSeedFixtureWorkerProbe({
      fetchFunction: async () => {
        throw new Error("connect ECONNREFUSED")
      },
    })

    await expect(probe()).resolves.toBe(false)
  })
})

describe("readiness wait", () => {
  it("appends the loopback hint to the timeout error", async () => {
    await expect(
      waitForLocalServer({
        label: "The app dev server",
        origin: "http://127.0.0.1:5175",
        probe: async () => false,
        timeoutHint:
          "If the dev server listens on another loopback address, set LYNVO_SEED_ORIGIN to http://localhost:5175.",
        timeoutMs: 10,
      })
    ).rejects.toThrow(
      "The app dev server was not ready at http://127.0.0.1:5175 within 0.01 seconds. If the dev server listens on another loopback address, set LYNVO_SEED_ORIGIN to http://localhost:5175."
    )
  })
})

describe("spawned Worker exit notice", () => {
  it("reports the confirmed race when another Lynvo Plugin Server serves the port", async () => {
    const messages: string[] = []

    await writeSpawnedWorkerExitNotice(
      { exitCode: 1, signalCode: null },
      {
        probe: async () => true,
        write: (text: string) => {
          messages.push(text)
        },
      }
    )

    expect(messages).toEqual([
      "The spawned seeding Plugin Server exited; the seed ran against another Lynvo Plugin Server already serving port 8788, which stays running.",
    ])
  })

  it("reports the plain exit when the port no longer serves the manifest", async () => {
    const messages: string[] = []

    await writeSpawnedWorkerExitNotice(
      { exitCode: null, signalCode: "SIGTERM" },
      {
        probe: async () => false,
        write: (text: string) => {
          messages.push(text)
        },
      }
    )

    expect(messages).toEqual([
      "The spawned seeding Plugin Server is no longer running.",
    ])
  })

  it("reports the plain exit when the re-probe itself fails", async () => {
    const messages: string[] = []

    await writeSpawnedWorkerExitNotice(
      { exitCode: 1, signalCode: null },
      {
        probe: async () => {
          throw new Error("connect ECONNREFUSED")
        },
        write: (text: string) => {
          messages.push(text)
        },
      }
    )

    expect(messages).toEqual([
      "The spawned seeding Plugin Server is no longer running.",
    ])
  })

  it("writes nothing while the spawned Worker is still running", async () => {
    const messages: string[] = []

    await writeSpawnedWorkerExitNotice(
      { exitCode: null, signalCode: null },
      {
        probe: async () => true,
        write: (text: string) => {
          messages.push(text)
        },
      }
    )

    expect(messages).toEqual([])
  })
})

describe("docs seed launcher orchestration", () => {
  const createSpawnedWorker = (port: string) => ({
    process: { exitCode: null, signalCode: null },
    probe: async () => true,
    port,
  })

  it("starts fixture Workers sequentially and reports their ports", async () => {
    const events: string[] = []
    const messages: string[] = []

    await seedLocalDevelopmentEnvironment(
      new URL("http://localhost:5173"),
      new EventEmitter(),
      {
        waitForApp: async () => {
          events.push("app-ready")
        },
        startFixtureWorker: async (fixture, _devProcess, onSpawnedWorker) => {
          const { port } = new URL(fixture.url)
          events.push(`start:${port}`)
          const worker = createSpawnedWorker(port)
          onSpawnedWorker(worker)
          events.push(`ready:${port}`)
          return worker
        },
        runSeed: async () => {
          events.push("seed")
          return { exitCode: 0, signal: null }
        },
        write: (message) => messages.push(message),
      }
    )

    expect(events).toEqual([
      "app-ready",
      "start:8788",
      "ready:8788",
      "start:8789",
      "ready:8789",
      "start:8790",
      "ready:8790",
      "seed",
    ])
    expect(messages).toEqual([
      "Seeded the local development environment. The app keeps running at http://localhost:5173, and the seeding Plugin Servers keep running on 8788, 8789, 8790 until the dev server exits.",
    ])
    expect(DOCS_SEED_PLUGIN_SERVER_FIXTURES).toHaveLength(3)
  })

  it("stops every spawned Worker when seeding fails", async () => {
    const stoppedWorkers: string[] = []

    await expect(
      seedLocalDevelopmentEnvironment(
        new URL("http://localhost:5173"),
        new EventEmitter(),
        {
          waitForApp: async () => {},
          startFixtureWorker: async (fixture, _devProcess, onSpawnedWorker) => {
            const { port } = new URL(fixture.url)
            const worker = createSpawnedWorker(port)
            onSpawnedWorker(worker)
            return worker
          },
          runSeed: async () => ({ exitCode: 1, signal: null }),
          stopWorkers: async (workers) => {
            stoppedWorkers.push(...workers.map((worker) => worker.port))
          },
        }
      )
    ).rejects.toThrow("The seed CLI exited with code 1.")

    expect(stoppedWorkers).toEqual(["8788", "8789", "8790"])
  })

  it("tracks a Worker before waiting for its readiness probe", async () => {
    const stoppedWorkers: string[] = []
    const worker = createSpawnedWorker("8788")

    await expect(
      seedLocalDevelopmentEnvironment(
        new URL("http://localhost:5173"),
        new EventEmitter(),
        {
          waitForApp: async () => {},
          startFixtureWorker: async (
            _fixture,
            _devProcess,
            onSpawnedWorker
          ) => {
            onSpawnedWorker(worker)
            throw new Error("Worker readiness failed")
          },
          stopWorkers: async (workers) => {
            stoppedWorkers.push(...workers.map((spawned) => spawned.port))
          },
        }
      )
    ).rejects.toThrow("Worker readiness failed")

    expect(stoppedWorkers).toEqual(["8788"])
  })
})
