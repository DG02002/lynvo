import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"
import { internalMutation } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import { releaseAccountCapacity } from "./accountCapacity"
import { ACCOUNT_ERASURE_BATCH_SIZE } from "./constants"
import { ACCOUNT_ERASURE_TABLES } from "./accountDataOwnership"
import { enqueueWorkerSessionCleanup } from "./sessionCleanup"

export { ACCOUNT_ERASURE_TABLES }

declare global {
  interface AccountErasureBatch<Document> {
    read: () => Promise<Document[]>
    delete: (document: Document) => Promise<void>
  }
}

const scheduleContinuation = async (ctx: MutationCtx, userId: Id<"users">) => {
  await ctx.scheduler.runAfter(0, internal.accountErasure.process, {
    userId,
  })
}

const advance = async (
  ctx: MutationCtx,
  progress: Doc<"accountErasures">,
  stage: Doc<"accountErasures">["stage"]
) => {
  await ctx.db.patch("accountErasures", progress._id, { stage })
  await scheduleContinuation(ctx, progress.userId)
}

const deleteBatch = async <Document>(
  ctx: MutationCtx,
  progress: Doc<"accountErasures">,
  batch: AccountErasureBatch<Document>,
  nextStage: Doc<"accountErasures">["stage"]
) => {
  const documents = await batch.read()
  for (const document of documents) {
    await batch.delete(document)
  }
  if (documents.length > 0) {
    await scheduleContinuation(ctx, progress.userId)
    return
  }
  await advance(ctx, progress, nextStage)
}

const deleteRemoteCommandBatch = async (
  ctx: MutationCtx,
  progress: Doc<"accountErasures">
) => {
  const commands = await ctx.db
    .query("remoteCommands")
    .withIndex("by_userId_targetSessionId_createdAt", (queryBuilder) =>
      queryBuilder.eq("userId", progress.userId)
    )
    .take(ACCOUNT_ERASURE_BATCH_SIZE)
  for (const command of commands) {
    await ctx.db.delete("remoteCommands", command._id)
  }
  if (commands.length > 0) {
    await scheduleContinuation(ctx, progress.userId)
    return
  }
  await advance(ctx, progress, "usageCounters")
}

const deleteUsageCounterBatch = async (
  ctx: MutationCtx,
  progress: Doc<"accountErasures">
) => {
  const counters = await ctx.db
    .query("usageCounters")
    .withIndex("by_owner_metric_period_epoch", (queryBuilder) =>
      queryBuilder.eq("ownerKey", `user:${progress.userId}`)
    )
    .take(ACCOUNT_ERASURE_BATCH_SIZE)
  for (const counter of counters) {
    await ctx.db.delete("usageCounters", counter._id)
  }
  if (counters.length > 0) {
    await scheduleContinuation(ctx, progress.userId)
    return
  }
  await advance(ctx, progress, "storageLedgers")
}

const deleteAccountBatch = async (
  ctx: MutationCtx,
  progress: Doc<"accountErasures">
) => {
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (queryBuilder) =>
      queryBuilder.eq("userId", progress.userId)
    )
    .take(1)
  const account = accounts[0]
  if (!account) {
    await advance(ctx, progress, "sessions")
    return
  }
  const verificationCodes = await ctx.db
    .query("authVerificationCodes")
    .withIndex("accountId", (queryBuilder) =>
      queryBuilder.eq("accountId", account._id)
    )
    .take(ACCOUNT_ERASURE_BATCH_SIZE)
  for (const verificationCode of verificationCodes) {
    await ctx.db.delete("authVerificationCodes", verificationCode._id)
  }
  if (verificationCodes.length === 0) {
    await ctx.db.delete("authAccounts", account._id)
  }
  await scheduleContinuation(ctx, progress.userId)
}

const deleteSessionBatch = async (
  ctx: MutationCtx,
  progress: Doc<"accountErasures">
) => {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (queryBuilder) =>
      queryBuilder.eq("userId", progress.userId)
    )
    .take(1)
  const session = sessions[0]
  if (!session) {
    await advance(ctx, progress, "finalize")
    return
  }
  if (session.workerSessionId) {
    await enqueueWorkerSessionCleanup(ctx, [session.workerSessionId])
  }
  const [refreshTokens, verifiers] = await Promise.all([
    ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (queryBuilder) =>
        queryBuilder.eq("sessionId", session._id)
      )
      .take(ACCOUNT_ERASURE_BATCH_SIZE),
    ctx.db
      .query("authVerifiers")
      .withIndex("sessionId", (queryBuilder) =>
        queryBuilder.eq("sessionId", session._id)
      )
      .take(ACCOUNT_ERASURE_BATCH_SIZE),
  ])
  for (const refreshToken of refreshTokens) {
    await ctx.db.delete("authRefreshTokens", refreshToken._id)
  }
  for (const verifier of verifiers) {
    await ctx.db.delete("authVerifiers", verifier._id)
  }
  if (refreshTokens.length === 0 && verifiers.length === 0) {
    await ctx.db.delete("authSessions", session._id)
  }
  await scheduleContinuation(ctx, progress.userId)
}

const getIncompleteStage = async (
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<Doc<"accountErasures">["stage"] | null> => {
  const links = await ctx.db
    .query("links")
    .withIndex("by_userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .take(1)
  if (links.length > 0) {
    return "links"
  }
  const savedLinkSynchronizationState = await ctx.db
    .query("savedLinkSynchronizationStates")
    .withIndex("by_userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .unique()
  if (savedLinkSynchronizationState) {
    return "links"
  }
  const pluginCredentials = await ctx.db
    .query("userPluginCredentials")
    .withIndex("by_userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .take(1)
  if (pluginCredentials.length > 0) {
    return "pluginCredentials"
  }
  const pluginDomains = await ctx.db
    .query("userPluginDomains")
    .withIndex("by_userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .take(1)
  if (pluginDomains.length > 0) {
    return "pluginDomains"
  }
  const pluginServers = await ctx.db
    .query("userPluginServers")
    .withIndex("by_userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .take(1)
  if (pluginServers.length > 0) {
    return "pluginServers"
  }
  const deviceCodes = await ctx.db
    .query("deviceCodes")
    .withIndex("by_userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .take(1)
  if (deviceCodes.length > 0) {
    return "deviceCodes"
  }
  const remoteCommands = await ctx.db
    .query("remoteCommands")
    .withIndex("by_userId_targetSessionId_createdAt", (queryBuilder) =>
      queryBuilder.eq("userId", userId)
    )
    .take(1)
  if (remoteCommands.length > 0) {
    return "remoteCommands"
  }
  const usageCounters = await ctx.db
    .query("usageCounters")
    .withIndex("by_owner_metric_period_epoch", (queryBuilder) =>
      queryBuilder.eq("ownerKey", `user:${userId}`)
    )
    .take(1)
  if (usageCounters.length > 0) {
    return "usageCounters"
  }
  const storageLedgers = await ctx.db
    .query("userStorageLedgers")
    .withIndex("by_userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .take(1)
  if (storageLedgers.length > 0) {
    return "storageLedgers"
  }
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (queryBuilder) =>
      queryBuilder.eq("userId", userId)
    )
    .take(1)
  if (accounts.length > 0) {
    return "accounts"
  }
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .take(1)
  return sessions.length > 0 ? "sessions" : null
}

const finalize = async (ctx: MutationCtx, progress: Doc<"accountErasures">) => {
  const incompleteStage = await getIncompleteStage(ctx, progress.userId)
  if (incompleteStage) {
    await advance(ctx, progress, incompleteStage)
    return
  }
  const user = await ctx.db.get("users", progress.userId)
  if (user) {
    await ctx.db.delete("users", user._id)
    await releaseAccountCapacity(ctx)
  }
  await ctx.db.delete("accountErasures", progress._id)
  console.info("security.account_erased", {
    trigger: progress.trigger,
    durationMs: Date.now() - progress.startedAt,
  })
  if (progress.trigger === "inactive") {
    await ctx.scheduler.runAfter(0, internal.users.cleanupInactiveUsers, {
      processedUsers: progress.cleanupProcessedUsers,
      startedAt: progress.cleanupStartedAt,
    })
  }
}

export const initiateAccountErasure = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  trigger: "manual" | "inactive",
  cleanup?: { processedUsers: number; startedAt: number }
) => {
  const existing = await ctx.db
    .query("accountErasures")
    .withIndex("by_userId", (queryBuilder) => queryBuilder.eq("userId", userId))
    .unique()
  if (existing) {
    await scheduleContinuation(ctx, userId)
    return false
  }
  const user = await ctx.db.get("users", userId)
  if (!user) {
    return false
  }
  const startedAt = Date.now()
  await ctx.db.insert("accountErasures", {
    userId,
    stage: "links",
    trigger,
    startedAt,
    cleanupProcessedUsers: cleanup?.processedUsers,
    cleanupStartedAt: cleanup?.startedAt,
  })
  await ctx.db.patch("users", userId, { erasurePendingAt: startedAt })
  await scheduleContinuation(ctx, userId)
  return true
}

export const process = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("accountErasures")
      .withIndex("by_userId", (queryBuilder) =>
        queryBuilder.eq("userId", args.userId)
      )
      .unique()
    if (!progress) {
      return null
    }
    switch (progress.stage) {
      case "links":
        if (
          !(await ctx.db
            .query("links")
            .withIndex("by_userId", (queryBuilder) =>
              queryBuilder.eq("userId", progress.userId)
            )
            .first())
        ) {
          const synchronizationState = await ctx.db
            .query("savedLinkSynchronizationStates")
            .withIndex("by_userId", (queryBuilder) =>
              queryBuilder.eq("userId", progress.userId)
            )
            .unique()
          if (synchronizationState) {
            await ctx.db.delete(
              "savedLinkSynchronizationStates",
              synchronizationState._id
            )
          }
        }
        await deleteBatch(
          ctx,
          progress,
          {
            read: async () =>
              await ctx.db
                .query("links")
                .withIndex("by_userId", (queryBuilder) =>
                  queryBuilder.eq("userId", progress.userId)
                )
                .take(ACCOUNT_ERASURE_BATCH_SIZE),
            delete: async (link) => {
              await ctx.db.delete("links", link._id)
            },
          },
          "pluginCredentials"
        )
        break
      case "pluginCredentials":
        await deleteBatch(
          ctx,
          progress,
          {
            read: async () =>
              await ctx.db
                .query("userPluginCredentials")
                .withIndex("by_userId", (queryBuilder) =>
                  queryBuilder.eq("userId", progress.userId)
                )
                .take(ACCOUNT_ERASURE_BATCH_SIZE),
            delete: async (credential) => {
              await ctx.db.delete("userPluginCredentials", credential._id)
            },
          },
          "pluginDomains"
        )
        break
      case "pluginDomains":
        await deleteBatch(
          ctx,
          progress,
          {
            read: async () =>
              await ctx.db
                .query("userPluginDomains")
                .withIndex("by_userId", (queryBuilder) =>
                  queryBuilder.eq("userId", progress.userId)
                )
                .take(ACCOUNT_ERASURE_BATCH_SIZE),
            delete: async (domain) => {
              await ctx.db.delete("userPluginDomains", domain._id)
            },
          },
          "pluginServers"
        )
        break
      case "pluginServers":
        await deleteBatch(
          ctx,
          progress,
          {
            read: async () =>
              await ctx.db
                .query("userPluginServers")
                .withIndex("by_userId", (queryBuilder) =>
                  queryBuilder.eq("userId", progress.userId)
                )
                .take(ACCOUNT_ERASURE_BATCH_SIZE),
            delete: async (pluginServer) => {
              await ctx.db.delete("userPluginServers", pluginServer._id)
            },
          },
          "deviceCodes"
        )
        break
      case "deviceCodes":
        await deleteBatch(
          ctx,
          progress,
          {
            read: async () =>
              await ctx.db
                .query("deviceCodes")
                .withIndex("by_userId", (queryBuilder) =>
                  queryBuilder.eq("userId", progress.userId)
                )
                .take(ACCOUNT_ERASURE_BATCH_SIZE),
            delete: async (deviceCode) => {
              await ctx.db.delete("deviceCodes", deviceCode._id)
            },
          },
          "remoteCommands"
        )
        break
      case "remoteCommands":
        await deleteRemoteCommandBatch(ctx, progress)
        break
      case "usageCounters":
        await deleteUsageCounterBatch(ctx, progress)
        break
      case "storageLedgers":
        await deleteBatch(
          ctx,
          progress,
          {
            read: async () =>
              await ctx.db
                .query("userStorageLedgers")
                .withIndex("by_userId", (queryBuilder) =>
                  queryBuilder.eq("userId", progress.userId)
                )
                .take(ACCOUNT_ERASURE_BATCH_SIZE),
            delete: async (ledger) => {
              await ctx.db.delete("userStorageLedgers", ledger._id)
            },
          },
          "accounts"
        )
        break
      case "accounts":
        await deleteAccountBatch(ctx, progress)
        break
      case "sessions":
        await deleteSessionBatch(ctx, progress)
        break
      case "finalize":
        await finalize(ctx, progress)
        break
    }
    return null
  },
})
