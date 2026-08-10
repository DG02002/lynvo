import { env, mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { SAVED_LINK_PENDING_BATCH_SIZE } from "./constants"
import { verifySavedLinkRealtimeToken } from "./authGateway"
import {
  acknowledgeSavedLinkBroadcast,
  listPendingSavedLinkRevisions,
} from "./savedLinkRevisions"

const authorizeSavedLinkRealtime = async (serviceToken: string) => {
  const secret = env.AUTH_GATEWAY_SECRET
  if (!secret) {
    throw new Error("Saved link realtime delivery is unavailable")
  }
  await verifySavedLinkRealtimeToken(serviceToken, secret)
}

export const listPending = query({
  args: { serviceToken: v.string() },
  returns: v.array(v.object({ userId: v.id("users"), revision: v.number() })),
  handler: async (ctx, args) => {
    await authorizeSavedLinkRealtime(args.serviceToken)
    return await listPendingSavedLinkRevisions(
      ctx,
      SAVED_LINK_PENDING_BATCH_SIZE
    )
  },
})

export const acknowledge = mutation({
  args: {
    serviceToken: v.string(),
    userId: v.string(),
    revision: v.number(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await authorizeSavedLinkRealtime(args.serviceToken)
    const userId = ctx.db.normalizeId("users", args.userId)
    if (!userId) {
      throw new Error("Invalid account")
    }
    await acknowledgeSavedLinkBroadcast(ctx, userId, args.revision)
    return { success: true }
  },
})
