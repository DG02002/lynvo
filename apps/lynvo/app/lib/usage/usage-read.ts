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
      const iconKind: UsageReadEntry["iconKind"] = isDailyLimit
        ? "hidden"
        : isDirect
          ? "direct"
          : "source"
      return {
        key: metric.id,
        name: isDailyLimit
          ? "Daily extraction limit"
          : (plugin?.name ?? metric.label.replace(/\s+extractions$/i, "")),
        used: metric.used,
        limit: metric.limit,
        icon: plugin?.icon,
        iconKind,
        sortOrder: isDailyLimit ? 0 : isDirect ? 1 : 2,
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

const normalizeCustomSection = (
  usage: readonly CustomPluginServerUsage[],
  didAdapterFail: boolean
): UsageReadCustomSection => {
  const available = usage.filter((pluginServer) => !pluginServer.error)
  return {
    groups: available.flatMap((pluginServer) => {
      const groupKeys = new Set(
        pluginServer.metrics.map(
          (metric) => `${metric.unit}\u0000${metric.period}`
        )
      )
      return [...groupKeys].map((groupKey) => {
        const [unit, periodValue] = groupKey.split("\u0000")
        const period: UsageMetric["period"] =
          periodValue === "daily" ? "daily" : "monthly"
        const metrics = pluginServer.metrics.filter(
          (metric) => metric.unit === unit && metric.period === period
        )
        return {
          key: `${pluginServer.pluginServerId}:${unit}:${period}`,
          serverName: pluginServer.name,
          unit,
          period,
          total: totalMetrics(metrics),
          resetsAt: earliestValidReset(metrics),
          entries: metrics.map((metric) => {
            const plugin = pluginServer.plugins?.find(
              (candidate) => candidate.id === metric.pluginId
            )
            const isServerMetric = !metric.pluginId
            const iconKind: UsageReadEntry["iconKind"] = isServerMetric
              ? "plugin-server"
              : "source"
            return {
              key: `${pluginServer.pluginServerId}:${metric.id}`,
              name: isServerMetric
                ? metric.label
                : (plugin?.name ?? metric.label),
              used: metric.used,
              limit: metric.limit,
              iconUrl: plugin?.iconUrl ?? pluginServer.iconUrl,
              iconKind,
            }
          }),
        }
      })
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
      adapters.readLynvo(input.timeBucket),
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
