import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import {
  abortDeviceExchange,
  authorizeDeviceCode,
  claimAuthorizedCode,
  cleanupExpiredDeviceCodes,
  createDeviceCode,
  finalizeDeviceExchange,
  getDeviceCodeForApproval,
  getDeviceCodeStatus,
  recoverDeviceExchange,
} from "../../workers/d1/device-auth"
import { findActiveSessionById } from "../../workers/d1/sessions"
import { insertGoogleUser } from "../../workers/d1/users"

const NOW = 1_750_000_000_000

const createTestUser = async () => {
  const user = await insertGoogleUser(env.DB, {
    googleSubject: `subject-${crypto.randomUUID()}`,
    email: "device-test@example.com",
    now: NOW,
  })
  return user
}

const createApprovedCode = async (userId: string) => {
  const created = await createDeviceCode(env.DB, {
    deviceName: "Living room TV",
    now: NOW,
  })
  const outcome = await authorizeDeviceCode(env.DB, {
    code: created.code,
    userId,
    now: NOW + 1_000,
  })
  expect(outcome.kind).toBe("authorized")
  return created
}

describe("d1 device auth state machine", () => {
  it("creates a code with a matching poll secret digest", async () => {
    const created = await createDeviceCode(env.DB, {
      deviceName: "Kitchen display",
      now: NOW,
    })
    expect(created.code).toMatch(/^[A-Z]{4}-[A-Z]{4}$/)
    expect(created.deviceName).toBe("Kitchen display")
    const status = await getDeviceCodeStatus(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
    })
    expect(status).toMatchObject({ kind: "known", status: "pending" })
  })

  it("reports invalid for a wrong poll secret", async () => {
    const created = await createDeviceCode(env.DB, {
      deviceName: "TV",
      now: NOW,
    })
    const status = await getDeviceCodeStatus(env.DB, {
      code: created.code,
      pollSecret: "wrong-secret",
    })
    expect(status).toEqual({ kind: "invalid" })
  })

  it("refuses authorizing an unknown or already used code", async () => {
    const unknownOutcome = await authorizeDeviceCode(env.DB, {
      code: "ZZZZ-ZZZZ",
      userId: "user",
      now: NOW,
    })
    expect(unknownOutcome).toEqual({ kind: "unknownCode" })

    const user = await createTestUser()
    const created = await createApprovedCode(user.id)
    const secondOutcome = await authorizeDeviceCode(env.DB, {
      code: created.code,
      userId: user.id,
      now: NOW + 2_000,
    })
    expect(secondOutcome).toEqual({ kind: "usedOrExpired" })
  })

  it("claims an approved code and mints a live session", async () => {
    const user = await createTestUser()
    const created = await createApprovedCode(user.id)
    const claim = await claimAuthorizedCode(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-1",
      generation: 1,
      now: NOW + 3_000,
    })
    expect(claim).toMatchObject({
      kind: "claimed",
      userId: user.id,
      deviceName: "Living room TV",
    })
    if (claim.kind !== "claimed") {
      return
    }
    const session = await findActiveSessionById(
      env.DB,
      claim.sessionId,
      NOW + 4_000
    )
    expect(session?.userId).toBe(user.id)

    const status = await getDeviceCodeStatus(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
    })
    expect(status).toMatchObject({ kind: "known", status: "authorized" })
  })

  it("rejects a claim with a wrong poll secret even when approved", async () => {
    const user = await createTestUser()
    const created = await createApprovedCode(user.id)
    const claim = await claimAuthorizedCode(env.DB, {
      code: created.code,
      pollSecret: "wrong-secret",
      attemptId: "attempt-1",
      generation: 1,
      now: NOW + 3_000,
    })
    expect(claim).toEqual({ kind: "notApproved" })
  })

  it("rejects stale generations on the same attempt", async () => {
    const user = await createTestUser()
    const created = await createApprovedCode(user.id)
    const firstClaim = await claimAuthorizedCode(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-1",
      generation: 5,
      now: NOW + 3_000,
    })
    expect(firstClaim.kind).toBe("claimed")
    const staleClaim = await claimAuthorizedCode(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-1",
      generation: 4,
      now: NOW + 4_000,
    })
    expect(staleClaim).toEqual({ kind: "notApproved" })
  })

  it("reuses the same session when retrying the same attempt", async () => {
    const user = await createTestUser()
    const created = await createApprovedCode(user.id)
    const firstClaim = await claimAuthorizedCode(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-1",
      generation: 1,
      now: NOW + 3_000,
    })
    const retryClaim = await claimAuthorizedCode(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-1",
      generation: 2,
      now: NOW + 4_000,
    })
    expect(retryClaim.kind).toBe("claimed")
    if (firstClaim.kind === "claimed" && retryClaim.kind === "claimed") {
      expect(retryClaim.sessionId).toBe(firstClaim.sessionId)
    }
  })

  it("takes over an expired lease with a new attempt and revokes the old session", async () => {
    const user = await createTestUser()
    const created = await createApprovedCode(user.id)
    const firstClaim = await claimAuthorizedCode(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-1",
      generation: 1,
      now: NOW + 3_000,
    })
    expect(firstClaim.kind).toBe("claimed")
    if (firstClaim.kind !== "claimed") {
      return
    }
    const takeoverClaim = await claimAuthorizedCode(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-2",
      generation: 1,
      now: NOW + 3_000 + 61_000,
    })
    expect(takeoverClaim.kind).toBe("claimed")
    if (takeoverClaim.kind !== "claimed") {
      return
    }
    expect(takeoverClaim.sessionId).not.toBe(firstClaim.sessionId)
    const revokedSession = await findActiveSessionById(
      env.DB,
      firstClaim.sessionId,
      NOW + 70_000
    )
    expect(revokedSession).toBeNull()
  })

  it("finalizes an active exchange exactly once", async () => {
    const user = await createTestUser()
    const created = await createApprovedCode(user.id)
    const claim = await claimAuthorizedCode(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-1",
      generation: 1,
      now: NOW + 3_000,
    })
    if (claim.kind !== "claimed") {
      expect.unreachable("claim should succeed")
      return
    }
    const finalize = await finalizeDeviceExchange(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-1",
      sessionId: claim.sessionId,
      generation: 1,
    })
    expect(finalize).toEqual({ kind: "finalized" })
    const repeatFinalize = await finalizeDeviceExchange(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-1",
      sessionId: claim.sessionId,
      generation: 1,
    })
    expect(repeatFinalize).toEqual({ kind: "alreadyFinalized" })
    const supersededFinalize = await finalizeDeviceExchange(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-other",
      sessionId: claim.sessionId,
      generation: 1,
    })
    expect(supersededFinalize).toEqual({ kind: "superseded" })
  })

  it("recovers a resumable and completed exchange", async () => {
    const user = await createTestUser()
    const created = await createApprovedCode(user.id)
    const claim = await claimAuthorizedCode(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-1",
      generation: 1,
      now: NOW + 3_000,
    })
    if (claim.kind !== "claimed") {
      expect.unreachable("claim should succeed")
      return
    }
    const resumable = await recoverDeviceExchange(env.DB, {
      userId: user.id,
      sessionId: claim.sessionId,
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-1",
    })
    expect(resumable).toBe("resumable")
    await finalizeDeviceExchange(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-1",
      sessionId: claim.sessionId,
      generation: 1,
    })
    const completed = await recoverDeviceExchange(env.DB, {
      userId: user.id,
      sessionId: claim.sessionId,
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-1",
    })
    expect(completed).toBe("completed")
    const wrongAttempt = await recoverDeviceExchange(env.DB, {
      userId: user.id,
      sessionId: claim.sessionId,
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-2",
    })
    expect(wrongAttempt).toBe("superseded")
  })

  it("aborts an exchange, restores the code, and revokes the session", async () => {
    const user = await createTestUser()
    const created = await createApprovedCode(user.id)
    const claim = await claimAuthorizedCode(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-1",
      generation: 1,
      now: NOW + 3_000,
    })
    if (claim.kind !== "claimed") {
      expect.unreachable("claim should succeed")
      return
    }
    const abort = await abortDeviceExchange(env.DB, {
      userId: user.id,
      sessionId: claim.sessionId,
      code: created.code,
      attemptId: "attempt-1",
      generation: 1,
      now: NOW + 4_000,
    })
    expect(abort).toEqual({ kind: "aborted" })
    expect(
      await findActiveSessionById(env.DB, claim.sessionId, NOW + 5_000)
    ).toBeNull()
    const approval = await getDeviceCodeForApproval(env.DB, created.code)
    expect(approval).toMatchObject({ status: "authorized" })
  })

  it("cleans up expired codes and revokes their exchange sessions", async () => {
    const user = await createTestUser()
    const created = await createApprovedCode(user.id)
    const claim = await claimAuthorizedCode(env.DB, {
      code: created.code,
      pollSecret: created.pollSecret,
      attemptId: "attempt-1",
      generation: 1,
      now: NOW + 3_000,
    })
    if (claim.kind !== "claimed") {
      expect.unreachable("claim should succeed")
      return
    }
    const cleanup = await cleanupExpiredDeviceCodes(
      env.DB,
      NOW + DEVICE_TTL_BUFFER_MS
    )
    expect(cleanup.deleted).toBeGreaterThanOrEqual(1)
    expect(
      await findActiveSessionById(env.DB, claim.sessionId, NOW + 10_000)
    ).toBeNull()
    expect(await getDeviceCodeForApproval(env.DB, created.code)).toBeNull()
  })
})

const DEVICE_TTL_BUFFER_MS = 11 * 60 * 1_000
