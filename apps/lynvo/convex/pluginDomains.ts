import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getAuthenticatedUserId } from "./authentication"
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
  domain: v.string(),
  pluginId: v.string(),
}

const pluginDomainValidator = v.object(pluginDomainFields)

const pluginCredentialValidator = v.object({
  _id: v.id("userPluginCredentials"),
  _creationTime: v.number(),
  userId: v.id("users"),
  pluginDomainId: v.id("userPluginDomains"),
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
      ...domain,
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
  args: { domain: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    return await ctx.db
      .query("userPluginDomains")
      .withIndex("by_userId_domain", (queryBuilder) =>
        queryBuilder
          .eq("userId", userId)
          .eq("domain", normalizePluginDomain(args.domain))
      )
      .unique()
  },
})

export const getCredentialByDomainForService = query({
  returns: v.union(v.null(), pluginCredentialValidator),
  args: { domain: v.string(), serviceToken: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const secret = process.env.AUTH_GATEWAY_SECRET
    if (!secret) {
      throw new Error("Credential service is not configured")
    }
    await verifyCredentialReadToken(args.serviceToken, secret)
    return await ctx.db
      .query("userPluginCredentials")
      .withIndex("by_userId_domain", (queryBuilder) =>
        queryBuilder
          .eq("userId", userId)
          .eq("domain", normalizePluginDomain(args.domain))
      )
      .unique()
  },
})

export const create = mutation({
  returns: v.id("userPluginDomains"),
  args: {
    domain: v.string(),
    pluginId: v.string(),
    credential: v.optional(encryptedCredentialValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    return await upsertPluginDomain(ctx, userId, args)
  },
})

export const setCredential = mutation({
  returns: v.null(),
  args: { id: v.string(), credential: encryptedCredentialValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    await setPluginCredential(ctx, userId, args.id, args.credential)
  },
})

export const deleteCredential = mutation({
  returns: v.null(),
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    await deletePluginCredential(ctx, userId, args.id)
  },
})

export const deleteById = mutation({
  returns: v.object({ success: v.boolean() }),
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    await deletePluginDomain(ctx, userId, args.id)
    return { success: true }
  },
})
