import type { DiscoverResponse } from "@dg02002/lynvo-plugin-server-protocol"
import { Effect } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"

import { extractWithCustomPluginServer } from "~/lib/effect/services/custom-extraction-adapter"
import type { RegisteredPluginServer } from "~/lib/effect/services/extraction-types"
import { PluginCredentialVault } from "~/lib/effect/services/plugin-credential-vault"

afterEach(() => {
  vi.unstubAllGlobals()
})

// SAFETY: The adapter only reads the environment binding it is given.
const environment = {} as Env

const noCredentialVault = PluginCredentialVault.of({
  encrypt: () => Effect.die(new Error("Unexpected credential write")),
  decrypt: () => Effect.die(new Error("Unexpected credential read")),
})

// The server-level matcher owns the host while the plugin's own hosts do
// not match the URL, so routing has to go through discovery.
const discoveryManifest = (displayName: string) =>
  JSON.stringify({
    protocolVersion: "1.0",
    pluginServerId: "dev.example.plugin-server",
    displayName,
    auth: { type: "bearer" },
    usage: { endpoint: "/usage" },
    matchers: [{ hosts: ["source.example"] }],
    features: { discovery: true },
    extensions: {
      lynvo: {
        plugins: [
          {
            id: "discovered-source",
            displayName: "Discovered Source",
            status: "active",
            version: "1.0.0",
            hosts: ["unrelated.example"],
          },
        ],
      },
    },
  })

const createPluginServer = (
  id: string,
  manifest: string
): RegisteredPluginServer => ({
  id,
  baseUrl: `https://${id}.plugin-server.example`,
  apiKey: "secret",
  manifest,
  enabled: true,
  priority: 0,
  proxyEnabled: false,
  verificationStatus: "verified",
})

interface RecordedRequest {
  readonly path: string
  readonly body: unknown
}

const stubPluginServerHttp = (discovery: DiscoverResponse) => {
  const requests: RecordedRequest[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const request = new Request(input)
    const path = new URL(request.url).pathname
    const body = await request
      .clone()
      .json()
      .catch(() => undefined)
    requests.push({ path, body })
    if (path === "/discover") {
      return Response.json(discovery)
    }
    return Response.json({
      plugin: {
        pluginServerId: "dev.example.plugin-server",
        displayName: "Example Plugin Server",
      },
      nodes: [],
      extensions: {},
    })
  })
  vi.stubGlobal("fetch", fetchMock)
  return {
    requests,
    discoverCalls: () => requests.filter((entry) => entry.path === "/discover"),
  }
}

const extractFrom = (pluginServer: RegisteredPluginServer, targetUrl: string) =>
  Effect.runPromise(
    extractWithCustomPluginServer(noCredentialVault, [pluginServer], {
      environment,
      targetUrl,
      userId: "user-1",
      requestId: "request-1",
      kind: "source",
    })
  )

describe("extractWithCustomPluginServer discovery caching", () => {
  it("reuses a discovery result across extraction retries", async () => {
    const pluginServer = createPluginServer(
      "discovery-reuse",
      discoveryManifest("Discovery Reuse")
    )
    const http = stubPluginServerHttp({
      matched: true,
      pluginId: "discovered-source",
      confidence: "pattern",
    })

    const first = await extractFrom(
      pluginServer,
      "https://source.example/title/1"
    )
    const second = await extractFrom(
      pluginServer,
      "https://source.example/title/1"
    )

    expect(first).toBeDefined()
    expect(second).toEqual(first)
    expect(http.discoverCalls()).toHaveLength(1)
    const extractRequests = http.requests.filter(
      (entry) => entry.path === "/extract"
    )
    expect(extractRequests).toHaveLength(2)
    for (const extractRequest of extractRequests) {
      expect(extractRequest.body).toMatchObject({
        input: { kind: "source", sourceUrl: "https://source.example/title/1" },
        pluginId: "discovered-source",
      })
    }
  })

  it("rediscovers after the server's manifest changes", async () => {
    const pluginServer = createPluginServer(
      "discovery-refresh",
      discoveryManifest("Before Refresh")
    )
    const http = stubPluginServerHttp({
      matched: true,
      pluginId: "discovered-source",
      confidence: "pattern",
    })

    await extractFrom(pluginServer, "https://source.example/title/2")
    expect(http.discoverCalls()).toHaveLength(1)

    await extractFrom(
      { ...pluginServer, manifest: discoveryManifest("After Refresh") },
      "https://source.example/title/2"
    )
    expect(http.discoverCalls()).toHaveLength(2)
  })
})
