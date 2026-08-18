import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server"
import { v } from "convex/values"
import {
  getAuthSessionId,
  getAuthUserId,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import {
  getAuthenticatedUserId,
  getAuthenticatedWritableUserId,
} from "./authentication"
import { validatePassword } from "../app/lib/auth-policy"
import {
  DEFAULT_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  LINK_LIMIT_BYTES,
  LINK_RETENTION_BATCH_SIZE,
  STORAGE_RETENTION_DAY_OPTIONS,
  USER_STORAGE_LIMIT_BYTES,
  USER_STORAGE_WARNING_BYTES,
  PASSWORD_CHANGE_RECOVERY_DELAY_MS,
} from "./constants"
import {
  cleanupInactiveUserAccounts,
  deleteUserAccountData,
  getAllUserSessionRevocations,
  revokeAllUserSessions,
  revokeCurrentUserSession,
  revokeOtherUserSessions,
  revokeUserSession,
  touchUserActivity,
} from "./accountLifecycle"
import {
  deleteExpiredLinks,
  getExpiredLinks,
  calculateAppOwnedStorageUsage,
  assertStorageMutation,
  getOperationalStorageBytes,
  getUserStorageLedger,
  normalizeRetentionDays,
  recordStorageDeletion,
} from "./storagePolicy"
import { buildPlayerPreferencesPatch } from "./userPreferences"
import { enqueueWorkerSessionCleanup } from "./sessionCleanup"
import { enqueueRealtimeSessionRevocation } from "./realtimeSessionRevocations"

const assertCurrentUser = async (ctx: {
  auth: Parameters<typeof getAuthUserId>[0]["auth"]
}) => {
  const userId = await getAuthUserId(ctx)
  if (!userId) {
    throw new Error("Authentication required")
  }
  return userId
}

export const getMe = query({
  returns: v.any(),
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    return await ctx.db.get("users", userId)
  },
})

export const getSessionUser = query({
  returns: v.any(),
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    const sessionId = await getAuthSessionId(ctx)
    if (!sessionId) {
      throw new Error("Authentication session required")
    }
    const session = await ctx.db.get("authSessions", sessionId)
    if (!session || session.userId !== userId) {
      throw new Error("Authentication session required")
    }
    const user = await ctx.db.get("users", userId)
    if (!user) {
      return null
    }
    return {
      id: user._id,
      username: user.username,
      sessionId,
    }
  },
})

export const getPlayerPreferences = query({
  returns: v.object({
    rangeSupportedPlayerId: v.optional(v.string()),
    rangeUnsupportedPlayerId: v.optional(v.string()),
  }),
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    const user = await ctx.db.get("users", userId)
    return {
      rangeSupportedPlayerId: user?.rangeSupportedPlayerId,
      rangeUnsupportedPlayerId: user?.rangeUnsupportedPlayerId,
    }
  },
})

export const updatePlayerPreferences = mutation({
  returns: v.object({ success: v.boolean() }),
  args: {
    rangeSupportedPlayerId: v.optional(v.string()),
    rangeUnsupportedPlayerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const user = await ctx.db.get("users", userId)
    if (!user) {
      throw new Error("Authentication required")
    }
    await assertStorageMutation(ctx, userId, "profileBytes", user, {
      ...user,
      ...buildPlayerPreferencesPatch(args),
    })
    await ctx.db.patch("users", userId, buildPlayerPreferencesPatch(args))
    return { success: true }
  },
})

export const updateStorageRetentionDays = mutation({
  returns: v.object({
    success: v.boolean(),
    deletedLinks: v.number(),
  }),
  args: {
    days: v.number(),
    deleteExpiredLinks: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const retentionDays = normalizeRetentionDays(args.days)
    const user = await ctx.db.get("users", userId)
    if (!user) {
      throw new Error("Authentication required")
    }
    let deletedLinks = 0
    if (args.deleteExpiredLinks) {
      const now = Date.now()
      deletedLinks = await deleteExpiredLinks(ctx, userId, retentionDays, now)
      if (deletedLinks === LINK_RETENTION_BATCH_SIZE) {
        await ctx.scheduler.runAfter(
          0,
          internal.links.cleanupExpiredLinksForUser,
          { userId, now }
        )
      }
    }

    await assertStorageMutation(ctx, userId, "profileBytes", user, {
      ...user,
      storageRetentionDays: retentionDays,
    })
    await ctx.db.patch("users", userId, {
      storageRetentionDays: retentionDays,
    })
    return { success: true, deletedLinks }
  },
})

export const previewStorageRetentionDays = query({
  returns: v.any(),
  args: {
    days: v.number(),
    timeBucket: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const retentionDays = normalizeRetentionDays(args.days)
    const expiredLinks = await getExpiredLinks(
      ctx,
      userId,
      retentionDays,
      args.timeBucket
    )

    return { expiredLinkCount: expiredLinks.length }
  },
})

export const clearLinks = mutation({
  returns: v.object({
    success: v.boolean(),
    deletedLinks: v.number(),
  }),
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const links = await ctx.db
      .query("links")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()

    for (const link of links) {
      await recordStorageDeletion(ctx, userId, "linkBytes", link)
      await ctx.db.delete("links", link._id)
    }

    return { success: true, deletedLinks: links.length }
  },
})

export const touchActivity = mutation({
  returns: v.object({ success: v.boolean() }),
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const sessionId = await getAuthSessionId(ctx)
    await touchUserActivity(ctx, userId, sessionId, Date.now())
    return { success: true }
  },
})

export const listSessions = query({
  returns: v.array(
    v.object({
      id: v.id("authSessions"),
      deviceName: v.string(),
      lastActiveAt: v.number(),
      createdAt: v.number(),
      isCurrent: v.boolean(),
    })
  ),
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    const currentSessionId = await getAuthSessionId(ctx)
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect()
    return sessions.map((session) => ({
      id: session._id,
      deviceName: session.deviceName ?? "Unknown device",
      lastActiveAt: session.lastActiveAt ?? session._creationTime,
      createdAt: session._creationTime,
      isCurrent: session._id === currentSessionId,
    }))
  },
})

export const getStorageUsage = query({
  returns: v.any(),
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    const [user, existingLedger, authBytes] = await Promise.all([
      ctx.db.get("users", userId),
      getUserStorageLedger(ctx, userId),
      getOperationalStorageBytes(ctx, userId),
    ])
    const ledger =
      existingLedger ?? (await calculateAppOwnedStorageUsage(ctx, userId))
    const retentionDays = user?.storageRetentionDays ?? DEFAULT_RETENTION_DAYS
    const pluginDomainBytes =
      ledger.pluginDomainBytes + ledger.pluginCredentialBytes

    return {
      estimatedBytes: ledger.totalEnforcedBytes + authBytes,
      enforcedBytes: ledger.totalEnforcedBytes,
      operationalBytes: authBytes,
      linkBytes: ledger.linkBytes,
      pluginServerBytes: ledger.pluginServerBytes,
      pluginDomainBytes,
      authBytes,
      profileBytes: ledger.profileBytes,
      savedLinkCount: ledger.savedLinkCount,
      averageLinkBytes:
        ledger.savedLinkCount > 0
          ? Math.round(ledger.linkBytes / ledger.savedLinkCount)
          : 0,
      storageLimitBytes: USER_STORAGE_LIMIT_BYTES,
      storageWarningBytes: USER_STORAGE_WARNING_BYTES,
      linkLimitBytes: LINK_LIMIT_BYTES,
      retentionDays,
      retentionDayOptions: [...STORAGE_RETENTION_DAY_OPTIONS],
      defaultRetentionDays: DEFAULT_RETENTION_DAYS,
      maxRetentionDays: MAX_RETENTION_DAYS,
    }
  },
})

export const renameSession = mutation({
  returns: v.object({ success: v.boolean() }),
  args: {
    sessionId: v.id("authSessions"),
    deviceName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const session = await ctx.db.get("authSessions", args.sessionId)
    if (!session || session.userId !== userId) {
      throw new Error("Session not found")
    }
    const deviceName = args.deviceName.trim().slice(0, 80)
    if (!deviceName) {
      throw new Error("Device name is required")
    }
    await ctx.db.patch("authSessions", session._id, { deviceName })
    return { success: true }
  },
})

export const setCurrentSessionDevice = mutation({
  returns: v.object({ success: v.boolean() }),
  args: {
    deviceName: v.string(),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedWritableUserId(ctx)
    const sessionId = await getAuthSessionId(ctx)
    if (!sessionId) {
      throw new Error("Session not found")
    }
    const session = await ctx.db.get("authSessions", sessionId)
    if (!session) {
      throw new Error("Session not found")
    }
    const deviceName = args.deviceName.trim().slice(0, 80)
    if (!deviceName) {
      throw new Error("Device name is required")
    }
    await ctx.db.patch("authSessions", sessionId, {
      deviceName: session.deviceName ?? deviceName,
      lastActiveAt: Date.now(),
    })
    return { success: true }
  },
})

export const linkCurrentSessionWorker = mutation({
  returns: v.object({ success: v.boolean() }),
  args: { workerSessionId: v.string() },
  handler: async (ctx, args) => {
    await getAuthenticatedWritableUserId(ctx)
    const sessionId = await getAuthSessionId(ctx)
    if (!sessionId) {
      throw new Error("Session not found")
    }
    const existingSession = await ctx.db
      .query("authSessions")
      .withIndex("by_workerSessionId", (queryBuilder) =>
        queryBuilder.eq("workerSessionId", args.workerSessionId)
      )
      .unique()
    if (existingSession && existingSession._id !== sessionId) {
      throw new Error("Worker session is already linked")
    }
    await ctx.db.patch("authSessions", sessionId, {
      workerSessionId: args.workerSessionId,
    })
    return { success: true }
  },
})

export const revokeSession = mutation({
  returns: v.object({
    success: v.boolean(),
    workerSessionIds: v.array(v.string()),
  }),
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const currentSessionId = await getAuthSessionId(ctx)
    const sessionId = ctx.db.normalizeId("authSessions", args.sessionId)
    if (!sessionId) {
      throw new Error("Session not found")
    }
    const revoked = await revokeUserSession(
      ctx,
      userId,
      currentSessionId,
      sessionId
    )
    return {
      success: true,
      workerSessionIds: revoked.workerSessionIds,
    }
  },
})

export const revokeCurrentSessionFromWorker = mutation({
  returns: v.object({ success: v.boolean() }),
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const sessionId = await getAuthSessionId(ctx)
    if (!sessionId) {
      throw new Error("Session not found")
    }
    await revokeCurrentUserSession(ctx, userId, sessionId)
    return { success: true }
  },
})

export const revokeAllSessions = mutation({
  returns: v.object({
    success: v.boolean(),
    workerSessionIds: v.array(v.string()),
    sessionIds: v.array(v.string()),
  }),
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const revoked = await revokeAllUserSessions(ctx, userId)
    return { success: true, ...revoked }
  },
})

export const changePassword = action({
  returns: v.object({
    success: v.boolean(),
    sessionIds: v.array(v.id("authSessions")),
  }),
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean
    sessionIds: Array<Id<"authSessions">>
  }> => {
    const userId = await assertCurrentUser(ctx)
    const [sessionId, user] = await Promise.all([
      getAuthSessionId(ctx),
      ctx.runQuery(internal.users.getUserForAuthAction, { userId }),
    ])
    if (!user) {
      throw new Error("Authentication required")
    }
    if (user.erasurePendingAt) {
      throw new Error("Account erasure is in progress")
    }
    const passwordError = validatePassword(args.newPassword, user.username)
    if (passwordError) {
      throw new Error(passwordError)
    }
    await retrieveAccount(ctx, {
      provider: "credentials",
      account: {
        id: user.normalizedUsername,
        secret: args.currentPassword,
      },
    })
    const transition = await ctx.runMutation(
      internal.users.preparePasswordChange,
      { userId, exceptSessionId: sessionId }
    )
    try {
      await modifyAccountCredentials(ctx, {
        provider: "credentials",
        account: {
          id: user.normalizedUsername,
          secret: args.newPassword,
        },
      })
    } catch (error) {
      await ctx.runMutation(internal.users.finishPasswordChange, {
        userId,
        startedAt: transition.startedAt,
      })
      throw error
    }
    await ctx.runMutation(internal.users.finishPasswordChange, {
      userId,
      startedAt: transition.startedAt,
    })
    console.info("security.password_changed", { userId })
    return { success: true, sessionIds: transition.sessionIds }
  },
})

export const beginAccountErasure = mutation({
  returns: v.object({ workerSessionIds: v.array(v.string()) }),
  args: {
    confirmUsername: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const user = await ctx.db.get("users", userId)
    if (!user) {
      throw new Error("Authentication required")
    }
    if (args.confirmUsername.trim() !== user.username) {
      throw new Error("Username does not match")
    }
    const workerSessionIds = await getAllUserSessionRevocations(ctx, userId)
    await enqueueWorkerSessionCleanup(ctx, workerSessionIds)
    await enqueueRealtimeSessionRevocation(ctx, userId)
    await deleteUserAccountData(ctx, userId)
    console.info("security.account_deleted", { userId })
    return { workerSessionIds }
  },
})

export const getUserForAuthAction = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get("users", args.userId)
  },
})

export const preparePasswordChange = internalMutation({
  args: {
    userId: v.id("users"),
    exceptSessionId: v.union(v.id("authSessions"), v.null()),
  },
  returns: v.object({
    sessionIds: v.array(v.id("authSessions")),
    startedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId)
    if (!user || user.passwordChangePendingAt) {
      throw new Error("Password change is already in progress")
    }
    const startedAt = Date.now()
    await ctx.db.patch("users", args.userId, {
      passwordChangePendingAt: startedAt,
    })
    const revoked = await revokeOtherUserSessions(
      ctx,
      args.userId,
      args.exceptSessionId
    )
    await ctx.scheduler.runAfter(
      PASSWORD_CHANGE_RECOVERY_DELAY_MS,
      internal.users.finishPasswordChange,
      { userId: args.userId, startedAt }
    )
    return { sessionIds: revoked.sessionIds, startedAt }
  },
})

export const finishPasswordChange = internalMutation({
  args: { userId: v.id("users"), startedAt: v.number() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId)
    if (user?.passwordChangePendingAt === args.startedAt) {
      await ctx.db.patch("users", args.userId, {
        passwordChangePendingAt: undefined,
      })
    }
    return { success: true }
  },
})

export const deleteUserData = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await deleteUserAccountData(ctx, args.userId)
    return { success: true }
  },
})

export const cleanupInactiveUsers = internalMutation({
  args: {
    processedUsers: v.optional(v.number()),
    startedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const startedAt = args.startedAt ?? now
    const deletedUsers = await cleanupInactiveUserAccounts(
      ctx,
      now,
      args.processedUsers ?? 0,
      startedAt
    )
    const processedUsers = (args.processedUsers ?? 0) + deletedUsers
    if (deletedUsers > 0) {
      return { processedUsers, continued: true }
    }
    console.info("maintenance.cleanup_complete", {
      job: "inactive_accounts",
      processedUsers,
      continued: false,
      durationMs: now - startedAt,
      errorClass: null,
    })
    return { processedUsers, continued: false }
  },
})
