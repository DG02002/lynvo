import { Effect } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  normalizeWorkerBaseUrl,
  prepareWorkerRefresh,
  prepareWorkerRegistration,
} from "~/lib/effect/services/WorkerRegistration"
import type { RegisteredWorker } from "~/lib/effect/services/extractor-types"

const createManifest = (
  sourceIconUrl = "https://icons.example/resolver-beta.svg"
) => ({
  protocolVersion: "1.0",
  extractorId: "com.example.extractor",
  displayName: "Example Extractor",
  auth: { type: "bearer" },
  usage: { endpoint: "/usage" },
  matchers: [{ hosts: ["resolver-beta.example"], pathPatterns: ["/**"] }],
  features: { password: true, lazyNodes: true },
  extensions: {
    lynvo: {
      sources: [
        {
          id: "resolver-beta",
          displayName: "Resolver Beta",
          iconUrl: sourceIconUrl,
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
      extractorId: "com.example.extractor",
      extensions: {
        lynvo: {
          sources: [
            {
              id: "resolver-beta",
              iconUrl: "https://icons.example/resolver-beta.svg",
            },
          ],
        },
      },
    })
    expect(fetchMock).toHaveBeenCalledWith("https://extractor.example/manifest")
    expect(fetchMock).toHaveBeenCalledWith("https://extractor.example/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer secret",
      },
    })
    expect(fetchMock).toHaveBeenCalledWith("https://extractor.example/usage", {
      headers: {
        Authorization: "Bearer secret",
      },
    })
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
      message: "Worker source plugin metadata is invalid.",
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
      extractorId: "com.example.extractor",
    })
    expect(fetchMock).toHaveBeenCalledWith("https://extractor.example/manifest")
    expect(fetchMock).toHaveBeenCalledWith("https://extractor.example/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer stored-secret",
      },
    })
    expect(fetchMock).toHaveBeenCalledWith("https://extractor.example/usage", {
      headers: {
        Authorization: "Bearer stored-secret",
      },
    })
  })
})
