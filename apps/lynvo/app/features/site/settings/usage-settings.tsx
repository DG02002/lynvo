import * as React from "react"
import { Link01Icon } from "@hugeicons/core-free-icons"
import { useQuery } from "convex/react"
import { Effect } from "effect"
import { api } from "../../../../convex/_generated/api"
import { PluginIcon } from "~/components/plugin-icon"
import { Progress } from "~/components/ui/progress"
import { Skeleton } from "~/components/ui/skeleton"
import { client } from "~/lib/effect/api/client"
import { useDailyTimeBucket } from "~/lib/use-coarse-time-bucket"
import type { LynvoPlugin } from "./plugin-settings-data"
import {
  SectionHeading,
  SettingsList,
  SettingsPanel,
  SettingsRow,
} from "./settings-layout"

interface UsageTotal {
  used: number
  limit: number
}

interface UsageListItem {
  key: string
  name: string
  total: UsageTotal
  icon?: LynvoPlugin["icon"]
  iconUrl?: string
  hideIcon?: boolean
  fallback: "plugin-server" | "source"
}

const COUNT_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
})
const RESET_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

const monthlyExtractions = (metrics: readonly UsageMetric[]) =>
  metrics.filter(
    (metric) => metric.period === "monthly" && metric.unit === "extractions"
  )

const dailyExtractions = (metrics: readonly UsageMetric[]) =>
  metrics.filter(
    (metric) => metric.period === "daily" && metric.unit === "extractions"
  )

const totalMetrics = (metrics: readonly UsageMetric[]): UsageTotal =>
  metrics.reduce(
    (total, metric) => ({
      used: total.used + metric.used,
      limit: total.limit + metric.limit,
    }),
    { used: 0, limit: 0 }
  )

const formatCount = (value: number): string => COUNT_FORMATTER.format(value)

const formatCompactCount = (value: number): string =>
  Number.isInteger(value) && value >= 0 && value < 10
    ? String(value).padStart(2, "0")
    : formatCount(value)

const formatResetDate = (resetsAt?: string): string | undefined => {
  if (!resetsAt) {
    return undefined
  }
  const date = new Date(resetsAt)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }
  return RESET_DATE_FORMATTER.format(date)
}

const UsageSummary = ({
  label,
  total,
  resetsAt,
}: {
  label: string
  total: UsageTotal
  resetsAt?: string
}) => {
  const usedPercent =
    total.limit > 0 ? Math.min((total.used / total.limit) * 100, 100) : 0
  const remainingPercent = Math.max(Math.round(100 - usedPercent), 0)
  const resetDate = formatResetDate(resetsAt)

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-normal text-foreground">
          Monthly usage limit
        </h2>
        <span className="shrink-0 text-base font-normal text-foreground">
          {remainingPercent}% remaining
        </span>
      </div>
      <Progress
        value={remainingPercent}
        aria-label={`${label} monthly extraction usage remaining`}
      />
      {resetDate && (
        <span className="text-sm text-muted-foreground">
          Resets {resetDate}
        </span>
      )}
    </div>
  )
}

const UsageItem = ({
  icon,
  iconUrl,
  hideIcon,
  fallback,
  name,
  total,
}: {
  icon?: LynvoPlugin["icon"]
  iconUrl?: string
  hideIcon?: boolean
  fallback: "plugin-server" | "source"
  name: string
  total: UsageTotal
}) => (
  <SettingsRow className="py-2">
    <div className="flex min-w-0 items-center gap-2.5">
      {!hideIcon && (
        <PluginIcon
          icon={icon}
          iconUrl={iconUrl}
          fallback={fallback}
          className="size-6"
        />
      )}
      <span className="truncate text-sm text-foreground">{name}</span>
    </div>
    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
      {formatCompactCount(total.used)}/{formatCount(total.limit)}
    </span>
  </SettingsRow>
)

const UsageLoading = () => (
  <SettingsList>
    <SettingsRow className="flex-col items-stretch gap-3">
      <Skeleton className="h-4 w-48" />
      <Progress value={0} />
    </SettingsRow>
  </SettingsList>
)

export const UsageSettings = ({
  lynvoPlugins,
}: {
  lynvoPlugins: LynvoPlugin[]
}) => {
  const timeBucket = useDailyTimeBucket()
  const lynvoUsage = useQuery(api.usage.getUsage, { timeBucket })
  const [externalUsage, setExternalUsage] = React.useState<
    readonly CustomPluginServerUsage[] | undefined
  >()
  const [externalUsageFailed, setExternalUsageFailed] = React.useState(false)

  React.useEffect(() => {
    let isCurrent = true
    void Effect.runPromise(client.pluginServers.usage()).then(
      (usage) => {
        if (isCurrent) {
          setExternalUsage(usage)
        }
      },
      () => {
        if (isCurrent) {
          setExternalUsageFailed(true)
          setExternalUsage([])
        }
      }
    )
    return () => {
      isCurrent = false
    }
  }, [])

  const lynvoMetrics = lynvoUsage ? monthlyExtractions(lynvoUsage.metrics) : []
  const lynvoDailyMetrics = lynvoUsage
    ? dailyExtractions(lynvoUsage.metrics)
    : []
  const availableExternalUsage = externalUsage?.filter(
    (pluginServer) => !pluginServer.error
  )
  const externalMetrics =
    availableExternalUsage?.flatMap((pluginServer) =>
      monthlyExtractions(pluginServer.metrics)
    ) ?? []
  const lynvoResetAt = lynvoMetrics
    .flatMap((metric) => (metric.resetsAt ? [metric.resetsAt] : []))
    .toSorted()[0]
  const externalResetAt = externalMetrics
    .flatMap((metric) => (metric.resetsAt ? [metric.resetsAt] : []))
    .toSorted()[0]

  const lynvoItems: UsageListItem[] = lynvoDailyMetrics
    .map((metric) => {
      const plugin = lynvoPlugins.find(
        (candidate) => candidate.id === metric.pluginId
      )
      const isDirect = metric.pluginId === "direct"
      const isDailyLimit = metric.id === "lynvo-plugin-server-operations"
      return {
        key: metric.id,
        icon: isDirect ? { hugeIcon: Link01Icon } : plugin?.icon,
        hideIcon: isDailyLimit,
        fallback: isDailyLimit
          ? ("plugin-server" as const)
          : ("source" as const),
        name: isDailyLimit
          ? "Daily extraction limit"
          : (plugin?.name ?? metric.label.replace(/\s+extractions$/i, "")),
        total: { used: metric.used, limit: metric.limit },
        sortOrder: isDailyLimit ? 0 : isDirect ? 1 : 2,
      }
    })
    .sort((left, right) => left.sortOrder - right.sortOrder)

  const externalItems: UsageListItem[] =
    externalUsage?.flatMap((pluginServer) =>
      pluginServer.error
        ? []
        : monthlyExtractions(pluginServer.metrics).map((metric) => {
            const plugin = pluginServer.plugins?.find(
              (candidate) => candidate.id === metric.pluginId
            )
            const isSharedPluginServerMetric = !metric.pluginId
            return {
              key: `${pluginServer.pluginServerId}:${metric.id}`,
              iconUrl: plugin?.iconUrl ?? pluginServer.iconUrl,
              fallback: isSharedPluginServerMetric
                ? ("plugin-server" as const)
                : ("source" as const),
              name: isSharedPluginServerMetric
                ? pluginServer.name
                : (plugin?.name ??
                  metric.label.replace(/\s+extractions$/i, "")),
              total: { used: metric.used, limit: metric.limit },
            }
          })
    ) ?? []
  const isLoading = lynvoUsage === undefined || externalUsage === undefined

  return (
    <div className="flex flex-col gap-7">
      {isLoading ? (
        <UsageLoading />
      ) : (
        <>
          <SettingsPanel className="gap-4">
            <SectionHeading
              title="Lynvo Plugin Server usage"
              description="One monthly allowance shared across Lynvo Plugins and direct media, plus a separate daily limit."
            />
            <UsageSummary
              label="Lynvo Plugin Server"
              total={totalMetrics(lynvoMetrics)}
              resetsAt={lynvoResetAt}
            />
            <SettingsList>
              {lynvoItems.map((item) => (
                <UsageItem
                  key={item.key}
                  icon={item.icon}
                  iconUrl={item.iconUrl}
                  hideIcon={item.hideIcon}
                  fallback={item.fallback}
                  name={item.name}
                  total={item.total}
                />
              ))}
            </SettingsList>
          </SettingsPanel>

          {externalItems.length > 0 && (
            <SettingsPanel className="gap-4">
              <SectionHeading
                title="Custom Plugin Server usage"
                description="Monthly requests shared across enabled Custom Plugin Servers."
              />
              <UsageSummary
                label="Custom Plugin Servers"
                total={totalMetrics(externalMetrics)}
                resetsAt={externalResetAt}
              />
              <SettingsList>
                {externalItems.map((item) => (
                  <UsageItem
                    key={item.key}
                    icon={item.icon}
                    iconUrl={item.iconUrl}
                    hideIcon={item.hideIcon}
                    fallback={item.fallback}
                    name={item.name}
                    total={item.total}
                  />
                ))}
                {externalUsage?.flatMap((pluginServer) =>
                  pluginServer.error
                    ? [
                        <SettingsRow
                          key={pluginServer.pluginServerId}
                          className="py-2"
                        >
                          <span className="text-sm text-destructive">
                            Usage for {pluginServer.name} couldn’t be loaded.
                          </span>
                        </SettingsRow>,
                      ]
                    : []
                )}
              </SettingsList>
            </SettingsPanel>
          )}
        </>
      )}
      {externalUsageFailed && (
        <p className="text-sm text-destructive">
          Custom Plugin Server usage couldn’t be loaded. Check the connection,
          then reload Settings.
        </p>
      )}
    </div>
  )
}
