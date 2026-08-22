import { Effect, Layer } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  normalizePluginServerBaseUrl,
  preparePluginServerRefresh,
  preparePluginServerRegistration,
} from "~/lib/effect/services/plugin-server-registration"
import { registerCustomPluginServer } from "~/lib/effect/services/custom-plugin-server-lifecycle"
import { CloudflareEnv } from "~/lib/effect/services/CloudflareEnv"
import { createFakeD1Database } from "../support/fake-d1"

const createManifest = (
  sourceIconUrl = "https://icons.example/resolver-beta.webp"
) => ({
  protocolVersion: "1.0",
  pluginServerId: "dev.example.plugin-server",
  displayName: "Example Plugin Server",
  auth: { type: "bearer" },
  usage: { endpoint: "/usage" },
  matchers: [{ hosts: ["resolver-beta.example"], pathPatterns: ["/**"] }],
  features: { password: true, lazyNodes: true },
  extensions: {
    lynvo: {
      plugins: [
        {
          id: "resolver-beta",
          displayName: "Resolver Beta",
          iconUrl: sourceIconUrl,
          status: "active",
          version: "1.0.0",
          hosts: ["resolver-beta.example"],
        },
      ],
    },
  },
})

const createUsage = () => ({
  metrics: [
    {
      id: "operations",
      label: "Plugin Server operations",
      used: 2,
      limit: 20,
      unit: "operations",
      period: "daily",
      resetsAt: "2026-07-20T00:00:00.000Z",
    },
  ],
})

describe("Plugin Server registration", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("normalizes base URLs", async () => {
    const baseUrl = await Effect.runPromise(
      normalizePluginServerBaseUrl(
        "https://plugin-server.example///?debug=1#local"
      )
    )

    expect(baseUrl).toBe("https://plugin-server.example")
  })

  it("fetches, validates, verifies, and serializes pluginServer manifests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(createManifest()))
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json(createUsage()))
    vi.stubGlobal("fetch", fetchMock)

    const registration = await Effect.runPromise(
      preparePluginServerRegistration({
        baseUrl: "https://plugin-server.example/",
        apiKey: "secret",
      })
    )

    expect(registration.baseUrl).toBe("https://plugin-server.example")
    expect(JSON.parse(registration.manifestValue)).toMatchObject({
      pluginServerId: "dev.example.plugin-server",
      extensions: {
        lynvo: {
          plugins: [
            {
              id: "resolver-beta",
              iconUrl: "https://icons.example/resolver-beta.webp",
            },
          ],
        },
      },
    })
    const requests = fetchMock.mock.calls.map(([request]) => request)
    expect(requests.map((request) => request.url)).toEqual([
      "https://plugin-server.example/manifest",
      "https://plugin-server.example/verify",
      "https://plugin-server.example/usage",
    ])
    expect(requests[1].method).toBe("POST")
    expect(requests[1].headers.get("Authorization")).toBe("Bearer secret")
    expect(requests[2].headers.get("Authorization")).toBe("Bearer secret")
  })

  it("rejects plugin servers without mandatory usage reporting", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(createManifest()))
        .mockResolvedValueOnce(Response.json({ ok: true }))
        .mockResolvedValueOnce(new Response("Not found", { status: 404 }))
    )

    await expect(
      Effect.runPromise(
        preparePluginServerRegistration({
          baseUrl: "https://plugin-server.example",
          apiKey: "secret",
        })
      )
    ).rejects.toMatchObject({
      message: "Plugin Server usage verification failed with HTTP 404.",
    })
  })

  it("rejects malformed source plugin icon metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json(createManifest("https://icons.example/bad.gif"))
        )
    )

    await expect(
      Effect.runPromise(
        preparePluginServerRegistration({
          baseUrl: "https://plugin-server.example",
          apiKey: "secret",
        })
      )
    ).rejects.toMatchObject({
      message: "Plugin Server Manifest does not match protocol v1.",
    })
  })

  it("preserves the primary registration error when recovery also fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(createManifest()))
        .mockResolvedValueOnce(Response.json({ ok: true }))
        .mockResolvedValueOnce(Response.json(createUsage()))
    )
    let finalizedCount = 0
    let recoveryCount = 0
    let storedPendingRow: Record<string, unknown> | null = null
    const credentialVault = {
      getByName: () => ({
        fetch: () =>
          Promise.resolve(
            Response.json({
              ciphertext: "ciphertext",
              nonce: "nonce",
              algorithm: "AES-256-GCM",
              keyVersion: 1,
            })
          ),
      }),
    }
    const database = createFakeD1Database((sql, args) => {
      if (sql.includes("INSERT INTO user_plugin_servers")) {
        storedPendingRow = {
          id: args[0] as string,
          user_id: args[1] as string,
          credential_status: "pending",
          credential_generation: args[9],
          credential_attempt_id: args[10],
        }
        return undefined
      }
      if (sql.includes("FROM user_plugin_servers")) {
        return storedPendingRow
          ? { row: storedPendingRow }
          : { rows: [] }
      }
      if (
        sql.includes("UPDATE user_plugin_servers") &&
        sql.includes("api_key_ciphertext")
      ) {
        finalizedCount += 1
        return { error: new Error("Finalization mutation failed") }
      }
      if (
        sql.includes("UPDATE user_plugin_servers") &&
        sql.includes("credential_status")
      ) {
        recoveryCount += 1
        return { error: new Error("Recovery mutation failed") }
      }
      return undefined
    })
    const layer = Layer.mergeAll(
      Layer.succeed(
        CloudflareEnv,
        CloudflareEnv.of({
          PLUGIN_SERVER_CREDENTIAL_VAULT: credentialVault,
          DB: database,
        } as unknown as Env)
      )
    )

    await expect(
      Effect.runPromise(
        registerCustomPluginServer({
          baseUrl: "https://plugin-server.example",
          apiKey: "secret",
          user: { id: "user-1" },
        }).pipe(Effect.provide(layer))
      )
    ).rejects.toMatchObject({
      message: "Finalization mutation failed",
    })
    expect(finalizedCount).toBe(1)
    expect(recoveryCount).toBe(1)
  })

  it("refreshes a registered pluginServer manifest using the stored API key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(createManifest()))
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json(createUsage()))
    vi.stubGlobal("fetch", fetchMock)

    const refresh = await Effect.runPromise(
      preparePluginServerRefresh({
        pluginServer: {
          id: "pluginServer-1",
          baseUrl: "https://plugin-server.example/",
          apiKey: "stored-secret",
          manifest: "{}",
          enabled: true,
          priority: 0,
        },
      })
    )

    expect(JSON.parse(refresh.manifestValue)).toMatchObject({
      pluginServerId: "dev.example.plugin-server",
    })
    const requests = fetchMock.mock.calls.map(([request]) => request)
    expect(requests.map((request) => request.url)).toEqual([
      "https://plugin-server.example/manifest",
      "https://plugin-server.example/verify",
      "https://plugin-server.example/usage",
    ])
    expect(requests[1].headers.get("Authorization")).toBe(
      "Bearer stored-secret"
    )
    expect(requests[2].headers.get("Authorization")).toBe(
      "Bearer stored-secret"
    )
  })
})
