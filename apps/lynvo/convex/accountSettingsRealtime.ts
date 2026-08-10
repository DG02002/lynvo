import { env, mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { ACCOUNT_SETTINGS_PENDING_BATCH_SIZE } from "./constants"
import { verifyAccountSettingsRealtimeToken } from "./authGateway"

const authorize = async (serviceToken: string) => {
  const secret = env.AUTH_GATEWAY_SECRET
  if (!secret) {
    throw new Error("Account settings realtime is unavailable")
  }
  await verifyAccountSettingsRealtimeToken(serviceToken, secret)
}

export const listPending = query({
  args: { serviceToken: v.string() },
  returns: v.array(v.object({ userId: v.id("users"), revision: v.number() })),
  handler: async (ctx, args) => {
    await authorize(args.serviceToken)
    const states = await ctx.db
      .query("accountSettingsSynchronizationStates")
      .withIndex("by_pendingBroadcast_and_updatedAt", (queryBuilder) =>
        queryBuilder.eq("pendingBroadcast", true)
      )
      .order("asc")
      .take(ACCOUNT_SETTINGS_PENDING_BATCH_SIZE)
    return states.map(({ userId, revision }) => ({ userId, revision }))
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
    await authorize(args.serviceToken)
    const userId = ctx.db.normalizeId("users", args.userId)
    if (!userId) {
      return { success: true }
    }
    const state = await ctx.db
      .query("accountSettingsSynchronizationStates")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .unique()
    if (!state) {
      return { success: true }
    }
    const acknowledgedRevision = Math.min(args.revision, state.revision)
    const broadcastRevision = Math.max(
      state.broadcastRevision,
      acknowledgedRevision
    )
    await ctx.db.patch("accountSettingsSynchronizationStates", state._id, {
      broadcastRevision,
      pendingBroadcast: broadcastRevision < state.revision,
      updatedAt: Date.now(),
    })
    return { success: true }
  },
})
