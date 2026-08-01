import { internalMutation, mutation, query } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import {
  getAuthenticatedUserId,
  getAuthenticatedWritableUserId,
} from "./authentication"
import { assertStorageMutation, recordStorageDeletion } from "./storagePolicy"
import { verifyCredentialReadToken } from "./authGateway"
import {
  CUSTOM_PLUGIN_SERVER_REGISTRATION_LIMIT,
  PLUGIN_SERVER_REGISTRATION_TTL_MS,
} from "./constants"

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
const registrationResultValidator = v.object({
  id: v.id("userPluginServers"),
  resumed: v.boolean(),
})
const servicePluginServerValidator = v.object({
  ...pluginServerFields,
  ...encryptedApiKeyFields,
})
const successValidator = v.object({ success: v.boolean() })

const normalizeBaseUrl = (baseUrl: string) => {
  const url = new URL(baseUrl.trim())
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("Plugin Server base URL must use HTTPS.")
  }
  url.pathname = url.pathname.replace(/\/+$/, "")
  url.search = ""
  url.hash = ""
  return url.toString().replace(/\/$/, "")
}

export const list = query({
  returns: v.array(publicPluginServerValidator),
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    const pluginServers = await ctx.db
      .query("userPluginServers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()
    return pluginServers.flatMap((pluginServer) => {
      if (pluginServer.credentialStatus !== "ready") {
        return []
      }
      const {
        credentialStatus: _credentialStatus,
        normalizedBaseUrl: _normalizedBaseUrl,
        pendingExpiresAt: _pendingExpiresAt,
        failureReason: _failureReason,
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

export const beginRegistration = mutation({
  returns: registrationResultValidator,
  args: { baseUrl: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const now = Date.now()
    const normalizedBaseUrl = normalizeBaseUrl(args.baseUrl)
    const pendingExpiresAt = now + PLUGIN_SERVER_REGISTRATION_TTL_MS
    const rows = await ctx.db
      .query("userPluginServers")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(CUSTOM_PLUGIN_SERVER_REGISTRATION_LIMIT + 1)
    const activeRows: Doc<"userPluginServers">[] = []
    for (const row of rows) {
      if (
        row.credentialStatus !== "ready" &&
        row.pendingExpiresAt !== undefined &&
        row.pendingExpiresAt <= now
      ) {
        await recordStorageDeletion(ctx, userId, "pluginServerBytes", row)
        await ctx.db.delete("userPluginServers", row._id)
      } else {
        activeRows.push(row)
      }
    }
    const existing = activeRows.find(
      (row) => row.normalizedBaseUrl === normalizedBaseUrl
    )
    if (existing?.credentialStatus === "ready") {
      throw new Error("This Plugin Server is already registered.")
    }
    if (existing) {
      const nextDocument = {
        ...existing,
        baseUrl: normalizedBaseUrl,
        credentialStatus: "pending" as const,
        pendingExpiresAt,
        failureReason: undefined,
        updatedAt: now,
      }
      await assertStorageMutation(
        ctx,
        userId,
        "pluginServerBytes",
        existing,
        nextDocument
      )
      await ctx.db.patch("userPluginServers", existing._id, {
        baseUrl: normalizedBaseUrl,
        credentialStatus: "pending",
        pendingExpiresAt,
        failureReason: undefined,
        updatedAt: now,
      })
      await ctx.scheduler.runAfter(
        PLUGIN_SERVER_REGISTRATION_TTL_MS,
        internal.userPluginServers.expireRegistration,
        { id: existing._id, expectedExpiresAt: pendingExpiresAt }
      )
      return { id: existing._id, resumed: true }
    }
    if (activeRows.length >= CUSTOM_PLUGIN_SERVER_REGISTRATION_LIMIT) {
      throw new Error("You have reached the saved plugin server limit.")
    }
    const newDoc = {
      userId,
      baseUrl: normalizedBaseUrl,
      normalizedBaseUrl,
      manifest: "",
      enabled: true,
      priority: 0,
      verificationStatus: "pending",
      credentialStatus: "pending" as const,
      pendingExpiresAt,
      createdAt: now,
      updatedAt: now,
    }
    await assertStorageMutation(
      ctx,
      userId,
      "pluginServerBytes",
      undefined,
      newDoc
    )
    const id = await ctx.db.insert("userPluginServers", newDoc)
    await ctx.scheduler.runAfter(
      PLUGIN_SERVER_REGISTRATION_TTL_MS,
      internal.userPluginServers.expireRegistration,
      { id, expectedExpiresAt: pendingExpiresAt }
    )
    return { id, resumed: false }
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
    manifest: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const pluginServerId = ctx.db.normalizeId("userPluginServers", args.id)
    const existing = pluginServerId
      ? await ctx.db.get("userPluginServers", pluginServerId)
      : null
    if (!existing || existing.userId !== userId) {
      throw new Error("Plugin server credential cannot be finalized")
    }
    if (existing.credentialStatus === "ready") {
      return { success: true }
    }
    if (existing.credentialStatus !== "pending") {
      throw new Error("Plugin server registration must be resumed")
    }
    const { id: _id, ...credential } = args
    const nextDoc = {
      ...existing,
      ...credential,
      credentialStatus: "ready" as const,
      manifest: args.manifest,
      verificationStatus: "verified",
      pendingExpiresAt: undefined,
      failureReason: undefined,
      updatedAt: Date.now(),
    }
    await assertStorageMutation(
      ctx,
      userId,
      "pluginServerBytes",
      existing,
      nextDoc
    )
    await ctx.db.patch("userPluginServers", existing._id, {
      ...credential,
      credentialStatus: "ready",
      manifest: args.manifest,
      verificationStatus: "verified",
      pendingExpiresAt: undefined,
      failureReason: undefined,
      updatedAt: nextDoc.updatedAt,
    })
    return { success: true }
  },
})

export const markRegistrationFailed = mutation({
  returns: successValidator,
  args: { id: v.string(), reason: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const pluginServerId = ctx.db.normalizeId("userPluginServers", args.id)
    const existing = pluginServerId
      ? await ctx.db.get("userPluginServers", pluginServerId)
      : null
    if (!existing || existing.userId !== userId) {
      throw new Error("Plugin server registration not found")
    }
    if (existing.credentialStatus === "ready") {
      return { success: true }
    }
    const nextDocument = {
      ...existing,
      credentialStatus: "failed" as const,
      failureReason: args.reason,
      updatedAt: Date.now(),
    }
    await assertStorageMutation(
      ctx,
      userId,
      "pluginServerBytes",
      existing,
      nextDocument
    )
    await ctx.db.patch("userPluginServers", existing._id, {
      credentialStatus: "failed",
      failureReason: args.reason,
      updatedAt: nextDocument.updatedAt,
    })
    return { success: true }
  },
})

export const expireRegistration = internalMutation({
  returns: v.object({ expired: v.boolean() }),
  args: {
    id: v.id("userPluginServers"),
    expectedExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get("userPluginServers", args.id)
    if (
      !existing ||
      existing.credentialStatus === "ready" ||
      existing.pendingExpiresAt !== args.expectedExpiresAt ||
      existing.pendingExpiresAt > Date.now()
    ) {
      return { expired: false }
    }
    await recordStorageDeletion(
      ctx,
      existing.userId,
      "pluginServerBytes",
      existing
    )
    await ctx.db.delete("userPluginServers", existing._id)
    return { expired: true }
  },
})

export const recordVerificationFailure = mutation({
  returns: successValidator,
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const pluginServerId = ctx.db.normalizeId("userPluginServers", args.id)
    const existing = pluginServerId
      ? await ctx.db.get("userPluginServers", pluginServerId)
      : null
    if (
      !existing ||
      existing.userId !== userId ||
      existing.credentialStatus !== "ready"
    ) {
      throw new Error("Plugin server not found or no longer available")
    }
    if (existing.verificationStatus === "down") {
      return { success: true }
    }
    const nextDocument = {
      ...existing,
      verificationStatus: "down",
      updatedAt: Date.now(),
    }
    await assertStorageMutation(
      ctx,
      userId,
      "pluginServerBytes",
      existing,
      nextDocument
    )
    await ctx.db.patch("userPluginServers", existing._id, {
      verificationStatus: "down",
      updatedAt: nextDocument.updatedAt,
    })
    return { success: true }
  },
})

export const recordVerificationSuccess = mutation({
  returns: successValidator,
  args: { id: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const pluginServerId = ctx.db.normalizeId("userPluginServers", args.id)
    const existing = pluginServerId
      ? await ctx.db.get("userPluginServers", pluginServerId)
      : null
    if (
      !existing ||
      existing.userId !== userId ||
      existing.credentialStatus !== "ready"
    ) {
      throw new Error("Plugin server not found or no longer available")
    }
    const nextDocument = {
      ...existing,
      verificationStatus: "verified",
      lastVerifiedAt: args.now,
      updatedAt: args.now,
    }
    await assertStorageMutation(
      ctx,
      userId,
      "pluginServerBytes",
      existing,
      nextDocument
    )
    await ctx.db.patch("userPluginServers", existing._id, {
      verificationStatus: "verified",
      lastVerifiedAt: args.now,
      updatedAt: args.now,
    })
    return { success: true }
  },
})

export const recordRefreshSuccess = mutation({
  returns: successValidator,
  args: { id: v.string(), manifest: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const pluginServerId = ctx.db.normalizeId("userPluginServers", args.id)
    const existing = pluginServerId
      ? await ctx.db.get("userPluginServers", pluginServerId)
      : null
    if (
      !existing ||
      existing.userId !== userId ||
      existing.credentialStatus !== "ready"
    ) {
      throw new Error("Plugin server not found or no longer available")
    }
    const nextDocument = {
      ...existing,
      manifest: args.manifest,
      verificationStatus: "verified",
      lastVerifiedAt: args.now,
      lastManifestRefreshAt: args.now,
      updatedAt: args.now,
    }
    await assertStorageMutation(
      ctx,
      userId,
      "pluginServerBytes",
      existing,
      nextDocument
    )
    await ctx.db.patch("userPluginServers", existing._id, {
      manifest: args.manifest,
      verificationStatus: "verified",
      lastVerifiedAt: args.now,
      lastManifestRefreshAt: args.now,
      updatedAt: args.now,
    })
    return { success: true }
  },
})

export const setEnabled = mutation({
  returns: successValidator,
  args: {
    id: v.string(),
    enabled: v.boolean(),
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

    const nextDoc = {
      ...existing,
      enabled: args.enabled,
      updatedAt: Date.now(),
    }
    await assertStorageMutation(
      ctx,
      userId,
      "pluginServerBytes",
      existing,
      nextDoc
    )
    await ctx.db.patch("userPluginServers", existing._id, {
      enabled: args.enabled,
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

    await recordStorageDeletion(ctx, userId, "pluginServerBytes", existing)
    await ctx.db.delete("userPluginServers", existing._id)
    return { success: true }
  },
})
