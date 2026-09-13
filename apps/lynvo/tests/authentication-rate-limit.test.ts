import { describe, expect, it, vi } from "vitest"
import {
  checkAuthenticationRateLimit,
  checkDeviceApprovalRateLimit,
} from "../workers/authentication-rate-limit"
import {
  DEVICE_APPROVAL_RATE_LIMIT,
  DEVICE_APPROVAL_RATE_WINDOW_SECONDS,
} from "../workers/constants"
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

  it("keeps device approval abuse limits active in local development", async () => {
    const limiter = createLimiter(429)
    const request = new Request("https://lynvo.test/api/auth/device/approval", {
      headers: { "CF-Connecting-IP": "192.0.2.44" },
    })

    const result = await checkDeviceApprovalRateLimit({
      environment: {
        ENVIRONMENT: "development",
        AUTH_RATE_LIMITER: limiter.namespace,
      },
      request,
      userId: "user-1",
    })

    expect(result).toBe("limited")
    expect(limiter.calls.map(({ key }) => key)).toEqual([
      "auth:device-approval:192.0.2.44:user-1",
    ])
    expect(JSON.parse(String(limiter.calls[0]?.init?.body))).toMatchObject({
      limit: DEVICE_APPROVAL_RATE_LIMIT,
      windowMs: DEVICE_APPROVAL_RATE_WINDOW_SECONDS * 1_000,
    })
  })
})
