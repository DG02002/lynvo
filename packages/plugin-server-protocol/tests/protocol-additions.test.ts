import { describe, expect, it } from "vitest"
import { Result, Schema } from "effect"
import {
  ProtocolError,
  createGroupNode,
  createPlayableNode,
  createResolvableNode,
  extractSuccessSchema,
  isCompatibleProtocolVersion,
  isProtocolError,
  mediaNodeSchema,
  toProtocolErrorResponse,
  usageResponseSchema,
  validExtractPendingFixture,
  validPluginServerManifestFixture,
  validUsageResponseFixture,
  createPluginServerRuntime,
} from "../src/index"

describe("protocol errors", () => {
  it("serializes typed errors with retry guidance", async () => {
    const error = new ProtocolError("RATE_LIMITED", "Capacity exhausted.", {
      retryAfterSeconds: 900,
    })
    expect(isProtocolError(error)).toBe(true)
    const response = toProtocolErrorResponse(error)
    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("900")
    // SAFETY: the response body is serialized by toProtocolErrorResponse,
    // whose envelope is exactly this error shape.
    const body = (await response.json()) as {
      error: { code: string; retryAfterSeconds?: number }
    }
    expect(body.error.code).toBe("RATE_LIMITED")
    expect(body.error.retryAfterSeconds).toBe(900)
  })

  it("serializes typed errors without retry guidance", async () => {
    const response = toProtocolErrorResponse(
      new ProtocolError("NODE_EXPIRED", "The link expired.")
    )
    expect(response.status).toBe(410)
    expect(response.headers.get("retry-after")).toBeNull()
  })

  it("does not classify ordinary errors", () => {
    expect(isProtocolError(new Error("RATE_LIMITED"))).toBe(false)
  })
})

describe("node factories", () => {
  it("produces schema-conforming playable nodes", () => {
    const node = createPlayableNode({
      url: "https://media.example/file.mp4",
      label: "File",
      expiry: Date.now() + 60_000,
      expirySource: "signed-url",
    })
    expect(
      Result.isSuccess(Schema.decodeUnknownResult(mediaNodeSchema)(node))
    ).toBe(true)
  })

  it("produces schema-conforming resolvable nodes", () => {
    const node = createResolvableNode({
      label: "Folder",
      nodeUrl: "https://media.example/folder",
      resolutionKind: "folder",
    })
    expect(
      Result.isSuccess(Schema.decodeUnknownResult(mediaNodeSchema)(node))
    ).toBe(true)
  })

  it("produces schema-conforming group nodes with nested children", () => {
    const node = createGroupNode({
      label: "Season",
      children: [
        createPlayableNode({
          url: "https://media.example/1.mp4",
          label: "Episode 1",
        }),
      ],
    })
    expect(
      Result.isSuccess(Schema.decodeUnknownResult(mediaNodeSchema)(node))
    ).toBe(true)
  })
})

describe("usage resetsAt validation", () => {
  it("accepts ISO timestamps and rejects other strings", () => {
    const metric = {
      id: "metric",
      label: "Metric",
      used: 1,
      limit: 30,
      unit: "extractions",
      period: "daily",
      resetsAt: new Date(Date.UTC(2026, 7, 28)).toISOString(),
    }
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(usageResponseSchema)({ metrics: [metric] })
      )
    ).toBe(true)
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(usageResponseSchema)({
          metrics: [{ ...metric, resetsAt: "tomorrow" }],
        })
      )
    ).toBe(false)
  })
})

describe("deferred extraction", () => {
  it("accepts a pending response with retry guidance", () => {
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(extractSuccessSchema)(
          validExtractPendingFixture
        )
      )
    ).toBe(true)
    expect(validExtractPendingFixture.pending?.retryAfterSeconds).toBe(30)
  })

  it("rejects pending responses without a positive retry interval", () => {
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(extractSuccessSchema)({
          ...validExtractPendingFixture,
          pending: { retryAfterSeconds: 0 },
        })
      )
    ).toBe(false)
  })
})

describe("runtime lifecycle hooks", () => {
  it("observes accepted requests and decoded results without re-parsing", async () => {
    const accepted: string[] = []
    const results: string[] = []
    const runtime = createPluginServerRuntime({
      manifest: validPluginServerManifestFixture,
      auth: { validate: () => true },
      usage: () => ({ metrics: validUsageResponseFixture.metrics }),
      extract: () => ({
        plugin: {
          pluginServerId: "example-media",
          displayName: "Example Media",
        },
        nodes: [],
        extensions: {},
      }),
      onExtractAccepted: (context) => {
        accepted.push(context.targetUrl)
      },
      onExtractResult: (context) => {
        results.push(
          context.result.ok === false ? context.result.error.code : "success"
        )
      },
    })
    const request = new Request("https://server.example/extract", {
      method: "POST",
      body: JSON.stringify({
        input: { kind: "source", sourceUrl: "https://media.example.com/video" },
      }),
    })
    const response = await runtime.handleExtract(request, {})
    expect(response.status).toBe(200)
    expect(accepted).toEqual(["https://media.example.com/video"])
    expect(results).toEqual(["success"])
  })
})

describe("usage deltas and node extensions", () => {
  it("accepts usage deltas and node extensions on extract success", () => {
    const response = {
      plugin: {
        pluginServerId: "dev.lynvo.example-plugin-server",
        displayName: "Example Plugin Server",
      },
      nodes: [
        {
          kind: "playable",
          label: "Video",
          url: "https://media.example.com/v.mp4",
          extensions: { vendor: { subtitle: "en" } },
        },
      ],
      extensions: {},
      usageDelta: [{ id: "proxy-credits", used: 2, unit: "credits" }],
    }
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(extractSuccessSchema)(response)
      )
    ).toBe(true)
  })

  it("rejects negative usage deltas", () => {
    const response = {
      plugin: {
        pluginServerId: "dev.lynvo.example-plugin-server",
        displayName: "Example Plugin Server",
      },
      nodes: [],
      extensions: {},
      usageDelta: [{ id: "proxy-credits", used: -1 }],
    }
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(extractSuccessSchema)(response)
      )
    ).toBe(false)
  })
})

describe("protocol version compatibility", () => {
  it("accepts any minor within the current major", () => {
    expect(isCompatibleProtocolVersion("1.0")).toBe(true)
    expect(isCompatibleProtocolVersion("1.4")).toBe(true)
    expect(isCompatibleProtocolVersion("2.0")).toBe(false)
    expect(isCompatibleProtocolVersion("1")).toBe(false)
    expect(isCompatibleProtocolVersion("1.x")).toBe(false)
  })
})
