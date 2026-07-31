import { Effect } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  normalizePluginServerBaseUrl,
  preparePluginServerRefresh,
  preparePluginServerRegistration,
} from "~/lib/effect/services/plugin-server-registration"
import type { RegisteredPluginServer } from "~/lib/effect/services/extraction-types"

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
        existingPluginServers: [],
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

  it("rejects duplicate plugin servers before making network requests", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const existingPluginServers: RegisteredPluginServer[] = [
      {
        _id: "pluginServer-1",
        baseUrl: "https://plugin-server.example",
        apiKey: "old-secret",
        manifest: "{}",
        enabled: true,
        priority: 0,
      },
    ]

    await expect(
      Effect.runPromise(
        preparePluginServerRegistration({
          baseUrl: "https://plugin-server.example/",
          apiKey: "secret",
          existingPluginServers,
        })
      )
    ).rejects.toMatchObject({
      message: "This Plugin Server is already registered.",
    })
    expect(fetchMock).not.toHaveBeenCalled()
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
          existingPluginServers: [],
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
          Response.json(createManifest("http://icons.example/bad.svg"))
        )
    )

    await expect(
      Effect.runPromise(
        preparePluginServerRegistration({
          baseUrl: "https://plugin-server.example",
          apiKey: "secret",
          existingPluginServers: [],
        })
      )
    ).rejects.toMatchObject({
      message: "Plugin Server Manifest does not match protocol v1.",
    })
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
          _id: "pluginServer-1",
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
