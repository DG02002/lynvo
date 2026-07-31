import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import {
  getAuthenticatedUserId,
  getAuthenticatedWritableUserId,
} from "./authentication"
import { assertStorageMutation, recordStorageDeletion } from "./storagePolicy"
import { verifyCredentialReadToken } from "./authGateway"

declare const process: {
  env: { AUTH_GATEWAY_SECRET?: string }
}

const pluginServerFields = {
  _id: v.id("userPluginServers"),
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

const publicPluginServerValidator = v.object(pluginServerFields)
const encryptedApiKeyFields = {
  apiKeyCiphertext: v.string(),
  apiKeyNonce: v.string(),
  apiKeyAlgorithm: v.literal("AES-256-GCM"),
  apiKeyVersion: v.number(),
}
const servicePluginServerValidator = v.object({
  ...pluginServerFields,
  ...encryptedApiKeyFields,
})
const successValidator = v.object({ success: v.boolean() })

export const list = query({
  returns: v.array(publicPluginServerValidator),
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    const pluginServers = await ctx.db
      .query("userPluginServers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()
    return pluginServers.flatMap(({ credentialStatus, ...pluginServer }) => {
      if (credentialStatus !== "ready") {
        return []
      }
      const {
        apiKeyCiphertext: _apiKeyCiphertext,
        apiKeyNonce: _apiKeyNonce,
        apiKeyAlgorithm: _apiKeyAlgorithm,
        apiKeyVersion: _apiKeyVersion,
        ...publicPluginServer
      } = pluginServer
      return [publicPluginServer]
    })
  },
})

export const listForService = query({
  returns: v.array(servicePluginServerValidator),
  args: { serviceToken: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const secret = process.env.AUTH_GATEWAY_SECRET
    if (!secret) {
      throw new Error("Credential service is not configured")
    }
    await verifyCredentialReadToken(args.serviceToken, secret)
    const pluginServers = await ctx.db
      .query("userPluginServers")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .collect()
    return pluginServers.flatMap((pluginServer) =>
      pluginServer.credentialStatus === "ready" &&
      pluginServer.apiKeyCiphertext &&
      pluginServer.apiKeyNonce &&
      pluginServer.apiKeyAlgorithm &&
      pluginServer.apiKeyVersion !== undefined
        ? [
            {
              _id: pluginServer._id,
              _creationTime: pluginServer._creationTime,
              userId: pluginServer.userId,
              baseUrl: pluginServer.baseUrl,
              manifest: pluginServer.manifest,
              enabled: pluginServer.enabled,
              priority: pluginServer.priority,
              verificationStatus: pluginServer.verificationStatus,
              lastVerifiedAt: pluginServer.lastVerifiedAt,
              lastManifestRefreshAt: pluginServer.lastManifestRefreshAt,
              createdAt: pluginServer.createdAt,
              updatedAt: pluginServer.updatedAt,
              apiKeyCiphertext: pluginServer.apiKeyCiphertext,
              apiKeyNonce: pluginServer.apiKeyNonce,
              apiKeyAlgorithm: pluginServer.apiKeyAlgorithm,
              apiKeyVersion: pluginServer.apiKeyVersion,
            },
          ]
        : []
    )
  },
})

export const createPending = mutation({
  returns: v.id("userPluginServers"),
  args: {
    baseUrl: v.string(),
    manifest: v.string(),
    enabled: v.boolean(),
    priority: v.number(),
    verificationStatus: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const now = Date.now()
    const newDoc = {
      userId,
      ...args,
      credentialStatus: "pending" as const,
      createdAt: now,
      updatedAt: now,
    }
    await assertStorageMutation(ctx, userId, undefined, newDoc)
    return await ctx.db.insert("userPluginServers", newDoc)
  },
})

export const finalizeEncryptedCredential = mutation({
  returns: successValidator,
  args: {
    id: v.string(),
    apiKeyCiphertext: v.string(),
    apiKeyNonce: v.string(),
    apiKeyAlgorithm: v.literal("AES-256-GCM"),
    apiKeyVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const pluginServerId = ctx.db.normalizeId("userPluginServers", args.id)
    const existing = pluginServerId
      ? await ctx.db.get("userPluginServers", pluginServerId)
      : null
    if (
      !existing ||
      existing.userId !== userId ||
      existing.credentialStatus !== "pending"
    ) {
      throw new Error("Plugin server credential cannot be finalized")
    }
    const { id: _id, ...credential } = args
    const nextDoc = {
      ...existing,
      ...credential,
      credentialStatus: "ready" as const,
      updatedAt: Date.now(),
    }
    await assertStorageMutation(ctx, userId, existing, nextDoc)
    await ctx.db.patch("userPluginServers", existing._id, {
      ...credential,
      credentialStatus: "ready",
      updatedAt: nextDoc.updatedAt,
    })
    return { success: true }
  },
})

export const update = mutation({
  returns: successValidator,
  args: {
    id: v.string(),
    baseUrl: v.optional(v.string()),
    manifest: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
    priority: v.optional(v.number()),
    verificationStatus: v.optional(v.string()),
    lastVerifiedAt: v.optional(v.number()),
    lastManifestRefreshAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const pluginServerId = ctx.db.normalizeId("userPluginServers", args.id)
    const existing = pluginServerId
      ? await ctx.db.get("userPluginServers", pluginServerId)
      : null

    if (!existing || existing.userId !== userId) {
      throw new Error("Plugin server not found or no longer available")
    }

    const { id: _id, ...updates } = args
    const nextDoc = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    }
    await assertStorageMutation(ctx, userId, existing, nextDoc)
    await ctx.db.patch("userPluginServers", existing._id, {
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
    const userId = await getAuthenticatedWritableUserId(ctx)
    const pluginServerId = ctx.db.normalizeId("userPluginServers", args.id)
    const existing = pluginServerId
      ? await ctx.db.get("userPluginServers", pluginServerId)
      : null

    if (!existing || existing.userId !== userId) {
      throw new Error("Plugin server not found or no longer available")
    }

    await recordStorageDeletion(ctx, userId, existing)
    await ctx.db.delete("userPluginServers", existing._id)
    return { success: true }
  },
})
