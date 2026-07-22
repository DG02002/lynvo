import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import {
  ACCOUNT_INACTIVITY_LIMIT_MS,
  ACTIVITY_UPDATE_INTERVAL_MS,
  INACTIVE_ACCOUNT_CLEANUP_BATCH_SIZE,
} from "./constants"
import {
  assertStorageMutation,
  USER_OWNED_STORAGE_TABLE_NAMES,
} from "./storagePolicy"

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
) =>
  await ctx.db
    .query("authSessions")
    .withIndex("userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .collect()

const deleteSessionRefreshTokens = async (
  ctx: MutationCtx,
  sessionIds: Array<Id<"authSessions">>
) => {
  await Promise.all(
    sessionIds.map(async (sessionId) => {
      const refreshTokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (queryBuilder) =>
          queryBuilder.eq("sessionId", sessionId)
        )
        .collect()
      await Promise.all(
        refreshTokens.map((refreshToken) => ctx.db.delete(refreshToken._id))
      )
    })
  )
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

  await Promise.all(
    USER_OWNED_STORAGE_TABLE_NAMES.map(async (tableName) => {
      const documents = await ctx.db
        .query(tableName)
        .filter((queryBuilder) =>
          queryBuilder.eq(queryBuilder.field("userId"), userId)
        )
        .collect()
      await Promise.all(
        (documents ?? []).map((document) => ctx.db.delete(document._id))
      )
    })
  )

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
    .take(INACTIVE_ACCOUNT_CLEANUP_BATCH_SIZE)

  await Promise.all(
    inactiveUsers.map((inactiveUser) =>
      deleteUserAccountData(ctx, inactiveUser._id)
    )
  )
  return inactiveUsers.length
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
