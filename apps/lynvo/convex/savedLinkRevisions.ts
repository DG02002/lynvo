import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"

declare global {
  interface PendingSavedLinkRevision {
    readonly userId: Id<"users">
    readonly revision: number
  }
}

export const readSavedLinkRevision = async (
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
) => {
  const state = await ctx.db
    .query("savedLinkSynchronizationStates")
    .withIndex("by_userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .unique()
  return state?.revision ?? 0
}

export const advanceSavedLinkRevision = async (
  ctx: MutationCtx,
  userId: Id<"users">
) => {
  const state = await ctx.db
    .query("savedLinkSynchronizationStates")
    .withIndex("by_userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .unique()
  const revision = (state?.revision ?? 0) + 1
  const updatedAt = Date.now()
  if (state) {
    await ctx.db.patch("savedLinkSynchronizationStates", state._id, {
      revision,
      pendingBroadcast: true,
      updatedAt,
    })
  } else {
    await ctx.db.insert("savedLinkSynchronizationStates", {
      userId,
      revision,
      broadcastRevision: 0,
      pendingBroadcast: true,
      updatedAt,
    })
  }
  return revision
}

export const listPendingSavedLinkRevisions = async (
  ctx: QueryCtx,
  limit: number
): Promise<PendingSavedLinkRevision[]> => {
  const states = await ctx.db
    .query("savedLinkSynchronizationStates")
    .withIndex("by_pendingBroadcast_and_updatedAt", (queryBuilder) =>
      queryBuilder.eq("pendingBroadcast", true)
    )
    .order("asc")
    .take(limit)
  return states.map((state) => ({
    userId: state.userId,
    revision: state.revision,
  }))
}

export const acknowledgeSavedLinkBroadcast = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  revision: number
) => {
  const state = await ctx.db
    .query("savedLinkSynchronizationStates")
    .withIndex("by_userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .unique()
  if (!state) {
    return
  }
  const acknowledgedRevision = Math.min(revision, state.revision)
  const broadcastRevision = Math.max(
    state.broadcastRevision,
    acknowledgedRevision
  )
  await ctx.db.patch("savedLinkSynchronizationStates", state._id, {
    broadcastRevision,
    pendingBroadcast: broadcastRevision < state.revision,
    updatedAt: Date.now(),
  })
}
