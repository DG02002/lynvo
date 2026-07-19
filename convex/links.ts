import { internalMutation, mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getAuthenticatedUserId } from "./authentication"
import {
  assertRecentLinkMutation,
  cleanupExpiredRecentLinks,
  getRetentionCutoff,
  getUserRetentionDays,
} from "./storagePolicy"

// List retained links for a user, ordered by createdAt desc.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    const retentionDays = await getUserRetentionDays(ctx, userId)
    const cutoff = getRetentionCutoff(Date.now(), retentionDays)
    return await ctx.db
      .query("links")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", userId).gte("createdAt", cutoff)
      )
      .order("desc")
      .collect()
  },
})

// Create a new link or update title/meta if the URL already exists.
// Enforces per-card, per-user storage, and retention limits.
export const createOrUpdate = mutation({
  args: {
    url: v.string(),
    title: v.optional(v.string()),
    meta: v.optional(v.string()), // JSON string
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const now = Date.now()
    await cleanupExpiredRecentLinks(ctx, userId, now)

    // Check if the URL already exists for this user
    const existing = await ctx.db
      .query("links")
      .withIndex("by_userId_url", (q) =>
        q.eq("userId", userId).eq("url", args.url)
      )
      .unique()

    if (existing) {
      const nextDoc = {
        ...existing,
        title: args.title ?? existing.title,
        meta: args.meta ?? existing.meta,
        updatedAt: now,
      }
      await assertRecentLinkMutation(ctx, userId, existing, nextDoc)
      await ctx.db.patch(existing._id, {
        title: args.title ?? existing.title,
        meta: args.meta ?? existing.meta,
        updatedAt: now,
      })
      return existing._id
    }

    const newDoc = {
      userId,
      url: args.url,
      title: args.title,
      meta: args.meta,
      createdAt: now,
      updatedAt: now,
    }
    await assertRecentLinkMutation(ctx, userId, undefined, newDoc)

    // Insert new link
    return await ctx.db.insert("links", newDoc)
  },
})

// Delete a link by ID
export const deleteById = mutation({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const linkId = ctx.db.normalizeId("links", args.id)
    const existing = linkId ? await ctx.db.get(linkId) : null

    if (!existing || existing.userId !== userId) {
      throw new Error("Link not found or no longer available")
    }

    await ctx.db.delete(existing._id)
    return { success: true }
  },
})

// Update metadata for a link
export const updateMeta = mutation({
  args: {
    id: v.string(),
    meta: v.string(), // JSON string
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const linkId = ctx.db.normalizeId("links", args.id)
    const existing = linkId ? await ctx.db.get(linkId) : null

    if (!existing || existing.userId !== userId) {
      throw new Error("Link not found or no longer available")
    }
    const nextDoc = {
      ...existing,
      meta: args.meta,
      updatedAt: Date.now(),
    }
    await assertRecentLinkMutation(ctx, userId, existing, nextDoc)

    await ctx.db.patch(existing._id, {
      meta: args.meta,
      updatedAt: Date.now(),
    })
    return { success: true }
  },
})

export const cleanupExpiredRecentCards = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const users = await ctx.db.query("users").collect()
    let deletedLinks = 0

    const deletedLinkCounts = await Promise.all(
      users.map(async (user) => {
        return await cleanupExpiredRecentLinks(ctx, user._id, now)
      })
    )
    deletedLinks = deletedLinkCounts.reduce(
      (totalDeletedLinks, deletedLinkCount) =>
        totalDeletedLinks + deletedLinkCount,
      0
    )

    return { deletedLinks }
  },
})
