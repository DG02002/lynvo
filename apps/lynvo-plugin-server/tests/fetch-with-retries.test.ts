import { afterEach, describe, expect, it, vi } from "vitest"

import { EXTRACTION_ELAPSED_TIME_LIMIT_MS } from "../src/constants"
import {
  DEFAULT_SOURCE_RETRY_POLICY,
  fetchWithSourceRetries,
} from "../src/sources/fetch-with-retries"
import { UpstreamPolicyError } from "../src/upstream-response"

afterEach(() => vi.restoreAllMocks())

describe("fetchWithSourceRetries", () => {
  it("retries network failures and 5xx responses with the shared default", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const sleep = vi.fn(async () => undefined)

    const response = await fetchWithSourceRetries(
      "https://media.example/video.mp4",
      {},
      { sleep }
    )

    expect(response.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledTimes(
      DEFAULT_SOURCE_RETRY_POLICY.maxRetries + 1
    )
    expect(sleep).toHaveBeenNthCalledWith(
      1,
      DEFAULT_SOURCE_RETRY_POLICY.delayMs
    )
    expect(sleep).toHaveBeenNthCalledWith(
      2,
      DEFAULT_SOURCE_RETRY_POLICY.delayMs
    )
  })

  it.each([429, 503])("retries HTTP %s responses", async (status) => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    const response = await fetchWithSourceRetries(
      "https://media.example/video.mp4",
      {},
      {
        retry: { maxRetries: 1, delayMs: 0 },
        sleep: async () => undefined,
      }
    )

    expect(response.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("replays source-scoped POSTs with the same listing request", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const requestBody = JSON.stringify({ path: "/Movies", page_index: 1 })

    await fetchWithSourceRetries(
      "https://index.example/api",
      { method: "POST", body: requestBody },
      {
        retry: { maxRetries: 1, delayMs: 0 },
        requestReplaySafe: true,
        sleep: async () => undefined,
      }
    )

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls.map(([, init]) => init?.method)).toEqual([
      "POST",
      "POST",
    ])
    expect(fetchSpy.mock.calls.map(([, init]) => init?.body)).toEqual([
      requestBody,
      requestBody,
    ])
  })

  it("does not retry a body-bearing request without explicit replay safety", async () => {
    const terminalResponse = new Response("upstream error details", {
      status: 503,
    })
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(terminalResponse)

    const response = await fetchWithSourceRetries(
      "https://index.example/api",
      { method: "POST", body: JSON.stringify({ path: "/Movies" }) },
      {
        retry: { maxRetries: 2, delayMs: 0 },
        sleep: async () => undefined,
      }
    )

    expect(response.status).toBe(503)
    await expect(response.text()).resolves.toBe("upstream error details")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("cancels retried response bodies but preserves the exhausted response body", async () => {
    const retryResponse = new Response("interim error details", {
      status: 503,
    })
    const finalResponse = new Response("final error details", {
      status: 503,
    })
    const cancelRetryResponseBody = vi.spyOn(retryResponse.body!, "cancel")
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(retryResponse)
      .mockResolvedValueOnce(finalResponse)

    const response = await fetchWithSourceRetries(
      "https://media.example/video.mp4",
      {},
      {
        retry: { maxRetries: 1, delayMs: 0 },
        sleep: async () => undefined,
      }
    )

    expect(response.status).toBe(503)
    await expect(response.text()).resolves.toBe("final error details")
    expect(cancelRetryResponseBody).toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("does not retry non-retryable HTTP statuses or unsafe URLs", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 404 }))

    const response = await fetchWithSourceRetries(
      "https://media.example/missing.mp4",
      {},
      { sleep: async () => undefined }
    )

    expect(response.status).toBe(404)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    await expect(
      fetchWithSourceRetries(
        "file:///etc/passwd",
        {},
        {
          sleep: async () => undefined,
        }
      )
    ).rejects.toBeInstanceOf(UpstreamPolicyError)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("does not start another request after the extraction budget is spent", async () => {
    let currentTimeMs = 0
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        currentTimeMs = EXTRACTION_ELAPSED_TIME_LIMIT_MS - 100
        return new Response(null, { status: 503 })
      })

    const response = await fetchWithSourceRetries(
      "https://media.example/video.mp4",
      {},
      {
        retry: { maxRetries: 2, delayMs: 200 },
        startedAtMs: 0,
        now: () => currentTimeMs,
        sleep: async (delayMs) => {
          currentTimeMs += delayMs
        },
      }
    )

    expect(response.status).toBe(503)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
