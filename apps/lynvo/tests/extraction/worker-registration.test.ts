import { Effect } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  normalizeWorkerBaseUrl,
  prepareWorkerRefresh,
  prepareWorkerRegistration,
} from "~/lib/effect/services/WorkerRegistration"
import type { RegisteredWorker } from "~/lib/effect/services/extractor-types"

const createManifest = (
  sourceIconUrl = "https://icons.example/resolver-beta.webp"
) => ({
  protocolVersion: "1.0",
  pluginServerId: "com.example.extractor",
  displayName: "Example Extractor",
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
      label: "Extractor operations",
      used: 2,
      limit: 20,
      unit: "operations",
      period: "daily",
      resetsAt: "2026-07-20T00:00:00.000Z",
    },
  ],
})

describe("worker registration", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("normalizes base URLs", async () => {
    const baseUrl = await Effect.runPromise(
      normalizeWorkerBaseUrl("https://extractor.example///?debug=1#local")
    )

    expect(baseUrl).toBe("https://extractor.example")
  })

  it("fetches, validates, verifies, and serializes worker manifests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(createManifest()))
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json(createUsage()))
    vi.stubGlobal("fetch", fetchMock)

    const registration = await Effect.runPromise(
      prepareWorkerRegistration({
        baseUrl: "https://extractor.example/",
        apiKey: "secret",
        existingWorkers: [],
      })
    )

    expect(registration.baseUrl).toBe("https://extractor.example")
    expect(JSON.parse(registration.manifestValue)).toMatchObject({
      pluginServerId: "com.example.extractor",
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
      "https://extractor.example/manifest",
      "https://extractor.example/verify",
      "https://extractor.example/usage",
    ])
    expect(requests[1].method).toBe("POST")
    expect(requests[1].headers.get("Authorization")).toBe("Bearer secret")
    expect(requests[2].headers.get("Authorization")).toBe("Bearer secret")
  })

  it("rejects duplicate workers before making network requests", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const existingWorkers: RegisteredWorker[] = [
      {
        _id: "worker-1",
        baseUrl: "https://extractor.example",
        apiKey: "old-secret",
        manifest: "{}",
        enabled: true,
        priority: 0,
      },
    ]

    await expect(
      Effect.runPromise(
        prepareWorkerRegistration({
          baseUrl: "https://extractor.example/",
          apiKey: "secret",
          existingWorkers,
        })
      )
    ).rejects.toMatchObject({
      message: "This extractor worker is already registered.",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects workers without mandatory usage reporting", async () => {
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
        prepareWorkerRegistration({
          baseUrl: "https://extractor.example",
          apiKey: "secret",
          existingWorkers: [],
        })
      )
    ).rejects.toMatchObject({
      message: "Worker usage verification failed with HTTP 404.",
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
        prepareWorkerRegistration({
          baseUrl: "https://extractor.example",
          apiKey: "secret",
          existingWorkers: [],
        })
      )
    ).rejects.toMatchObject({
      message: "Worker manifest does not match protocol v1.",
    })
  })

  it("refreshes a registered worker manifest using the stored API key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(createManifest()))
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json(createUsage()))
    vi.stubGlobal("fetch", fetchMock)

    const refresh = await Effect.runPromise(
      prepareWorkerRefresh({
        worker: {
          _id: "worker-1",
          baseUrl: "https://extractor.example/",
          apiKey: "stored-secret",
          manifest: "{}",
          enabled: true,
          priority: 0,
        },
      })
    )

    expect(JSON.parse(refresh.manifestValue)).toMatchObject({
      pluginServerId: "com.example.extractor",
    })
    const requests = fetchMock.mock.calls.map(([request]) => request)
    expect(requests.map((request) => request.url)).toEqual([
      "https://extractor.example/manifest",
      "https://extractor.example/verify",
      "https://extractor.example/usage",
    ])
    expect(requests[1].headers.get("Authorization")).toBe(
      "Bearer stored-secret"
    )
    expect(requests[2].headers.get("Authorization")).toBe(
      "Bearer stored-secret"
    )
  })
})
