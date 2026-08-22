import { Effect } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  extractFromCustomPluginServer,
  getCustomPluginServerMetadata,
  selectCustomPluginServer,
} from "~/lib/effect/services/custom-plugin-server-adapter"

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

const incompleteManifestFields = ["usage", "status", "version"] as const

const createIncompleteStoredManifest = (
  missingField: (typeof incompleteManifestFields)[number]
): string =>
  JSON.stringify({
    protocolVersion: "1.0",
    pluginServerId: "dev.example.plugin-server",
    displayName: "Example Plugin Server",
    auth: { type: "bearer" },
    ...(missingField === "usage" ? {} : { usage: { endpoint: "/usage" } }),
    matchers: [{ hosts: ["source.example"] }],
    features: {},
    extensions: {
      lynvo: {
        plugins: [
          {
            id: "example-source",
            displayName: "Example Source",
            ...(missingField === "status" ? {} : { status: "active" }),
            ...(missingField === "version" ? {} : { version: "1.0.0" }),
            hosts: ["source.example"],
          },
        ],
      },
    },
  })

describe("extractFromCustomPluginServer", () => {
  it("forwards structured Basic Auth only to plugin servers that declare support", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        plugin: {
          pluginServerId: "dev.example.plugin-server",
          displayName: "Example Plugin Server",
        },
        nodes: [],
        extensions: {},
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await Effect.runPromise(
      extractFromCustomPluginServer(
        {
          id: "pluginServer-one",
          baseUrl: "https://plugin-server.example",
          apiKey: "secret",
          manifest: JSON.stringify({
            protocolVersion: "1.0",
            pluginServerId: "dev.example.plugin-server",
            displayName: "Example Plugin Server",
            auth: { type: "bearer" },
            usage: { endpoint: "/usage" },
            matchers: [{ hosts: ["source.example"] }],
            features: { basicAuth: true },
            extensions: {
              lynvo: {
                plugins: [
                  {
                    id: "example-source",
                    displayName: "Example Source",
                    status: "active",
                    version: "1.0.0",
                    hosts: ["source.example"],
                  },
                ],
              },
            },
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

  it("decodes human-readable pluginServer text without changing identifiers or URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          plugin: {
            pluginServerId: "dev.example.plugin-server&amp;stable",
            displayName: "Example &amp; Plugin Server",
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
      extractFromCustomPluginServer(
        {
          id: "pluginServer-one",
          baseUrl: "https://plugin-server.example",
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
      pluginName: "Example & Plugin Server",
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
      getCustomPluginServerMetadata(
        {
          id: "pluginServer-one",
          baseUrl: "https://plugin-server.example",
          apiKey: "secret",
          manifest: JSON.stringify({
            protocolVersion: "1.0",
            pluginServerId: "dev.example.plugin-server",
            displayName: "Example Plugin Server",
            auth: { type: "bearer" },
            usage: { endpoint: "/usage" },
            matchers: [{ hosts: ["plugin-source-alpha.example"] }],
            features: {},
            extensions: {
              lynvo: {
                plugins: [
                  {
                    id: "plugin-source-alpha",
                    displayName: "Source Alpha",
                    iconUrl:
                      "https://plugin-server.example/icons/plugin-source-alpha.webp",
                    routesToPluginId: "plugin-source-beta",
                    status: "active",
                    version: "1.0.0",
                    hosts: ["plugin-source-alpha.example"],
                  },
                  {
                    id: "plugin-source-beta",
                    displayName: "Source Beta",
                    iconUrl:
                      "https://plugin-server.example/icons/plugin-source-beta.webp",
                    status: "active",
                    version: "1.0.0",
                    hosts: ["plugin-source-beta.example"],
                  },
                ],
              },
            },
          }),
          enabled: true,
          priority: 0,
        },
        "https://plugin-source-alpha.example/file"
      )
    )

    expect(metadata).toMatchObject({
      sourceName: "Source Alpha",
      routeSourceName: "Source Beta",
      routeSourceIconUrl:
        "https://plugin-server.example/icons/plugin-source-beta.webp",
    })
  })

  it("omits absent optional metadata so HTTP encoding can succeed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          plugin: {
            pluginServerId: "dev.example.plugin-server",
            displayName: "Example Plugin Server",
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
      extractFromCustomPluginServer(
        {
          id: "pluginServer-one",
          baseUrl: "https://plugin-server.example",
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
      pluginName: "Example Plugin Server",
      pluginId: "source-alpha",
      sourceName: "Source Alpha",
      schemaVersion: 3,
      pluginServerId: "pluginServer-one",
    })
    expect(findUndefinedPaths(result)).toEqual([])
  })
})

describe("selectCustomPluginServer", () => {
  it("does not select an enabled Plugin Server when it is unavailable", async () => {
    const pluginServer = {
      id: "pluginServer-one",
      baseUrl: "https://plugin-server.example",
      apiKey: "secret",
      manifest: createIncompleteStoredManifest("usage"),
      enabled: true,
      priority: 0,
      verificationStatus: "down",
    }

    const selected = await Effect.runPromise(
      selectCustomPluginServer([pluginServer], "https://source.example/title")
    )
    const selectedById = await Effect.runPromise(
      selectCustomPluginServer(
        [pluginServer],
        "https://source.example/title",
        pluginServer.id
      )
    )

    expect(selected).toBeUndefined()
    expect(selectedById).toBeUndefined()
  })

  it.each(incompleteManifestFields)(
    "does not route through a verified stored manifest when %s is missing",
    async (missingField) => {
      const pluginServer = {
        id: "pluginServer-one",
        baseUrl: "https://plugin-server.example",
        apiKey: "secret",
        manifest: createIncompleteStoredManifest(missingField),
        enabled: true,
        priority: 0,
        verificationStatus: "verified",
      }

      const selected = await Effect.runPromise(
        selectCustomPluginServer([pluginServer], "https://source.example/title")
      )

      expect(selected).toBeUndefined()
    }
  )

  it("does not select a verified Plugin Server with a malformed manifest", async () => {
    const pluginServer = {
      id: "pluginServer-one",
      baseUrl: "https://plugin-server.example",
      apiKey: "secret",
      manifest: "not-json",
      enabled: true,
      priority: 0,
      verificationStatus: "verified",
    }

    const selected = await Effect.runPromise(
      selectCustomPluginServer([pluginServer], "https://source.example/title")
    )

    expect(selected).toBeUndefined()
  })
})
