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

const encryptedCredentialValidator = v.object({
  ciphertext: v.string(),
  nonce: v.string(),
  algorithm: v.literal("AES-256-GCM"),
  keyVersion: v.number(),
})

export const list = query({
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
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    return await getAuthorizedPluginDomainById(ctx, userId, args.id)
  },
})

export const getByDomain = query({
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

export const getCredentialByDomain = query({
  args: { domain: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
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
  args: { id: v.string(), credential: encryptedCredentialValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    await setPluginCredential(ctx, userId, args.id, args.credential)
  },
})

export const deleteCredential = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    await deletePluginCredential(ctx, userId, args.id)
  },
})

export const deleteById = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    await deletePluginDomain(ctx, userId, args.id)
    return { success: true }
  },
})
