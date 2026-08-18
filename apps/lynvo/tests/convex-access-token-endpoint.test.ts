import { describe, expect, it, vi } from "vitest"
import { createConvexAccessTokenHandler } from "../workers/convex-access-token"

describe("Convex access token endpoint", () => {
  it("returns an authenticated access token without making it cacheable", async () => {
    const resolveAccessToken = vi.fn().mockResolvedValue({
      kind: "authenticated",
      accessToken: "short-lived-access-token",
    })
    const handler = createConvexAccessTokenHandler({
      checkRateLimit: vi.fn().mockResolvedValue("allowed"),
      resolveAccessToken,
    })

    const response = await handler(
      new Request("https://lynvo.example/api/auth/convex-token", {
        method: "POST",
        headers: { Origin: "https://lynvo.example" },
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({
      accessToken: "short-lived-access-token",
    })
    expect(resolveAccessToken).toHaveBeenCalledWith(expect.any(Request), false)
  })

  it("passes forced refresh intent without accepting cross-origin requests", async () => {
    const resolveAccessToken = vi.fn().mockResolvedValue({
      kind: "authenticated",
      accessToken: "rotated-access-token",
    })
    const handler = createConvexAccessTokenHandler({
      checkRateLimit: vi.fn().mockResolvedValue("allowed"),
      resolveAccessToken,
    })

    const refreshed = await handler(
      new Request(
        "https://lynvo.example/api/auth/convex-token?forceRefresh=true",
        { method: "POST", headers: { Origin: "https://lynvo.example" } }
      )
    )
    const forbidden = await handler(
      new Request("https://lynvo.example/api/auth/convex-token", {
        method: "POST",
        headers: { Origin: "https://attacker.example" },
      })
    )

    expect(refreshed.status).toBe(200)
    expect(resolveAccessToken).toHaveBeenCalledWith(expect.any(Request), true)
    expect(forbidden.status).toBe(403)
    expect(await forbidden.text()).not.toContain("rotated-access-token")
  })

  it.each([
    ["unauthenticated", 401],
    ["unavailable", 503],
  ] as const)(
    "maps %s session resolution without token material",
    async (kind, status) => {
      const handler = createConvexAccessTokenHandler({
        checkRateLimit: vi.fn().mockResolvedValue("allowed"),
        resolveAccessToken: vi.fn().mockResolvedValue({ kind }),
      })

      const response = await handler(
        new Request("https://lynvo.example/api/auth/convex-token", {
          method: "POST",
        })
      )

      expect(response.status).toBe(status)
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(await response.text()).not.toContain("token")
    }
  )

  it("returns a bounded rate-limit response before resolving the session", async () => {
    const resolveAccessToken = vi.fn()
    const handler = createConvexAccessTokenHandler({
      checkRateLimit: vi.fn().mockResolvedValue("limited"),
      resolveAccessToken,
    })

    const response = await handler(
      new Request("https://lynvo.example/api/auth/convex-token", {
        method: "POST",
      })
    )

    expect(response.status).toBe(429)
    expect(resolveAccessToken).not.toHaveBeenCalled()
  })
})
