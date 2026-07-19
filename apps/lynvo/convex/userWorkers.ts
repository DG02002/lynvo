import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getAuthenticatedUserId } from "./authentication"
import { assertStorageMutation } from "./storagePolicy"

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    return await ctx.db
      .query("userWorkers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()
  },
})

export const create = mutation({
  args: {
    baseUrl: v.string(),
    apiKey: v.string(),
    manifest: v.string(),
    enabled: v.boolean(),
    priority: v.number(),
    verificationStatus: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const now = Date.now()
    const newDoc = {
      userId,
      baseUrl: args.baseUrl,
      apiKey: args.apiKey,
      manifest: args.manifest,
      enabled: args.enabled,
      priority: args.priority,
      verificationStatus: args.verificationStatus,
      createdAt: now,
      updatedAt: now,
    }
    await assertStorageMutation(ctx, userId, undefined, newDoc)
    return await ctx.db.insert("userWorkers", newDoc)
  },
})

export const update = mutation({
  args: {
    id: v.string(),
    baseUrl: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    manifest: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
    priority: v.optional(v.number()),
    verificationStatus: v.optional(v.string()),
    lastVerifiedAt: v.optional(v.number()),
    lastManifestRefreshAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const workerId = ctx.db.normalizeId("userWorkers", args.id)
    const existing = workerId ? await ctx.db.get(workerId) : null

    if (!existing || existing.userId !== userId) {
      throw new Error("Extractor not found or no longer available")
    }

    const { id: _id, ...updates } = args
    const nextDoc = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    }
    await assertStorageMutation(ctx, userId, existing, nextDoc)
    await ctx.db.patch(existing._id, {
      ...updates,
      updatedAt: nextDoc.updatedAt,
    })
    return { success: true }
  },
})

export const deleteById = mutation({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const workerId = ctx.db.normalizeId("userWorkers", args.id)
    const existing = workerId ? await ctx.db.get(workerId) : null

    if (!existing || existing.userId !== userId) {
      throw new Error("Extractor not found or no longer available")
    }

    await ctx.db.delete(existing._id)
    return { success: true }
  },
})
