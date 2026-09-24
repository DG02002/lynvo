import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

import { Schema } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  readDevelopmentPluginServerKey,
  SeedApiClient,
  seedDocsSessions,
} from "../scripts/seed"

const DeviceCodeRequestSchema = Schema.Struct({ deviceName: Schema.String })

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

  it("uses the local default when the vars file does not exist", async () => {
    const readLocalEnvironment = vi.fn(async () => {
      const error = new Error("No local vars file")
      Object.assign(error, { code: "ENOENT" })
      throw error
    })

    await expect(
      readDevelopmentPluginServerKey({
        environment: {},
        readLocalEnvironment,
      })
    ).resolves.toBe("dev-local-api-key")
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

  it("creates only the named device session that is missing", async () => {
    const initialSessions = [
      { id: "browser-session", deviceName: "Browser", isCurrent: true },
      { id: "tv-session", deviceName: "Android TV", isCurrent: false },
    ]
    const completeSessions = [
      ...initialSessions,
      { id: "phone-session", deviceName: "Phone browser", isCurrent: false },
    ]
    const requests: string[] = []
    const requestedDeviceNames: string[] = []
    let sessionListRequests = 0
    const fetchFunction: typeof fetch = async (input, init) => {
      const requestUrl = input instanceof Request ? input.url : input.toString()
      const url = new URL(requestUrl)
      const method = init?.method ?? "GET"
      requests.push(`${method} ${url.pathname}`)

      if (url.pathname === "/api/settings/security/sessions") {
        sessionListRequests += 1
        const sessions =
          sessionListRequests === 1 ? initialSessions : completeSessions
        return new Response(JSON.stringify(sessions), {
          headers: { "Content-Type": "application/json" },
        })
      }
      if (url.pathname === "/api/auth/device/code") {
        const body = Schema.decodeUnknownSync(DeviceCodeRequestSchema)(
          await new Request(input, init).json()
        )
        requestedDeviceNames.push(body.deviceName)
        return new Response(
          JSON.stringify({
            code: "device-code",
            pollSecret: "poll-secret",
            deviceName: "Phone browser",
          }),
          { headers: { "Content-Type": "application/json" } }
        )
      }
      if (url.pathname === "/api/auth/device/exchange") {
        return new Response(
          JSON.stringify({
            userId: "lynvo-development-user",
            deviceName: "Phone browser",
            sessionId: "phone-session",
          }),
          { headers: { "Content-Type": "application/json" } }
        )
      }
      if (
        url.pathname === "/api/auth/device/authorize" ||
        url.pathname === "/api/auth/device/exchange/finalize"
      ) {
        return new Response("{}", {
          headers: { "Content-Type": "application/json" },
        })
      }
      throw new Error(`Unexpected docs seed request: ${method} ${url.pathname}`)
    }
    const api = new SeedApiClient("http://localhost:5173", fetchFunction)

    await expect(seedDocsSessions(api)).resolves.toBe(3)
    expect(requestedDeviceNames).toEqual(["Phone browser"])
    expect(requests).toEqual([
      "GET /api/settings/security/sessions",
      "POST /api/auth/device/code",
      "POST /api/auth/device/authorize",
      "GET /api/auth/device/exchange",
      "POST /api/auth/device/exchange/finalize",
      "GET /api/settings/security/sessions",
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
