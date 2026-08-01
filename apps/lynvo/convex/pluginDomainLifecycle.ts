import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { normalizePluginDomain } from "../app/lib/plugin-domain"
import { assertStorageMutation, recordStorageDeletion } from "./storagePolicy"

declare global {
  interface EncryptedCredentialInput {
    ciphertext: string
    nonce: string
    algorithm: "AES-256-GCM"
    keyVersion: number
  }
}

export const getAuthorizedPluginDomainById = async (
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  domainIdValue: string
) => {
  const domainId = ctx.db.normalizeId("userPluginDomains", domainIdValue)
  const domain = domainId
    ? await ctx.db.get("userPluginDomains", domainId)
    : null
  if (!domain || domain.userId !== userId) {
    throw new Error("Plugin domain not found")
  }
  return domain
}

const getCredential = async (
  ctx: QueryCtx | MutationCtx,
  pluginDomainId: Id<"userPluginDomains">
) =>
  await ctx.db
    .query("userPluginCredentials")
    .withIndex("by_pluginDomainId", (queryBuilder) =>
      queryBuilder.eq("pluginDomainId", pluginDomainId)
    )
    .unique()

export const buildPluginCredentialDocument = ({
  userId,
  pluginDomain,
  credential,
  existingCredential,
  now,
}: {
  userId: Id<"users">
  pluginDomain: Pick<
    Doc<"userPluginDomains">,
    "_id" | "pluginServerId" | "pluginId" | "domain"
  >
  credential: EncryptedCredentialInput
  existingCredential?: Doc<"userPluginCredentials">
  now: number
}) => ({
  userId,
  pluginDomainId: pluginDomain._id,
  pluginServerId: pluginDomain.pluginServerId,
  pluginId: pluginDomain.pluginId,
  domain: pluginDomain.domain,
  ...credential,
  createdAt: existingCredential?.createdAt ?? now,
  updatedAt: now,
})

const replaceCredential = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  pluginDomain: Doc<"userPluginDomains">,
  credential: EncryptedCredentialInput,
  existingCredential?: Doc<"userPluginCredentials">
) => {
  const credentialDocument = buildPluginCredentialDocument({
    userId,
    pluginDomain,
    credential,
    existingCredential,
    now: Date.now(),
  })
  await assertStorageMutation(
    ctx,
    userId,
    "pluginCredentialBytes",
    existingCredential,
    credentialDocument
  )
  if (existingCredential) {
    await ctx.db.replace(
      "userPluginCredentials",
      existingCredential._id,
      credentialDocument
    )
    return existingCredential._id
  }
  return await ctx.db.insert("userPluginCredentials", credentialDocument)
}

export const upsertPluginDomain = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  input: {
    domain: string
    pluginServerId: string
    pluginId: string
    credential?: EncryptedCredentialInput
  }
) => {
  const domain = normalizePluginDomain(input.domain)
  const existingDomain = await ctx.db
    .query("userPluginDomains")
    .withIndex("by_userId_pluginServerId_domain", (queryBuilder) =>
      queryBuilder
        .eq("userId", userId)
        .eq("pluginServerId", input.pluginServerId)
        .eq("domain", domain)
    )
    .unique()

  if (!existingDomain) {
    const pluginDomainDocument = {
      userId,
      pluginServerId: input.pluginServerId,
      domain,
      pluginId: input.pluginId,
    }
    await assertStorageMutation(
      ctx,
      userId,
      "pluginDomainBytes",
      undefined,
      pluginDomainDocument
    )
    const pluginDomainId = await ctx.db.insert(
      "userPluginDomains",
      pluginDomainDocument
    )
    if (input.credential) {
      const pluginDomain = await ctx.db.get("userPluginDomains", pluginDomainId)
      if (!pluginDomain) {
        throw new Error("Plugin domain creation failed")
      }
      await replaceCredential(ctx, userId, pluginDomain, input.credential)
    }
    return pluginDomainId
  }

  const existingCredential = await getCredential(ctx, existingDomain._id)
  const isReassignment = existingDomain.pluginId !== input.pluginId
  const nextDomain = { ...existingDomain, pluginId: input.pluginId, domain }
  await assertStorageMutation(
    ctx,
    userId,
    "pluginDomainBytes",
    existingDomain,
    nextDomain
  )
  await ctx.db.patch("userPluginDomains", existingDomain._id, {
    pluginId: input.pluginId,
    domain,
  })

  if (isReassignment && existingCredential) {
    await recordStorageDeletion(
      ctx,
      userId,
      "pluginCredentialBytes",
      existingCredential
    )
    await ctx.db.delete("userPluginCredentials", existingCredential._id)
  }
  if (input.credential) {
    await replaceCredential(
      ctx,
      userId,
      nextDomain,
      input.credential,
      isReassignment ? undefined : (existingCredential ?? undefined)
    )
  }
  return existingDomain._id
}

export const setPluginCredential = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  domainId: string,
  credential: EncryptedCredentialInput
) => {
  const pluginDomain = await getAuthorizedPluginDomainById(
    ctx,
    userId,
    domainId
  )
  const existingCredential = await getCredential(ctx, pluginDomain._id)
  await replaceCredential(
    ctx,
    userId,
    pluginDomain,
    credential,
    existingCredential ?? undefined
  )
}

export const deletePluginCredential = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  domainId: string
) => {
  const pluginDomain = await getAuthorizedPluginDomainById(
    ctx,
    userId,
    domainId
  )
  const credential = await getCredential(ctx, pluginDomain._id)
  if (credential) {
    await recordStorageDeletion(
      ctx,
      userId,
      "pluginCredentialBytes",
      credential
    )
    await ctx.db.delete("userPluginCredentials", credential._id)
  }
}

export const deletePluginDomain = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  domainId: string
) => {
  const pluginDomain = await getAuthorizedPluginDomainById(
    ctx,
    userId,
    domainId
  )
  await deletePluginDomainDocument(ctx, userId, pluginDomain)
}

export const deletePluginDomainDocument = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  pluginDomain: Doc<"userPluginDomains">
) => {
  const credential = await getCredential(ctx, pluginDomain._id)
  if (credential) {
    await recordStorageDeletion(
      ctx,
      userId,
      "pluginCredentialBytes",
      credential
    )
    await ctx.db.delete("userPluginCredentials", credential._id)
  }
  await recordStorageDeletion(ctx, userId, "pluginDomainBytes", pluginDomain)
  await ctx.db.delete("userPluginDomains", pluginDomain._id)
}
