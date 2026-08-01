import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { ACCOUNT_DATA_STORAGE_REGISTRY } from "./accountDataOwnership"
import {
  DAY_MS,
  DEFAULT_RETENTION_DAYS,
  LINK_LIMIT_BYTES,
  STORAGE_RETENTION_DAY_OPTIONS,
  USER_STORAGE_LIMIT_BYTES,
  STORAGE_LEDGER_SCHEMA_VERSION,
  OPERATIONAL_STORAGE_DOCUMENT_LIMIT,
  STORAGE_RECONSTRUCTION_DOCUMENT_LIMIT,
  LINK_RETENTION_BATCH_SIZE,
} from "./constants"

export const STORAGE_DOMAIN_NAMES = [
  "profile",
  "links",
  "pluginServers",
  "pluginDomains",
  "pluginCredentials",
  "authSessions",
  "authAccounts",
  "deviceCodes",
]

export const STORAGE_DOMAIN_REGISTRY = ACCOUNT_DATA_STORAGE_REGISTRY

export type StorageLedgerDomain = Exclude<
  (typeof STORAGE_DOMAIN_REGISTRY)[keyof typeof STORAGE_DOMAIN_REGISTRY],
  null
>

declare global {
  interface AppOwnedStorageUsage {
    profileBytes: number
    linkBytes: number
    pluginServerBytes: number
    pluginDomainBytes: number
    pluginCredentialBytes: number
    savedLinkCount: number
    totalEnforcedBytes: number
  }
}

const encoder = new TextEncoder()

export const byteLength = (value: unknown) =>
  encoder.encode(
    JSON.stringify(value, (key, nestedValue) =>
      key === "_id" || key === "_creationTime" ? undefined : nestedValue
    )
  ).length

const sumDocumentBytes = (documents: unknown[] | undefined) =>
  documents?.reduce<number>(
    (totalBytes, document) => totalBytes + byteLength(document),
    0
  ) ?? 0

const assertBoundedInventory = (documents: unknown[], domain: string) => {
  if (documents.length > STORAGE_RECONSTRUCTION_DOCUMENT_LIMIT) {
    throw new Error(`Storage ${domain} inventory requires reconciliation`)
  }
  return documents
}

export const calculateStorageUsage = (inventory: {
  profile?: unknown[]
  links?: unknown[]
  pluginServers?: unknown[]
  pluginDomains?: unknown[]
  pluginCredentials?: unknown[]
  authSessions?: unknown[]
  authAccounts?: unknown[]
  deviceCodes?: unknown[]
}) => {
  const profileBytes = sumDocumentBytes(inventory.profile)
  const linkBytes = sumDocumentBytes(inventory.links)
  const pluginServerBytes = sumDocumentBytes(inventory.pluginServers)
  const pluginDomainBytes =
    sumDocumentBytes(inventory.pluginDomains) +
    sumDocumentBytes(inventory.pluginCredentials)
  const authBytes =
    sumDocumentBytes(inventory.authSessions) +
    sumDocumentBytes(inventory.authAccounts) +
    sumDocumentBytes(inventory.deviceCodes)
  const estimatedBytes =
    profileBytes + linkBytes + pluginServerBytes + pluginDomainBytes + authBytes
  const savedLinkCount = inventory.links?.length ?? 0

  return {
    estimatedBytes,
    linkBytes,
    pluginServerBytes,
    pluginDomainBytes,
    authBytes,
    profileBytes,
    savedLinkCount,
    averageLinkBytes:
      savedLinkCount > 0 ? Math.round(linkBytes / savedLinkCount) : 0,
  }
}

export const getStorageUsage = async (
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
) => {
  const [
    user,
    links,
    pluginServers,
    pluginDomains,
    pluginCredentials,
    authSessions,
    authAccounts,
    deviceCodes,
  ] = await Promise.all([
    ctx.db.get("users", userId),
    ctx.db
      .query("links")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(STORAGE_RECONSTRUCTION_DOCUMENT_LIMIT + 1),
    ctx.db
      .query("userPluginServers")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(STORAGE_RECONSTRUCTION_DOCUMENT_LIMIT + 1),
    ctx.db
      .query("userPluginDomains")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(STORAGE_RECONSTRUCTION_DOCUMENT_LIMIT + 1),
    ctx.db
      .query("userPluginCredentials")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(STORAGE_RECONSTRUCTION_DOCUMENT_LIMIT + 1),
    ctx.db
      .query("authSessions")
      .withIndex("userId", (queryBuilder) => queryBuilder.eq("userId", userId))
      .take(STORAGE_RECONSTRUCTION_DOCUMENT_LIMIT + 1),
    ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(STORAGE_RECONSTRUCTION_DOCUMENT_LIMIT + 1),
    ctx.db
      .query("deviceCodes")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(STORAGE_RECONSTRUCTION_DOCUMENT_LIMIT + 1),
  ])

  return calculateStorageUsage({
    profile: user ? [user] : [],
    links: assertBoundedInventory(links, "Recent Links"),
    pluginServers: assertBoundedInventory(pluginServers, "Plugin Servers"),
    pluginDomains: assertBoundedInventory(pluginDomains, "Plugin Domains"),
    pluginCredentials: assertBoundedInventory(
      pluginCredentials,
      "Plugin Credentials"
    ),
    authSessions: assertBoundedInventory(authSessions, "Auth Sessions"),
    authAccounts: assertBoundedInventory(authAccounts, "Auth Accounts"),
    deviceCodes: assertBoundedInventory(deviceCodes, "Device Codes"),
  })
}

export const calculateAppOwnedStorageUsage = async (
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<AppOwnedStorageUsage> => {
  const [user, links, pluginServers, pluginDomains, pluginCredentials] =
    await Promise.all([
      ctx.db.get("users", userId),
      ctx.db
        .query("links")
        .withIndex("by_userId", (queryBuilder) =>
          queryBuilder.eq("userId", userId)
        )
        .take(STORAGE_RECONSTRUCTION_DOCUMENT_LIMIT + 1),
      ctx.db
        .query("userPluginServers")
        .withIndex("by_userId", (queryBuilder) =>
          queryBuilder.eq("userId", userId)
        )
        .take(STORAGE_RECONSTRUCTION_DOCUMENT_LIMIT + 1),
      ctx.db
        .query("userPluginDomains")
        .withIndex("by_userId", (queryBuilder) =>
          queryBuilder.eq("userId", userId)
        )
        .take(STORAGE_RECONSTRUCTION_DOCUMENT_LIMIT + 1),
      ctx.db
        .query("userPluginCredentials")
        .withIndex("by_userId", (queryBuilder) =>
          queryBuilder.eq("userId", userId)
        )
        .take(STORAGE_RECONSTRUCTION_DOCUMENT_LIMIT + 1),
    ])
  const profileBytes = user ? byteLength(user) : 0
  const linkBytes = sumDocumentBytes(
    assertBoundedInventory(links, "Recent Links")
  )
  const pluginServerBytes = sumDocumentBytes(
    assertBoundedInventory(pluginServers, "Plugin Servers")
  )
  const pluginDomainBytes = sumDocumentBytes(
    assertBoundedInventory(pluginDomains, "Plugin Domains")
  )
  const pluginCredentialBytes = sumDocumentBytes(
    assertBoundedInventory(pluginCredentials, "Plugin Credentials")
  )
  return {
    profileBytes,
    linkBytes,
    pluginServerBytes,
    pluginDomainBytes,
    pluginCredentialBytes,
    savedLinkCount: links.length,
    totalEnforcedBytes:
      profileBytes +
      linkBytes +
      pluginServerBytes +
      pluginDomainBytes +
      pluginCredentialBytes,
  }
}

export const getUserStorageLedger = async (
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
) =>
  await ctx.db
    .query("userStorageLedgers")
    .withIndex("by_userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .unique()

export const getOperationalStorageBytes = async (
  ctx: QueryCtx,
  userId: Id<"users">
) => {
  const [authSessions, authAccounts, deviceCodes] = await Promise.all([
    ctx.db
      .query("authSessions")
      .withIndex("userId", (queryBuilder) => queryBuilder.eq("userId", userId))
      .take(OPERATIONAL_STORAGE_DOCUMENT_LIMIT),
    ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(OPERATIONAL_STORAGE_DOCUMENT_LIMIT),
    ctx.db
      .query("deviceCodes")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .take(OPERATIONAL_STORAGE_DOCUMENT_LIMIT),
  ])
  return (
    sumDocumentBytes(authSessions) +
    sumDocumentBytes(authAccounts) +
    sumDocumentBytes(deviceCodes)
  )
}

export const upsertUserStorageLedger = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  usage: AppOwnedStorageUsage,
  updatedAt: number
) => {
  const existing = await getUserStorageLedger(ctx, userId)
  const document = {
    userId,
    schemaVersion: STORAGE_LEDGER_SCHEMA_VERSION,
    ...usage,
    updatedAt,
  }
  if (existing) {
    await ctx.db.replace("userStorageLedgers", existing._id, document)
    return existing._id
  }
  return await ctx.db.insert("userStorageLedgers", document)
}

const getOrCreateStorageLedger = async (
  ctx: MutationCtx,
  userId: Id<"users">
) => {
  const existing = await getUserStorageLedger(ctx, userId)
  if (existing?.schemaVersion === STORAGE_LEDGER_SCHEMA_VERSION) {
    return existing
  }
  const usage = await calculateAppOwnedStorageUsage(ctx, userId)
  const ledgerId = await upsertUserStorageLedger(ctx, userId, usage, Date.now())
  const ledger = await ctx.db.get("userStorageLedgers", ledgerId)
  if (!ledger) {
    throw new Error("Storage ledger initialization failed")
  }
  return ledger
}

export const applyStorageMutation = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  domain: StorageLedgerDomain,
  currentDocument: unknown | undefined,
  nextDocument: unknown | undefined
) => {
  const ledger = await getOrCreateStorageLedger(ctx, userId)
  const currentBytes = currentDocument ? byteLength(currentDocument) : 0
  const nextBytes = nextDocument ? byteLength(nextDocument) : 0
  const deltaBytes = nextBytes - currentBytes
  const totalEnforcedBytes = ledger.totalEnforcedBytes + deltaBytes
  assertStorageGrowth(totalEnforcedBytes, deltaBytes)
  const savedLinkCount =
    domain === "linkBytes"
      ? ledger.savedLinkCount +
        (currentDocument ? 0 : 1) -
        (nextDocument ? 0 : 1)
      : ledger.savedLinkCount
  await ctx.db.patch("userStorageLedgers", ledger._id, {
    [domain]: ledger[domain] + deltaBytes,
    savedLinkCount,
    totalEnforcedBytes,
    updatedAt: Date.now(),
  })
  return totalEnforcedBytes
}

export const projectStorageBytes = (
  currentStorageBytes: number,
  currentDocumentBytes: number,
  nextDocumentBytes: number
) => currentStorageBytes - currentDocumentBytes + nextDocumentBytes

export const assertStorageGrowth = (
  projectedStorageBytes: number,
  storageDeltaBytes = projectedStorageBytes
) => {
  if (
    storageDeltaBytes > 0 &&
    projectedStorageBytes > USER_STORAGE_LIMIT_BYTES
  ) {
    throw new Error(
      "Storage is full. Remove saved links before adding another."
    )
  }
}

export const assertStorageMutation = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  domain: StorageLedgerDomain,
  currentDocument: unknown | undefined,
  nextDocument: unknown
) => {
  return await applyStorageMutation(
    ctx,
    userId,
    domain,
    currentDocument,
    nextDocument
  )
}

export const recordStorageDeletion = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  domain: StorageLedgerDomain,
  currentDocument: unknown
) => await applyStorageMutation(ctx, userId, domain, currentDocument, undefined)

export const assertLinkSize = (linkBytes: number) => {
  if (linkBytes > LINK_LIMIT_BYTES) {
    throw new Error("This link contains too much data to save.")
  }
}

export const assertLinkMutation = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  currentLink: unknown | undefined,
  nextLink: unknown
) => {
  assertLinkSize(byteLength(nextLink))
  return await assertStorageMutation(
    ctx,
    userId,
    "linkBytes",
    currentLink,
    nextLink
  )
}

export const normalizeRetentionDays = (retentionDays: number) => {
  if (!STORAGE_RETENTION_DAY_OPTIONS.includes(retentionDays)) {
    throw new Error("Choose an available auto-delete period")
  }
  return retentionDays
}

export const getRetentionCutoff = (now: number, retentionDays: number) =>
  now - retentionDays * DAY_MS

export const selectExpiredLinks = <Link extends { createdAt: number }>(
  links: Link[],
  cutoff: number
) => links.filter((link) => link.createdAt < cutoff)

export const getUserRetentionDays = async (
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
) => {
  const user = await ctx.db.get("users", userId)
  return user?.storageRetentionDays ?? DEFAULT_RETENTION_DAYS
}

export const getExpiredLinks = async (
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  retentionDays: number,
  now: number
) => {
  const cutoff = getRetentionCutoff(now, retentionDays)
  return await ctx.db
    .query("links")
    .withIndex("by_userId_createdAt", (queryBuilder) =>
      queryBuilder.eq("userId", userId).lt("createdAt", cutoff)
    )
    .take(LINK_RETENTION_BATCH_SIZE)
}

export const deleteExpiredLinks = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  retentionDays: number,
  now: number
) => {
  const expiredLinks = await getExpiredLinks(ctx, userId, retentionDays, now)
  for (const link of expiredLinks) {
    await recordStorageDeletion(ctx, userId, "linkBytes", link)
    await ctx.db.delete("links", link._id)
  }
  return expiredLinks.length
}

export const cleanupExpiredStoredLinks = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number
) => {
  const retentionDays = await getUserRetentionDays(ctx, userId)
  return await deleteExpiredLinks(ctx, userId, retentionDays, now)
}
