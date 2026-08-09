import { describe, expect, it, vi } from "vitest"
import type { AuthSessionModule } from "../workers/auth-session"
import {
  createSignedInSessionLifecycle,
  type SignedInSessionCoordinator,
} from "../workers/signed-in-session-lifecycle"
import type { SessionCleanupModule } from "../workers/session-cleanup"

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
  ...overrides,
})

const createCleanup = (
  overrides: Partial<SessionCleanupModule> = {}
): SessionCleanupModule => ({
  record: vi.fn().mockResolvedValue({ kind: "completed" }),
  drain: vi.fn().mockResolvedValue({ kind: "completed" }),
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
      }),
      createCleanup({
        drain: vi.fn().mockResolvedValue({ kind: "unavailable" }),
      })
    )

    const result = await lifecycle.revokeAllSessions()

    expect(result).toEqual({ kind: "unavailable" })
    expect(revokeConvexSessions).toHaveBeenCalledOnce()
  })

  it("drains durable Worker cleanup after the Convex commit", async () => {
    const operationOrder: string[] = []
    const authSession = createAuthSession({
      revoke: vi.fn().mockImplementation(async () => {
        operationOrder.push("worker")
        return { kind: "revoked", cookie: "session=expired" }
      }),
    })
    const cleanup = createCleanup({
      drain: vi.fn().mockImplementation(async () => {
        operationOrder.push("worker")
        return { kind: "completed" }
      }),
    })
    const lifecycle = createSignedInSessionLifecycle(
      authSession,
      createCoordinator({
        revokeAllSessions: async () => {
          operationOrder.push("convex")
          return ["worker-session"]
        },
      }),
      cleanup
    )

    const result = await lifecycle.revokeAllSessions()

    expect(result).toEqual({ kind: "completed", cookie: "session=expired" })
    expect(operationOrder).toEqual(["convex", "worker"])
    expect(cleanup.drain).toHaveBeenCalledOnce()
  })

  it("resumes durable cleanup through a fresh lifecycle instance", async () => {
    let shouldFail = true
    const cleanup = createCleanup({
      drain: async () => {
        if (shouldFail) {
          shouldFail = false
          return { kind: "unavailable" }
        }
        return { kind: "completed" }
      },
    })
    const failedLifecycle = createSignedInSessionLifecycle(
      createAuthSession({
        revoke: vi.fn().mockResolvedValue({ kind: "unavailable" }),
      }),
      undefined,
      cleanup
    )
    expect(await failedLifecycle.retryCleanup()).toEqual({
      kind: "unavailable",
    })

    const recoveredAuthSession = createAuthSession()
    const recoveredLifecycle = createSignedInSessionLifecycle(
      recoveredAuthSession,
      undefined,
      cleanup
    )
    expect(await recoveredLifecycle.retryCleanup()).toEqual({
      kind: "completed",
      cookie: "session=expired",
    })
  })

  it("surfaces failed Worker compensation after Convex linking fails", async () => {
    const authSession = createAuthSession({
      revoke: vi.fn().mockResolvedValue({ kind: "unavailable" }),
    })
    const cleanup = createCleanup({
      drain: vi.fn().mockResolvedValue({ kind: "unavailable" }),
    })
    const lifecycle = createSignedInSessionLifecycle(
      authSession,
      undefined,
      cleanup
    )

    const result = await lifecycle.establish({
      convexSessionId: "convex-session",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      nowMs: 1,
      linkWorkerSession: vi.fn().mockRejectedValue(new Error("offline")),
    })

    expect(result).toEqual({ kind: "unavailable" })
    expect(authSession.revoke).not.toHaveBeenCalled()
    expect(cleanup.record).toHaveBeenCalledWith(expect.any(String))
    expect(cleanup.drain).toHaveBeenCalledOnce()
  })
})
