const LYNVO_DAILY_LIMIT_METRIC_ID = "lynvo-plugin-server-operations"
const CUSTOM_USAGE_FAILURE =
  "Custom Plugin Server usage couldn’t be loaded. Check the connection, then reload Settings."

const extractionMetrics = (
  metrics: readonly UsageMetric[],
  period: UsageMetric["period"]
) =>
  metrics.filter(
    (metric) => metric.period === period && metric.unit === "extractions"
  )

const totalMetrics = (metrics: readonly UsageMetric[]): UsageReadTotal =>
  metrics.reduce(
    (total, metric) => ({
      used: total.used + metric.used,
      limit: total.limit + metric.limit,
    }),
    { used: 0, limit: 0 }
  )

const earliestValidReset = (
  metrics: readonly UsageMetric[]
): string | undefined =>
  metrics
    .flatMap((metric) =>
      Number.isNaN(new Date(metric.resetsAt).getTime()) ? [] : [metric.resetsAt]
    )
    .toSorted()[0]

const getLynvoUsageIconKind = (
  isDailyLimit: boolean,
  isDirect: boolean
): UsageReadEntry["iconKind"] => {
  if (isDailyLimit) {
    return "hidden"
  }

  if (isDirect) {
    return "direct"
  }

  return "source"
}

const getLynvoUsageSortOrder = (isDailyLimit: boolean, isDirect: boolean) => {
  if (isDailyLimit) {
    return 0
  }

  if (isDirect) {
    return 1
  }

  return 2
}

const normalizeLynvoSection = (
  metrics: readonly UsageMetric[],
  plugins: UsageReadInput["lynvoPlugins"]
): UsageReadSection => {
  const monthlyMetrics = extractionMetrics(metrics, "monthly")
  const entries = extractionMetrics(metrics, "daily")
    .map((metric) => {
      const plugin = plugins.find(
        (candidate) => candidate.id === metric.pluginId
      )
      const isDailyLimit = metric.id === LYNVO_DAILY_LIMIT_METRIC_ID
      const isDirect = metric.pluginId === "direct-media"
      const iconKind = getLynvoUsageIconKind(isDailyLimit, isDirect)
      return {
        key: metric.id,
        name: isDailyLimit
          ? "Daily extraction limit"
          : (plugin?.name ?? metric.label.replace(/\s+extractions$/i, "")),
        used: metric.used,
        limit: metric.limit,
        icon: plugin?.icon,
        iconKind,
        sortOrder: getLynvoUsageSortOrder(isDailyLimit, isDirect),
      }
    })
    .toSorted((left, right) => left.sortOrder - right.sortOrder)
    .map(({ sortOrder: _sortOrder, ...entry }) => entry)
  return {
    total: totalMetrics(monthlyMetrics),
    resetsAt: earliestValidReset(monthlyMetrics),
    entries,
    failures: [],
  }
}

const remainingPercentOf = (metrics: readonly UsageMetric[]): number => {
  let minimumRemainingRatio: number | undefined
  for (const metric of metrics) {
    if (metric.limit <= 0) {
      continue
    }
    const remainingRatio = 1 - metric.used / metric.limit
    minimumRemainingRatio =
      minimumRemainingRatio === undefined
        ? remainingRatio
        : Math.min(minimumRemainingRatio, remainingRatio)
  }
  if (minimumRemainingRatio === undefined) {
    return 100
  }
  return Math.max(0, Math.round(minimumRemainingRatio * 100))
}

// Monthly budgets are what people manage; daily rate limits sort below them.
const PERIOD_ORDER = { monthly: 0, daily: 1 } as const

const normalizeCustomSection = (
  usage: readonly CustomPluginServerUsage[],
  didAdapterFail: boolean
): UsageReadCustomSection => {
  const available = usage.filter((pluginServer) => !pluginServer.error)
  return {
    groups: available.map((pluginServer) => {
      // The headline bar reflects the tightest monthly quota; servers that
      // only report daily metrics fall back to those for the bar.
      const headlineMetrics = pluginServer.metrics.filter(
        (metric) => metric.period === "monthly"
      )
      const barMetrics =
        headlineMetrics.length > 0 ? headlineMetrics : pluginServer.metrics
      return {
        key: pluginServer.pluginServerId,
        serverName: pluginServer.name,
        iconUrl: pluginServer.iconUrl,
        remainingPercent: remainingPercentOf(barMetrics),
        resetsAt: earliestValidReset(barMetrics),
        entries: pluginServer.metrics
          .toSorted(
            (left, right) =>
              PERIOD_ORDER[left.period] - PERIOD_ORDER[right.period]
          )
          .map((metric) => {
            const plugin = pluginServer.plugins?.find(
              (candidate) => candidate.id === metric.pluginId
            )
            // The group header already shows the Plugin Server icon once;
            // only Plugin-specific metrics carry their own icon.
            const iconKind: UsageReadEntry["iconKind"] = metric.pluginId
              ? "source"
              : "hidden"
            return {
              key: `${pluginServer.pluginServerId}:${metric.id}`,
              name: plugin?.name ?? metric.label,
              used: metric.used,
              limit: metric.limit,
              iconUrl: plugin?.iconUrl,
              iconKind,
            }
          }),
      }
    }),
    failures: didAdapterFail
      ? [CUSTOM_USAGE_FAILURE]
      : usage.flatMap((pluginServer) =>
          pluginServer.error
            ? [`Usage for ${pluginServer.name} couldn’t be loaded.`]
            : []
        ),
  }
}

export const createUsageReadModule = (
  adapters: UsageReadAdapters
): UsageReadModule => ({
  read: async (input) => {
    const [lynvo, custom] = await Promise.allSettled([
      adapters.readLynvo(),
      adapters.readCustom(),
    ])
    if (lynvo.status === "rejected") {
      throw lynvo.reason
    }
    return {
      lynvo: normalizeLynvoSection(lynvo.value.metrics, input.lynvoPlugins),
      custom: normalizeCustomSection(
        custom.status === "fulfilled" ? custom.value : [],
        custom.status === "rejected"
      ),
    }
  },
})
