import { describe, expect, it, vi } from "vitest"
import { checkAuthenticationRateLimit } from "../workers/authentication-rate-limit"
import { createTestRateLimiter } from "./support/rate-limiter"

const createLimiter = (status: number) => {
  const fetch = vi.fn(() => Promise.resolve(new Response(null, { status })))
  const limiter = createTestRateLimiter(() => fetch())
  return {
    calls: limiter.calls,
    namespace: limiter.namespace,
    fetch,
  }
}

describe("authentication rate limit environment policy", () => {
  it("bypasses authentication attempt limits in local development", async () => {
    const limiter = createLimiter(429)

    const result = await checkAuthenticationRateLimit({
      environment: {
        ENVIRONMENT: "development",
        AUTH_RATE_LIMITER: limiter.namespace,
      },
      key: "auth:device-code:127.0.0.1",
      limit: 10,
      windowSeconds: 600,
    })

    expect(result).toBe("allowed")
    expect(limiter.calls).toHaveLength(0)
    expect(limiter.fetch).not.toHaveBeenCalled()
  })

  it("continues enforcing authentication attempt limits in production", async () => {
    const limiter = createLimiter(429)

    const result = await checkAuthenticationRateLimit({
      environment: {
        ENVIRONMENT: "production",
        AUTH_RATE_LIMITER: limiter.namespace,
      },
      key: "auth:device-code:203.0.113.1",
      limit: 10,
      windowSeconds: 600,
    })

    expect(result).toBe("limited")
    expect(limiter.calls.map(({ key }) => key)).toEqual([
      "auth:device-code:203.0.113.1",
    ])
  })
})
