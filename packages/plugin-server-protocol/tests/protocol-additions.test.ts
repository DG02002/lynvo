import { describe, expect, it } from "vitest"
import { Result, Schema } from "effect"
import {
  PROTOCOL_ERROR_STATUS,
  ProtocolError,
  createGroupNode,
  createPlayableNode,
  createResolvableNode,
  isCompatibleProtocolVersion,
  isProtocolError,
  mediaNodeSchema,
  toProtocolErrorResponse,
  usageResponseSchema,
} from "../src/index"

describe("protocol errors", () => {
  it("maps typed errors to the documented status table", () => {
    expect(PROTOCOL_ERROR_STATUS.RATE_LIMITED).toBe(429)
    expect(PROTOCOL_ERROR_STATUS.NODE_EXPIRED).toBe(410)
    expect(PROTOCOL_ERROR_STATUS.UNSUPPORTED_URL).toBe(400)
    expect(PROTOCOL_ERROR_STATUS.PERMANENT_FAILURE).toBe(500)
  })

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

describe("protocol version compatibility", () => {
  it("accepts any minor within the current major", () => {
    expect(isCompatibleProtocolVersion("1.0")).toBe(true)
    expect(isCompatibleProtocolVersion("1.4")).toBe(true)
    expect(isCompatibleProtocolVersion("2.0")).toBe(false)
    expect(isCompatibleProtocolVersion("1")).toBe(false)
    expect(isCompatibleProtocolVersion("1.x")).toBe(false)
  })
})
