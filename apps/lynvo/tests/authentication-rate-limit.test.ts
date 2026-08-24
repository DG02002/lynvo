import { describe, expect, it, vi } from "vitest"
import { checkAuthenticationRateLimit } from "../workers/authentication-rate-limit"

const createLimiter = (status: number) => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status }))
  return {
    // SAFETY: The rate-limit code only calls getByName and fetch on this namespace stub.
    namespace: {
      getByName: vi.fn().mockReturnValue({ fetch }),
    } as DurableObjectNamespace,
    fetch,
  }
}

describe("authentication rate limit environment policy", () => {
  it("bypasses authentication attempt limits in local development", async () => {
    const limiter = createLimiter(429)

    const result = await checkAuthenticationRateLimit(
      {
        ENVIRONMENT: "development",
        AUTH_RATE_LIMITER: limiter.namespace,
      },
      "auth:device-code:127.0.0.1",
      10,
      600
    )

    expect(result).toBe("allowed")
    expect(limiter.namespace.getByName).not.toHaveBeenCalled()
    expect(limiter.fetch).not.toHaveBeenCalled()
  })

  it("continues enforcing authentication attempt limits in production", async () => {
    const limiter = createLimiter(429)

    const result = await checkAuthenticationRateLimit(
      {
        ENVIRONMENT: "production",
        AUTH_RATE_LIMITER: limiter.namespace,
      },
      "auth:device-code:203.0.113.1",
      10,
      600
    )

    expect(result).toBe("limited")
    expect(limiter.namespace.getByName).toHaveBeenCalledWith(
      "auth:device-code:203.0.113.1"
    )
  })
})
