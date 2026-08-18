import { ConvexError, v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import {
  action,
  internalMutation,
  query,
  env,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { internal } from "./_generated/api"
import { verifyCredentialReadToken } from "./authGateway"
import { getAuthenticatedUserId } from "./authentication"
import {
  GLOBAL_DAILY_LYNVO_PLUGIN_EXTRACTION_LIMIT,
  MANAGED_EXTRACTION_RESERVATION_LEASE_MS,
  USER_DAILY_LYNVO_PLUGIN_EXTRACTION_LIMIT,
  USER_MONTHLY_LYNVO_PLUGIN_EXTRACTION_LIMIT,
} from "./constants"

const managedPluginId = v.union(
  v.literal("bhadoo-google-drive-index"),
  v.literal("google-drive-public-files"),
  v.literal("onedrive-index"),
  v.literal("direct-media")
)

declare const process: {
  env: { AUTH_GATEWAY_SECRET?: string }
}

interface ManagedExtractionReservationResult {
  readonly status: "reserved" | "already-reserved"
  readonly dailyUsed?: number
  readonly monthlyUsed?: number
}

interface ManagedExtractionSettlementResult {
  readonly status: "consumed" | "released" | "already-settled"
}

const DAILY_USAGE_PERIOD = "daily" as const
const MONTHLY_USAGE_PERIOD = "monthly" as const
const USAGE_COUNTER_INITIAL_VALUE = 1
const LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID = "lynvo-plugin-server-operations"
const LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID = "lynvo-plugin-server-extractions"

const areUsageLimitsDisabled = () => env.DISABLE_USAGE_LIMITS === "true"

const getDailyPeriod = (timestamp: number) => {
  const now = new Date(timestamp)
  const start = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  )
  return {
    key: new Date(start).toISOString().slice(0, 10),
    resetsAt: start + 24 * 60 * 60 * 1000,
  }
}

const getMonthlyPeriod = (timestamp: number) => {
  const now = new Date(timestamp)
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  return {
    key: new Date(start).toISOString().slice(0, 7),
    resetsAt: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  }
}

const getEpoch = async (ctx: QueryCtx | MutationCtx): Promise<number> => {
  const epoch = await ctx.db.query("usageEpochs").first()
  return epoch?.epoch ?? 0
}

const getCounter = async (
  ctx: QueryCtx | MutationCtx,
  ownerKey: string,
  metricId: string,
  periodKey: string,
  epoch: number
) =>
  await ctx.db
    .query("usageCounters")
    .withIndex("by_owner_metric_period_epoch", (counterQuery) =>
      counterQuery
        .eq("ownerKey", ownerKey)
        .eq("metricId", metricId)
        .eq("periodKey", periodKey)
        .eq("epoch", epoch)
    )
    .unique()

const incrementCounter = async (
  ctx: MutationCtx,
  ownerKey: string,
  metricId: string,
  periodKey: string,
  epoch: number,
  current: Doc<"usageCounters"> | null
) => {
  if (current) {
    await ctx.db.patch("usageCounters", current._id, {
      used: current.used + 1,
    })
    return current.used + 1
  }
  await ctx.db.insert("usageCounters", {
    ownerKey,
    metricId,
    periodKey,
    epoch,
    used: USAGE_COUNTER_INITIAL_VALUE,
  })
  return USAGE_COUNTER_INITIAL_VALUE
}

export const reserveManagedExtraction = internalMutation({
  args: {
    userId: v.id("users"),
    operationId: v.string(),
    pluginId: managedPluginId,
  },
  returns: v.union(
    v.object({ status: v.literal("already-reserved") }),
    v.object({
      status: v.literal("reserved"),
      dailyUsed: v.number(),
      monthlyUsed: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("managedExtractionOperations")
      .withIndex("by_userId_operationId", (operationQuery) =>
        operationQuery
          .eq("userId", args.userId)
          .eq("operationId", args.operationId)
      )
      .unique()
    if (existing) {
      return { status: "already-reserved" as const }
    }

    const usageLimitsDisabled = areUsageLimitsDisabled()
    const timestamp = Date.now()
    const daily = getDailyPeriod(timestamp)
    const monthly = getMonthlyPeriod(timestamp)
    const epoch = await getEpoch(ctx)
    const ownerKey = `user:${args.userId}`
    const [userDaily, globalDaily, monthlyCounter] = await Promise.all([
      getCounter(
        ctx,
        ownerKey,
        LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
        daily.key,
        epoch
      ),
      getCounter(
        ctx,
        "global",
        LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
        daily.key,
        epoch
      ),
      getCounter(
        ctx,
        ownerKey,
        LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID,
        monthly.key,
        epoch
      ),
    ])
    if (
      !usageLimitsDisabled &&
      (userDaily?.used ?? 0) >= USER_DAILY_LYNVO_PLUGIN_EXTRACTION_LIMIT
    ) {
      throw new ConvexError("Daily Lynvo Plugin extraction limit reached.")
    }
    if (
      (globalDaily?.used ?? 0) >= GLOBAL_DAILY_LYNVO_PLUGIN_EXTRACTION_LIMIT
    ) {
      throw new ConvexError(
        "Lynvo Plugin extraction capacity is unavailable until tomorrow."
      )
    }
    if (
      !usageLimitsDisabled &&
      (monthlyCounter?.used ?? 0) >= USER_MONTHLY_LYNVO_PLUGIN_EXTRACTION_LIMIT
    ) {
      throw new ConvexError("Monthly Lynvo Plugin extraction limit reached.")
    }

    const [, dailyUsed, monthlyUsed] = await Promise.all([
      incrementCounter(
        ctx,
        "global",
        LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
        daily.key,
        epoch,
        globalDaily
      ),
      !usageLimitsDisabled
        ? incrementCounter(
            ctx,
            ownerKey,
            LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
            daily.key,
            epoch,
            userDaily
          )
        : (userDaily?.used ?? 0),
      !usageLimitsDisabled
        ? incrementCounter(
            ctx,
            ownerKey,
            LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID,
            monthly.key,
            epoch,
            monthlyCounter
          )
        : (monthlyCounter?.used ?? 0),
    ])
    await ctx.db.insert("managedExtractionOperations", {
      userId: args.userId,
      operationId: args.operationId,
      pluginId: args.pluginId,
      state: "reserved",
      epoch,
      dailyPeriodKey: daily.key,
      monthlyPeriodKey: monthly.key,
      userLimitsApplied: !usageLimitsDisabled,
      reservedAt: timestamp,
      leaseExpiresAt: timestamp + MANAGED_EXTRACTION_RESERVATION_LEASE_MS,
    })
    return { status: "reserved" as const, dailyUsed, monthlyUsed }
  },
})

export const settleManagedExtraction = internalMutation({
  args: {
    userId: v.id("users"),
    operationId: v.string(),
    outcome: v.union(v.literal("consumed"), v.literal("released")),
  },
  returns: v.object({
    status: v.union(
      v.literal("consumed"),
      v.literal("released"),
      v.literal("already-settled")
    ),
  }),
  handler: async (ctx, args) => {
    const operation = await ctx.db
      .query("managedExtractionOperations")
      .withIndex("by_userId_operationId", (operationQuery) =>
        operationQuery
          .eq("userId", args.userId)
          .eq("operationId", args.operationId)
      )
      .unique()
    if (!operation) {
      throw new ConvexError("Managed extraction reservation not found.")
    }
    if (operation.state !== "reserved") {
      return { status: "already-settled" as const }
    }
    if (args.outcome === "released") {
      const ownerKey = `user:${args.userId}`
      const counterKeys = [
        [
          "global",
          LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
          operation.dailyPeriodKey,
        ],
        ...(operation.userLimitsApplied
          ? [
              [
                ownerKey,
                LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
                operation.dailyPeriodKey,
              ],
              [
                ownerKey,
                LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID,
                operation.monthlyPeriodKey,
              ],
            ]
          : []),
      ]
      for (const [owner, metric, period] of counterKeys) {
        const counter = await getCounter(
          ctx,
          owner,
          metric,
          period,
          operation.epoch
        )
        if (!counter || counter.used < 1) {
          throw new ConvexError("Managed extraction counter is inconsistent.")
        }
        await ctx.db.patch("usageCounters", counter._id, {
          used: counter.used - 1,
        })
      }
    }
    await ctx.db.patch("managedExtractionOperations", operation._id, {
      state: args.outcome,
      settledAt: Date.now(),
    })
    return { status: args.outcome }
  },
})

export const reserveLynvoPluginOperation = action({
  args: {
    serviceToken: v.string(),
    operationId: v.string(),
    pluginId: managedPluginId,
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<ManagedExtractionReservationResult> => {
    const userId = await getAuthenticatedUserId(ctx)
    const secret = process.env.AUTH_GATEWAY_SECRET
    if (!secret) {
      throw new ConvexError("Auth gateway is unavailable.")
    }
    await verifyCredentialReadToken(args.serviceToken, secret)
    return await ctx.runMutation(internal.usage.reserveManagedExtraction, {
      userId,
      operationId: args.operationId,
      pluginId: args.pluginId,
    })
  },
})

export const settleLynvoPluginOperation = action({
  args: {
    serviceToken: v.string(),
    operationId: v.string(),
    outcome: v.union(v.literal("consumed"), v.literal("released")),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<ManagedExtractionSettlementResult> => {
    const userId = await getAuthenticatedUserId(ctx)
    const secret = process.env.AUTH_GATEWAY_SECRET
    if (!secret) {
      throw new ConvexError("Auth gateway is unavailable.")
    }
    await verifyCredentialReadToken(args.serviceToken, secret)
    return await ctx.runMutation(internal.usage.settleManagedExtraction, {
      userId,
      operationId: args.operationId,
      outcome: args.outcome,
    })
  },
})

export const getUsage = query({
  returns: v.any(),
  args: { timeBucket: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const timestamp = args.timeBucket
    const daily = getDailyPeriod(timestamp)
    const monthly = getMonthlyPeriod(timestamp)
    const epoch = await getEpoch(ctx)
    const ownerKey = `user:${userId}`
    const [dailyCounter, monthlyCounter] = await Promise.all([
      getCounter(
        ctx,
        ownerKey,
        LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
        daily.key,
        epoch
      ),
      getCounter(
        ctx,
        ownerKey,
        LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID,
        monthly.key,
        epoch
      ),
    ])
    const monthlyUsed = monthlyCounter?.used ?? 0
    return {
      metrics: [
        {
          id: LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
          label: "Daily Lynvo Plugin extractions",
          used: dailyCounter?.used ?? 0,
          limit: USER_DAILY_LYNVO_PLUGIN_EXTRACTION_LIMIT,
          unit: "extractions",
          period: DAILY_USAGE_PERIOD,
          resetsAt: new Date(daily.resetsAt).toISOString(),
        },
        {
          id: LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID,
          label: "Lynvo Plugin extractions",
          used: monthlyUsed,
          limit: USER_MONTHLY_LYNVO_PLUGIN_EXTRACTION_LIMIT,
          unit: "extractions",
          period: MONTHLY_USAGE_PERIOD,
          resetsAt: new Date(monthly.resetsAt).toISOString(),
        },
      ],
    }
  },
})

export const resetAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const current = await ctx.db.query("usageEpochs").first()
    if (current) {
      await ctx.db.patch("usageEpochs", current._id, {
        epoch: current.epoch + 1,
        updatedAt: Date.now(),
      })
      return { epoch: current.epoch + 1 }
    }
    await ctx.db.insert("usageEpochs", { epoch: 1, updatedAt: Date.now() })
    return { epoch: 1 }
  },
})
