import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import {
  ACCOUNT_INACTIVITY_LIMIT_MS,
  ACTIVITY_UPDATE_INTERVAL_MS,
  CLEANUP_USER_PAGE_SIZE,
  SESSION_REVOCATION_DOCUMENT_LIMIT,
} from "./constants"
import { assertStorageMutation } from "./storagePolicy"
import { initiateAccountErasure } from "./accountErasure"

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
    .take(SESSION_REVOCATION_DOCUMENT_LIMIT)
  if (sessions.length === SESSION_REVOCATION_DOCUMENT_LIMIT) {
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
      .take(SESSION_REVOCATION_DOCUMENT_LIMIT)
    if (refreshTokens.length === SESSION_REVOCATION_DOCUMENT_LIMIT) {
      throw new Error("Account data exceeds the synchronous deletion limit")
    }
    for (const refreshToken of refreshTokens) {
      await ctx.db.delete("authRefreshTokens", refreshToken._id)
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
      .take(SESSION_REVOCATION_DOCUMENT_LIMIT)
    if (verifiers.length === SESSION_REVOCATION_DOCUMENT_LIMIT) {
      throw new Error("Account data exceeds the synchronous deletion limit")
    }
    for (const verifier of verifiers) {
      await ctx.db.delete("authVerifiers", verifier._id)
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
  const session = await ctx.db.get("authSessions", sessionId)
  if (!session || session.userId !== userId) {
    throw new Error("Session not found")
  }
  await deleteSessionRefreshTokens(ctx, [sessionId])
  await deleteSessionVerifiers(ctx, [sessionId])
  await ctx.db.delete("authSessions", sessionId)
  return session.workerSessionId
}

export const revokeCurrentUserSession = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  sessionId: Id<"authSessions">
) => await revokeUserSession(ctx, userId, null, sessionId)

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
  await Promise.all(
    sessions.map((session) => ctx.db.delete("authSessions", session._id))
  )
  return sessions.flatMap((session) =>
    session.workerSessionId ? [session.workerSessionId] : []
  )
}

export const deleteUserAccountData = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  trigger: "manual" | "inactive" = "manual",
  cleanup?: { processedUsers: number; startedAt: number }
) => {
  return await initiateAccountErasure(ctx, userId, trigger, cleanup)
}

export const cleanupInactiveUserAccounts = async (
  ctx: MutationCtx,
  now: number,
  processedUsers: number,
  startedAt: number
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
  await deleteUserAccountData(ctx, inactiveUser._id, "inactive", {
    processedUsers: processedUsers + 1,
    startedAt,
  })
  return 1
}

export const touchUserActivity = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  sessionId: Id<"authSessions"> | null,
  now: number
) => {
  const user = await ctx.db.get("users", userId)
  if (user && now - user.lastActiveAt > ACTIVITY_UPDATE_INTERVAL_MS) {
    await assertStorageMutation(ctx, userId, "profileBytes", user, {
      ...user,
      lastActiveAt: now,
    })
    await ctx.db.patch("users", user._id, { lastActiveAt: now })
  }
  if (!sessionId) {
    return
  }
  const session = await ctx.db.get("authSessions", sessionId)
  if (
    session &&
    (!session.lastActiveAt ||
      now - session.lastActiveAt > ACTIVITY_UPDATE_INTERVAL_MS)
  ) {
    await ctx.db.patch("authSessions", session._id, { lastActiveAt: now })
  }
}
