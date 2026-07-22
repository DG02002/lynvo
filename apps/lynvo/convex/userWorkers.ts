import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getAuthenticatedUserId } from "./authentication"
import { assertStorageMutation, recordStorageDeletion } from "./storagePolicy"
import { verifyCredentialReadToken } from "./authGateway"

declare const process: {
  env: { AUTH_GATEWAY_SECRET?: string }
}

const workerFields = {
  _id: v.id("userWorkers"),
  _creationTime: v.number(),
  userId: v.id("users"),
  baseUrl: v.string(),
  manifest: v.string(),
  enabled: v.boolean(),
  priority: v.number(),
  verificationStatus: v.string(),
  lastVerifiedAt: v.optional(v.number()),
  lastManifestRefreshAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
}

const publicWorkerValidator = v.object(workerFields)
const serviceWorkerValidator = v.object({ ...workerFields, apiKey: v.string() })
const successValidator = v.object({ success: v.boolean() })

export const list = query({
  returns: v.array(publicWorkerValidator),
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    const workers = await ctx.db
      .query("userWorkers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()
    return workers.map(({ apiKey: _apiKey, ...worker }) => worker)
  },
})

export const listForService = query({
  returns: v.array(serviceWorkerValidator),
  args: { serviceToken: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const secret = process.env.AUTH_GATEWAY_SECRET
    if (!secret) {
      throw new Error("Credential service is not configured")
    }
    await verifyCredentialReadToken(args.serviceToken, secret)
    return await ctx.db
      .query("userWorkers")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .collect()
  },
})

export const create = mutation({
  returns: v.id("userWorkers"),
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
  returns: successValidator,
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
    const existing = workerId ? await ctx.db.get("userWorkers", workerId) : null

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
    await ctx.db.patch("userWorkers", existing._id, {
      ...updates,
      updatedAt: nextDoc.updatedAt,
    })
    return { success: true }
  },
})

export const deleteById = mutation({
  returns: successValidator,
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const workerId = ctx.db.normalizeId("userWorkers", args.id)
    const existing = workerId ? await ctx.db.get("userWorkers", workerId) : null

    if (!existing || existing.userId !== userId) {
      throw new Error("Extractor not found or no longer available")
    }

    await recordStorageDeletion(ctx, userId, existing)
    await ctx.db.delete("userWorkers", existing._id)
    return { success: true }
  },
})
