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
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server"
import { internal } from "./_generated/api"
import {
  getAuthenticatedUserId,
  getAuthenticatedWritableUserId,
} from "./authentication"
import { validatePassword } from "../app/lib/auth-policy"
import {
  DEFAULT_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  RECENT_LINK_LIMIT_BYTES,
  RECENT_LINK_RETENTION_BATCH_SIZE,
  STORAGE_RETENTION_DAY_OPTIONS,
  USER_STORAGE_LIMIT_BYTES,
  USER_STORAGE_WARNING_BYTES,
} from "./constants"
import {
  cleanupInactiveUserAccounts,
  deleteUserAccountData,
  replacePasswordAndInvalidateOtherSessions,
  revokeAllUserSessions,
  revokeCurrentUserSession,
  revokeUserSession,
  touchUserActivity,
} from "./accountLifecycle"
import {
  deleteExpiredRecentLinks,
  getExpiredRecentLinks,
  calculateAppOwnedStorageUsage,
  assertStorageMutation,
  getOperationalStorageBytes,
  getUserStorageLedger,
  normalizeRetentionDays,
  recordStorageDeletion,
} from "./storagePolicy"
import { buildPlayerPreferencesPatch } from "./userPreferences"

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
  returns: v.any(),
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
  returns: v.any(),
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
  returns: v.any(),
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
      deletedLinks = await deleteExpiredRecentLinks(
        ctx,
        userId,
        retentionDays,
        now
      )
      if (deletedLinks === RECENT_LINK_RETENTION_BATCH_SIZE) {
        await ctx.scheduler.runAfter(
          0,
          internal.links.cleanupExpiredRecentLinksForUser,
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
    const expiredLinks = await getExpiredRecentLinks(
      ctx,
      userId,
      retentionDays,
      args.timeBucket
    )

    return { expiredLinkCount: expiredLinks.length }
  },
})

export const clearRecentCards = mutation({
  returns: v.any(),
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const links = await ctx.db
      .query("links")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()

    for (const link of links) {
      await recordStorageDeletion(ctx, userId, "recentLinkBytes", link)
      await ctx.db.delete("links", link._id)
    }

    return { success: true, deletedLinks: links.length }
  },
})

export const touchActivity = mutation({
  returns: v.any(),
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const sessionId = await getAuthSessionId(ctx)
    await touchUserActivity(ctx, userId, sessionId, Date.now())
    return { success: true }
  },
})

export const listSessions = query({
  returns: v.any(),
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
      linkBytes: ledger.recentLinkBytes,
      pluginServerBytes: ledger.pluginServerBytes,
      pluginDomainBytes,
      authBytes,
      profileBytes: ledger.profileBytes,
      savedLinkCount: ledger.savedLinkCount,
      averageLinkBytes:
        ledger.savedLinkCount > 0
          ? Math.round(ledger.recentLinkBytes / ledger.savedLinkCount)
          : 0,
      storageLimitBytes: USER_STORAGE_LIMIT_BYTES,
      storageWarningBytes: USER_STORAGE_WARNING_BYTES,
      recentCardLimitBytes: RECENT_LINK_LIMIT_BYTES,
      retentionDays,
      retentionDayOptions: [...STORAGE_RETENTION_DAY_OPTIONS],
      defaultRetentionDays: DEFAULT_RETENTION_DAYS,
      maxRetentionDays: MAX_RETENTION_DAYS,
    }
  },
})

export const renameSession = mutation({
  returns: v.any(),
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
  returns: v.any(),
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
      ...(session.deviceName ? {} : { deviceName }),
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
  returns: v.any(),
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
    const workerSessionId = await revokeUserSession(
      ctx,
      userId,
      currentSessionId,
      sessionId
    )
    return {
      success: true,
      workerSessionIds: workerSessionId ? [workerSessionId] : [],
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
  returns: v.any(),
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const workerSessionIds = await revokeAllUserSessions(ctx, userId)
    return { success: true, workerSessionIds }
  },
})

export const changePassword = action({
  returns: v.any(),
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
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
    await replacePasswordAndInvalidateOtherSessions(
      () =>
        modifyAccountCredentials(ctx, {
          provider: "credentials",
          account: {
            id: user.normalizedUsername,
            secret: args.newPassword,
          },
        }),
      () =>
        invalidateSessions(ctx, {
          userId,
          except: sessionId ? [sessionId] : [],
        })
    )
    console.info("security.password_changed", { userId })
    return { success: true }
  },
})

export const deleteAccount = action({
  returns: v.any(),
  args: {
    confirmUsername: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await assertCurrentUser(ctx)
    const user = await ctx.runQuery(internal.users.getUserForAuthAction, {
      userId,
    })
    if (!user) {
      throw new Error("Authentication required")
    }
    if (args.confirmUsername.trim() !== user.username) {
      throw new Error("Username does not match")
    }
    await ctx.runMutation(internal.users.deleteUserData, { userId })
    console.info("security.account_deleted", { userId })
    return { success: true }
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
