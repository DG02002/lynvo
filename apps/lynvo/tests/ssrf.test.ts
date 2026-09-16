import { sleep } from "@dg02002/lynvo-plugin-server-protocol"
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

  it.each([301, 302, 303])(
    "cancels every intermediate redirect body and converts POST to GET after %s",
    async (status) => {
      const firstRedirectResponse = new Response("first redirect body", {
        status: 307,
        headers: { Location: "https://public.example/intermediate" },
      })
      const secondRedirectResponse = new Response("second redirect body", {
        status,
        headers: { Location: "https://public.example/final" },
      })
      const firstCancel = vi.spyOn(firstRedirectResponse.body!, "cancel")
      const secondCancel = vi.spyOn(secondRedirectResponse.body!, "cancel")
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(firstRedirectResponse)
        .mockResolvedValueOnce(secondRedirectResponse)
        .mockResolvedValueOnce(new Response("final body"))
      const transport = createOutboundHttpTransport({ fetch })

      await expect(
        transport.fetch("https://public.example/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": "request-1",
          },
          body: "request body",
        })
      ).resolves.toMatchObject({ status: 200 })

      expect(firstCancel).toHaveBeenCalledOnce()
      expect(secondCancel).toHaveBeenCalledOnce()
      expect(fetch).toHaveBeenCalledTimes(3)
      const intermediateRequest = fetch.mock.calls[1]?.[0]
      expect(intermediateRequest).toBeInstanceOf(Request)
      expect(intermediateRequest).toMatchObject({ method: "POST" })
      if (!(intermediateRequest instanceof Request)) {
        throw new Error("Expected the intermediate fetch input to be a Request")
      }
      await expect(intermediateRequest.clone().text()).resolves.toBe(
        "request body"
      )
      const finalRequest = fetch.mock.calls[2]?.[0]
      expect(finalRequest).toBeInstanceOf(Request)
      expect(finalRequest).toMatchObject({ method: "GET", body: null })
      if (!(finalRequest instanceof Request)) {
        throw new Error("Expected the final fetch input to be a Request")
      }
      await expect(finalRequest.clone().text()).resolves.toBe("")
    }
  )

  it("keeps the request timeout active while reading the response body", async () => {
    let pullStarted!: () => void
    const pullStartedPromise = new Promise<void>((resolve) => {
      pullStarted = resolve
    })
    let releasePull!: () => void
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pullStarted()
          return new Promise<void>((resolve) => {
            releasePull = () => {
              resolve()
              controller.error(new Error("test body released"))
            }
          })
        },
      },
      { highWaterMark: 0 }
    )
    let requestSignal: AbortSignal | undefined
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementationOnce(async (request) => {
        requestSignal = request instanceof Request ? request.signal : undefined
        return new Response(body)
      })
    const transport = createOutboundHttpTransport({ fetch })
    const result = transport.fetch("https://public.example/slow", {
      timeoutMs: 5,
    })
    const outcome = expect(result).rejects.toMatchObject({
      name: "TimeoutError",
    })

    await pullStartedPromise
    await sleep(20)
    try {
      expect(requestSignal?.aborted).toBe(true)
    } finally {
      releasePull()
    }
    await outcome
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
    let cancelled = false
    let requestSignal: AbortSignal | undefined
    const body = new ReadableStream<Uint8Array>(
      {
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
        cancel() {
          cancelled = true
        },
      },
      { highWaterMark: 0 }
    )
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementationOnce(async (request) => {
        requestSignal = request instanceof Request ? request.signal : undefined
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
    expect(cancelled).toBe(true)
    expect(requestSignal?.aborted).toBe(true)
  })

  it("preserves the size error when aborting errors the response body", async () => {
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

    await expect(
      transport.fetch("https://public.example/aborted-oversized", {
        maximumResponseBytes,
      })
    ).rejects.toMatchObject({
      code: "RESPONSE_TOO_LARGE",
      message: "Outbound response exceeded the byte limit",
    })
    expect(bytesPulled).toBeLessThan(totalChunks * chunkSize)
    expect(bytesPulled).toBeLessThanOrEqual(maximumResponseBytes + chunkSize)
    expect(responseBodyAborted).toBe(true)
    expect(requestSignal?.aborted).toBe(true)
  })
})
