import { describe, expect, it, vi } from "vitest"
import type { AuthSessionModule } from "../workers/auth-session"
import { createSignedInSessionLifecycle } from "../workers/signed-in-session-lifecycle"

const createAuthSession = (
  overrides: Partial<AuthSessionModule> = {}
): AuthSessionModule => ({
  create: vi.fn().mockResolvedValue({
    kind: "created",
    cookie: "session=active",
  }),
  read: vi.fn().mockResolvedValue({ kind: "revoked_or_missing" }),
  rotate: vi.fn().mockResolvedValue({ kind: "rotated" }),
  revoke: vi.fn().mockResolvedValue({
    kind: "revoked",
    cookie: "session=expired",
  }),
  expireCookie: vi.fn().mockReturnValue("session=expired"),
  ...overrides,
})

describe("signed-in session lifecycle", () => {
  it("compensates Worker storage when Convex linking fails", async () => {
    const authSession = createAuthSession()
    const lifecycle = createSignedInSessionLifecycle(authSession)

    const result = await lifecycle.establish({
      convexSessionId: "convex-session",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      nowMs: 1,
      linkWorkerSession: vi.fn().mockRejectedValue(new Error("offline")),
    })

    expect(result).toEqual({ kind: "unavailable" })
    expect(authSession.revoke).toHaveBeenCalledOnce()
  })

  it("revokes Convex before deleting the Worker session", async () => {
    const operationOrder: string[] = []
    const authSession = createAuthSession({
      read: vi.fn().mockResolvedValue({
        kind: "active",
        session: {
          convexSessionId: "convex-session",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          createdAt: 1,
          expiresAt: 2,
        },
      }),
      revoke: vi.fn().mockImplementation(async () => {
        operationOrder.push("worker")
        return { kind: "revoked", cookie: "session=expired" }
      }),
    })
    const lifecycle = createSignedInSessionLifecycle(authSession)

    const result = await lifecycle.terminate({
      sessionId: "worker-session",
      revokeConvexSession: async () => {
        operationOrder.push("convex")
      },
    })

    expect(result).toEqual({ kind: "completed", cookie: "session=expired" })
    expect(operationOrder).toEqual(["convex", "worker"])
  })

  it("expires the browser cookie when no Worker session exists", async () => {
    const authSession = createAuthSession()
    const lifecycle = createSignedInSessionLifecycle(authSession)

    const result = await lifecycle.terminate({
      revokeConvexSession: vi.fn(),
    })

    expect(result).toEqual({ kind: "completed", cookie: "session=expired" })
    expect(authSession.read).not.toHaveBeenCalled()
  })

  it("reports Worker failure after Convex revocation has committed", async () => {
    const authSession = createAuthSession({
      revoke: vi.fn().mockResolvedValue({ kind: "unavailable" }),
    })
    const revokeConvexSessions = vi.fn().mockResolvedValue(["worker-session"])
    const lifecycle = createSignedInSessionLifecycle(authSession, {
      revokeSession: vi.fn(),
      revokeAllSessions: revokeConvexSessions,
      beginAccountErasure: vi.fn(),
    })

    const result = await lifecycle.revokeAllSessions()

    expect(result).toEqual({ kind: "unavailable" })
    expect(revokeConvexSessions).toHaveBeenCalledOnce()
  })

  it("revokes the Worker identifiers returned by the Convex commit", async () => {
    const operationOrder: string[] = []
    const authSession = createAuthSession({
      revoke: vi.fn().mockImplementation(async () => {
        operationOrder.push("worker")
        return { kind: "revoked", cookie: "session=expired" }
      }),
    })
    const lifecycle = createSignedInSessionLifecycle(authSession, {
      revokeSession: vi.fn(),
      revokeAllSessions: async () => {
        operationOrder.push("convex")
        return ["worker-session"]
      },
      beginAccountErasure: vi.fn(),
    })

    const result = await lifecycle.revokeAllSessions()

    expect(result).toEqual({ kind: "completed", cookie: "session=expired" })
    expect(operationOrder).toEqual(["convex", "worker"])
  })

  it("surfaces failed Worker compensation after Convex linking fails", async () => {
    const authSession = createAuthSession({
      revoke: vi.fn().mockResolvedValue({ kind: "unavailable" }),
    })
    const lifecycle = createSignedInSessionLifecycle(authSession)

    const result = await lifecycle.establish({
      convexSessionId: "convex-session",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      nowMs: 1,
      linkWorkerSession: vi.fn().mockRejectedValue(new Error("offline")),
    })

    expect(result).toEqual({ kind: "unavailable" })
    expect(authSession.revoke).toHaveBeenCalledOnce()
  })
})
