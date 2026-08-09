import { describe, expect, it, vi } from "vitest"
import type { AuthSessionModule } from "../workers/auth-session"
import {
  createSignedInSessionLifecycle,
  type SignedInSessionCoordinator,
} from "../workers/signed-in-session-lifecycle"

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

const createCoordinator = (
  overrides: Partial<SignedInSessionCoordinator> = {}
): SignedInSessionCoordinator => ({
  revokeSession: vi.fn().mockResolvedValue([]),
  revokeAllSessions: vi.fn().mockResolvedValue([]),
  beginAccountErasure: vi.fn().mockResolvedValue([]),
  listPendingCleanup: vi.fn().mockResolvedValue([]),
  completeCleanup: vi.fn().mockResolvedValue(undefined),
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
    const lifecycle = createSignedInSessionLifecycle(
      authSession,
      createCoordinator({
        revokeAllSessions: revokeConvexSessions,
        listPendingCleanup: vi.fn().mockResolvedValue(["worker-session"]),
      })
    )

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
    const completeCleanup = vi.fn().mockResolvedValue(undefined)
    const lifecycle = createSignedInSessionLifecycle(
      authSession,
      createCoordinator({
        revokeAllSessions: async () => {
          operationOrder.push("convex")
          return ["worker-session"]
        },
        listPendingCleanup: vi.fn().mockResolvedValue(["worker-session"]),
        completeCleanup,
      })
    )

    const result = await lifecycle.revokeAllSessions()

    expect(result).toEqual({ kind: "completed", cookie: "session=expired" })
    expect(operationOrder).toEqual(["convex", "worker"])
    expect(completeCleanup).toHaveBeenCalledWith("worker-session")
  })

  it("resumes durable cleanup through a fresh lifecycle instance", async () => {
    const pending = new Set(["worker-session"])
    const coordinator = createCoordinator({
      listPendingCleanup: async () => [...pending],
      completeCleanup: async (workerSessionId) => {
        pending.delete(workerSessionId)
      },
    })
    const failedLifecycle = createSignedInSessionLifecycle(
      createAuthSession({
        revoke: vi.fn().mockResolvedValue({ kind: "unavailable" }),
      }),
      coordinator
    )
    expect(await failedLifecycle.retryCleanup()).toEqual({
      kind: "unavailable",
    })

    const recoveredAuthSession = createAuthSession()
    const recoveredLifecycle = createSignedInSessionLifecycle(
      recoveredAuthSession,
      coordinator
    )
    expect(await recoveredLifecycle.retryCleanup()).toEqual({
      kind: "completed",
      cookie: "session=expired",
    })
    expect(recoveredAuthSession.revoke).toHaveBeenCalledWith("worker-session")
    expect(pending.size).toBe(0)
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
