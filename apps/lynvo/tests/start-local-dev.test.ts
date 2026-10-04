import { spawnSync } from "node:child_process"

import { describe, expect, it } from "vitest"

import {
  createSeedFixtureWorkerProbe,
  waitForLocalServer,
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
