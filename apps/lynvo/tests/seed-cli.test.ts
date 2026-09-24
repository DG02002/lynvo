import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  readDevelopmentPluginServerKey,
  SeedApiClient,
  seedDocsSessions,
} from "../scripts/seed"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("docs seed setup", () => {
  it("prefers a trimmed environment key over the local vars file", async () => {
    const readLocalEnvironment = vi.fn(
      async () => "MANAGED_PLUGIN_SERVER_API_KEY=file-key"
    )
    vi.stubEnv("LYNVO_SEED_PLUGIN_SERVER_KEY", "  environment-key  ")

    await expect(
      readDevelopmentPluginServerKey({ readLocalEnvironment })
    ).resolves.toBe("environment-key")
    expect(readLocalEnvironment).not.toHaveBeenCalled()
  })

  it("reads and unquotes the managed Plugin Server key from local vars", async () => {
    const readLocalEnvironment = vi.fn(
      async () => 'OTHER=value\nMANAGED_PLUGIN_SERVER_API_KEY="local-key"\n'
    )

    await expect(
      readDevelopmentPluginServerKey({
        environment: {},
        readLocalEnvironment,
      })
    ).resolves.toBe("local-key")
  })

  it("reuses the named device sessions without requesting new approvals", async () => {
    const existingSessions = [
      { id: "browser-session", deviceName: "Browser", isCurrent: true },
      { id: "tv-session", deviceName: "Android TV", isCurrent: false },
      { id: "phone-session", deviceName: "Phone browser", isCurrent: false },
    ]
    const requests: URL[] = []
    const fetchFunction: typeof fetch = async (input) => {
      const requestUrl = input instanceof Request ? input.url : input.toString()
      requests.push(new URL(requestUrl))
      return new Response(JSON.stringify(existingSessions), {
        headers: { "Content-Type": "application/json" },
      })
    }
    const api = new SeedApiClient("http://localhost:5173", fetchFunction)

    await expect(seedDocsSessions(api)).resolves.toBe(3)
    expect(requests).toHaveLength(2)
    expect(requests.map((request) => request.pathname)).toEqual([
      "/api/settings/security/sessions",
      "/api/settings/security/sessions",
    ])
  })
})

describe("seed CLI scenario selection", () => {
  it("rejects an unregistered scenario with the available usage", () => {
    const result = spawnSync(
      "pnpm",
      ["--filter", "@lynvo/app", "seed", "unknown"],
      {
        cwd: resolve("../.."),
        encoding: "utf8",
        timeout: 15_000,
      }
    )

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "Usage: pnpm --filter @lynvo/app seed <docs>"
    )
    expect(result.stderr).toContain(
      "Error: Usage: pnpm --filter @lynvo/app seed <docs>"
    )
  })
})
