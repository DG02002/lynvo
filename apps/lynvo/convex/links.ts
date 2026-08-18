import { internalMutation, mutation, query } from "./_generated/server"
import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import {
  getAuthenticatedUserId,
  getAuthenticatedWritableUserId,
} from "./authentication"
import {
  assertLinkMutation,
  cleanupExpiredStoredLinks,
  getRetentionCutoff,
  getUserRetentionDays,
  recordStorageDeletion,
} from "./storagePolicy"
import {
  CLEANUP_USER_PAGE_SIZE,
  EMPTY_LINK_METADATA_JSON,
  LINKS_MAX_COUNT,
  LINK_RETENTION_BATCH_SIZE,
  SAVED_LINK_COMMAND_OPERATION_CLEANUP_BATCH_SIZE,
  SAVED_LINK_COMMAND_OPERATION_TTL_MS,
} from "./constants"
import { parseCanonicalLinkMetadataJson } from "../app/features/links/storage-schemas"
import { extractedLinkSchema } from "../app/features/links/storage-schemas"
import { removeLinkFromTree } from "../app/features/links/link-tree-metadata"
import { mergeUnique } from "../app/features/links/link-tree-metadata"

const canonicalizeLinkMetadataJson = (metadataJson: string) =>
  JSON.stringify(parseCanonicalLinkMetadataJson(metadataJson))

const savedLinkResultValidator = v.object({
  _id: v.id("links"),
  url: v.string(),
  title: v.optional(v.string()),
  meta: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

// List retained links for a user, ordered by createdAt desc.
export const list = query({
  returns: v.object({
    results: v.array(savedLinkResultValidator),
  }),
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
      .take(LINKS_MAX_COUNT)
    return {
      results: links.map((link) => ({
        _id: link._id,
        url: link.url,
        title: link.title,
        meta: link.meta,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
      })),
    }
  },
})

// Create a new link or update title/meta if the URL already exists.
// Enforces per-link, per-user storage, and retention limits.
export const createOrUpdate = mutation({
  returns: v.object({ id: v.id("links") }),
  args: {
    operationId: v.string(),
    url: v.string(),
    title: v.optional(v.string()),
    meta: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const completedOperation = await ctx.db
      .query("savedLinkCommandOperations")
      .withIndex("by_userId_operationId", (operationQuery) =>
        operationQuery.eq("userId", userId).eq("operationId", args.operationId)
      )
      .unique()
    if (completedOperation) {
      return { id: completedOperation.linkId }
    }
    const now = Date.now()
    const deletedExpiredLinks = await cleanupExpiredStoredLinks(
      ctx,
      userId,
      now
    )
    if (deletedExpiredLinks === LINK_RETENTION_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.links.cleanupExpiredLinksForUser,
        { userId, now }
      )
    }

    // Check if the URL already exists for this user
    const existing = await ctx.db
      .query("links")
      .withIndex("by_userId_url", (q) =>
        q.eq("userId", userId).eq("url", args.url)
      )
      .unique()

    const metadataJson = canonicalizeLinkMetadataJson(
      args.meta ?? EMPTY_LINK_METADATA_JSON
    )
    if (existing) {
      const nextDoc = {
        ...existing,
        title: args.title ?? existing.title,
        meta: metadataJson,
        updatedAt: now,
      }
      await assertLinkMutation(ctx, userId, existing, nextDoc)
      await ctx.db.patch("links", existing._id, {
        title: args.title ?? existing.title,
        meta: metadataJson,
        updatedAt: now,
      })
      await ctx.db.insert("savedLinkCommandOperations", {
        userId,
        operationId: args.operationId,
        command: "create-or-update",
        linkId: existing._id,
        createdAt: now,
        expiresAt: now + SAVED_LINK_COMMAND_OPERATION_TTL_MS,
      })
      return { id: existing._id }
    }

    const newDoc = {
      userId,
      url: args.url,
      title: args.title,
      meta: metadataJson,
      createdAt: now,
      updatedAt: now,
    }
    const retainedLinks = await ctx.db
      .query("links")
      .withIndex("by_userId_createdAt", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .order("asc")
      .take(LINKS_MAX_COUNT)
    const oldestLink =
      retainedLinks.length === LINKS_MAX_COUNT ? retainedLinks[0] : undefined
    await assertLinkMutation(ctx, userId, oldestLink, newDoc)
    if (oldestLink) {
      await ctx.db.delete("links", oldestLink._id)
    }

    const id = await ctx.db.insert("links", newDoc)
    await ctx.db.insert("savedLinkCommandOperations", {
      userId,
      operationId: args.operationId,
      command: "create-or-update",
      linkId: id,
      createdAt: now,
      expiresAt: now + SAVED_LINK_COMMAND_OPERATION_TTL_MS,
    })
    return { id }
  },
})

// Delete a link by ID
export const deleteById = mutation({
  returns: v.object({ success: v.boolean() }),
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

    await recordStorageDeletion(ctx, userId, "linkBytes", existing)
    await ctx.db.delete("links", existing._id)
    return { success: true }
  },
})

// Update metadata for a link
export const updateMeta = mutation({
  returns: v.object({ success: v.boolean() }),
  args: {
    operationId: v.string(),
    id: v.string(),
    meta: v.string(), // JSON string
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const completedOperation = await ctx.db
      .query("savedLinkCommandOperations")
      .withIndex("by_userId_operationId", (operationQuery) =>
        operationQuery.eq("userId", userId).eq("operationId", args.operationId)
      )
      .unique()
    if (completedOperation) {
      return { success: true }
    }
    const linkId = ctx.db.normalizeId("links", args.id)
    const existing = linkId ? await ctx.db.get("links", linkId) : null

    if (!existing || existing.userId !== userId) {
      throw new Error("Link not found or no longer available")
    }
    const metadataJson = canonicalizeLinkMetadataJson(args.meta)
    const nextDoc = {
      ...existing,
      meta: metadataJson,
      updatedAt: Date.now(),
    }
    await assertLinkMutation(ctx, userId, existing, nextDoc)

    await ctx.db.patch("links", existing._id, {
      meta: metadataJson,
      updatedAt: Date.now(),
    })
    await ctx.db.insert("savedLinkCommandOperations", {
      userId,
      operationId: args.operationId,
      command: "update-meta",
      linkId: existing._id,
      createdAt: Date.now(),
      expiresAt: Date.now() + SAVED_LINK_COMMAND_OPERATION_TTL_MS,
    })
    return { success: true }
  },
})

export const applyMetadataOperation = mutation({
  returns: v.object({ success: v.boolean() }),
  args: {
    operationId: v.string(),
    id: v.string(),
    operation: v.union(
      v.object({ kind: v.literal("markOpened"), linkUrl: v.string() }),
      v.object({
        kind: v.literal("cacheMirrors"),
        lazyItemUrl: v.string(),
        mirrorsJson: v.string(),
      }),
      v.object({
        kind: v.literal("removeExtractedLink"),
        linkKey: v.string(),
        linkUrl: v.string(),
      }),
      v.object({
        kind: v.literal("replaceExtraction"),
        expectedExtractionJson: v.string(),
        extractedLinksJson: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const completedOperation = await ctx.db
      .query("savedLinkCommandOperations")
      .withIndex("by_userId_operationId", (operationQuery) =>
        operationQuery.eq("userId", userId).eq("operationId", args.operationId)
      )
      .unique()
    if (completedOperation) {
      return { success: true }
    }
    const linkId = ctx.db.normalizeId("links", args.id)
    const existing = linkId ? await ctx.db.get("links", linkId) : null
    if (!existing || existing.userId !== userId) {
      throw new Error("Link not found or no longer available")
    }

    const metadata = parseCanonicalLinkMetadataJson(existing.meta)
    switch (args.operation.kind) {
      case "markOpened":
        metadata.playback.openedUrls = mergeUnique(
          metadata.playback.openedUrls,
          [args.operation.linkUrl]
        )
        break
      case "cacheMirrors": {
        const mirrors = extractedLinkSchema
          .array()
          .parse(JSON.parse(args.operation.mirrorsJson))
        metadata.playback.resolvedMirrors = {
          ...metadata.playback.resolvedMirrors,
          [args.operation.lazyItemUrl]: mirrors,
        }
        break
      }
      case "removeExtractedLink": {
        const operation = args.operation
        metadata.extraction.extractedLinks = removeLinkFromTree(
          metadata.extraction.extractedLinks,
          operation.linkKey
        )
        metadata.playback.openedUrls = metadata.playback.openedUrls.filter(
          (openedUrl) => openedUrl !== operation.linkUrl
        )
        metadata.playback.openedIds = metadata.playback.openedIds.filter(
          (openedId) => openedId !== operation.linkKey
        )
        break
      }
      case "replaceExtraction": {
        const currentExtractionJson = JSON.stringify(
          metadata.extraction.extractedLinks
        )
        if (currentExtractionJson !== args.operation.expectedExtractionJson) {
          throw new Error("Saved link extraction changed; refresh and retry")
        }
        metadata.extraction.extractedLinks = extractedLinkSchema
          .array()
          .parse(JSON.parse(args.operation.extractedLinksJson))
        metadata.playback.resolvedMirrors = {}
        break
      }
    }

    const now = Date.now()
    const nextDoc = {
      ...existing,
      meta: JSON.stringify(metadata),
      updatedAt: now,
    }
    await assertLinkMutation(ctx, userId, existing, nextDoc)
    await ctx.db.patch("links", existing._id, {
      meta: nextDoc.meta,
      updatedAt: now,
    })
    await ctx.db.insert("savedLinkCommandOperations", {
      userId,
      operationId: args.operationId,
      command: "apply-metadata-operation",
      linkId: existing._id,
      createdAt: now,
      expiresAt: now + SAVED_LINK_COMMAND_OPERATION_TTL_MS,
    })
    return { success: true }
  },
})

export const cleanupSavedLinkCommandOperations = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number(), continued: v.boolean() }),
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("savedLinkCommandOperations")
      .withIndex("by_expiresAt", (operationQuery) =>
        operationQuery.lte("expiresAt", Date.now())
      )
      .take(SAVED_LINK_COMMAND_OPERATION_CLEANUP_BATCH_SIZE)
    for (const operation of expired) {
      await ctx.db.delete("savedLinkCommandOperations", operation._id)
    }
    const continued =
      expired.length === SAVED_LINK_COMMAND_OPERATION_CLEANUP_BATCH_SIZE
    if (continued) {
      await ctx.scheduler.runAfter(
        0,
        internal.links.cleanupSavedLinkCommandOperations,
        {}
      )
    }
    return { deleted: expired.length, continued }
  },
})

export const cleanupExpiredLinks = internalMutation({
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
      ? await cleanupExpiredStoredLinks(ctx, user._id, now)
      : 0
    const didFinishUser = !user || deletedInBatch < LINK_RETENTION_BATCH_SIZE
    const processedUsers =
      (args.processedUsers ?? 0) + (user && didFinishUser ? 1 : 0)
    const deletedLinks = (args.deletedLinks ?? 0) + deletedInBatch
    if (!didFinishUser) {
      await ctx.scheduler.runAfter(0, internal.links.cleanupExpiredLinks, {
        paginationOpts: args.paginationOpts,
        processedUsers,
        deletedLinks,
        startedAt,
      })
      return { processedUsers, deletedLinks, continued: true }
    }
    if (!users.isDone) {
      await ctx.scheduler.runAfter(0, internal.links.cleanupExpiredLinks, {
        paginationOpts: {
          cursor: users.continueCursor,
          numItems: CLEANUP_USER_PAGE_SIZE,
        },
        processedUsers,
        deletedLinks,
        startedAt,
      })
      return { processedUsers, deletedLinks, continued: true }
    }
    console.info("maintenance.cleanup_complete", {
      job: "links_retention",
      processedUsers,
      deletedLinks,
      continued: false,
      durationMs: now - startedAt,
      errorClass: null,
    })
    return { processedUsers, deletedLinks, continued: false }
  },
})

export const cleanupExpiredLinksForUser = internalMutation({
  returns: v.object({ deletedLinks: v.number(), continued: v.boolean() }),
  args: { userId: v.id("users"), now: v.number() },
  handler: async (ctx, args) => {
    const deletedLinks = await cleanupExpiredStoredLinks(
      ctx,
      args.userId,
      args.now
    )
    const continued = deletedLinks === LINK_RETENTION_BATCH_SIZE
    if (continued) {
      await ctx.scheduler.runAfter(
        0,
        internal.links.cleanupExpiredLinksForUser,
        args
      )
    }
    return { deletedLinks, continued }
  },
})
