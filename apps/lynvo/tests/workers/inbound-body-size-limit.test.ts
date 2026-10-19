import { env } from "cloudflare:workers"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import app from "../../workers/app"
import { MAX_INBOUND_API_BODY_BYTES } from "../../workers/constants"
import { createInboundApiBodyLimitMiddleware } from "../../workers/inbound-api-body-limit"
import type { RequestLoggingEnvironment } from "../../workers/request-logging"

describe("inbound API body size limit", () => {
  it("returns 413 before parsing an oversized JSON request", async () => {
    const body = "x".repeat(MAX_INBOUND_API_BODY_BYTES + 1)
    const contentLength = new TextEncoder().encode(body).byteLength
    const response = await app.fetch(
      new Request("https://lynvo.test/api/auth/device/code", {
        method: "POST",
        headers: {
          "Content-Length": String(contentLength),
          "Content-Type": "application/json",
          Origin: "https://lynvo.test",
        },
        body,
      }),
      env
    )

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid_request",
      retryable: false,
    })
  })

  it("returns 413 when an oversized streamed body has no Content-Length", async () => {
    let chunksPulled = 0
    let cancelled = false
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          chunksPulled += 1
          controller.enqueue(
            new Uint8Array(chunksPulled === 1 ? MAX_INBOUND_API_BODY_BYTES : 1)
          )
        },
        cancel() {
          cancelled = true
        },
      },
      { highWaterMark: 0 }
    )
    const request = new Request("https://lynvo.test/api/auth/device/code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://lynvo.test",
      },
      body,
    })

    expect(request.headers.has("Content-Length")).toBe(false)
    const response = await app.fetch(request, env)

    expect(response.status).toBe(413)
    expect(chunksPulled).toBe(2)
    expect(cancelled).toBe(true)
  })

  it("returns retryable 408 and cancels a body that misses its read deadline", async () => {
    const timeoutController = new AbortController()
    let requestTimeoutSignal: AbortSignal | undefined
    const timeoutApp = new Hono<RequestLoggingEnvironment>()
    timeoutApp.use(
      "/api/*",
      createInboundApiBodyLimitMiddleware(50, () => {
        requestTimeoutSignal = timeoutController.signal
        return timeoutController.signal
      })
    )
    timeoutApp.post("/api/auth/device/code", (context) =>
      context.json({ success: true })
    )
    let sentChunk = false
    let chunksPulled = 0
    let cancelled = false
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          chunksPulled += 1
          if (!sentChunk) {
            sentChunk = true
            controller.enqueue(new Uint8Array([123]))
          }
        },
        cancel() {
          cancelled = true
        },
      },
      { highWaterMark: 0 }
    )
    const request = new Request("https://lynvo.test/api/auth/device/code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://lynvo.test",
      },
      body,
    })

    const responsePromise = timeoutApp.fetch(request, env)
    expect(requestTimeoutSignal).toBe(timeoutController.signal)
    timeoutController.abort(new DOMException("Timed out", "TimeoutError"))
    const response = await responsePromise

    expect(response.status).toBe(408)
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid_request",
      retryable: true,
    })
    expect(cancelled).toBe(true)
  }, 5_000)

  it("allows a normal-sized JSON mutation payload", async () => {
    const body = JSON.stringify({ deviceName: "Living room TV" })
    const contentLength = new TextEncoder().encode(body).byteLength
    const response = await app.fetch(
      new Request("https://lynvo.test/api/auth/device/code", {
        method: "POST",
        headers: {
          "Content-Length": String(contentLength),
          "Content-Type": "application/json",
          Origin: "https://lynvo.test",
        },
        body,
      }),
      env
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      deviceName: "Living room TV",
    })
  })
})
