import type { Id } from "./_generated/dataModel"
import { env, mutation, query } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { v } from "convex/values"
import { REALTIME_SESSION_REVOCATION_PENDING_BATCH_SIZE } from "./constants"
import { verifySessionCleanupToken } from "./authGateway"

const authorize = async (serviceToken: string) => {
  const secret = env.AUTH_GATEWAY_SECRET
  if (!secret) {
    throw new Error("Realtime session revocation is unavailable")
  }
  await verifySessionCleanupToken(serviceToken, secret)
}

export const enqueueRealtimeSessionRevocation = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  sessionId?: string
) => {
  const existing = await ctx.db
    .query("realtimeSessionRevocationIntents")
    .withIndex("by_userId_sessionId", (queryBuilder) =>
      queryBuilder.eq("userId", userId).eq("sessionId", sessionId)
    )
    .unique()
  if (!existing) {
    await ctx.db.insert("realtimeSessionRevocationIntents", {
      userId,
      sessionId,
      createdAt: Date.now(),
    })
  }
}

export const listPending = query({
  args: { serviceToken: v.string() },
  returns: v.array(
    v.object({ userId: v.id("users"), sessionId: v.optional(v.string()) })
  ),
  handler: async (ctx, args) => {
    await authorize(args.serviceToken)
    const intents = await ctx.db
      .query("realtimeSessionRevocationIntents")
      .withIndex("by_createdAt")
      .order("asc")
      .take(REALTIME_SESSION_REVOCATION_PENDING_BATCH_SIZE)
    return intents.map(({ userId, sessionId }) => ({ userId, sessionId }))
  },
})

export const complete = mutation({
  args: {
    serviceToken: v.string(),
    userId: v.string(),
    sessionId: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await authorize(args.serviceToken)
    const userId = ctx.db.normalizeId("users", args.userId)
    if (!userId) {
      return { success: true }
    }
    const intent = await ctx.db
      .query("realtimeSessionRevocationIntents")
      .withIndex("by_userId_sessionId", (queryBuilder) =>
        queryBuilder.eq("userId", userId).eq("sessionId", args.sessionId)
      )
      .unique()
    if (intent) {
      await ctx.db.delete("realtimeSessionRevocationIntents", intent._id)
    }
    return { success: true }
  },
})
