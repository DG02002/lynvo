import { describe, expect, it, vi } from "vitest"
import {
  ConvexAccessUnavailableError,
  createConvexAccessTokenFetcher,
} from "../app/lib/convex-browser-auth"

describe("Convex browser authentication", () => {
  it("fetches access tokens with forced refresh intent and no browser persistence", async () => {
    const fetchRequest = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { accessToken: "memory-only-token" },
          { headers: { "Cache-Control": "no-store" } }
        )
      )
    const onSessionExpired = vi.fn()
    const fetchAccessToken = createConvexAccessTokenFetcher({
      fetchRequest,
      onSessionExpired,
    })

    await expect(fetchAccessToken({ forceRefreshToken: true })).resolves.toBe(
      "memory-only-token"
    )
    expect(fetchRequest).toHaveBeenCalledWith(
      "/api/auth/convex-token?forceRefresh=true",
      expect.objectContaining({ method: "POST", credentials: "same-origin" })
    )
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it("clears authentication after the Worker rejects the session", async () => {
    const onSessionExpired = vi.fn()
    const fetchAccessToken = createConvexAccessTokenFetcher({
      fetchRequest: vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 401 })),
      onSessionExpired,
    })

    await expect(
      fetchAccessToken({ forceRefreshToken: false })
    ).resolves.toBeNull()
    expect(onSessionExpired).toHaveBeenCalledOnce()
  })

  it("surfaces temporary failures without returning stale credentials", async () => {
    const fetchAccessToken = createConvexAccessTokenFetcher({
      fetchRequest: vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 503 })),
      onSessionExpired: vi.fn(),
    })

    await expect(
      fetchAccessToken({ forceRefreshToken: false })
    ).rejects.toBeInstanceOf(ConvexAccessUnavailableError)
  })
})
