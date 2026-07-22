import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import {
  ACCOUNT_INACTIVITY_LIMIT_MS,
  ACCOUNT_DELETION_DOCUMENT_LIMIT,
  ACTIVITY_UPDATE_INTERVAL_MS,
  CLEANUP_USER_PAGE_SIZE,
} from "./constants"
import { assertStorageMutation } from "./storagePolicy"

export const replacePasswordAndInvalidateOtherSessions = async (
  replacePassword: () => Promise<unknown>,
  invalidateOtherSessions: () => Promise<unknown>
) => {
  await replacePassword()
  await invalidateOtherSessions()
}

const getUserSessions = async (
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
) => {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .take(ACCOUNT_DELETION_DOCUMENT_LIMIT)
  if (sessions.length === ACCOUNT_DELETION_DOCUMENT_LIMIT) {
    throw new Error("Account data exceeds the synchronous deletion limit")
  }
  return sessions
}

const deleteSessionRefreshTokens = async (
  ctx: MutationCtx,
  sessionIds: Array<Id<"authSessions">>
) => {
  for (const sessionId of sessionIds) {
    const refreshTokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (queryBuilder) =>
        queryBuilder.eq("sessionId", sessionId)
      )
      .take(ACCOUNT_DELETION_DOCUMENT_LIMIT)
    if (refreshTokens.length === ACCOUNT_DELETION_DOCUMENT_LIMIT) {
      throw new Error("Account data exceeds the synchronous deletion limit")
    }
    for (const refreshToken of refreshTokens) {
      await ctx.db.delete(refreshToken._id)
    }
  }
}

const deleteSessionVerifiers = async (
  ctx: MutationCtx,
  sessionIds: Array<Id<"authSessions">>
) => {
  for (const sessionId of sessionIds) {
    const verifiers = await ctx.db
      .query("authVerifiers")
      .withIndex("sessionId", (queryBuilder) =>
        queryBuilder.eq("sessionId", sessionId)
      )
      .take(ACCOUNT_DELETION_DOCUMENT_LIMIT)
    if (verifiers.length === ACCOUNT_DELETION_DOCUMENT_LIMIT) {
      throw new Error("Account data exceeds the synchronous deletion limit")
    }
    for (const verifier of verifiers) {
      await ctx.db.delete(verifier._id)
    }
  }
}

const deleteAccountVerificationCodes = async (
  ctx: MutationCtx,
  accountIds: Array<Id<"authAccounts">>
) => {
  for (const accountId of accountIds) {
    const verificationCodes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (queryBuilder) =>
        queryBuilder.eq("accountId", accountId)
      )
      .take(ACCOUNT_DELETION_DOCUMENT_LIMIT)
    if (verificationCodes.length === ACCOUNT_DELETION_DOCUMENT_LIMIT) {
      throw new Error("Account data exceeds the synchronous deletion limit")
    }
    for (const verificationCode of verificationCodes) {
      await ctx.db.delete(verificationCode._id)
    }
  }
}

export const revokeUserSession = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  currentSessionId: Id<"authSessions"> | null,
  sessionId: Id<"authSessions">
) => {
  if (sessionId === currentSessionId) {
    throw new Error("Use sign out for the current session")
  }
  const session = await ctx.db.get(sessionId)
  if (!session || session.userId !== userId) {
    throw new Error("Session not found")
  }
  await deleteSessionRefreshTokens(ctx, [sessionId])
  await deleteSessionVerifiers(ctx, [sessionId])
  await ctx.db.delete(sessionId)
}

export const revokeAllUserSessions = async (
  ctx: MutationCtx,
  userId: Id<"users">
) => {
  const sessions = await getUserSessions(ctx, userId)
  await deleteSessionRefreshTokens(
    ctx,
    sessions.map((session) => session._id)
  )
  await deleteSessionVerifiers(
    ctx,
    sessions.map((session) => session._id)
  )
  await Promise.all(sessions.map((session) => ctx.db.delete(session._id)))
}

export const deleteUserAccountData = async (
  ctx: MutationCtx,
  userId: Id<"users">
) => {
  const sessions = await getUserSessions(ctx, userId)
  await deleteSessionRefreshTokens(
    ctx,
    sessions.map((session) => session._id)
  )
  await deleteSessionVerifiers(
    ctx,
    sessions.map((session) => session._id)
  )
  const ownerKey = `user:${userId}`
  const [
    links,
    workers,
    pluginDomains,
    pluginCredentials,
    deviceCodes,
    authAccounts,
    remoteCommands,
    usageCounters,
    storageLedgers,
  ] = await Promise.all([
    ctx.db
      .query("links")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(ACCOUNT_DELETION_DOCUMENT_LIMIT),
    ctx.db
      .query("userWorkers")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(ACCOUNT_DELETION_DOCUMENT_LIMIT),
    ctx.db
      .query("userPluginDomains")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(ACCOUNT_DELETION_DOCUMENT_LIMIT),
    ctx.db
      .query("userPluginCredentials")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(ACCOUNT_DELETION_DOCUMENT_LIMIT),
    ctx.db
      .query("deviceCodes")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(ACCOUNT_DELETION_DOCUMENT_LIMIT),
    ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(ACCOUNT_DELETION_DOCUMENT_LIMIT),
    ctx.db
      .query("remoteCommands")
      .withIndex("by_userId_targetSessionId_createdAt", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(ACCOUNT_DELETION_DOCUMENT_LIMIT),
    ctx.db
      .query("usageCounters")
      .withIndex("by_owner_metric_period_epoch", (queryBuilder) =>
        queryBuilder.eq("ownerKey", ownerKey)
      )
      .take(ACCOUNT_DELETION_DOCUMENT_LIMIT),
    ctx.db
      .query("userStorageLedgers")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(ACCOUNT_DELETION_DOCUMENT_LIMIT),
  ])
  const ownedCollections = [
    links,
    workers,
    pluginDomains,
    pluginCredentials,
    deviceCodes,
    authAccounts,
    remoteCommands,
    usageCounters,
    storageLedgers,
    sessions,
  ]
  if (
    ownedCollections.some(
      (documents) => documents.length === ACCOUNT_DELETION_DOCUMENT_LIMIT
    )
  ) {
    throw new Error("Account data exceeds the synchronous deletion limit")
  }
  await deleteAccountVerificationCodes(
    ctx,
    authAccounts.map((account) => account._id)
  )
  for (const link of links) {
    await ctx.db.delete(link._id)
  }
  for (const worker of workers) {
    await ctx.db.delete(worker._id)
  }
  for (const credential of pluginCredentials) {
    await ctx.db.delete(credential._id)
  }
  for (const domain of pluginDomains) {
    await ctx.db.delete(domain._id)
  }
  for (const code of deviceCodes) {
    await ctx.db.delete(code._id)
  }
  for (const account of authAccounts) {
    await ctx.db.delete(account._id)
  }
  for (const command of remoteCommands) {
    await ctx.db.delete(command._id)
  }
  for (const counter of usageCounters) {
    await ctx.db.delete(counter._id)
  }
  for (const ledger of storageLedgers) {
    await ctx.db.delete(ledger._id)
  }
  for (const session of sessions) {
    await ctx.db.delete(session._id)
  }

  const user = await ctx.db.get(userId)
  if (user) {
    await ctx.db.delete(user._id)
  }
}

export const cleanupInactiveUserAccounts = async (
  ctx: MutationCtx,
  now: number
) => {
  const cutoff = now - ACCOUNT_INACTIVITY_LIMIT_MS
  const inactiveUsers = await ctx.db
    .query("users")
    .withIndex("by_lastActiveAt", (queryBuilder) =>
      queryBuilder.lt("lastActiveAt", cutoff)
    )
    .take(CLEANUP_USER_PAGE_SIZE)
  const inactiveUser = inactiveUsers[0]
  if (!inactiveUser || inactiveUser.lastActiveAt >= cutoff) {
    return 0
  }
  await deleteUserAccountData(ctx, inactiveUser._id)
  return 1
}

export const touchUserActivity = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  sessionId: Id<"authSessions"> | null,
  now: number
) => {
  const user = await ctx.db.get(userId)
  if (user && now - user.lastActiveAt > ACTIVITY_UPDATE_INTERVAL_MS) {
    await assertStorageMutation(ctx, userId, user, {
      ...user,
      lastActiveAt: now,
    })
    await ctx.db.patch(user._id, { lastActiveAt: now })
  }
  if (!sessionId) {
    return
  }
  const session = await ctx.db.get(sessionId)
  if (
    session &&
    (!session.lastActiveAt ||
      now - session.lastActiveAt > ACTIVITY_UPDATE_INTERVAL_MS)
  ) {
    await ctx.db.patch(session._id, { lastActiveAt: now })
  }
}
