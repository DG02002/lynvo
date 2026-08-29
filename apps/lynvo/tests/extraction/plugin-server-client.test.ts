import { afterEach, describe, expect, it, vi } from "vitest"
import {
  PluginServerClient,
  HttpPluginServerTransport,
  ServiceBindingPluginServerTransport,
  type PluginServerClientError,
  type PluginServerTransport,
} from "~/lib/extraction/plugin-server-client"
import { PLUGIN_SERVER_REQUEST_TIMEOUT_MS } from "~/lib/constants"

const manifest = {
  protocolVersion: "1.0",
  pluginServerId: "dev.example.plugin-server",
  displayName: "Example",
  auth: { type: "bearer" },
  usage: { endpoint: "/usage" },
  matchers: [{ hosts: ["source.example"] }],
  features: { basicAuth: true },
  extensions: {
    lynvo: {
      plugins: [
        {
          id: "example",
          displayName: "Example",
          iconUrl: "https://source.example/icon.webp",
          status: "active",
          version: "1.0.0",
          hosts: ["source.example"],
        },
      ],
    },
  },
}

afterEach(() => vi.unstubAllGlobals())

describe("PluginServerClient", () => {
  it("allows the Lynvo Plugin Server to finish its bounded retry budget", () => {
    expect(PLUGIN_SERVER_REQUEST_TIMEOUT_MS).toBeGreaterThan(45_000)
  })

  it.each([
    [
      "HTTP",
      () => new HttpPluginServerTransport("https://plugin-server.example"),
      true,
    ],
    [
      "service binding",
      (transport: PluginServerTransport) =>
        new ServiceBindingPluginServerTransport(transport),
      false,
    ],
  ])(
    "uses the same request contract over %s",
    async (_name, createTransport, rewritesOrigin) => {
      const requests: Request[] = []
      const transport: PluginServerTransport = {
        fetch: async (request) => {
          requests.push(request.clone())
          return request.url.endsWith("/manifest")
            ? Response.json(manifest)
            : Response.json({
                plugin: {
                  pluginServerId: "dev.example.plugin-server",
                  displayName: "Example",
                },
                nodes: [],
                extensions: {},
              })
        },
      }
      if (rewritesOrigin) {
        vi.stubGlobal("fetch", transport.fetch)
      }
      const client = new PluginServerClient(createTransport(transport))

      await client.getManifest({ requestId: "request-1" })
      await client.extractSource("https://source.example/file", {
        apiKey: "secret",
        requestId: "request-2",
        operationId: "request-2:source",
        basicAuth: { username: "viewer", password: "safe" },
      })

      expect(new URL(requests[0].url).hostname).toBe(
        rewritesOrigin ? "plugin-server.example" : "plugin-server.internal"
      )
      expect(requests[0].headers.get("x-request-id")).toBe("request-1")
      expect(requests[1].headers.get("Authorization")).toBe("Bearer secret")
      expect(requests[1].headers.get("x-request-id")).toBe("request-2")
      expect(requests[1].headers.get("x-operation-id")).toBe("request-2:source")
      expect(await requests[1].json()).toEqual({
        input: { kind: "source", sourceUrl: "https://source.example/file" },
        basicAuth: { username: "viewer", password: "safe" },
      })
    }
  )

  it("decodes protocol failures", async () => {
    const client = new PluginServerClient({
      fetch: async () =>
        Response.json(
          {
            ok: false,
            error: { code: "RATE_LIMITED", message: "Slow down" },
            extensions: {},
          },
          { status: 429 }
        ),
    })

    await expect(
      client.extractNode("https://source.example/file", {})
    ).rejects.toMatchObject<Partial<PluginServerClientError>>({
      code: "RATE_LIMITED",
      status: 429,
    })
  })

  it("rejects a manifest that is structurally valid but semantically incomplete", async () => {
    const { usage: declaredUsage, ...manifestWithoutUsage } = manifest
    const client = new PluginServerClient({
      fetch: async () => Response.json(manifestWithoutUsage),
    })

    await expect(client.getManifest()).rejects.toMatchObject<
      Partial<PluginServerClientError>
    >({
      code: "PROTOCOL_MISMATCH",
    })
    expect(declaredUsage).toEqual({ endpoint: "/usage" })
  })

  it("rejects usage that exceeds its declared finite limit", async () => {
    const client = new PluginServerClient({
      fetch: async () =>
        Response.json({
          metrics: [
            {
              id: "operations",
              label: "Operations",
              used: 11,
              limit: 10,
              unit: "operations",
              period: "daily",
              resetsAt: "2026-07-20T00:00:00.000Z",
            },
          ],
        }),
    })

    await expect(client.getUsage({})).rejects.toMatchObject<
      Partial<PluginServerClientError>
    >({
      code: "PROTOCOL_MISMATCH",
    })
  })

  it("rejects extraction responses with invalid icon metadata", async () => {
    const client = new PluginServerClient({
      fetch: async () =>
        Response.json({
          plugin: {
            pluginServerId: "dev.example.plugin-server",
            displayName: "Example",
            pluginIconUrl: "https://source.example/plugin.gif",
          },
          nodes: [],
          extensions: {},
        }),
    })

    await expect(
      client.extractSource("https://source.example/file", {})
    ).rejects.toMatchObject<Partial<PluginServerClientError>>({
      code: "PROTOCOL_MISMATCH",
    })
  })

  it("sends structured credentials to standardized discovery", async () => {
    const requests: Request[] = []
    const client = new PluginServerClient({
      fetch: async (request) => {
        requests.push(request.clone())
        return Response.json({
          matched: true,
          pluginId: "example",
          confidence: "verified",
        })
      },
    })

    await expect(
      client.discover("https://source.example/path", {
        apiKey: "secret",
        basicAuth: { username: "viewer", password: "safe" },
      })
    ).resolves.toEqual({
      matched: true,
      pluginId: "example",
      confidence: "verified",
    })
    expect(await requests[0].json()).toEqual({
      url: "https://source.example/path",
      basicAuth: { username: "viewer", password: "safe" },
    })
  })
})
