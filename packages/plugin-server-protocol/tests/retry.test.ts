import { describe, expect, it, vi } from "vitest"

import { parseRetryAfterMs, runWithRetries } from "../src/retry"

describe("retry helpers", () => {
  it("retries sequentially and uses the injected delay", async () => {
    const execute = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce("complete")
    const wait = vi.fn(async () => undefined)

    await expect(
      runWithRetries(execute, {
        maxRetries: 1,
        getDelayMs: (_cause, retryNumber) => retryNumber * 10,
        sleep: wait,
      })
    ).resolves.toBe("complete")

    expect(execute).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledWith(10)
  })

  it("parses numeric and HTTP-date Retry-After values as milliseconds", () => {
    expect(parseRetryAfterMs("12", 1_000)).toBe(12_000)
    expect(parseRetryAfterMs(new Date(13_000).toUTCString(), 1_000)).toBe(
      12_000
    )
    expect(parseRetryAfterMs(new Date(500).toUTCString(), 1_000)).toBe(0)
    expect(parseRetryAfterMs("not-a-delay", 1_000)).toBeUndefined()
  })
})
