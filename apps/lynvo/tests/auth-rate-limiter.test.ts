import { describe, expect, it } from "vitest"

import { AuthRateLimiter } from "../workers/auth-rate-limiter"

class MemoryDurableObjectStorage {
  private readonly values = new Map<string, unknown>()
  private transactionQueue = Promise.resolve()

  get = async <Value>(key: string): Promise<Value | undefined> =>
    // SAFETY: Values are read through the same generic Durable Object storage contract used to write them.
    this.values.get(key) as Value | undefined

  put = async <Value>(key: string, value: Value): Promise<void> => {
    this.values.set(key, value)
  }

  transaction = async <Value>(
    callback: (storage: MemoryDurableObjectStorage) => Promise<Value>
  ): Promise<Value> => {
    const precedingTransaction = this.transactionQueue
    let completeTransaction = () => {}
    this.transactionQueue = new Promise<void>((resolve) => {
      completeTransaction = resolve
    })
    await precedingTransaction
    try {
      return await callback(this)
    } finally {
      completeTransaction()
    }
  }
}

const createLimiter = () => {
  const storage = new MemoryDurableObjectStorage()
  // SAFETY: AuthRateLimiter only uses the storage methods implemented by this in-memory state.
  return new AuthRateLimiter({ storage } as DurableObjectState)
}

const attempt = (
  limiter: AuthRateLimiter,
  nowMs: number,
  limit = 2,
  windowMs = 1_000
) =>
  limiter.fetch(
    new Request("https://auth-rate-limiter/attempt", {
      method: "POST",
      body: JSON.stringify({ limit, nowMs, windowMs }),
    })
  )

describe("AuthRateLimiter Durable Object HTTP behavior", () => {
  it("allows the configured attempts and rejects the next one", async () => {
    const limiter = createLimiter()

    expect((await attempt(limiter, 100)).status).toBe(200)
    expect((await attempt(limiter, 200)).status).toBe(200)
    expect((await attempt(limiter, 300)).status).toBe(429)
  })

  it("does not admit concurrent attempts beyond the allowance", async () => {
    const limiter = createLimiter()
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => attempt(limiter, 100, 5))
    )

    expect(
      responses.filter((response) => response.status === 200)
    ).toHaveLength(5)
    expect(
      responses.filter((response) => response.status === 429)
    ).toHaveLength(15)
  })

  it("starts a new window after expiration", async () => {
    const limiter = createLimiter()

    await attempt(limiter, 100, 1)
    expect((await attempt(limiter, 1_099, 1)).status).toBe(429)
    expect((await attempt(limiter, 1_100, 1)).status).toBe(200)
  })
})
