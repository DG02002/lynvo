import { mutation, query } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { v } from "convex/values"
import { verifySessionCleanupToken } from "./authGateway"

const authorizeCleanup = async (serviceToken: string) => {
  const secret = process.env.AUTH_GATEWAY_SECRET
  if (!secret) {
    throw new Error("Session cleanup is unavailable")
  }
  await verifySessionCleanupToken(serviceToken, secret)
}

export const enqueueWorkerSessionCleanup = async (
  ctx: MutationCtx,
  workerSessionIds: ReadonlyArray<string>
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
        createdAt: Date.now(),
      })
    }
  }
}

export const listPending = query({
  args: { serviceToken: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    await authorizeCleanup(args.serviceToken)
    const intents = await ctx.db
      .query("workerSessionCleanupIntents")
      .order("asc")
      .take(100)
    return intents.map((intent) => intent.workerSessionId)
  },
})

export const complete = mutation({
  args: { serviceToken: v.string(), workerSessionId: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await authorizeCleanup(args.serviceToken)
    const intent = await ctx.db
      .query("workerSessionCleanupIntents")
      .withIndex("by_workerSessionId", (queryBuilder) =>
        queryBuilder.eq("workerSessionId", args.workerSessionId)
      )
      .unique()
    if (intent) {
      await ctx.db.delete("workerSessionCleanupIntents", intent._id)
    }
    return { success: true }
  },
})
