import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import {
  getAuthenticatedUserId,
  getAuthenticatedWritableUserId,
} from "./authentication"
import { normalizePluginDomain } from "../app/lib/plugin-domain"
import {
  deletePluginCredential,
  deletePluginDomain,
  getAuthorizedPluginDomainById,
  setPluginCredential,
  upsertPluginDomain,
} from "./pluginDomainLifecycle"
import { verifyCredentialReadToken } from "./authGateway"

declare const process: {
  env: { AUTH_GATEWAY_SECRET?: string }
}

const encryptedCredentialValidator = v.object({
  ciphertext: v.string(),
  nonce: v.string(),
  algorithm: v.literal("AES-256-GCM"),
  keyVersion: v.number(),
})

const pluginDomainFields = {
  _id: v.id("userPluginDomains"),
  _creationTime: v.number(),
  userId: v.id("users"),
  pluginServerId: v.string(),
  domain: v.string(),
  pluginId: v.string(),
  credentialGeneration: v.optional(v.number()),
  credentialAttemptId: v.optional(v.string()),
  credentialFinalizedAttemptId: v.optional(v.string()),
}

const pluginDomainValidator = v.object(pluginDomainFields)

const pluginCredentialValidator = v.object({
  _id: v.id("userPluginCredentials"),
  _creationTime: v.number(),
  userId: v.id("users"),
  pluginDomainId: v.id("userPluginDomains"),
  pluginServerId: v.string(),
  pluginId: v.string(),
  domain: v.string(),
  ciphertext: v.string(),
  nonce: v.string(),
  algorithm: v.literal("AES-256-GCM"),
  keyVersion: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

export const list = query({
  returns: v.array(
    v.object({ ...pluginDomainFields, hasCredential: v.boolean() })
  ),
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx)
    const [domains, credentials] = await Promise.all([
      ctx.db
        .query("userPluginDomains")
        .withIndex("by_userId", (queryBuilder) =>
          queryBuilder.eq("userId", userId)
        )
        .collect(),
      ctx.db
        .query("userPluginCredentials")
        .withIndex("by_userId", (queryBuilder) =>
          queryBuilder.eq("userId", userId)
        )
        .collect(),
    ])
    const credentialDomainIds = new Set(
      credentials.map((credential) => credential.pluginDomainId)
    )
    return domains.map((domain) => ({
      _id: domain._id,
      _creationTime: domain._creationTime,
      userId: domain.userId,
      pluginServerId: domain.pluginServerId,
      domain: domain.domain,
      pluginId: domain.pluginId,
      hasCredential: credentialDomainIds.has(domain._id),
    }))
  },
})

export const getById = query({
  returns: v.union(v.null(), pluginDomainValidator),
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    return await getAuthorizedPluginDomainById(ctx, userId, args.id)
  },
})

export const getByDomain = query({
  returns: v.union(v.null(), pluginDomainValidator),
  args: { domain: v.string(), pluginServerId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    return await ctx.db
      .query("userPluginDomains")
      .withIndex("by_userId_pluginServerId_domain", (queryBuilder) =>
        queryBuilder
          .eq("userId", userId)
          .eq("pluginServerId", args.pluginServerId)
          .eq("domain", normalizePluginDomain(args.domain))
      )
      .unique()
  },
})

export const getCredentialByDomainForService = query({
  returns: v.union(v.null(), pluginCredentialValidator),
  args: {
    domain: v.string(),
    pluginServerId: v.string(),
    serviceToken: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const secret = process.env.AUTH_GATEWAY_SECRET
    if (!secret) {
      throw new Error("Credential service is not configured")
    }
    await verifyCredentialReadToken(args.serviceToken, secret)
    return await ctx.db
      .query("userPluginCredentials")
      .withIndex("by_userId_pluginServerId_domain", (queryBuilder) =>
        queryBuilder
          .eq("userId", userId)
          .eq("pluginServerId", args.pluginServerId)
          .eq("domain", normalizePluginDomain(args.domain))
      )
      .unique()
  },
})

export const create = mutation({
  returns: v.id("userPluginDomains"),
  args: {
    domain: v.string(),
    pluginServerId: v.string(),
    pluginId: v.string(),
    credential: v.optional(encryptedCredentialValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    return await upsertPluginDomain(ctx, userId, args)
  },
})

export const setCredential = mutation({
  returns: v.null(),
  args: { id: v.string(), credential: encryptedCredentialValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    await setPluginCredential(ctx, userId, args.id, args.credential)
  },
})

export const beginCredentialChange = mutation({
  returns: v.object({
    id: v.id("userPluginDomains"),
    userId: v.id("users"),
    pluginServerId: v.string(),
    pluginId: v.string(),
    domain: v.string(),
    generation: v.number(),
    attemptId: v.string(),
  }),
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const domain = await getAuthorizedPluginDomainById(ctx, userId, args.id)
    const generation = (domain.credentialGeneration ?? 0) + 1
    const attemptId = crypto.randomUUID()
    await ctx.db.patch("userPluginDomains", domain._id, {
      credentialGeneration: generation,
      credentialAttemptId: attemptId,
      credentialFinalizedAttemptId: undefined,
    })
    return {
      id: domain._id,
      userId: domain.userId,
      pluginServerId: domain.pluginServerId,
      pluginId: domain.pluginId,
      domain: domain.domain,
      generation,
      attemptId,
    }
  },
})

export const finalizeCredentialChange = mutation({
  returns: v.null(),
  args: {
    id: v.string(),
    generation: v.number(),
    attemptId: v.string(),
    credential: encryptedCredentialValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const domain = await getAuthorizedPluginDomainById(ctx, userId, args.id)
    if (
      domain.credentialGeneration !== args.generation ||
      domain.credentialAttemptId !== args.attemptId
    ) {
      throw new Error("Plugin credential change was superseded")
    }
    if (domain.credentialFinalizedAttemptId === args.attemptId) {
      return null
    }
    await setPluginCredential(ctx, userId, domain._id, args.credential)
    await ctx.db.patch("userPluginDomains", domain._id, {
      credentialFinalizedAttemptId: args.attemptId,
    })
    return null
  },
})

export const deleteCredential = mutation({
  returns: v.null(),
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    const domain = await getAuthorizedPluginDomainById(ctx, userId, args.id)
    await ctx.db.patch("userPluginDomains", domain._id, {
      credentialGeneration: (domain.credentialGeneration ?? 0) + 1,
      credentialAttemptId: undefined,
      credentialFinalizedAttemptId: undefined,
    })
    await deletePluginCredential(ctx, userId, args.id)
  },
})

export const deleteById = mutation({
  returns: v.object({ success: v.boolean() }),
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedWritableUserId(ctx)
    await deletePluginDomain(ctx, userId, args.id)
    return { success: true }
  },
})
