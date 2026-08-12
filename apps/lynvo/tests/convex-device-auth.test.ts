// @vitest-environment edge-runtime

import { api, internal } from "../convex/_generated/api"
import {
  DEVICE_CODE_CLEANUP_BATCH_SIZE,
  DEVICE_CODE_EXCHANGE_LEASE_MS,
  DEVICE_CODE_TTL_MS,
} from "../convex/constants"
import {
  signAuthPreflightToken,
  signSessionCleanupToken,
} from "../app/lib/auth-gateway"
import {
  asAuthenticatedUser,
  createConvexTest,
  insertTestUser,
} from "./convex-test-harness"

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")

const digestPollSecret = async (pollSecret: string) =>
  bytesToHex(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(pollSecret)
      )
    )
  )

describe("device authorization", () => {
  it("keeps the newest generation-bound Worker cleanup intent", async () => {
    const gatewaySecret = "test-session-cleanup-secret"
    vi.stubEnv("AUTH_GATEWAY_SECRET", gatewaySecret)
    const convex = createConvexTest()
    const serviceToken = await signSessionCleanupToken(
      gatewaySecret,
      Date.now() + DEVICE_CODE_TTL_MS
    )
    const enqueue = (issuanceGeneration: number) =>
      convex.mutation(api.sessionCleanup.enqueue, {
        serviceToken,
        workerSessionIds: ["generation-cleanup-attempt"],
        issuanceGeneration,
      })

    await enqueue(1)
    await enqueue(2)
    await enqueue(1)
    await expect(
      convex.query(api.sessionCleanup.listPending, { serviceToken })
    ).resolves.toEqual([
      {
        workerSessionId: "generation-cleanup-attempt",
        issuanceGeneration: 2,
      },
    ])

    await convex.mutation(api.sessionCleanup.complete, {
      serviceToken,
      workerSessionId: "generation-cleanup-attempt",
      issuanceGeneration: 1,
    })
    await expect(
      convex.query(api.sessionCleanup.listPending, { serviceToken })
    ).resolves.toHaveLength(1)
    await convex.mutation(api.sessionCleanup.complete, {
      serviceToken,
      workerSessionId: "generation-cleanup-attempt",
      issuanceGeneration: 2,
    })
    await expect(
      convex.query(api.sessionCleanup.listPending, { serviceToken })
    ).resolves.toEqual([])
    vi.unstubAllEnvs()
  })

  it("generates fixed-width codes without Math.random", async () => {
    const gatewaySecret = "test-cryptographic-device-code-secret"
    vi.stubEnv("AUTH_GATEWAY_SECRET", gatewaySecret)
    const convex = createConvexTest()
    const preflightToken = await signAuthPreflightToken(
      { purpose: "deviceCode", exp: Date.now() + DEVICE_CODE_TTL_MS },
      gatewaySecret
    )
    const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not generate authentication codes")
    })

    const generated = await convex.mutation(api.deviceAuth.generateCode, {
      deviceName: "Personal phone",
      preflightToken,
    })
    expect(generated.code).toMatch(/^[A-Z]{4}-[A-Z]{4}$/)
    expect(generated.deviceName).toBe("Personal phone")
    randomSpy.mockRestore()
    vi.unstubAllEnvs()
  })

  it("requires a valid gateway preflight and polling secret", async () => {
    const gatewaySecret = "test-device-code-gateway-secret"
    vi.stubEnv("AUTH_GATEWAY_SECRET", gatewaySecret)
    const convex = createConvexTest()

    await expect(
      convex.mutation(api.deviceAuth.generateCode, {
        deviceName: "Test TV",
        preflightToken: "invalid",
      })
    ).rejects.toThrow("Invalid auth preflight token")

    const preflightToken = await signAuthPreflightToken(
      { purpose: "deviceCode", exp: Date.now() + DEVICE_CODE_TTL_MS },
      gatewaySecret
    )
    const generated = await convex.mutation(api.deviceAuth.generateCode, {
      deviceName: "Test TV",
      preflightToken,
    })

    await expect(
      convex.query(api.deviceAuth.getStatus, {
        code: generated.code,
        pollSecret: "wrong-secret",
      })
    ).resolves.toEqual({ status: "invalid" })
    await expect(
      convex.query(api.deviceAuth.getStatus, {
        code: generated.code,
        pollSecret: generated.pollSecret,
      })
    ).resolves.toMatchObject({
      status: "pending",
      expiresAt: generated.expiresAt,
    })
    vi.unstubAllEnvs()
  })

  it("requires authentication to approve a code", async () => {
    const convex = createConvexTest()
    await convex.run(async (context) => {
      await context.db.insert("deviceCodes", {
        code: "ABCD-EFGH",
        pollSecretDigest: await digestPollSecret("poll-secret"),
        status: "pending",
        deviceName: "Test TV",
        expiresAt: Date.now() + DEVICE_CODE_TTL_MS,
        createdAt: Date.now(),
      })
    })

    await expect(
      convex.mutation(api.deviceAuth.authorizeCode, { code: "ABCD-EFGH" })
    ).rejects.toThrow("UNAUTHORIZED")
  })

  it("claims and finalizes an approved code only after session creation", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "device-owner")
    const pollSecret = "poll-secret"
    const expiresAt = 1_000_000
    await convex.run(async (context) => {
      await context.db.insert("deviceCodes", {
        code: "BCDE-FGHI",
        pollSecretDigest: await digestPollSecret(pollSecret),
        status: "pending",
        deviceName: "Test TV",
        expiresAt,
        createdAt: 1,
      })
    })
    const authenticatedClient = asAuthenticatedUser(
      convex,
      user.userId,
      user.sessionId
    )
    vi.useFakeTimers()
    vi.setSystemTime(expiresAt - 1)
    await authenticatedClient.mutation(api.deviceAuth.authorizeCode, {
      code: "BCDE-FGHI",
    })

    const claimed = await convex.mutation(
      internal.deviceAuth.claimAuthorizedCode,
      {
        code: "BCDE-FGHI",
        pollSecret,
        now: expiresAt - 1,
        attemptId: "exchange-one",
        generation: 1,
      }
    )
    expect(claimed).toMatchObject({ userId: user.userId })
    const deviceClient = asAuthenticatedUser(
      convex,
      user.userId,
      claimed.sessionId
    )
    await expect(
      convex.mutation(internal.deviceAuth.claimAuthorizedCode, {
        code: "BCDE-FGHI",
        pollSecret,
        now: expiresAt - 1,
        attemptId: "exchange-two",
        generation: 1,
      })
    ).rejects.toThrow("Approve this code")
    await expect(
      deviceClient.mutation(api.deviceAuth.finalizeExchange, {
        code: "BCDE-FGHI",
        pollSecret,
        attemptId: "exchange-one",
        sessionId: claimed.sessionId,
        generation: 2,
      })
    ).rejects.toThrow("Device code exchange was superseded")
    await deviceClient.mutation(api.deviceAuth.finalizeExchange, {
      code: "BCDE-FGHI",
      pollSecret,
      attemptId: "exchange-one",
      sessionId: claimed.sessionId,
      generation: 1,
    })
    await deviceClient.mutation(api.users.linkCurrentSessionWorker, {
      workerSessionId: "exchange-one",
    })
    await expect(
      deviceClient.query(api.deviceAuth.recoverExchange, {
        code: "BCDE-FGHI",
        pollSecret,
        attemptId: "exchange-one",
      })
    ).resolves.toBe("completed")
    await expect(
      deviceClient.query(api.deviceAuth.recoverExchange, {
        code: "BCDE-FGHI",
        pollSecret: "wrong-secret",
        attemptId: "exchange-one",
      })
    ).resolves.toBe("invalid")
    await expect(
      deviceClient.mutation(api.deviceAuth.finalizeExchange, {
        code: "BCDE-FGHI",
        pollSecret,
        attemptId: "exchange-one",
        sessionId: claimed.sessionId,
        generation: 1,
      })
    ).resolves.toBeNull()
    await expect(
      convex.mutation(internal.deviceAuth.claimAuthorizedCode, {
        code: "BCDE-FGHI",
        pollSecret,
        now: expiresAt - 1,
        attemptId: "exchange-one",
        generation: 2,
      })
    ).rejects.toThrow("Approve this code")
    await deviceClient.mutation(api.deviceAuth.abortDeviceExchange, {
      code: "BCDE-FGHI",
      attemptId: "exchange-one",
      sessionId: claimed.sessionId,
      generation: 1,
    })
    await expect(
      convex.mutation(internal.deviceAuth.claimAuthorizedCode, {
        code: "BCDE-FGHI",
        pollSecret,
        now: expiresAt - 1,
        attemptId: "exchange-retry",
        generation: 1,
      })
    ).resolves.toMatchObject({ userId: user.userId })

    await convex.run(async (context) => {
      await context.db.insert("deviceCodes", {
        code: "CDEF-GHIJ",
        pollSecretDigest: await digestPollSecret(pollSecret),
        status: "authorized",
        userId: user.userId,
        deviceName: "Expired TV",
        expiresAt,
        createdAt: 1,
      })
    })
    await expect(
      convex.mutation(internal.deviceAuth.claimAuthorizedCode, {
        code: "CDEF-GHIJ",
        pollSecret,
        now: expiresAt,
        attemptId: "expired-exchange",
        generation: 1,
      })
    ).rejects.toThrow("Approve this code")
    vi.useRealTimers()
  })

  it("reuses one attempt-bound session before and after lease expiry", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "retry-owner")
    const pollSecret = "retry-secret"
    const now = 100_000
    await convex.run(async (context) => {
      await context.db.insert("deviceCodes", {
        code: "DEFG-HIJK",
        pollSecretDigest: await digestPollSecret(pollSecret),
        status: "authorized",
        userId: user.userId,
        deviceName: "Retry TV",
        expiresAt: now + DEVICE_CODE_TTL_MS,
        createdAt: now,
      })
    })

    const firstClaim = await convex.mutation(
      internal.deviceAuth.claimAuthorizedCode,
      {
        code: "DEFG-HIJK",
        pollSecret,
        now,
        attemptId: "retry-attempt",
        generation: 1,
      }
    )
    await convex.run(async (context) => {
      await context.db.insert("authRefreshTokens", {
        sessionId: firstClaim.sessionId,
        expirationTime: now + DEVICE_CODE_TTL_MS,
      })
    })
    const activeLeaseRetry = await convex.mutation(
      internal.deviceAuth.claimAuthorizedCode,
      {
        code: "DEFG-HIJK",
        pollSecret,
        now: now + 1,
        attemptId: "retry-attempt",
        generation: 2,
      }
    )
    await convex.run(async (context) => {
      await context.db.insert("authRefreshTokens", {
        sessionId: firstClaim.sessionId,
        expirationTime: now + DEVICE_CODE_TTL_MS,
      })
    })
    const expiredLeaseRetry = await convex.mutation(
      internal.deviceAuth.claimAuthorizedCode,
      {
        code: "DEFG-HIJK",
        pollSecret,
        now: now + DEVICE_CODE_EXCHANGE_LEASE_MS + 1,
        attemptId: "retry-attempt",
        generation: 3,
      }
    )
    const currentRefreshTokenId = await convex.run(
      async (context) =>
        await context.db.insert("authRefreshTokens", {
          sessionId: firstClaim.sessionId,
          expirationTime: now + DEVICE_CODE_TTL_MS,
        })
    )

    await expect(
      convex.mutation(internal.deviceAuth.claimAuthorizedCode, {
        code: "DEFG-HIJK",
        pollSecret,
        now: now + DEVICE_CODE_EXCHANGE_LEASE_MS + 2,
        attemptId: "retry-attempt",
        generation: 2,
      })
    ).rejects.toThrow("Approve this code")
    await asAuthenticatedUser(
      convex,
      user.userId,
      firstClaim.sessionId
    ).mutation(api.deviceAuth.abortDeviceExchange, {
      code: "DEFG-HIJK",
      attemptId: "retry-attempt",
      sessionId: firstClaim.sessionId,
      generation: 2,
    })

    expect(activeLeaseRetry.sessionId).toBe(firstClaim.sessionId)
    expect(expiredLeaseRetry.sessionId).toBe(firstClaim.sessionId)
    await convex.run(async (context) => {
      const attemptSessions = await context.db
        .query("authSessions")
        .withIndex("by_deviceExchangeAttemptId", (queryBuilder) =>
          queryBuilder.eq("deviceExchangeAttemptId", "retry-attempt")
        )
        .collect()
      const refreshTokens = await context.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (queryBuilder) =>
          queryBuilder.eq("sessionId", firstClaim.sessionId)
        )
        .collect()
      expect(attemptSessions).toHaveLength(1)
      expect(refreshTokens.map((refreshToken) => refreshToken._id)).toEqual([
        currentRefreshTokenId,
      ])
      expect(
        await context.db
          .query("workerSessionCleanupIntents")
          .withIndex("by_workerSessionId", (queryBuilder) =>
            queryBuilder.eq("workerSessionId", "retry-attempt")
          )
          .unique()
      ).toBeNull()
    })
  })

  it("rejects a late issuance generation and retains one current token root", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "generation-owner")
    const sessionId = await convex.run(async (context) => {
      const createdSessionId = await context.db.insert("authSessions", {
        userId: user.userId,
        expirationTime: Date.now() + DEVICE_CODE_TTL_MS,
        deviceExchangeAttemptId: "generation-attempt",
      })
      await context.db.insert("deviceCodes", {
        code: "JKLM-NOPQ",
        pollSecretDigest: await digestPollSecret("generation-secret"),
        status: "exchanging",
        userId: user.userId,
        deviceName: "Generation TV",
        exchangeAttemptId: "generation-attempt",
        exchangeGeneration: 2,
        exchangeLeaseExpiresAt: Date.now() + DEVICE_CODE_EXCHANGE_LEASE_MS,
        exchangeSessionId: createdSessionId,
        expiresAt: Date.now() + DEVICE_CODE_TTL_MS,
        createdAt: Date.now(),
      })
      return createdSessionId
    })
    const refreshTokenIds = await convex.run(async (context) => ({
      stale: await context.db.insert("authRefreshTokens", {
        sessionId,
        expirationTime: Date.now() + DEVICE_CODE_TTL_MS,
      }),
      current: await context.db.insert("authRefreshTokens", {
        sessionId,
        expirationTime: Date.now() + DEVICE_CODE_TTL_MS,
      }),
    }))
    const deviceClient = asAuthenticatedUser(convex, user.userId, sessionId)

    await expect(
      deviceClient.mutation(api.deviceAuth.commitExchangeIssuance, {
        code: "JKLM-NOPQ",
        attemptId: "generation-attempt",
        generation: 1,
        refreshTokenId: refreshTokenIds.stale,
      })
    ).resolves.toBe("stale")
    await expect(
      deviceClient.mutation(api.deviceAuth.commitExchangeIssuance, {
        code: "JKLM-NOPQ",
        attemptId: "generation-attempt",
        generation: 2,
        refreshTokenId: refreshTokenIds.current,
      })
    ).resolves.toBe("current")
    await convex.run(async (context) => {
      const refreshTokens = await context.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (queryBuilder) =>
          queryBuilder.eq("sessionId", sessionId)
        )
        .collect()
      expect(refreshTokens.map((refreshToken) => refreshToken._id)).toEqual([
        refreshTokenIds.current,
      ])
    })
  })

  it("atomically aborts an unlinked exchange and records Worker cleanup", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "abort-owner")
    const attemptId = "aborted-attempt"
    const sessionId = await convex.run(async (context) => {
      const createdSessionId = await context.db.insert("authSessions", {
        userId: user.userId,
        expirationTime: Date.now() + DEVICE_CODE_TTL_MS,
        deviceExchangeAttemptId: attemptId,
      })
      await context.db.insert("deviceCodes", {
        code: "EFGH-IJKL",
        pollSecretDigest: await digestPollSecret("abort-secret"),
        status: "exchanging",
        userId: user.userId,
        deviceName: "Abort TV",
        exchangeAttemptId: attemptId,
        exchangeGeneration: 1,
        exchangeLeaseExpiresAt: Date.now() + DEVICE_CODE_EXCHANGE_LEASE_MS,
        exchangeSessionId: createdSessionId,
        expiresAt: Date.now() + DEVICE_CODE_TTL_MS,
        createdAt: Date.now(),
      })
      return createdSessionId
    })

    await asAuthenticatedUser(convex, user.userId, sessionId).mutation(
      api.deviceAuth.abortDeviceExchange,
      { code: "EFGH-IJKL", attemptId, sessionId, generation: 1 }
    )

    await convex.run(async (context) => {
      expect(await context.db.get("authSessions", sessionId)).toBeNull()
      const intent = await context.db
        .query("workerSessionCleanupIntents")
        .withIndex("by_workerSessionId", (queryBuilder) =>
          queryBuilder.eq("workerSessionId", attemptId)
        )
        .unique()
      expect(intent).toMatchObject({
        workerSessionId: attemptId,
        issuanceGeneration: 1,
      })
      const record = await context.db
        .query("deviceCodes")
        .withIndex("by_code", (queryBuilder) =>
          queryBuilder.eq("code", "EFGH-IJKL")
        )
        .unique()
      expect(record).toMatchObject({ status: "authorized" })
    })
  })

  it("aborts only the authenticated attempt when the code was superseded", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "superseded-owner")
    const otherUser = await insertTestUser(convex, "other-owner")
    const sessions = await convex.run(async (context) => {
      const oldSessionId = await context.db.insert("authSessions", {
        userId: user.userId,
        expirationTime: Date.now() + DEVICE_CODE_TTL_MS,
        deviceExchangeAttemptId: "old-attempt",
      })
      const newSessionId = await context.db.insert("authSessions", {
        userId: user.userId,
        expirationTime: Date.now() + DEVICE_CODE_TTL_MS,
        deviceExchangeAttemptId: "new-attempt",
      })
      await context.db.insert("deviceCodes", {
        code: "GHIJ-KLMN",
        pollSecretDigest: await digestPollSecret("superseded-secret"),
        status: "exchanging",
        userId: user.userId,
        deviceName: "Superseded TV",
        exchangeAttemptId: "new-attempt",
        exchangeGeneration: 1,
        exchangeLeaseExpiresAt: Date.now() + DEVICE_CODE_EXCHANGE_LEASE_MS,
        exchangeSessionId: newSessionId,
        expiresAt: Date.now() + DEVICE_CODE_TTL_MS,
        createdAt: Date.now(),
      })
      return { oldSessionId, newSessionId }
    })

    await expect(
      asAuthenticatedUser(
        convex,
        otherUser.userId,
        otherUser.sessionId
      ).mutation(api.deviceAuth.abortDeviceExchange, {
        code: "GHIJ-KLMN",
        attemptId: "old-attempt",
        sessionId: sessions.oldSessionId,
        generation: 1,
      })
    ).rejects.toThrow("Device code exchange session is invalid")
    await asAuthenticatedUser(
      convex,
      user.userId,
      sessions.oldSessionId
    ).mutation(api.deviceAuth.abortDeviceExchange, {
      code: "GHIJ-KLMN",
      attemptId: "old-attempt",
      sessionId: sessions.oldSessionId,
      generation: 1,
    })

    await convex.run(async (context) => {
      expect(
        await context.db.get("authSessions", sessions.oldSessionId)
      ).toBeNull()
      expect(
        await context.db.get("authSessions", sessions.newSessionId)
      ).not.toBeNull()
      const record = await context.db
        .query("deviceCodes")
        .withIndex("by_code", (queryBuilder) =>
          queryBuilder.eq("code", "GHIJ-KLMN")
        )
        .unique()
      expect(record).toMatchObject({
        status: "exchanging",
        exchangeAttemptId: "new-attempt",
        exchangeSessionId: sessions.newSessionId,
      })
      expect(
        await context.db
          .query("workerSessionCleanupIntents")
          .withIndex("by_workerSessionId", (queryBuilder) =>
            queryBuilder.eq("workerSessionId", "old-attempt")
          )
          .unique()
      ).not.toBeNull()
    })
  })

  it("cleans a linked but non-finalized session after code expiry", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(200_000)
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "abandoned-owner")
    const attemptId = "abandoned-attempt"
    const sessionId = await convex.run(async (context) => {
      const createdSessionId = await context.db.insert("authSessions", {
        userId: user.userId,
        expirationTime: Date.now() + DEVICE_CODE_TTL_MS,
        deviceExchangeAttemptId: attemptId,
        workerSessionId: attemptId,
      })
      await context.db.insert("authRefreshTokens", {
        sessionId: createdSessionId,
        expirationTime: Date.now() + DEVICE_CODE_TTL_MS,
      })
      await context.db.insert("deviceCodes", {
        code: "FGHI-JKLM",
        pollSecretDigest: await digestPollSecret("abandoned-secret"),
        status: "exchanging",
        userId: user.userId,
        deviceName: "Abandoned TV",
        exchangeAttemptId: attemptId,
        exchangeLeaseExpiresAt: Date.now() - 1,
        exchangeSessionId: createdSessionId,
        expiresAt: Date.now() - 1,
        createdAt: 1,
      })
      return createdSessionId
    })

    await convex.mutation(internal.deviceAuth.cleanupExpiredCodes)

    await convex.run(async (context) => {
      expect(await context.db.get("authSessions", sessionId)).toBeNull()
      expect(
        await context.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (queryBuilder) =>
            queryBuilder.eq("sessionId", sessionId)
          )
          .collect()
      ).toHaveLength(0)
      expect(
        await context.db
          .query("workerSessionCleanupIntents")
          .withIndex("by_workerSessionId", (queryBuilder) =>
            queryBuilder.eq("workerSessionId", attemptId)
          )
          .unique()
      ).not.toBeNull()
    })
    vi.useRealTimers()
  })

  it("records expired Worker cleanup when the Convex session is missing", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(300_000)
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "missing-session-owner")
    await convex.run(async (context) => {
      const missingSessionId = await context.db.insert("authSessions", {
        userId: user.userId,
        expirationTime: Date.now() - 1,
        deviceExchangeAttemptId: "missing-session-attempt",
      })
      await context.db.delete("authSessions", missingSessionId)
      await context.db.insert("deviceCodes", {
        code: "HIJK-LMNO",
        pollSecretDigest: await digestPollSecret("missing-secret"),
        status: "exchanging",
        userId: user.userId,
        deviceName: "Missing Session TV",
        exchangeAttemptId: "missing-session-attempt",
        exchangeLeaseExpiresAt: Date.now() - 1,
        exchangeSessionId: missingSessionId,
        expiresAt: Date.now() - 1,
        createdAt: 1,
      })
    })

    await convex.mutation(internal.deviceAuth.cleanupExpiredCodes)

    await convex.run(async (context) => {
      expect(
        await context.db
          .query("workerSessionCleanupIntents")
          .withIndex("by_workerSessionId", (queryBuilder) =>
            queryBuilder.eq("workerSessionId", "missing-session-attempt")
          )
          .unique()
      ).not.toBeNull()
    })
    vi.useRealTimers()
  })

  it("leaves a consumed linked session untouched when its code expires", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(400_000)
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "consumed-owner")
    const attemptId = "consumed-attempt"
    const sessionId = await convex.run(async (context) => {
      const createdSessionId = await context.db.insert("authSessions", {
        userId: user.userId,
        expirationTime: Date.now() + DEVICE_CODE_TTL_MS,
        deviceExchangeAttemptId: attemptId,
        workerSessionId: attemptId,
      })
      await context.db.insert("authRefreshTokens", {
        sessionId: createdSessionId,
        expirationTime: Date.now() + DEVICE_CODE_TTL_MS,
      })
      await context.db.insert("deviceCodes", {
        code: "IJKL-MNOP",
        pollSecretDigest: await digestPollSecret("consumed-secret"),
        status: "consumed",
        userId: user.userId,
        deviceName: "Consumed TV",
        exchangeAttemptId: attemptId,
        exchangeSessionId: createdSessionId,
        consumedSessionId: createdSessionId,
        expiresAt: Date.now() - 1,
        createdAt: 1,
      })
      return createdSessionId
    })

    await convex.mutation(internal.deviceAuth.cleanupExpiredCodes)

    await convex.run(async (context) => {
      expect(await context.db.get("authSessions", sessionId)).not.toBeNull()
      expect(
        await context.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (queryBuilder) =>
            queryBuilder.eq("sessionId", sessionId)
          )
          .collect()
      ).toHaveLength(1)
      expect(
        await context.db
          .query("workerSessionCleanupIntents")
          .withIndex("by_workerSessionId", (queryBuilder) =>
            queryBuilder.eq("workerSessionId", attemptId)
          )
          .unique()
      ).toBeNull()
    })
    vi.useRealTimers()
  })

  it("cleans expired codes in bounded batches", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const convex = createConvexTest()
    await convex.run(async (context) => {
      for (
        let codeIndex = 0;
        codeIndex < DEVICE_CODE_CLEANUP_BATCH_SIZE + 1;
        codeIndex += 1
      ) {
        await context.db.insert("deviceCodes", {
          code: `TEST-${String.fromCharCode(65 + Math.floor(codeIndex / 26))}${String.fromCharCode(65 + (codeIndex % 26))}AA`,
          pollSecretDigest: await digestPollSecret(String(codeIndex)),
          status: "pending",
          deviceName: "Expired TV",
          expiresAt: 999_999,
          createdAt: codeIndex,
        })
      }
    })

    await expect(
      convex.mutation(internal.deviceAuth.cleanupExpiredCodes)
    ).resolves.toEqual({ deleted: DEVICE_CODE_CLEANUP_BATCH_SIZE })
    await expect(
      convex.run(
        async (context) => await context.db.query("deviceCodes").collect()
      )
    ).resolves.toHaveLength(1)
    await convex.finishAllScheduledFunctions(vi.runAllTimers)
    await expect(
      convex.run(
        async (context) => await context.db.query("deviceCodes").collect()
      )
    ).resolves.toHaveLength(0)
    vi.useRealTimers()
  })
})
