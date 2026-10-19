import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"

import app from "../../workers/app"
import { MAX_INBOUND_API_BODY_BYTES } from "../../workers/constants"

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
