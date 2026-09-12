import { describe, expect, it, vi } from "vitest"
import {
  createOutboundHttpTransport,
  OutboundHttpError,
} from "~/lib/outbound-http"

describe("outbound HTTP safety boundary", () => {
  it.each([
    "http://127.0.0.1/resource",
    "http://2130706433/resource",
    "http://0x7f000001/resource",
    "http://0177.0.0.1/resource",
    "http://localhost/resource",
    "http://media.localhost/resource",
    "http://[::]/resource",
    "http://[::1]/resource",
    "http://[::ffff:127.0.0.1]/resource",
    "http://[64:ff9b::7f00:1]/resource",
    "http://[64:ff9b:1::7f00:1]/resource",
    "http://[fec0::1]/resource",
    "http://[2001:0::1]/resource",
    "http://[2002::1]/resource",
    "http://192.88.99.1/resource",
    "http://169.254.169.254/latest/meta-data",
    "https://user:password@example.com/resource",
  ])("rejects a non-public destination: %s", async (url) => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    const transport = createOutboundHttpTransport({ fetch })

    await expect(transport.fetch(url)).rejects.toBeInstanceOf(OutboundHttpError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("validates every redirect before following it", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: "http://127.0.0.1/private" },
      })
    )
    const transport = createOutboundHttpTransport({ fetch })

    await expect(
      transport.fetch("https://public.example/start")
    ).rejects.toMatchObject({ code: "UNSAFE_DESTINATION" })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it("never forwards protected credentials across origins", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
      new Response(null, {
        status: 307,
        headers: { Location: "https://other.example/final" },
      })
    )
    const transport = createOutboundHttpTransport({ fetch })

    await expect(
      transport.fetch("https://plugin.example/usage", {
        headers: { Authorization: "Bearer secret" },
        protectedOrigin: "https://plugin.example",
      })
    ).rejects.toMatchObject({ code: "CROSS_ORIGIN_REDIRECT" })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it("stops consuming an oversized response as soon as it exceeds the limit", async () => {
    const maximumResponseBytes = 8
    const chunkSize = 4
    const totalChunks = 100
    let chunksPulled = 0
    let bytesPulled = 0
    let responseBodyAborted = false
    let responseBodyController:
      | ReadableStreamDefaultController<Uint8Array>
      | undefined
    let requestSignal: AbortSignal | undefined
    const body = new ReadableStream<Uint8Array>(
      {
        start(controller) {
          responseBodyController = controller
        },
        pull(controller) {
          if (chunksPulled === totalChunks) {
            controller.close()
            return
          }
          chunksPulled += 1
          const chunk = new Uint8Array(chunkSize)
          bytesPulled += chunk.byteLength
          controller.enqueue(chunk)
        },
      },
      { highWaterMark: 0 }
    )
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementationOnce(async (request) => {
        requestSignal = request instanceof Request ? request.signal : undefined
        requestSignal?.addEventListener(
          "abort",
          () => {
            responseBodyAborted = true
            responseBodyController?.error(new Error("Request aborted"))
          },
          { once: true }
        )
        return new Response(body)
      })
    const transport = createOutboundHttpTransport({ fetch })

    const response = transport.fetch("https://public.example/oversized", {
      maximumResponseBytes,
    })

    await expect(response).rejects.toBeInstanceOf(OutboundHttpError)
    await expect(response).rejects.toMatchObject({
      code: "RESPONSE_TOO_LARGE",
      message: "Outbound response exceeded the byte limit",
    })
    expect(bytesPulled).toBeLessThan(totalChunks * chunkSize)
    expect(bytesPulled).toBeLessThanOrEqual(maximumResponseBytes + chunkSize)
    expect(responseBodyAborted).toBe(true)
    expect(requestSignal?.aborted).toBe(true)
  })
})
