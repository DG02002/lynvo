import { describe, expect, it, vi } from "vitest"
import {
  createPluginServerRuntime,
  isSupportedProtocolVersion,
  type ExtractSuccessResponse,
  type PluginServerManifest,
  type UsageResponse,
} from "@lynvo/plugin-server-protocol"

interface TestEnv {
  validApiKey: string
}

const createRequest = (body: unknown, apiKey = "secret") =>
  new Request("https://pluginServer.example/extract", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

const manifest: PluginServerManifest = {
  protocolVersion: "1.0",
  pluginServerId: "dev.example.plugin-server",
  displayName: "Example Plugin Server",
  auth: { type: "bearer" },
  usage: { endpoint: "/usage" },
  matchers: [{ hosts: ["source.example"], pathPatterns: ["/**"] }],
  features: { password: true, lazyNodes: true },
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
}

const createRuntime = (
  extract: () => ExtractSuccessResponse | Promise<ExtractSuccessResponse>,
  usage: () => UsageResponse | Promise<UsageResponse> = () => ({
    metrics: [
      {
        id: "operations",
        label: "Operations",
        used: 0,
        limit: 10,
        unit: "operations",
        period: "daily",
        resetsAt: "2026-07-20T00:00:00.000Z",
      },
    ],
  }),
  runtimeManifest: PluginServerManifest = manifest
) =>
  createPluginServerRuntime<TestEnv>({
    manifest: runtimeManifest,
    auth: {
      validate: ({ request, env }) =>
        request.headers.get("Authorization") === `Bearer ${env.validApiKey}`,
    },
    extract,
    usage,
  })

describe("createPluginServerRuntime", () => {
  it("declares supported protocol versions", () => {
    expect(isSupportedProtocolVersion("1.0")).toBe(true)
    expect(isSupportedProtocolVersion("2.0")).toBe(false)
  })

  it("rejects a structurally valid manifest that fails semantic contract validation", async () => {
    const { usage: declaredUsage, ...manifestWithoutUsage } = manifest
    const runtime = createRuntime(
      () => ({
        plugin: {
          pluginServerId: "dev.example.plugin-server",
          displayName: "Example Plugin Server",
        },
        nodes: [],
        extensions: {},
      }),
      undefined,
      manifestWithoutUsage as unknown as PluginServerManifest
    )

    const response = await runtime.handleManifest(
      new Request("https://pluginServer.example/manifest"),
      { validApiKey: "secret" }
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      error: { code: "PROTOCOL_MISMATCH" },
    })
    expect(declaredUsage).toEqual({ endpoint: "/usage" })
  })

  it("serves a validated manifest", async () => {
    const runtime = createRuntime(() => ({
      plugin: {
        pluginServerId: "dev.example.plugin-server",
        displayName: "Example Plugin Server",
      },
      nodes: [],
      extensions: {},
    }))

    const response = await runtime.handleManifest(
      new Request("https://pluginServer.example/manifest"),
      { validApiKey: "secret" }
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      protocolVersion: "1.0",
      pluginServerId: "dev.example.plugin-server",
    })
  })

  it("verifies bearer auth", async () => {
    const runtime = createRuntime(() => ({
      plugin: {
        pluginServerId: "dev.example.plugin-server",
        displayName: "Example Plugin Server",
      },
      nodes: [],
      extensions: {},
    }))

    const ok = await runtime.handleVerify(
      new Request("https://pluginServer.example/verify", {
        method: "POST",
        headers: { Authorization: "Bearer secret" },
      }),
      { validApiKey: "secret" }
    )
    const denied = await runtime.handleVerify(
      new Request("https://pluginServer.example/verify", {
        method: "POST",
        headers: { Authorization: "Bearer wrong" },
      }),
      { validApiKey: "secret" }
    )

    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ ok: true })
    expect(denied.status).toBe(401)
    expect(await denied.json()).toMatchObject({
      error: { code: "AUTH_INVALID" },
    })
  })

  it("serves authenticated finite usage metrics", async () => {
    const runtime = createRuntime(() => ({
      plugin: {
        pluginServerId: "dev.example.plugin-server",
        displayName: "Example Plugin Server",
      },
      nodes: [],
      extensions: {},
    }))
    const response = await runtime.handleUsage(
      new Request("https://pluginServer.example/usage", {
        headers: { Authorization: "Bearer secret" },
      }),
      { validApiKey: "secret" }
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      metrics: [{ id: "operations", limit: 10 }],
    })
  })

  it("rejects usage that exceeds a declared finite limit", async () => {
    const runtime = createRuntime(
      () => ({
        plugin: {
          pluginServerId: "dev.example.plugin-server",
          displayName: "Example Plugin Server",
        },
        nodes: [],
        extensions: {},
      }),
      () => ({
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
      })
    )

    const response = await runtime.handleUsage(
      new Request("https://pluginServer.example/usage", {
        headers: { Authorization: "Bearer secret" },
      }),
      { validApiKey: "secret" }
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      error: { code: "PROTOCOL_MISMATCH" },
    })
  })

  it("extracts matching URLs", async () => {
    const runtime = createRuntime(() => ({
      plugin: {
        pluginServerId: "dev.example.plugin-server",
        displayName: "Example Plugin Server",
      },
      nodes: [
        {
          kind: "playable",
          id: "main",
          label: "Main",
          url: "https://cdn.example/file.mp4",
        },
      ],
      extensions: {},
    }))

    const response = await runtime.handleExtract(
      createRequest({
        input: { kind: "source", sourceUrl: "https://source.example/title" },
      }),
      { validApiKey: "secret" }
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      nodes: [{ kind: "playable", id: "main" }],
    })
  })

  it("rejects invalid JSON bodies", async () => {
    const runtime = createRuntime(() => ({
      plugin: {
        pluginServerId: "dev.example.plugin-server",
        displayName: "Example Plugin Server",
      },
      nodes: [],
      extensions: {},
    }))

    const response = await runtime.handleExtract(
      new Request("https://pluginServer.example/extract", {
        method: "POST",
        headers: { Authorization: "Bearer secret" },
        body: "{",
      }),
      { validApiKey: "secret" }
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: { code: "BAD_REQUEST" },
    })
  })

  it("rejects unsupported URLs before calling extract", async () => {
    const extract = vi.fn(() => ({
      plugin: {
        pluginServerId: "dev.example.plugin-server",
        displayName: "Example Plugin Server",
      },
      nodes: [],
      extensions: {},
    }))
    const runtime = createRuntime(extract)

    const response = await runtime.handleExtract(
      createRequest({
        input: {
          kind: "source",
          sourceUrl: "https://unsupported.example/title",
        },
      }),
      { validApiKey: "secret" }
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: { code: "UNSUPPORTED_URL" },
    })
    expect(extract).not.toHaveBeenCalled()
  })

  it("returns protocol mismatch when extract returns invalid output", async () => {
    const runtime = createPluginServerRuntime<TestEnv>({
      manifest: {
        protocolVersion: "1.0",
        pluginServerId: "dev.example.plugin-server",
        displayName: "Example Plugin Server",
        auth: { type: "bearer" },
        usage: { endpoint: "/usage" },
        matchers: [{ hosts: ["source.example"] }],
        features: { password: true, lazyNodes: true },
        extensions: {},
      },
      auth: { validate: () => true },
      extract: () =>
        ({
          plugin: {
            pluginServerId: "dev.example.plugin-server",
            displayName: "Example Plugin Server",
          },
          nodes: [{ kind: "playable", id: "bad", label: "Bad" }],
          extensions: {},
        }) as unknown as ExtractSuccessResponse,
      usage: () => ({
        metrics: [
          {
            id: "operations",
            label: "Operations",
            used: 0,
            limit: 10,
            unit: "operations",
            period: "daily",
            resetsAt: "2026-07-20T00:00:00.000Z",
          },
        ],
      }),
    })

    const response = await runtime.handleExtract(
      createRequest({
        input: { kind: "source", sourceUrl: "https://source.example/title" },
      }),
      { validApiKey: "secret" }
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      error: { code: "PROTOCOL_MISMATCH" },
    })
  })

  it("rejects extraction responses with invalid icon metadata", async () => {
    const runtime = createRuntime(() => ({
      plugin: {
        pluginServerId: "dev.example.plugin-server",
        displayName: "Example Plugin Server",
        pluginIconUrl: "https://source.example/plugin.svg",
      },
      nodes: [],
      extensions: {},
    }))

    const response = await runtime.handleExtract(
      createRequest({
        input: { kind: "source", sourceUrl: "https://source.example/title" },
      }),
      { validApiKey: "secret" }
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      error: { code: "PROTOCOL_MISMATCH" },
    })
  })

  it("maps password errors to PASSWORD_REQUIRED", async () => {
    const runtime = createRuntime(() => {
      throw new Error("PASSWORD_REQUIRED")
    })

    const response = await runtime.handleExtract(
      createRequest({
        input: { kind: "source", sourceUrl: "https://source.example/title" },
      }),
      { validApiKey: "secret" }
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      error: { code: "PASSWORD_REQUIRED" },
    })
  })
})
