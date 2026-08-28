import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import {
  createSession,
  deleteStaleSessions,
  findActiveSessionById,
  revokeAllSessionsForUser,
  revokeSessionById,
  touchSessionLastSeen,
} from "../../workers/d1/sessions"
import { insertGoogleUser } from "../../workers/d1/users"

const NOW = 1_750_000_000_000

const createUser = async () => {
  const user = await insertGoogleUser(env.DB, {
    googleSubject: `subject-${crypto.randomUUID()}`,
    email: "session-test@example.com",
    now: NOW,
  })
  return user
}

describe("d1 sessions", () => {
  it("creates a session and finds it while active", async () => {
    const user = await createUser()
    const session = await createSession(env.DB, {
      userId: user.id,
      userAgent: "test-agent",
      now: NOW,
    })
    const found = await findActiveSessionById(env.DB, session.id, NOW + 1)
    expect(found?.userId).toBe(user.id)
    expect(found?.userAgent).toBe("test-agent")
    expect(found?.revokedAt).toBeNull()
  })

  it("rejects expired sessions", async () => {
    const user = await createUser()
    const session = await createSession(env.DB, {
      userId: user.id,
      now: NOW,
      ttlMs: 1_000,
    })
    const found = await findActiveSessionById(env.DB, session.id, NOW + 2_000)
    expect(found).toBeNull()
  })

  it("touches last seen only for active sessions", async () => {
    const user = await createUser()
    const session = await createSession(env.DB, { userId: user.id, now: NOW })
    const touched = await touchSessionLastSeen(env.DB, session.id, NOW + 5_000)
    expect(touched).toBe(true)
    const revoked = await revokeSessionById(env.DB, session.id, NOW + 6_000)
    expect(revoked).toBe(true)
    const touchedAfterRevocation = await touchSessionLastSeen(
      env.DB,
      session.id,
      NOW + 7_000
    )
    expect(touchedAfterRevocation).toBe(false)
  })

  it("revokes a single session exactly once", async () => {
    const user = await createUser()
    const session = await createSession(env.DB, { userId: user.id, now: NOW })
    expect(await revokeSessionById(env.DB, session.id, NOW)).toBe(true)
    expect(await revokeSessionById(env.DB, session.id, NOW)).toBe(false)
    expect(await findActiveSessionById(env.DB, session.id, NOW)).toBeNull()
  })

  it("revokes all sessions for a user without touching other users", async () => {
    const firstUser = await createUser()
    const secondUser = await createUser()
    const firstSession = await createSession(env.DB, {
      userId: firstUser.id,
      now: NOW,
    })
    const secondSession = await createSession(env.DB, {
      userId: secondUser.id,
      now: NOW,
    })
    const revokedCount = await revokeAllSessionsForUser(
      env.DB,
      firstUser.id,
      NOW + 1_000
    )
    expect(revokedCount).toBe(1)
    expect(
      await findActiveSessionById(env.DB, firstSession.id, NOW + 2_000)
    ).toBeNull()
    expect(
      await findActiveSessionById(env.DB, secondSession.id, NOW + 2_000)
    ).not.toBeNull()
  })

  it("sweeps expired and revoked sessions", async () => {
    const user = await createUser()
    const expiredSession = await createSession(env.DB, {
      userId: user.id,
      now: NOW,
      ttlMs: 1_000,
    })
    const revokedSession = await createSession(env.DB, {
      userId: user.id,
      now: NOW,
    })
    const liveSession = await createSession(env.DB, {
      userId: user.id,
      now: NOW,
    })
    await revokeSessionById(env.DB, revokedSession.id, NOW + 1_000)
    const deleted = await deleteStaleSessions(env.DB, NOW + 10_000)
    expect(deleted).toBeGreaterThanOrEqual(2)
    expect(
      await findActiveSessionById(env.DB, liveSession.id, NOW + 10_000)
    ).not.toBeNull()
    expect(expiredSession.id).toBeTruthy()
  })
})
