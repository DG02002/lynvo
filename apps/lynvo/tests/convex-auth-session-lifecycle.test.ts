// @vitest-environment edge-runtime

import { api, internal } from "../convex/_generated/api"
import {
  asAuthenticatedUser,
  createConvexTest,
  insertTestUser,
} from "./convex-test-harness"

describe("Convex auth session lifecycle", () => {
  it("leases an unresolved password change beyond the action runtime limit", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-10T00:00:00.000Z"))
    try {
      const convex = createConvexTest()
      const target = await insertTestUser(convex, "password-lease-user")
      const startedAt = Date.now()

      await convex.mutation(internal.users.preparePasswordChange, {
        userId: target.userId,
        exceptSessionId: target.sessionId,
      })

      const scheduledFunctions = await convex.run((context) =>
        context.db.system.query("_scheduled_functions").collect()
      )
      expect(scheduledFunctions).toHaveLength(1)
      expect(scheduledFunctions[0]?.scheduledTime).toBeGreaterThan(
        startedAt + 30 * 60 * 1000
      )

      vi.advanceTimersByTime(30 * 60 * 1000)
      await expect(
        convex.run((context) => context.db.get("users", target.userId))
      ).resolves.toMatchObject({ passwordChangePendingAt: startedAt })
    } finally {
      vi.useRealTimers()
    }
  })

  it("returns the Worker id linked at the session revocation commit", async () => {
    const convex = createConvexTest()
    const target = await insertTestUser(convex, "prepared-user")
    const otherSessionId = await convex.run((context) =>
      context.db.insert("authSessions", {
        userId: target.userId,
        expirationTime: Date.now() + 60_000,
        workerSessionId: "other-worker-session",
      })
    )
    const client = asAuthenticatedUser(convex, target.userId, target.sessionId)

    await convex.run((context) =>
      context.db.patch("authSessions", otherSessionId, {
        workerSessionId: "concurrently-relinked-worker-session",
      })
    )
    await expect(
      client.mutation(api.users.revokeSession, { sessionId: otherSessionId })
    ).resolves.toEqual({
      success: true,
      workerSessionIds: ["concurrently-relinked-worker-session"],
    })
    const cleanupIntents = await convex.run((context) =>
      context.db.query("workerSessionCleanupIntents").collect()
    )
    expect(cleanupIntents).toMatchObject([
      { workerSessionId: "concurrently-relinked-worker-session" },
    ])
    const realtimeIntents = await convex.run((context) =>
      context.db.query("realtimeSessionRevocationIntents").collect()
    )
    expect(realtimeIntents).toMatchObject([
      { userId: target.userId, sessionId: otherSessionId },
    ])
  })

  it("targets revoked sessions without including a later new login", async () => {
    const convex = createConvexTest()
    const target = await insertTestUser(convex, "all-session-user")
    const client = asAuthenticatedUser(convex, target.userId, target.sessionId)

    await client.mutation(api.users.revokeAllSessions, {})

    const newSessionId = await convex.run((context) =>
      context.db.insert("authSessions", {
        userId: target.userId,
        expirationTime: Date.now() + 60_000,
      })
    )

    const realtimeIntents = await convex.run((context) =>
      context.db.query("realtimeSessionRevocationIntents").collect()
    )
    expect(realtimeIntents).toMatchObject([
      { userId: target.userId, sessionId: target.sessionId },
    ])
    expect(realtimeIntents).not.toContainEqual(
      expect.objectContaining({ sessionId: newSessionId })
    )
  })

  it("denies an issued token immediately after its session row is deleted", async () => {
    const convex = createConvexTest()
    const target = await insertTestUser(convex, "revoked-user")
    const client = asAuthenticatedUser(convex, target.userId, target.sessionId)

    await expect(
      client.query(api.users.getSessionUser, {})
    ).resolves.toMatchObject({ id: target.userId, sessionId: target.sessionId })
    await convex.run(async (context) => {
      await context.db.delete("authSessions", target.sessionId)
    })

    await expect(client.query(api.users.getSessionUser, {})).rejects.toThrow(
      "Authentication session required"
    )
  })

  it("enqueues targeted realtime closure for logout", async () => {
    const convex = createConvexTest()
    const target = await insertTestUser(convex, "logout-realtime-user")
    const client = asAuthenticatedUser(convex, target.userId, target.sessionId)

    await client.mutation(api.users.revokeCurrentSessionFromWorker, {})

    const intents = await convex.run((context) =>
      context.db.query("realtimeSessionRevocationIntents").collect()
    )
    expect(intents).toMatchObject([
      { userId: target.userId, sessionId: target.sessionId },
    ])
  })

  it("password invalidation preserves the current session and targets every other session", async () => {
    const convex = createConvexTest()
    const target = await insertTestUser(convex, "password-realtime-user")
    const otherSessionId = await convex.run((context) =>
      context.db.insert("authSessions", {
        userId: target.userId,
        expirationTime: Date.now() + 60_000,
      })
    )

    const transition = await convex.mutation(
      internal.users.preparePasswordChange,
      {
        userId: target.userId,
        exceptSessionId: target.sessionId,
      }
    )

    await expect(
      convex.run((context) => context.db.get("authSessions", target.sessionId))
    ).resolves.not.toBeNull()
    const intents = await convex.run((context) =>
      context.db.query("realtimeSessionRevocationIntents").collect()
    )
    expect(intents).toMatchObject([
      { userId: target.userId, sessionId: otherSessionId },
    ])
    await expect(
      convex.run((context) => context.db.get("users", target.userId))
    ).resolves.toMatchObject({ passwordChangePendingAt: transition.startedAt })

    await convex.mutation(internal.users.finishPasswordChange, {
      userId: target.userId,
      startedAt: transition.startedAt,
    })
    const recoveredUser = await convex.run((context) =>
      context.db.get("users", target.userId)
    )
    expect(recoveredUser).not.toHaveProperty("passwordChangePendingAt")
  })

  it("links one opaque Worker session to the authenticated Convex session", async () => {
    const convex = createConvexTest()
    const target = await insertTestUser(convex, "linked-user")
    const client = asAuthenticatedUser(convex, target.userId, target.sessionId)

    await expect(
      client.mutation(api.users.linkCurrentSessionWorker, {
        workerSessionId: "opaque-session-id",
      })
    ).resolves.toEqual({ success: true })
    const session = await convex.run((context) =>
      context.db.get("authSessions", target.sessionId)
    )
    expect(session?.workerSessionId).toBe("opaque-session-id")
  })

  it("returns the paired Worker id when Settings revokes another session", async () => {
    const convex = createConvexTest()
    const target = await insertTestUser(convex, "settings-user")
    const otherSessionId = await convex.run((context) =>
      context.db.insert("authSessions", {
        userId: target.userId,
        expirationTime: Date.now() + 60_000,
        workerSessionId: "other-worker-session",
      })
    )
    const client = asAuthenticatedUser(convex, target.userId, target.sessionId)

    await expect(
      client.mutation(api.users.revokeSession, { sessionId: otherSessionId })
    ).resolves.toEqual({
      success: true,
      workerSessionIds: ["other-worker-session"],
    })
    await expect(
      convex.run((context) => context.db.get("authSessions", otherSessionId))
    ).resolves.toBeNull()
  })
})
