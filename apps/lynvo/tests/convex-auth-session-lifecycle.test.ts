// @vitest-environment edge-runtime

import { api } from "../convex/_generated/api"
import {
  asAuthenticatedUser,
  createConvexTest,
  insertTestUser,
} from "./convex-test-harness"

describe("Convex auth session lifecycle", () => {
  it("prepares Worker revocation without deleting the Convex session", async () => {
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

    await expect(
      client.query(api.users.prepareSessionRevocation, {
        sessionId: otherSessionId,
      })
    ).resolves.toEqual({ workerSessionIds: ["other-worker-session"] })
    await expect(
      convex.run((context) => context.db.get("authSessions", otherSessionId))
    ).resolves.not.toBeNull()
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
