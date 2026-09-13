import { describe, expect, it, vi } from "vitest"
import { fetchValidatedRedirects, ValidatedFetchError } from "../src/index"

const validateUrl = (value: string | URL): URL => new URL(value)

const fetchConfiguration = {
  validateUrl,
  maxRedirects: 4,
  timeoutMs: 1_000,
  maximumResponseBytes: 1_024,
  responseBodyMode: "read" as const,
  stripHeadersOnCrossOrigin: ["Authorization"],
}

describe("validated outbound fetch", () => {
  it.each([301, 302, 303])(
    "cancels redirect bodies and converts POST to GET after %s",
    async (status) => {
      const firstRedirectResponse = new Response("first redirect body", {
        status: 307,
        headers: { Location: "https://media.example/intermediate" },
      })
      const secondRedirectResponse = new Response("second redirect body", {
        status,
        headers: { Location: "https://other.example/final" },
      })
      const firstCancel = vi.spyOn(firstRedirectResponse.body!, "cancel")
      const secondCancel = vi.spyOn(secondRedirectResponse.body!, "cancel")
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(firstRedirectResponse)
        .mockResolvedValueOnce(secondRedirectResponse)
        .mockResolvedValueOnce(new Response("final body"))

      await expect(
        fetchValidatedRedirects(
          "https://media.example/start",
          {
            method: "POST",
            headers: {
              Authorization: "Basic secret",
              "Content-Type": "application/json",
            },
            body: "request body",
          },
          { ...fetchConfiguration, fetch }
        )
      ).resolves.toMatchObject({ status: 200 })

      expect(firstCancel).toHaveBeenCalledOnce()
      expect(secondCancel).toHaveBeenCalledOnce()
      expect(fetch).toHaveBeenCalledTimes(3)
      expect(fetch.mock.calls[1]?.[1]).toMatchObject({
        method: "POST",
        body: "request body",
        redirect: "manual",
      })
      expect(fetch.mock.calls[2]?.[1]).toMatchObject({
        method: "GET",
        body: null,
        redirect: "manual",
      })
      const finalHeaders = new Headers(fetch.mock.calls[2]?.[1]?.headers)
      expect(finalHeaders.has("Authorization")).toBe(false)
      expect(finalHeaders.has("Content-Type")).toBe(false)
    }
  )

  it("keeps the timeout active while reading a buffered response body", async () => {
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
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(body))
    const result = fetchValidatedRedirects(
      "https://media.example/slow",
      {},
      { ...fetchConfiguration, fetch, timeoutMs: 5 }
    )
    const outcome = expect(result).rejects.toMatchObject({
      name: "TimeoutError",
    })

    await pullStartedPromise
    await new Promise((resolve) => setTimeout(resolve, 20))
    const requestSignal = fetch.mock.calls[0]?.[1]?.signal
    try {
      expect(requestSignal?.aborted).toBe(true)
    } finally {
      releasePull()
    }
    await outcome
  })

  it("stops reading when the cumulative response exceeds its byte limit", async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(9))
      },
      cancel() {
        cancelled = true
      },
    })
    const response = new Response(body)
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(response)

    await expect(
      fetchValidatedRedirects(
        "https://media.example/oversized",
        {},
        { ...fetchConfiguration, fetch, maximumResponseBytes: 8 }
      )
    ).rejects.toMatchObject({
      code: "RESPONSE_TOO_LARGE",
      message: "Response exceeded its byte limit.",
    })
    expect(cancelled).toBe(true)
  })

  it("uses a typed error for a redirect limit failure", async () => {
    const redirectResponse = new Response(null, {
      status: 302,
      headers: { Location: "https://media.example/next" },
    })
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(redirectResponse)

    await expect(
      fetchValidatedRedirects(
        "https://media.example/start",
        {},
        { ...fetchConfiguration, fetch, maxRedirects: 0 }
      )
    ).rejects.toBeInstanceOf(ValidatedFetchError)
    expect(fetch).toHaveBeenCalledOnce()
  })
})
