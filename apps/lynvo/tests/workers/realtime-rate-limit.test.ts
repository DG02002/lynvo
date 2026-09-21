import { describe, expect, it, vi } from "vitest"

import { createTestRateLimiter } from "../support/rate-limiter"

describe("realtime handshake abuse control", () => {
  it("returns the remaining rate-limit window in Retry-After", async () => {
    const now = 1_700_000_000_000
    const expiresAt = now + 7_500
    const limiter = createTestRateLimiter(() =>
      Response.json({ allowed: false, expiresAt }, { status: 429 })
    )
    const { default: worker } = await import("../../workers/app")
    // SAFETY: The route only reads the rate-limiter binding and environment name from this fixture.
    const environment = {
      ENVIRONMENT: "production",
      AUTH_RATE_LIMITER: limiter.namespace,
    } as Env
    // SAFETY: The route only calls waitUntil on this test execution context.
    const executionContext = { waitUntil: () => undefined } as ExecutionContext
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(now)

    try {
      const response = await worker.fetch(
        new Request("https://lynvo.test/api/realtime", {
          headers: {
            Upgrade: "websocket",
            "CF-Connecting-IP": "192.0.2.11",
          },
        }),
        environment,
        executionContext
      )

      expect(response.status).toBe(429)
      expect(response.headers.get("Retry-After")).toBe("8")
      await expect(response.text()).resolves.toBe(
        "Too many connection attempts"
      )
    } finally {
      dateNow.mockRestore()
    }
  })
})
