import { internalMutation, mutation, query } from "./_generated/server"
import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import {
  getAuthenticatedUserId,
  getAuthenticatedWritableUserId,
} from "./authentication"
import {
  assertRecentLinkMutation,
  cleanupExpiredRecentLinks,
  getRetentionCutoff,
  getUserRetentionDays,
  recordStorageDeletion,
} from "./storagePolicy"
import { CLEANUP_USER_PAGE_SIZE, RECENT_LINKS_MAX_COUNT } from "./constants"

// List retained links for a user, ordered by createdAt desc.
export const list = query({
  returns: v.any(),
  args: { timeBucket: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const retentionDays = await getUserRetentionDays(ctx, userId)
    const cutoff = getRetentionCutoff(args.timeBucket, retentionDays)
    const links = await ctx.db
      .query("links")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", userId).gte("createdAt", cutoff)
      )
      .order("desc")
      .take(RECENT_LINKS_MAX_COUNT)
    return links.map((link) => ({
      _id: link._id,
      url: link.url,
      title: link.title,
      meta: link.meta,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    }))
  },
})

// Create a new link or update title/meta if the URL already exists.
// Enforces per-card, per-user storage, and retention limits.
export const createOrUpdate = mutation({
  returns: v.any(),
  args: {
    url: v.string(),
    title: v.optional(v.string()),
    meta: v.optional(v.string()), // JSON string
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
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
      await ctx.db.patch("links", existing._id, {
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
    const retainedLinks = await ctx.db
      .query("links")
      .withIndex("by_userId_createdAt", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .order("asc")
      .take(RECENT_LINKS_MAX_COUNT)
    const oldestRecentLink =
      retainedLinks.length === RECENT_LINKS_MAX_COUNT
        ? retainedLinks[0]
        : undefined
    await assertRecentLinkMutation(ctx, userId, oldestRecentLink, newDoc)
    if (oldestRecentLink) {
      await ctx.db.delete("links", oldestRecentLink._id)
    }

    return await ctx.db.insert("links", newDoc)
  },
})

// Delete a link by ID
export const deleteById = mutation({
  returns: v.any(),
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const linkId = ctx.db.normalizeId("links", args.id)
    const existing = linkId ? await ctx.db.get("links", linkId) : null

    if (!existing || existing.userId !== userId) {
      throw new Error("Link not found or no longer available")
    }

    await recordStorageDeletion(ctx, userId, existing)
    await ctx.db.delete("links", existing._id)
    return { success: true }
  },
})

// Update metadata for a link
export const updateMeta = mutation({
  returns: v.any(),
  args: {
    id: v.string(),
    meta: v.string(), // JSON string
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const linkId = ctx.db.normalizeId("links", args.id)
    const existing = linkId ? await ctx.db.get("links", linkId) : null

    if (!existing || existing.userId !== userId) {
      throw new Error("Link not found or no longer available")
    }
    const nextDoc = {
      ...existing,
      meta: args.meta,
      updatedAt: Date.now(),
    }
    await assertRecentLinkMutation(ctx, userId, existing, nextDoc)

    await ctx.db.patch("links", existing._id, {
      meta: args.meta,
      updatedAt: Date.now(),
    })
    return { success: true }
  },
})

export const cleanupExpiredRecentCards = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
    processedUsers: v.optional(v.number()),
    deletedLinks: v.optional(v.number()),
    startedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const startedAt = args.startedAt ?? now
    const users = await ctx.db.query("users").paginate(args.paginationOpts)
    const user = users.page[0]
    const deletedInBatch = user
      ? await cleanupExpiredRecentLinks(ctx, user._id, now)
      : 0
    const processedUsers = (args.processedUsers ?? 0) + (user ? 1 : 0)
    const deletedLinks = (args.deletedLinks ?? 0) + deletedInBatch
    if (!users.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.links.cleanupExpiredRecentCards,
        {
          paginationOpts: {
            cursor: users.continueCursor,
            numItems: CLEANUP_USER_PAGE_SIZE,
          },
          processedUsers,
          deletedLinks,
          startedAt,
        }
      )
      return { processedUsers, deletedLinks, continued: true }
    }
    console.info("maintenance.cleanup_complete", {
      job: "recent_links_retention",
      processedUsers,
      deletedLinks,
      continued: false,
      durationMs: now - startedAt,
      errorClass: null,
    })
    return { processedUsers, deletedLinks, continued: false }
  },
})
