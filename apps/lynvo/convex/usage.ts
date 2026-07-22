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
  OFFICIAL_PLUGIN_DISPLAY_NAMES,
  OFFICIAL_PLUGIN_MONTHLY_EXTRACTION_LIMITS,
  USER_DAILY_OFFICIAL_EXTRACTION_LIMIT,
} from "./constants"

const DAILY_USAGE_PERIOD = "daily" as const
const MONTHLY_USAGE_PERIOD = "monthly" as const
const USAGE_COUNTER_INITIAL_VALUE = 1

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

const getOfficialPluginDisplayName = (pluginId: string): string => {
  if (pluginId === "bhadoo-google-drive-index") {
    return OFFICIAL_PLUGIN_DISPLAY_NAMES[pluginId]
  }
  if (pluginId === "onedrive-index") {
    return OFFICIAL_PLUGIN_DISPLAY_NAMES[pluginId]
  }
  return OFFICIAL_PLUGIN_DISPLAY_NAMES.direct
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
    await ctx.db.patch(current._id, { used: current.used + 1 })
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
  args: {
    pluginId: v.union(
      v.literal("bhadoo-google-drive-index"),
      v.literal("onedrive-index"),
      v.literal("direct")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const timestamp = Date.now()
    const daily = getDailyPeriod(timestamp)
    const monthly = getMonthlyPeriod(timestamp)
    const epoch = await getEpoch(ctx)
    const ownerKey = `user:${userId}`
    const pluginMetricId = `official-plugin:${args.pluginId}`
    const [userDaily, globalDaily, pluginMonthly] = await Promise.all([
      getCounter(ctx, ownerKey, "official-worker-operations", daily.key, epoch),
      getCounter(ctx, "global", "official-worker-operations", daily.key, epoch),
      getCounter(ctx, ownerKey, pluginMetricId, monthly.key, epoch),
    ])
    const pluginLimit = OFFICIAL_PLUGIN_MONTHLY_EXTRACTION_LIMITS[args.pluginId]
    if ((userDaily?.used ?? 0) >= USER_DAILY_OFFICIAL_EXTRACTION_LIMIT) {
      throw new ConvexError("Daily official extraction limit reached.")
    }
    if ((globalDaily?.used ?? 0) >= GLOBAL_DAILY_OFFICIAL_EXTRACTION_LIMIT) {
      throw new ConvexError(
        "Official extraction capacity is unavailable until tomorrow."
      )
    }
    if ((pluginMonthly?.used ?? 0) >= pluginLimit) {
      throw new ConvexError(
        `${args.pluginId} monthly extraction limit reached.`
      )
    }
    const [dailyUsed, , pluginUsed] = await Promise.all([
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
        pluginMetricId,
        monthly.key,
        epoch,
        pluginMonthly
      ),
    ])
    return { dailyUsed, pluginUsed }
  },
})

export const getUsage = query({
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
    const pluginMetrics = await Promise.all(
      Object.entries(OFFICIAL_PLUGIN_MONTHLY_EXTRACTION_LIMITS).map(
        async ([pluginId, limit]) => {
          const counter = await getCounter(
            ctx,
            ownerKey,
            `official-plugin:${pluginId}`,
            monthly.key,
            epoch
          )
          return {
            id: `official-plugin:${pluginId}`,
            label: `${getOfficialPluginDisplayName(pluginId)} extractions`,
            used: counter?.used ?? 0,
            limit,
            unit: "extractions",
            period: MONTHLY_USAGE_PERIOD,
            resetsAt: new Date(monthly.resetsAt).toISOString(),
            sourceId: pluginId,
          }
        }
      )
    )
    return {
      metrics: [
        {
          id: "official-worker-operations",
          label: "Official plugin operations",
          used: dailyCounter?.used ?? 0,
          limit: USER_DAILY_OFFICIAL_EXTRACTION_LIMIT,
          unit: "operations",
          period: DAILY_USAGE_PERIOD,
          resetsAt: new Date(daily.resetsAt).toISOString(),
        },
        ...pluginMetrics,
      ],
    }
  },
})

export const resetAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const current = await ctx.db.query("usageEpochs").first()
    if (current) {
      await ctx.db.patch(current._id, {
        epoch: current.epoch + 1,
        updatedAt: Date.now(),
      })
      return { epoch: current.epoch + 1 }
    }
    await ctx.db.insert("usageEpochs", { epoch: 1, updatedAt: Date.now() })
    return { epoch: 1 }
  },
})
