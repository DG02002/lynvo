import { Effect } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  extractFromWorker,
  getWorkerMetadata,
  selectWorker,
} from "~/lib/effect/services/WorkerExtractorAdapter"

const findUndefinedPaths = (value: unknown, path = "result"): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      findUndefinedPaths(entry, `${path}.${index}`)
    )
  }
  if (typeof value !== "object" || value === null) {
    return []
  }
  return Object.entries(value).flatMap(([key, entry]) =>
    entry === undefined
      ? [`${path}.${key}`]
      : findUndefinedPaths(entry, `${path}.${key}`)
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("extractFromWorker", () => {
  it("forwards structured Basic Auth only to workers that declare support", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        plugin: {
          pluginServerId: "com.example.extractor",
          displayName: "Example Extractor",
        },
        nodes: [],
        extensions: {},
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await Effect.runPromise(
      extractFromWorker(
        {
          _id: "worker-one",
          baseUrl: "https://extractor.example",
          apiKey: "secret",
          manifest: JSON.stringify({
            protocolVersion: "1.0",
            pluginServerId: "com.example.extractor",
            displayName: "Example Extractor",
            auth: { type: "bearer" },
            matchers: [{ hosts: ["source.example"] }],
            features: { basicAuth: true },
            extensions: {},
          }),
          enabled: true,
          priority: 0,
        },
        "https://viewer:s%40fe@source.example/title",
        "source"
      )
    )

    const request = fetchMock.mock.calls[0][0]
    expect(await request.json()).toEqual({
      input: {
        kind: "source",
        sourceUrl: "https://source.example/title",
      },
      basicAuth: {
        username: "viewer",
        password: "s@fe",
      },
    })
  })

  it("decodes human-readable worker text without changing identifiers or URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          plugin: {
            pluginServerId: "com.example.extractor&amp;stable",
            displayName: "Example &amp; Extractor",
            pluginId: "source&amp;stable",
            pluginName: "Source &amp; Collection",
            pageTitle: "Source Title Alpha",
            audio: "Hindi &amp; English",
          },
          nodes: [
            {
              kind: "group",
              id: "folder&amp;stable",
              label: "Folder &amp; Specials",
              badge: "New &amp; Updated",
              size: "1 &amp; 2 GB",
              sourceName: "Source &amp; Mirror",
              children: [
                {
                  kind: "playable",
                  id: "playable-item&amp;stable",
                  label: "Playable Item Alpha",
                  url: "https://media.example/video?token=a&amp;b",
                },
              ],
            },
          ],
          extensions: {},
        })
      )
    )

    const result = await Effect.runPromise(
      extractFromWorker(
        {
          _id: "worker-one",
          baseUrl: "https://extractor.example",
          apiKey: "secret",
          manifest: "{}",
          enabled: true,
          priority: 0,
        },
        "https://source.example/title",
        "source"
      )
    )

    expect(result.meta).toMatchObject({
      pluginName: "Example & Extractor",
      pluginId: "source&amp;stable",
      sourceName: "Source & Collection",
      pageTitle: "Source Title Alpha",
      audio: "Hindi & English",
    })
    expect(result.links[0]).toMatchObject({
      id: "folder&amp;stable",
      label: "Folder & Specials",
      size: "1 & 2 GB",
      sourceName: "Source & Mirror",
      children: [
        {
          id: "playable-item&amp;stable",
          label: "Playable Item Alpha",
          url: "https://media.example/video?token=a&amp;b",
        },
      ],
    })
  })

  it("exposes a declared source route for the save preview", async () => {
    const metadata = await Effect.runPromise(
      getWorkerMetadata(
        {
          _id: "worker-one",
          baseUrl: "https://extractor.example",
          apiKey: "secret",
          manifest: JSON.stringify({
            protocolVersion: "1.0",
            pluginServerId: "com.example.extractor",
            displayName: "Example Extractor",
            auth: { type: "bearer" },
            matchers: [{ hosts: ["extractor-source-alpha.example"] }],
            features: {},
            extensions: {
              lynvo: {
                plugins: [
                  {
                    id: "extractor-source-alpha",
                    displayName: "Extractor Source Alpha",
                    iconUrl:
                      "https://extractor.example/icons/extractor-source-alpha.webp",
                    routesToPluginId: "extractor-source-beta",
                    hosts: ["extractor-source-alpha.example"],
                  },
                  {
                    id: "extractor-source-beta",
                    displayName: "Extractor Source Beta",
                    iconUrl:
                      "https://extractor.example/icons/extractor-source-beta.webp",
                    hosts: ["extractor-source-beta.example"],
                  },
                ],
              },
            },
          }),
          enabled: true,
          priority: 0,
        },
        "https://extractor-source-alpha.example/file"
      )
    )

    expect(metadata).toMatchObject({
      sourceName: "Extractor Source Alpha",
      routeSourceName: "Extractor Source Beta",
      routeSourceIconUrl:
        "https://extractor.example/icons/extractor-source-beta.webp",
    })
  })

  it("omits absent optional metadata so HTTP encoding can succeed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          plugin: {
            pluginServerId: "com.example.extractor",
            displayName: "Example Extractor",
            pluginId: "source-alpha",
            pluginName: "Source Alpha",
          },
          nodes: [
            {
              kind: "group",
              id: "folder-one",
              label: "Folder one",
              children: [
                {
                  kind: "resolvable",
                  id: "playable-item-one",
                  label: "Playable Item one",
                  nodeUrl: "https://source.example/playable-item-one",
                },
              ],
            },
          ],
          extensions: {},
        })
      )
    )

    const result = await Effect.runPromise(
      extractFromWorker(
        {
          _id: "worker-one",
          baseUrl: "https://extractor.example",
          apiKey: "secret",
          manifest: "{}",
          enabled: true,
          priority: 0,
        },
        "https://source.example/title",
        "source"
      )
    )

    expect(result.meta).toEqual({
      pluginName: "Example Extractor",
      pluginId: "source-alpha",
      sourceName: "Source Alpha",
      schemaVersion: 2,
      workerId: "worker-one",
    })
    expect(findUndefinedPaths(result)).toEqual([])
  })
})

describe("selectWorker", () => {
  it("does not select an enabled worker that is down", async () => {
    const worker = {
      _id: "worker-one",
      baseUrl: "https://extractor.example",
      apiKey: "secret",
      manifest: JSON.stringify({
        protocolVersion: "1.0",
        pluginServerId: "com.example.extractor",
        displayName: "Example Extractor",
        auth: { type: "bearer" },
        matchers: [{ hosts: ["source.example"] }],
        features: {},
        extensions: {},
      }),
      enabled: true,
      priority: 0,
      verificationStatus: "down",
    }

    const selected = await Effect.runPromise(
      selectWorker([worker], "https://source.example/title")
    )
    const selectedById = await Effect.runPromise(
      selectWorker([worker], "https://source.example/title", worker._id)
    )

    expect(selected).toBeUndefined()
    expect(selectedById).toBeUndefined()
  })
})
