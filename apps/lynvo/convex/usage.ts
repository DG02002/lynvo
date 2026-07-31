import { ConvexError, v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { getAuthenticatedUserId } from "./authentication"
import {
  GLOBAL_DAILY_OFFICIAL_EXTRACTION_LIMIT,
  USER_DAILY_OFFICIAL_EXTRACTION_LIMIT,
  USER_MONTHLY_OFFICIAL_EXTRACTION_LIMIT,
} from "./constants"

const DAILY_USAGE_PERIOD = "daily" as const
const MONTHLY_USAGE_PERIOD = "monthly" as const
const USAGE_COUNTER_INITIAL_VALUE = 1
const OFFICIAL_MONTHLY_METRIC_ID = "official-extractions"
const LEGACY_OFFICIAL_MONTHLY_METRIC_IDS = [
  "official-plugin:bhadoo-google-drive-index",
  "official-plugin:google-drive-public-files",
  "official-plugin:onedrive-index",
  "official-plugin:direct",
] as const

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

export const consumeOfficialPlugin = mutation({
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
    const timestamp = Date.now()
    const daily = getDailyPeriod(timestamp)
    const monthly = getMonthlyPeriod(timestamp)
    const epoch = await getEpoch(ctx)
    const ownerKey = `user:${userId}`
    const [userDaily, globalDaily, monthlyCounter, ...legacyMonthlyCounters] =
      await Promise.all([
        getCounter(
          ctx,
          ownerKey,
          "official-worker-operations",
          daily.key,
          epoch
        ),
        getCounter(
          ctx,
          "global",
          "official-worker-operations",
          daily.key,
          epoch
        ),
        getCounter(
          ctx,
          ownerKey,
          OFFICIAL_MONTHLY_METRIC_ID,
          monthly.key,
          epoch
        ),
        ...LEGACY_OFFICIAL_MONTHLY_METRIC_IDS.map((metricId) =>
          getCounter(ctx, ownerKey, metricId, monthly.key, epoch)
        ),
      ])
    const monthlyUsed =
      (monthlyCounter?.used ?? 0) +
      legacyMonthlyCounters.reduce(
        (total, counter) => total + (counter?.used ?? 0),
        0
      )
    if ((userDaily?.used ?? 0) >= USER_DAILY_OFFICIAL_EXTRACTION_LIMIT) {
      throw new ConvexError("Daily official extraction limit reached.")
    }
    if ((globalDaily?.used ?? 0) >= GLOBAL_DAILY_OFFICIAL_EXTRACTION_LIMIT) {
      throw new ConvexError(
        "Official extraction capacity is unavailable until tomorrow."
      )
    }
    if (monthlyUsed >= USER_MONTHLY_OFFICIAL_EXTRACTION_LIMIT) {
      throw new ConvexError("Monthly official extraction limit reached.")
    }
    const [dailyUsed, , currentMonthlyUsed] = await Promise.all([
      incrementCounter(
        ctx,
        ownerKey,
        "official-worker-operations",
        daily.key,
        epoch,
        userDaily
      ),
      incrementCounter(
        ctx,
        "global",
        "official-worker-operations",
        daily.key,
        epoch,
        globalDaily
      ),
      incrementCounter(
        ctx,
        ownerKey,
        OFFICIAL_MONTHLY_METRIC_ID,
        monthly.key,
        epoch,
        monthlyCounter
      ),
    ])
    return {
      dailyUsed,
      monthlyUsed:
        currentMonthlyUsed +
        legacyMonthlyCounters.reduce(
          (total, counter) => total + (counter?.used ?? 0),
          0
        ),
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
      "official-worker-operations",
      daily.key,
      epoch
    )
    const [monthlyCounter, ...legacyMonthlyCounters] = await Promise.all([
      getCounter(ctx, ownerKey, OFFICIAL_MONTHLY_METRIC_ID, monthly.key, epoch),
      ...LEGACY_OFFICIAL_MONTHLY_METRIC_IDS.map((metricId) =>
        getCounter(ctx, ownerKey, metricId, monthly.key, epoch)
      ),
    ])
    const monthlyUsed =
      (monthlyCounter?.used ?? 0) +
      legacyMonthlyCounters.reduce(
        (total, counter) => total + (counter?.used ?? 0),
        0
      )
    return {
      metrics: [
        {
          id: "official-worker-operations",
          label: "Daily official extractions",
          used: dailyCounter?.used ?? 0,
          limit: USER_DAILY_OFFICIAL_EXTRACTION_LIMIT,
          unit: "extractions",
          period: DAILY_USAGE_PERIOD,
          resetsAt: new Date(daily.resetsAt).toISOString(),
        },
        {
          id: OFFICIAL_MONTHLY_METRIC_ID,
          label: "Official extractions",
          used: monthlyUsed,
          limit: USER_MONTHLY_OFFICIAL_EXTRACTION_LIMIT,
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
