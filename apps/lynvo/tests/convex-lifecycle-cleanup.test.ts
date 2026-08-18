// @vitest-environment edge-runtime

import { api, internal } from "../convex/_generated/api"
import {
  ACCOUNT_ERASURE_BATCH_SIZE,
  ACCOUNT_INACTIVITY_LIMIT_MS,
  CLEANUP_USER_PAGE_SIZE,
  DAY_MS,
  LINKS_MAX_COUNT,
  LINK_RETENTION_BATCH_SIZE,
  EMPTY_LINK_METADATA_JSON,
} from "../convex/constants"
import {
  calculateAppOwnedStorageUsage,
  getUserStorageLedger,
} from "../convex/storagePolicy"
import {
  asAuthenticatedUser,
  createConvexTest,
  insertTestUser,
} from "./convex-test-harness"

describe("bounded lifecycle cleanup", () => {
  it("rejects new user-owned writes after erasure starts", async () => {
    const convex = createConvexTest()
    const target = await insertTestUser(convex, "delete-pending")
    const client = asAuthenticatedUser(convex, target.userId, target.sessionId)

    await convex.mutation(internal.users.deleteUserData, {
      userId: target.userId,
    })
    const realtimeIntents = await convex.run((context) =>
      context.db.query("realtimeSessionRevocationIntents").collect()
    )
    expect(realtimeIntents).toMatchObject([{ userId: target.userId }])

    await expect(
      client.mutation(api.links.createOrUpdate, {
        url: "https://pending.example/new",
      })
    ).rejects.toThrow("Account erasure is in progress")
  })

  it("resumes account erasure across bounded transactions", async () => {
    vi.useFakeTimers()
    const convex = createConvexTest()
    const target = await insertTestUser(convex, "delete-batched")
    await convex.run(async (context) => {
      for (let index = 0; index < ACCOUNT_ERASURE_BATCH_SIZE + 1; index += 1) {
        await context.db.insert("links", {
          userId: target.userId,
          url: `https://batched.example/${index}`,
          meta: EMPTY_LINK_METADATA_JSON,
          createdAt: index,
          updatedAt: index,
        })
      }
    })

    await convex.mutation(internal.users.deleteUserData, {
      userId: target.userId,
    })
    const initiated = await convex.run(async (context) => ({
      user: await context.db.get(target.userId),
      progress: await context.db
        .query("accountErasures")
        .withIndex("by_userId", (queryBuilder) =>
          queryBuilder.eq("userId", target.userId)
        )
        .unique(),
    }))
    expect(initiated.user).not.toBeNull()
    expect(initiated.progress).not.toBeNull()

    await convex.finishAllScheduledFunctions(vi.runAllTimers)
    const completed = await convex.run(async (context) => ({
      user: await context.db.get(target.userId),
      progress: await context.db
        .query("accountErasures")
        .withIndex("by_userId", (queryBuilder) =>
          queryBuilder.eq("userId", target.userId)
        )
        .unique(),
    }))
    expect(completed).toEqual({ user: null, progress: null })
    vi.useRealTimers()
  })

  it("rechecks completed stages before finalizing an interrupted erasure", async () => {
    vi.useFakeTimers()
    const convex = createConvexTest()
    const target = await insertTestUser(convex, "delete-recheck")
    await convex.mutation(internal.users.deleteUserData, {
      userId: target.userId,
    })
    const lateDocumentIds = await convex.run(async (context) => {
      const progress = await context.db
        .query("accountErasures")
        .withIndex("by_userId", (queryBuilder) =>
          queryBuilder.eq("userId", target.userId)
        )
        .unique()
      if (!progress) {
        throw new Error("Expected account erasure progress")
      }
      await context.db.patch("accountErasures", progress._id, {
        stage: "finalize",
      })
      const linkId = await context.db.insert("links", {
        userId: target.userId,
        url: "https://interrupted.example/late",
        meta: EMPTY_LINK_METADATA_JSON,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      const accountId = await context.db.insert("authAccounts", {
        userId: target.userId,
        provider: "credentials",
        providerAccountId: "delete-recheck",
      })
      const verificationCodeId = await context.db.insert(
        "authVerificationCodes",
        {
          accountId,
          provider: "credentials",
          code: "late-code",
          expirationTime: Date.now() + DAY_MS,
        }
      )
      const refreshTokenId = await context.db.insert("authRefreshTokens", {
        sessionId: target.sessionId,
        expirationTime: Date.now() + DAY_MS,
      })
      const verifierId = await context.db.insert("authVerifiers", {
        sessionId: target.sessionId,
        signature: "late-signature",
      })
      return {
        linkId,
        accountId,
        verificationCodeId,
        refreshTokenId,
        verifierId,
      }
    })

    await convex.mutation(internal.accountErasure.process, {
      userId: target.userId,
    })
    await convex.finishAllScheduledFunctions(vi.runAllTimers)

    const result = await convex.run(async (context) => ({
      user: await context.db.get(target.userId),
      link: await context.db.get(lateDocumentIds.linkId),
      account: await context.db.get(lateDocumentIds.accountId),
      verificationCode: await context.db.get(
        lateDocumentIds.verificationCodeId
      ),
      refreshToken: await context.db.get(lateDocumentIds.refreshTokenId),
      verifier: await context.db.get(lateDocumentIds.verifierId),
      session: await context.db.get(target.sessionId),
    }))
    expect(result).toEqual({
      user: null,
      link: null,
      account: null,
      verificationCode: null,
      refreshToken: null,
      verifier: null,
      session: null,
    })
    vi.useRealTimers()
  })

  it("deletes every indexed account child, preserves another user, and retries", async () => {
    vi.useFakeTimers()
    const convex = createConvexTest()
    const target = await insertTestUser(convex, "delete-target")
    const preserved = await insertTestUser(convex, "delete-preserved")
    await convex.run(async (context) => {
      const now = Date.now()
      const domainId = await context.db.insert("userPluginDomains", {
        userId: target.userId,
        pluginServerId: "plugin-server-1",
        domain: "target.example",
        pluginId: "direct-media",
      })
      await context.db.insert("userPluginCredentials", {
        userId: target.userId,
        pluginDomainId: domainId,
        pluginServerId: "plugin-server-1",
        pluginId: "direct-media",
        domain: "target.example",
        ciphertext: "encrypted",
        nonce: "nonce",
        algorithm: "AES-256-GCM",
        keyVersion: 1,
        createdAt: now,
        updatedAt: now,
      })
      for (let index = 0; index < LINKS_MAX_COUNT; index += 1) {
        await context.db.insert("links", {
          userId: target.userId,
          url: `https://target.example/link/${index}`,
          meta: EMPTY_LINK_METADATA_JSON,
          createdAt: now + index,
          updatedAt: now + index,
        })
      }
      await context.db.insert("savedLinkSynchronizationStates", {
        userId: target.userId,
        revision: 4,
        broadcastRevision: 3,
        pendingBroadcast: true,
        updatedAt: now,
      })
      await context.db.insert("userPluginServers", {
        userId: target.userId,
        baseUrl: "https://plugin-server.target.example",
        normalizedBaseUrl: "https://plugin-server.target.example",
        apiKeyCiphertext: "ciphertext",
        apiKeyNonce: "nonce",
        apiKeyAlgorithm: "AES-256-GCM",
        apiKeyVersion: 1,
        credentialStatus: "ready",
        manifest: "{}",
        enabled: true,
        priority: 1,
        verificationStatus: "verified",
        createdAt: now,
        updatedAt: now,
      })
      await context.db.insert("deviceCodes", {
        code: "TARGET01",
        pollSecretDigest: "digest",
        status: "authorized",
        deviceName: "Target device",
        userId: target.userId,
        expiresAt: now + DAY_MS,
        createdAt: now,
      })
      await context.db.insert("remoteCommands", {
        userId: target.userId,
        targetSessionId: target.sessionId,
        targetReceiverId: "receiver",
        command: "play",
        payload: "{}",
        createdAt: now,
        expiresAt: now + DAY_MS,
        status: "queued",
        availableAt: now,
      })
      await context.db.insert("usageCounters", {
        ownerKey: `user:${target.userId}`,
        metricId: "test",
        periodKey: "2026-07",
        epoch: 0,
        used: 1,
      })
      await context.db.insert("authRefreshTokens", {
        sessionId: target.sessionId,
        expirationTime: now + DAY_MS,
      })
      await context.db.insert("authVerifiers", {
        sessionId: target.sessionId,
        signature: "target-signature",
      })
      const accountId = await context.db.insert("authAccounts", {
        userId: target.userId,
        provider: "credentials",
        providerAccountId: "delete-target",
      })
      await context.db.insert("authVerificationCodes", {
        accountId,
        provider: "credentials",
        code: "target-code",
        expirationTime: now + DAY_MS,
      })
      const usage = await calculateAppOwnedStorageUsage(context, target.userId)
      await context.db.insert("userStorageLedgers", {
        userId: target.userId,
        schemaVersion: 1,
        ...usage,
        updatedAt: now,
      })
    })

    await convex.mutation(internal.users.deleteUserData, {
      userId: target.userId,
    })
    await expect(
      convex.mutation(internal.users.deleteUserData, {
        userId: target.userId,
      })
    ).resolves.toEqual({ success: true })
    await convex.finishAllScheduledFunctions(vi.runAllTimers)
    const result = await convex.run(async (context) => ({
      target: await context.db.get(target.userId),
      preserved: await context.db.get(preserved.userId),
      targetLinks: await context.db
        .query("links")
        .withIndex("by_userId", (queryBuilder) =>
          queryBuilder.eq("userId", target.userId)
        )
        .collect(),
      targetSynchronizationState: await context.db
        .query("savedLinkSynchronizationStates")
        .withIndex("by_userId", (queryBuilder) =>
          queryBuilder.eq("userId", target.userId)
        )
        .unique(),
      preservedSessions: await context.db
        .query("authSessions")
        .withIndex("userId", (queryBuilder) =>
          queryBuilder.eq("userId", preserved.userId)
        )
        .collect(),
    }))
    expect(result.target).toBeNull()
    expect(result.targetLinks).toEqual([])
    expect(result.targetSynchronizationState).toBeNull()
    expect(result.preserved).not.toBeNull()
    expect(result.preservedSessions).toHaveLength(1)
    vi.useRealTimers()
  })

  it("drains inactive accounts one scheduled transaction at a time", async () => {
    vi.useFakeTimers()
    const log = vi.spyOn(console, "info").mockImplementation(() => {})
    const now = Date.UTC(2026, 6, 22)
    vi.setSystemTime(now)
    const convex = createConvexTest()
    const first = await insertTestUser(convex, "inactive-first")
    const second = await insertTestUser(convex, "inactive-second")
    const active = await insertTestUser(convex, "still-active")
    await convex.run(async (context) => {
      const inactiveAt = now - ACCOUNT_INACTIVITY_LIMIT_MS - 1
      await context.db.patch(first.userId, { lastActiveAt: inactiveAt })
      await context.db.patch(second.userId, { lastActiveAt: inactiveAt })
      await context.db.patch(active.userId, { lastActiveAt: now })
    })

    const firstBatch = await convex.mutation(
      internal.users.cleanupInactiveUsers,
      {}
    )
    expect(firstBatch).toEqual({ processedUsers: 1, continued: true })
    await convex.finishAllScheduledFunctions(vi.runAllTimers)
    const remaining = await convex.run(async (context) => ({
      first: await context.db.get(first.userId),
      second: await context.db.get(second.userId),
      active: await context.db.get(active.userId),
    }))
    expect(remaining.first).toBeNull()
    expect(remaining.second).toBeNull()
    expect(remaining.active).not.toBeNull()
    const realtimeIntents = await convex.run((context) =>
      context.db.query("realtimeSessionRevocationIntents").collect()
    )
    expect(realtimeIntents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: first.userId }),
        expect.objectContaining({ userId: second.userId }),
      ])
    )
    expect(log).toHaveBeenCalledWith(
      "maintenance.cleanup_complete",
      expect.objectContaining({
        job: "inactive_accounts",
        processedUsers: 2,
        continued: false,
        errorClass: null,
      })
    )
    expect(JSON.stringify(log.mock.calls)).not.toContain("inactive-first")
    log.mockRestore()
    vi.useRealTimers()
  })

  it("paginates retention cleanup and reconciles each user ledger", async () => {
    vi.useFakeTimers()
    const now = Date.UTC(2026, 6, 22)
    vi.setSystemTime(now)
    const convex = createConvexTest()
    const users = await Promise.all([
      insertTestUser(convex, "retention-first"),
      insertTestUser(convex, "retention-second"),
      insertTestUser(convex, "retention-third"),
    ])
    await convex.run(async (context) => {
      for (const user of users) {
        await context.db.patch(user.userId, { storageRetentionDays: 7 })
        await context.db.insert("links", {
          userId: user.userId,
          url: `https://${user.userId}.example/expired`,
          meta: EMPTY_LINK_METADATA_JSON,
          createdAt: now - 8 * DAY_MS,
          updatedAt: now - 8 * DAY_MS,
        })
        if (user === users[0]) {
          for (
            let linkIndex = 0;
            linkIndex < LINK_RETENTION_BATCH_SIZE + 5;
            linkIndex += 1
          ) {
            await context.db.insert("links", {
              userId: user.userId,
              url: `https://${user.userId}.example/expired-${linkIndex}`,
              meta: EMPTY_LINK_METADATA_JSON,
              createdAt: now - 8 * DAY_MS,
              updatedAt: now - 8 * DAY_MS,
            })
          }
        }
        await context.db.insert("links", {
          userId: user.userId,
          url: `https://${user.userId}.example/live`,
          meta: EMPTY_LINK_METADATA_JSON,
          createdAt: now,
          updatedAt: now,
        })
        const usage = await calculateAppOwnedStorageUsage(context, user.userId)
        await context.db.insert("userStorageLedgers", {
          userId: user.userId,
          schemaVersion: 1,
          ...usage,
          updatedAt: now,
        })
      }
    })

    await convex.mutation(internal.links.cleanupExpiredLinks, {
      paginationOpts: { cursor: null, numItems: CLEANUP_USER_PAGE_SIZE },
    })
    await convex.finishAllScheduledFunctions(vi.runAllTimers)
    for (const user of users) {
      const result = await convex.run(async (context) => ({
        links: await context.db
          .query("links")
          .withIndex("by_userId", (queryBuilder) =>
            queryBuilder.eq("userId", user.userId)
          )
          .collect(),
        ledger: await getUserStorageLedger(context, user.userId),
        inventory: await calculateAppOwnedStorageUsage(context, user.userId),
      }))
      expect(result.links.map((link) => link.url)).toEqual([
        `https://${user.userId}.example/live`,
      ])
      expect(result.ledger).toMatchObject(result.inventory)
    }
    vi.useRealTimers()
  })
})
