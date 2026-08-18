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
    passwordChangePendingAt: v.optional(v.number()),
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
    deviceExchangeAttemptId: v.optional(v.string()),
    deviceName: v.optional(v.string()),
    lastActiveAt: v.optional(v.number()),
  })
    .index("userId", ["userId"])
    .index("by_workerSessionId", ["workerSessionId"])
    .index("by_deviceExchangeAttemptId", ["deviceExchangeAttemptId"]),

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
    meta: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_userId_url", ["userId", "url"]),

  savedLinkSynchronizationStates: defineTable({
    userId: v.id("users"),
    revision: v.number(),
    broadcastRevision: v.number(),
    pendingBroadcast: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_pendingBroadcast_and_updatedAt", [
      "pendingBroadcast",
      "updatedAt",
    ]),

  savedLinkCommandOperations: defineTable({
    userId: v.id("users"),
    operationId: v.string(),
    command: v.union(
      v.literal("create-or-update"),
      v.literal("update-meta"),
      v.literal("apply-metadata-operation")
    ),
    linkId: v.id("links"),
    revision: v.number(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_userId_operationId", ["userId", "operationId"])
    .index("by_expiresAt", ["expiresAt"]),

  workerSessionCleanupIntents: defineTable({
    workerSessionId: v.string(),
    issuanceGeneration: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_workerSessionId", ["workerSessionId"]),

  realtimeSessionRevocationIntents: defineTable({
    userId: v.id("users"),
    sessionId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId_sessionId", ["userId", "sessionId"])
    .index("by_createdAt", ["createdAt"]),

  accountSettingsSynchronizationStates: defineTable({
    userId: v.id("users"),
    revision: v.number(),
    broadcastRevision: v.number(),
    pendingBroadcast: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_pendingBroadcast_and_updatedAt", [
      "pendingBroadcast",
      "updatedAt",
    ]),

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
    credentialGeneration: v.optional(v.number()),
    credentialAttemptId: v.optional(v.string()),
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
    credentialGeneration: v.optional(v.number()),
    credentialAttemptId: v.optional(v.string()),
    credentialFinalizedAttemptId: v.optional(v.string()),
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

  managedExtractionOperations: defineTable({
    userId: v.id("users"),
    operationId: v.string(),
    pluginId: v.union(
      v.literal("bhadoo-google-drive-index"),
      v.literal("google-drive-public-files"),
      v.literal("onedrive-index"),
      v.literal("direct-media")
    ),
    state: v.union(
      v.literal("reserved"),
      v.literal("consumed"),
      v.literal("released")
    ),
    epoch: v.number(),
    dailyPeriodKey: v.string(),
    monthlyPeriodKey: v.string(),
    userLimitsApplied: v.boolean(),
    reservedAt: v.number(),
    leaseExpiresAt: v.number(),
    settledAt: v.optional(v.number()),
  })
    .index("by_userId_operationId", ["userId", "operationId"])
    .index("by_state_leaseExpiresAt", ["state", "leaseExpiresAt"]),

  deviceCodes: defineTable({
    code: v.string(),
    pollSecretDigest: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("authorized"),
      v.literal("exchanging"),
      v.literal("consumed")
    ),
    deviceName: v.string(),
    userId: v.optional(v.id("users")),
    exchangeAttemptId: v.optional(v.string()),
    exchangeGeneration: v.optional(v.number()),
    exchangeLeaseExpiresAt: v.optional(v.number()),
    exchangeSessionId: v.optional(v.id("authSessions")),
    consumedSessionId: v.optional(v.id("authSessions")),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_userId", ["userId"]),

  remoteCommands: defineTable({
    userId: v.id("users"),
    targetSessionId: v.id("authSessions"),
    targetReceiverId: v.string(),
    command: v.literal("play"),
    payload: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    status: v.union(
      v.literal("queued"),
      v.literal("claimed"),
      v.literal("applied"),
      v.literal("failed")
    ),
    availableAt: v.optional(v.number()),
    notificationPending: v.optional(v.boolean()),
    claimToken: v.optional(v.string()),
    claimExpiresAt: v.optional(v.number()),
    resultMessage: v.optional(v.string()),
  })
    .index("by_userId_targetSessionId_createdAt", [
      "userId",
      "targetSessionId",
      "createdAt",
    ])
    .index("by_claim_availability", [
      "userId",
      "targetSessionId",
      "targetReceiverId",
      "status",
      "availableAt",
      "createdAt",
    ])
    .index("by_notificationPending_createdAt", [
      "notificationPending",
      "createdAt",
    ])
    .index("by_expiresAt", ["expiresAt"]),
})
