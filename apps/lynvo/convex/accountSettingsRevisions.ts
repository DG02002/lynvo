import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"

export const readAccountSettingsRevision = async (
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
) => {
  const state = await ctx.db
    .query("accountSettingsSynchronizationStates")
    .withIndex("by_userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .unique()
  return state?.revision ?? 0
}

export const advanceAccountSettingsRevision = async (
  ctx: MutationCtx,
  userId: Id<"users">
) => {
  const state = await ctx.db
    .query("accountSettingsSynchronizationStates")
    .withIndex("by_userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .unique()
  const revision = (state?.revision ?? 0) + 1
  const updatedAt = Date.now()
  if (state) {
    await ctx.db.patch("accountSettingsSynchronizationStates", state._id, {
      revision,
      pendingBroadcast: true,
      updatedAt,
    })
  } else {
    await ctx.db.insert("accountSettingsSynchronizationStates", {
      userId,
      revision,
      broadcastRevision: 0,
      pendingBroadcast: true,
      updatedAt,
    })
  }
  return revision
}
