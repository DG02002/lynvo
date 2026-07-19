import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import {
  DAY_MS,
  DEFAULT_RETENTION_DAYS,
  RECENT_LINK_LIMIT_BYTES,
  STORAGE_RETENTION_DAY_OPTIONS,
  USER_STORAGE_LIMIT_BYTES,
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

export const USER_OWNED_STORAGE_TABLE_NAMES = [
  "links",
  "userWorkers",
  "userPluginDomains",
  "userPluginCredentials",
  "deviceCodes",
  "authAccounts",
  "authSessions",
] as const

const encoder = new TextEncoder()

export const byteLength = (value: unknown) =>
  encoder.encode(JSON.stringify(value)).length

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
    ctx.db.get(userId),
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
  const currentDocumentBytes = currentDocument ? byteLength(currentDocument) : 0
  const nextDocumentBytes = byteLength(nextDocument)
  const storageUsage = await getStorageUsage(ctx, userId)
  const projectedStorageBytes = projectStorageBytes(
    storageUsage.estimatedBytes,
    currentDocumentBytes,
    nextDocumentBytes
  )
  assertStorageGrowth(
    projectedStorageBytes,
    nextDocumentBytes - currentDocumentBytes
  )
  return projectedStorageBytes
}

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
  const user = await ctx.db.get(userId)
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
  await Promise.all(
    expiredRecentLinks.map((recentLink) => ctx.db.delete(recentLink._id))
  )
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
