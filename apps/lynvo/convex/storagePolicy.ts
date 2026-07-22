import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import {
  DAY_MS,
  DEFAULT_RETENTION_DAYS,
  RECENT_LINK_LIMIT_BYTES,
  STORAGE_RETENTION_DAY_OPTIONS,
  USER_STORAGE_LIMIT_BYTES,
  STORAGE_LEDGER_SCHEMA_VERSION,
  OPERATIONAL_STORAGE_DOCUMENT_LIMIT,
} from "./constants"

export const STORAGE_DOMAIN_NAMES = [
  "profile",
  "recentLinks",
  "workers",
  "pluginDomains",
  "pluginCredentials",
  "authSessions",
  "authAccounts",
  "deviceCodes",
]

declare global {
  interface AppOwnedStorageUsage {
    profileBytes: number
    recentLinkBytes: number
    workerBytes: number
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

export const calculateStorageUsage = (inventory: {
  profile?: unknown[]
  recentLinks?: unknown[]
  workers?: unknown[]
  pluginDomains?: unknown[]
  pluginCredentials?: unknown[]
  authSessions?: unknown[]
  authAccounts?: unknown[]
  deviceCodes?: unknown[]
}) => {
  const profileBytes = sumDocumentBytes(inventory.profile)
  const linkBytes = sumDocumentBytes(inventory.recentLinks)
  const workerBytes = sumDocumentBytes(inventory.workers)
  const pluginDomainBytes =
    sumDocumentBytes(inventory.pluginDomains) +
    sumDocumentBytes(inventory.pluginCredentials)
  const authBytes =
    sumDocumentBytes(inventory.authSessions) +
    sumDocumentBytes(inventory.authAccounts) +
    sumDocumentBytes(inventory.deviceCodes)
  const estimatedBytes =
    profileBytes + linkBytes + workerBytes + pluginDomainBytes + authBytes
  const savedLinkCount = inventory.recentLinks?.length ?? 0

  return {
    estimatedBytes,
    linkBytes,
    workerBytes,
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
    recentLinks,
    workers,
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
      .collect(),
    ctx.db
      .query("userWorkers")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .collect(),
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
    ctx.db
      .query("authSessions")
      .withIndex("userId", (queryBuilder) => queryBuilder.eq("userId", userId))
      .collect(),
    ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .collect(),
    ctx.db
      .query("deviceCodes")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", userId)
      )
      .collect(),
  ])

  return calculateStorageUsage({
    profile: user ? [user] : [],
    recentLinks,
    workers,
    pluginDomains,
    pluginCredentials,
    authSessions,
    authAccounts,
    deviceCodes,
  })
}

export const calculateAppOwnedStorageUsage = async (
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<AppOwnedStorageUsage> => {
  const [user, recentLinks, workers, pluginDomains, pluginCredentials] =
    await Promise.all([
      ctx.db.get("users", userId),
      ctx.db
        .query("links")
        .withIndex("by_userId", (queryBuilder) =>
          queryBuilder.eq("userId", userId)
        )
        .collect(),
      ctx.db
        .query("userWorkers")
        .withIndex("by_userId", (queryBuilder) =>
          queryBuilder.eq("userId", userId)
        )
        .collect(),
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
  const profileBytes = user ? byteLength(user) : 0
  const recentLinkBytes = sumDocumentBytes(recentLinks)
  const workerBytes = sumDocumentBytes(workers)
  const pluginDomainBytes = sumDocumentBytes(pluginDomains)
  const pluginCredentialBytes = sumDocumentBytes(pluginCredentials)
  return {
    profileBytes,
    recentLinkBytes,
    workerBytes,
    pluginDomainBytes,
    pluginCredentialBytes,
    savedLinkCount: recentLinks.length,
    totalEnforcedBytes:
      profileBytes +
      recentLinkBytes +
      workerBytes +
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

const getStorageDomain = (document: unknown) => {
  if (!document || typeof document !== "object") {
    return "profileBytes" as const
  }
  if ("ciphertext" in document) {
    return "pluginCredentialBytes" as const
  }
  if ("baseUrl" in document) {
    return "workerBytes" as const
  }
  if ("url" in document) {
    return "recentLinkBytes" as const
  }
  if ("domain" in document && "pluginId" in document) {
    return "pluginDomainBytes" as const
  }
  return "profileBytes" as const
}

const getOrCreateStorageLedger = async (
  ctx: MutationCtx,
  userId: Id<"users">
) => {
  const existing = await getUserStorageLedger(ctx, userId)
  if (existing) {
    return existing
  }
  const user = await ctx.db.get("users", userId)
  const profileBytes = user ? byteLength(user) : 0
  const usage = {
    profileBytes,
    recentLinkBytes: 0,
    workerBytes: 0,
    pluginDomainBytes: 0,
    pluginCredentialBytes: 0,
    savedLinkCount: 0,
    totalEnforcedBytes: profileBytes,
  }
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
  currentDocument: unknown | undefined,
  nextDocument: unknown | undefined
) => {
  const ledger = await getOrCreateStorageLedger(ctx, userId)
  const domain = getStorageDomain(nextDocument ?? currentDocument)
  const currentBytes = currentDocument ? byteLength(currentDocument) : 0
  const nextBytes = nextDocument ? byteLength(nextDocument) : 0
  const deltaBytes = nextBytes - currentBytes
  const totalEnforcedBytes = ledger.totalEnforcedBytes + deltaBytes
  assertStorageGrowth(totalEnforcedBytes, deltaBytes)
  const savedLinkCount =
    domain === "recentLinkBytes"
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
  currentDocument: unknown | undefined,
  nextDocument: unknown
) => {
  return await applyStorageMutation(ctx, userId, currentDocument, nextDocument)
}

export const recordStorageDeletion = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  currentDocument: unknown
) => await applyStorageMutation(ctx, userId, currentDocument, undefined)

export const assertRecentLinkSize = (recentLinkBytes: number) => {
  if (recentLinkBytes > RECENT_LINK_LIMIT_BYTES) {
    throw new Error("This link contains too much data to save.")
  }
}

export const assertRecentLinkMutation = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  currentRecentLink: unknown | undefined,
  nextRecentLink: unknown
) => {
  assertRecentLinkSize(byteLength(nextRecentLink))
  return await assertStorageMutation(
    ctx,
    userId,
    currentRecentLink,
    nextRecentLink
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

export const selectExpiredRecentLinks = <
  RecentLink extends { createdAt: number },
>(
  recentLinks: RecentLink[],
  cutoff: number
) => recentLinks.filter((recentLink) => recentLink.createdAt < cutoff)

export const getUserRetentionDays = async (
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
) => {
  const user = await ctx.db.get("users", userId)
  return user?.storageRetentionDays ?? DEFAULT_RETENTION_DAYS
}

export const getExpiredRecentLinks = async (
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
    .collect()
}

export const deleteExpiredRecentLinks = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  retentionDays: number,
  now: number
) => {
  const expiredRecentLinks = await getExpiredRecentLinks(
    ctx,
    userId,
    retentionDays,
    now
  )
  for (const recentLink of expiredRecentLinks) {
    await recordStorageDeletion(ctx, userId, recentLink)
    await ctx.db.delete("links", recentLink._id)
  }
  return expiredRecentLinks.length
}

export const cleanupExpiredRecentLinks = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number
) => {
  const retentionDays = await getUserRetentionDays(ctx, userId)
  return await deleteExpiredRecentLinks(ctx, userId, retentionDays, now)
}
