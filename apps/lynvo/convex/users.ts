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
import { getAuthenticatedUserId } from "./authentication"
import { validatePassword } from "../app/lib/auth-policy"
import {
  DEFAULT_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  RECENT_LINK_LIMIT_BYTES,
  STORAGE_RETENTION_DAY_OPTIONS,
  USER_STORAGE_LIMIT_BYTES,
  USER_STORAGE_WARNING_BYTES,
} from "./constants"
import {
  cleanupInactiveUserAccounts,
  deleteUserAccountData,
  replacePasswordAndInvalidateOtherSessions,
  revokeAllUserSessions,
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
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    return await ctx.db.get(userId)
  },
})

export const getSessionUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    const sessionId = await getAuthSessionId(ctx)
    if (!sessionId) {
      throw new Error("Authentication session required")
    }
    const user = await ctx.db.get(userId)
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
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    const user = await ctx.db.get(userId)
    return {
      rangeSupportedPlayerId: user?.rangeSupportedPlayerId,
      rangeUnsupportedPlayerId: user?.rangeUnsupportedPlayerId,
    }
  },
})

export const updatePlayerPreferences = mutation({
  args: {
    rangeSupportedPlayerId: v.optional(v.string()),
    rangeUnsupportedPlayerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const user = await ctx.db.get(userId)
    if (!user) {
      throw new Error("Authentication required")
    }
    await assertStorageMutation(ctx, userId, user, {
      ...user,
      ...buildPlayerPreferencesPatch(args),
    })
    await ctx.db.patch(userId, buildPlayerPreferencesPatch(args))
    return { success: true }
  },
})

export const updateStorageRetentionDays = mutation({
  args: {
    days: v.number(),
    deleteExpiredLinks: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const retentionDays = normalizeRetentionDays(args.days)
    const user = await ctx.db.get(userId)
    if (!user) {
      throw new Error("Authentication required")
    }
    let deletedLinks = 0

    if (args.deleteExpiredLinks) {
      deletedLinks = await deleteExpiredRecentLinks(
        ctx,
        userId,
        retentionDays,
        Date.now()
      )
    }

    await assertStorageMutation(ctx, userId, user, {
      ...user,
      storageRetentionDays: retentionDays,
    })
    await ctx.db.patch(userId, { storageRetentionDays: retentionDays })
    return { success: true, deletedLinks }
  },
})

export const previewStorageRetentionDays = query({
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
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    const links = await ctx.db
      .query("links")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()

    for (const link of links) {
      await recordStorageDeletion(ctx, userId, link)
      await ctx.db.delete(link._id)
    }

    return { success: true, deletedLinks: links.length }
  },
})

export const touchActivity = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    const sessionId = await getAuthSessionId(ctx)
    await touchUserActivity(ctx, userId, sessionId, Date.now())
    return { success: true }
  },
})

export const listSessions = query({
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
      deviceName: session.deviceName ?? "Unknown Device",
      lastActiveAt: session.lastActiveAt ?? session._creationTime,
      createdAt: session._creationTime,
      isCurrent: session._id === currentSessionId,
    }))
  },
})

export const getStorageUsage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    const [user, existingLedger, authBytes] = await Promise.all([
      ctx.db.get(userId),
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
      workerBytes: ledger.workerBytes,
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
  args: {
    sessionId: v.id("authSessions"),
    deviceName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const session = await ctx.db.get(args.sessionId)
    if (!session || session.userId !== userId) {
      throw new Error("Session not found")
    }
    const deviceName = args.deviceName.trim().slice(0, 80)
    if (!deviceName) {
      throw new Error("Device name is required")
    }
    await ctx.db.patch(session._id, { deviceName })
    return { success: true }
  },
})

export const setCurrentSessionDevice = mutation({
  args: {
    deviceName: v.string(),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedUserId(ctx)
    const sessionId = await getAuthSessionId(ctx)
    if (!sessionId) {
      throw new Error("Session not found")
    }
    const deviceName = args.deviceName.trim().slice(0, 80)
    if (!deviceName) {
      throw new Error("Device name is required")
    }
    await ctx.db.patch(sessionId, {
      deviceName,
      lastActiveAt: Date.now(),
    })
    return { success: true }
  },
})

export const revokeSession = mutation({
  args: {
    sessionId: v.id("authSessions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const currentSessionId = await getAuthSessionId(ctx)
    await revokeUserSession(ctx, userId, currentSessionId, args.sessionId)
    return { success: true }
  },
})

export const revokeAllSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    await revokeAllUserSessions(ctx, userId)
    return { success: true }
  },
})

export const changePassword = action({
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
    return await ctx.db.get(args.userId)
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
    const deletedUsers = await cleanupInactiveUserAccounts(ctx, now)
    const processedUsers = (args.processedUsers ?? 0) + deletedUsers
    if (deletedUsers > 0) {
      await ctx.scheduler.runAfter(0, internal.users.cleanupInactiveUsers, {
        processedUsers,
        startedAt,
      })
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
