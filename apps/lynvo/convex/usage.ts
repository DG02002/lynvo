import { ConvexError, v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import {
  internalMutation,
  mutation,
  query,
  env,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { getAuthenticatedUserId } from "./authentication"
import {
  GLOBAL_DAILY_LYNVO_PLUGIN_EXTRACTION_LIMIT,
  USER_DAILY_LYNVO_PLUGIN_EXTRACTION_LIMIT,
  USER_MONTHLY_LYNVO_PLUGIN_EXTRACTION_LIMIT,
} from "./constants"

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

export const consumeLynvoPlugin = mutation({
  returns: v.any(),
  args: {
    pluginId: v.union(
      v.literal("bhadoo-google-drive-index"),
      v.literal("google-drive-public-files"),
      v.literal("onedrive-index"),
      v.literal("direct")
    ),
  },
  handler: async (ctx, _args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const usageLimitsDisabled = areUsageLimitsDisabled()
    const timestamp = Date.now()
    const daily = getDailyPeriod(timestamp)
    const monthly = getMonthlyPeriod(timestamp)
    const epoch = await getEpoch(ctx)
    const ownerKey = `user:${userId}`
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
    const monthlyUsed = monthlyCounter?.used ?? 0
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
      monthlyUsed >= USER_MONTHLY_LYNVO_PLUGIN_EXTRACTION_LIMIT
    ) {
      throw new ConvexError("Monthly Lynvo Plugin extraction limit reached.")
    }
    const [, dailyUsed, currentMonthlyUsed] = await Promise.all([
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
    return {
      dailyUsed,
      monthlyUsed: currentMonthlyUsed,
    }
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
    const dailyCounter = await getCounter(
      ctx,
      ownerKey,
      LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
      daily.key,
      epoch
    )
    const monthlyCounter = await getCounter(
      ctx,
      ownerKey,
      LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID,
      monthly.key,
      epoch
    )
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
