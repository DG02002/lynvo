import { describe, expect, it, vi } from "vitest"

import { runWithRetries } from "../src/retry"

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
        decide: (outcome, retryNumber) =>
          outcome._tag === "failure"
            ? { retry: true, delayMs: retryNumber * 10 }
            : { retry: false },
        sleep: wait,
      })
    ).resolves.toBe("complete")

    expect(execute).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledWith(10)
  })

  it("retries values without throwing a sentinel error", async () => {
    const execute = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const wait = vi.fn(async () => undefined)

    await expect(
      runWithRetries(execute, {
        maxRetries: 1,
        decide: ({ _tag, value }, retryNumber) =>
          _tag === "success" && value.status === 503
            ? { retry: true, delayMs: retryNumber * 10 }
            : { retry: false },
        sleep: wait,
      })
    ).resolves.toMatchObject({ status: 200 })

    expect(execute).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledWith(10)
  })
})
