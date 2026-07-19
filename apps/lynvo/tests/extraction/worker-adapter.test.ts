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
        source: {
          extractorId: "com.example.extractor",
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
            extractorId: "com.example.extractor",
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
          source: {
            extractorId: "com.example.extractor&amp;stable",
            displayName: "Example &amp; Extractor",
            sourceId: "source&amp;stable",
            sourceName: "Movies &amp; Shows",
            pageTitle: "I&#039;m Not Afraid (2026)",
            audio: "Hindi &amp; English",
          },
          nodes: [
            {
              kind: "group",
              id: "season&amp;stable",
              label: "Season &amp; Specials",
              badge: "New &amp; Updated",
              size: "1 &amp; 2 GB",
              sourceName: "Source &amp; Mirror",
              children: [
                {
                  kind: "playable",
                  id: "episode&amp;stable",
                  label: "Tom &amp; Jerry",
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
      sourceId: "source&amp;stable",
      sourceName: "Movies & Shows",
      pageTitle: "I'm Not Afraid (2026)",
      audio: "Hindi & English",
    })
    expect(result.links[0]).toMatchObject({
      id: "season&amp;stable",
      label: "Season & Specials",
      size: "1 & 2 GB",
      sourceName: "Source & Mirror",
      children: [
        {
          id: "episode&amp;stable",
          label: "Tom & Jerry",
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
            extractorId: "com.example.extractor",
            displayName: "Example Extractor",
            auth: { type: "bearer" },
            matchers: [{ hosts: ["hubdrive.example"] }],
            features: {},
            extensions: {
              lynvo: {
                sources: [
                  {
                    id: "hubdrive",
                    displayName: "HubDrive",
                    iconUrl: "https://extractor.example/icons/hubdrive.webp",
                    routesToSourceId: "hubcloud",
                    hosts: ["hubdrive.example"],
                  },
                  {
                    id: "hubcloud",
                    displayName: "HubCloud",
                    iconUrl: "https://extractor.example/icons/hubcloud.webp",
                    hosts: ["hubcloud.example"],
                  },
                ],
              },
            },
          }),
          enabled: true,
          priority: 0,
        },
        "https://hubdrive.example/file"
      )
    )

    expect(metadata).toMatchObject({
      sourceName: "HubDrive",
      routeSourceName: "HubCloud",
      routeSourceIconUrl: "https://extractor.example/icons/hubcloud.webp",
    })
  })

  it("backfills the HubDrive route from an older stored manifest", async () => {
    const metadata = await Effect.runPromise(
      getWorkerMetadata(
        {
          _id: "worker-one",
          baseUrl: "https://extractor.example",
          apiKey: "secret",
          manifest: JSON.stringify({
            protocolVersion: "1.0",
            extractorId: "com.lynvo.plnkextractor",
            displayName: "PlnkExtractor",
            auth: { type: "bearer" },
            matchers: [{ hosts: ["hubdrive.example"] }],
            features: {},
            extensions: {
              lynvo: {
                sources: [
                  {
                    id: "hubdrive",
                    displayName: "HubDrive",
                    iconUrl: "https://extractor.example/icons/hubdrive.webp",
                    hosts: ["hubdrive.example"],
                  },
                  {
                    id: "hubcloud",
                    displayName: "HubCloud",
                    iconUrl: "https://extractor.example/icons/hubcloud.webp",
                    hosts: ["hubcloud.example"],
                  },
                ],
              },
            },
          }),
          enabled: true,
          priority: 0,
        },
        "https://hubdrive.example/file"
      )
    )

    expect(metadata).toMatchObject({
      sourceName: "HubDrive",
      routeSourceName: "HubCloud",
      routeSourceIconUrl: "https://extractor.example/icons/hubcloud.webp",
    })
  })

  it("omits absent optional metadata so HTTP encoding can succeed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          source: {
            extractorId: "com.example.extractor",
            displayName: "Example Extractor",
            sourceId: "source-alpha",
            sourceName: "Source Alpha",
          },
          nodes: [
            {
              kind: "group",
              id: "season-one",
              label: "Season one",
              children: [
                {
                  kind: "resolvable",
                  id: "episode-one",
                  label: "Episode one",
                  nodeUrl: "https://source.example/episode-one",
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
      sourceId: "source-alpha",
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
        extractorId: "com.example.extractor",
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
