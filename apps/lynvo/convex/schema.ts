import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    username: v.string(),
    normalizedUsername: v.string(),
    rangeSupportedPlayerId: v.optional(v.string()),
    rangeUnsupportedPlayerId: v.optional(v.string()),
    storageRetentionDays: v.optional(v.number()),
    createdAt: v.number(),
    lastActiveAt: v.number(),
    erasurePendingAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_normalizedUsername", ["normalizedUsername"])
    .index("by_lastActiveAt", ["lastActiveAt"]),

  accountErasures: defineTable({
    userId: v.id("users"),
    stage: v.union(
      v.literal("links"),
      v.literal("pluginCredentials"),
      v.literal("pluginDomains"),
      v.literal("pluginServers"),
      v.literal("deviceCodes"),
      v.literal("remoteCommands"),
      v.literal("usageCounters"),
      v.literal("storageLedgers"),
      v.literal("accounts"),
      v.literal("sessions"),
      v.literal("finalize")
    ),
    trigger: v.union(v.literal("manual"), v.literal("inactive")),
    startedAt: v.number(),
    cleanupProcessedUsers: v.optional(v.number()),
    cleanupStartedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  accountCapacity: defineTable({
    key: v.literal("global"),
    registeredAccounts: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  authSessions: defineTable({
    userId: v.id("users"),
    expirationTime: v.number(),
    workerSessionId: v.optional(v.string()),
    deviceName: v.optional(v.string()),
    lastActiveAt: v.optional(v.number()),
  })
    .index("userId", ["userId"])
    .index("by_workerSessionId", ["workerSessionId"]),

  authAccounts: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    providerAccountId: v.string(),
    secret: v.optional(v.string()),
    emailVerified: v.optional(v.string()),
    phoneVerified: v.optional(v.string()),
  })
    .index("userIdAndProvider", ["userId", "provider"])
    .index("providerAndAccountId", ["provider", "providerAccountId"]),

  authRefreshTokens: defineTable({
    sessionId: v.id("authSessions"),
    expirationTime: v.number(),
    firstUsedTime: v.optional(v.number()),
    parentRefreshTokenId: v.optional(v.id("authRefreshTokens")),
  })
    .index("sessionId", ["sessionId"])
    .index("sessionIdAndParentRefreshTokenId", [
      "sessionId",
      "parentRefreshTokenId",
    ]),

  authVerificationCodes: defineTable({
    accountId: v.id("authAccounts"),
    provider: v.string(),
    code: v.string(),
    expirationTime: v.number(),
    verifier: v.optional(v.string()),
    emailVerified: v.optional(v.string()),
    phoneVerified: v.optional(v.string()),
  })
    .index("accountId", ["accountId"])
    .index("code", ["code"]),

  authVerifiers: defineTable({
    sessionId: v.optional(v.id("authSessions")),
    signature: v.optional(v.string()),
  })
    .index("signature", ["signature"])
    .index("sessionId", ["sessionId"]),

  authRateLimits: defineTable({
    identifier: v.string(),
    lastAttemptTime: v.number(),
    attemptsLeft: v.number(),
  }).index("identifier", ["identifier"]),

  links: defineTable({
    userId: v.id("users"),
    url: v.string(),
    title: v.optional(v.string()),
    meta: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_userId_url", ["userId", "url"]),

  userStorageLedgers: defineTable({
    userId: v.id("users"),
    schemaVersion: v.number(),
    profileBytes: v.number(),
    linkBytes: v.number(),
    pluginServerBytes: v.number(),
    pluginDomainBytes: v.number(),
    pluginCredentialBytes: v.number(),
    savedLinkCount: v.number(),
    totalEnforcedBytes: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  userPluginServers: defineTable({
    userId: v.id("users"),
    baseUrl: v.string(),
    normalizedBaseUrl: v.string(),
    apiKeyCiphertext: v.optional(v.string()),
    apiKeyNonce: v.optional(v.string()),
    apiKeyAlgorithm: v.optional(v.literal("AES-256-GCM")),
    apiKeyVersion: v.optional(v.number()),
    credentialStatus: v.union(
      v.literal("pending"),
      v.literal("ready"),
      v.literal("failed")
    ),
    pendingExpiresAt: v.optional(v.number()),
    failureReason: v.optional(v.string()),
    manifest: v.string(),
    enabled: v.boolean(),
    priority: v.number(),
    verificationStatus: v.string(),
    lastVerifiedAt: v.optional(v.number()),
    lastManifestRefreshAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_normalizedBaseUrl", ["userId", "normalizedBaseUrl"]),

  userPluginDomains: defineTable({
    userId: v.id("users"),
    pluginServerId: v.string(),
    domain: v.string(),
    pluginId: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_domain", ["userId", "domain"])
    .index("by_userId_pluginServerId", ["userId", "pluginServerId"])
    .index("by_userId_pluginServerId_domain", [
      "userId",
      "pluginServerId",
      "domain",
    ]),

  userPluginCredentials: defineTable({
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
    .index("by_userId", ["userId"])
    .index("by_pluginDomainId", ["pluginDomainId"])
    .index("by_userId_domain", ["userId", "domain"])
    .index("by_userId_pluginServerId_domain", [
      "userId",
      "pluginServerId",
      "domain",
    ]),

  usageCounters: defineTable({
    ownerKey: v.string(),
    metricId: v.string(),
    periodKey: v.string(),
    epoch: v.number(),
    used: v.number(),
  }).index("by_owner_metric_period_epoch", [
    "ownerKey",
    "metricId",
    "periodKey",
    "epoch",
  ]),

  usageEpochs: defineTable({
    epoch: v.number(),
    updatedAt: v.number(),
  }),

  deviceCodes: defineTable({
    code: v.string(),
    pollSecretDigest: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("authorized"),
      v.literal("consumed")
    ),
    deviceName: v.string(),
    userId: v.optional(v.id("users")),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_userId", ["userId"]),

  remoteCommands: defineTable({
    userId: v.id("users"),
    targetSessionId: v.id("authSessions"),
    command: v.literal("play"),
    payload: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_userId_targetSessionId_createdAt", [
      "userId",
      "targetSessionId",
      "createdAt",
    ])
    .index("by_expiresAt", ["expiresAt"]),
})
