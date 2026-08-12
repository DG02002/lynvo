import { env, mutation, query } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { v } from "convex/values"
import { verifySessionCleanupToken } from "./authGateway"

const authorizeCleanup = async (serviceToken: string) => {
  const secret = env.AUTH_GATEWAY_SECRET
  if (!secret) {
    throw new Error("Session cleanup is unavailable")
  }
  await verifySessionCleanupToken(serviceToken, secret)
}

export const enqueueWorkerSessionCleanup = async (
  ctx: MutationCtx,
  workerSessionIds: ReadonlyArray<string>,
  issuanceGeneration?: number
) => {
  for (const workerSessionId of workerSessionIds) {
    const existing = await ctx.db
      .query("workerSessionCleanupIntents")
      .withIndex("by_workerSessionId", (queryBuilder) =>
        queryBuilder.eq("workerSessionId", workerSessionId)
      )
      .unique()
    if (!existing) {
      await ctx.db.insert("workerSessionCleanupIntents", {
        workerSessionId,
        issuanceGeneration,
        createdAt: Date.now(),
      })
    } else if (
      existing.issuanceGeneration !== undefined &&
      (issuanceGeneration === undefined ||
        issuanceGeneration > existing.issuanceGeneration)
    ) {
      await ctx.db.patch("workerSessionCleanupIntents", existing._id, {
        issuanceGeneration,
      })
    }
  }
}

export const listPending = query({
  args: { serviceToken: v.string() },
  returns: v.array(
    v.object({
      workerSessionId: v.string(),
      issuanceGeneration: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    await authorizeCleanup(args.serviceToken)
    const intents = await ctx.db
      .query("workerSessionCleanupIntents")
      .order("asc")
      .take(100)
    return intents.map((intent) => ({
      workerSessionId: intent.workerSessionId,
      issuanceGeneration: intent.issuanceGeneration,
    }))
  },
})

export const enqueue = mutation({
  args: {
    serviceToken: v.string(),
    workerSessionIds: v.array(v.string()),
    issuanceGeneration: v.optional(v.number()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await authorizeCleanup(args.serviceToken)
    await enqueueWorkerSessionCleanup(
      ctx,
      args.workerSessionIds,
      args.issuanceGeneration
    )
    return { success: true }
  },
})

export const complete = mutation({
  args: {
    serviceToken: v.string(),
    workerSessionId: v.string(),
    issuanceGeneration: v.optional(v.number()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await authorizeCleanup(args.serviceToken)
    const intent = await ctx.db
      .query("workerSessionCleanupIntents")
      .withIndex("by_workerSessionId", (queryBuilder) =>
        queryBuilder.eq("workerSessionId", args.workerSessionId)
      )
      .unique()
    if (intent && intent.issuanceGeneration === args.issuanceGeneration) {
      await ctx.db.delete("workerSessionCleanupIntents", intent._id)
    }
    return { success: true }
  },
})
