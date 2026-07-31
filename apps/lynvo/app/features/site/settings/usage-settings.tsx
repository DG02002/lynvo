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
import type { OfficialPlugin } from "./plugin-settings-data"
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
  icon?: OfficialPlugin["icon"]
  iconUrl?: string
  hideIcon?: boolean
  fallback: "extractor" | "source"
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
  icon?: OfficialPlugin["icon"]
  iconUrl?: string
  hideIcon?: boolean
  fallback: "extractor" | "source"
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
  officialPlugins,
}: {
  officialPlugins: OfficialPlugin[]
}) => {
  const timeBucket = useDailyTimeBucket()
  const officialUsage = useQuery(api.usage.getUsage, { timeBucket })
  const [externalUsage, setExternalUsage] = React.useState<
    readonly ExternalWorkerUsage[] | undefined
  >()
  const [externalUsageFailed, setExternalUsageFailed] = React.useState(false)

  React.useEffect(() => {
    let isCurrent = true
    void Effect.runPromise(client.workers.usage()).then(
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

  const officialMetrics = officialUsage
    ? monthlyExtractions(officialUsage.metrics)
    : []
  const officialDailyMetrics = officialUsage
    ? dailyExtractions(officialUsage.metrics)
    : []
  const availableExternalUsage = externalUsage?.filter(
    (worker) => !worker.error
  )
  const externalMetrics =
    availableExternalUsage?.flatMap((worker) =>
      monthlyExtractions(worker.metrics)
    ) ?? []
  const officialResetAt = officialMetrics
    .flatMap((metric) => (metric.resetsAt ? [metric.resetsAt] : []))
    .toSorted()[0]
  const externalResetAt = externalMetrics
    .flatMap((metric) => (metric.resetsAt ? [metric.resetsAt] : []))
    .toSorted()[0]

  const officialItems: UsageListItem[] = officialDailyMetrics
    .map((metric) => {
      const plugin = officialPlugins.find(
        (candidate) => candidate.id === metric.pluginId
      )
      const isDirect = metric.pluginId === "direct"
      const isDailyLimit = metric.id === "official-worker-operations"
      return {
        key: metric.id,
        icon: isDirect ? { hugeIcon: Link01Icon } : plugin?.icon,
        hideIcon: isDailyLimit,
        fallback: isDailyLimit ? ("extractor" as const) : ("source" as const),
        name: isDailyLimit
          ? "Daily extraction limit"
          : (plugin?.name ?? metric.label.replace(/\s+extractions$/i, "")),
        total: { used: metric.used, limit: metric.limit },
        sortOrder: isDailyLimit ? 0 : isDirect ? 1 : 2,
      }
    })
    .sort((left, right) => left.sortOrder - right.sortOrder)

  const externalItems: UsageListItem[] =
    externalUsage?.flatMap((worker) =>
      worker.error
        ? []
        : monthlyExtractions(worker.metrics).map((metric) => {
            const source = worker.plugins?.find(
              (candidate) => candidate.id === metric.pluginId
            )
            const isSharedExtractorMetric = !metric.pluginId
            return {
              key: `${worker.workerId}:${metric.id}`,
              iconUrl: source?.iconUrl ?? worker.iconUrl,
              fallback: isSharedExtractorMetric
                ? ("extractor" as const)
                : ("source" as const),
              name: isSharedExtractorMetric
                ? worker.name
                : (source?.name ??
                  metric.label.replace(/\s+extractions$/i, "")),
              total: { used: metric.used, limit: metric.limit },
            }
          })
    ) ?? []
  const isLoading = officialUsage === undefined || externalUsage === undefined

  return (
    <div className="flex flex-col gap-7">
      {isLoading ? (
        <UsageLoading />
      ) : (
        <>
          <SettingsPanel className="gap-4">
            <SectionHeading
              title="Official extractions"
              description="One monthly allowance shared across all official plugins and direct links, with a separate daily safety limit."
            />
            <UsageSummary
              label="Official extractor"
              total={totalMetrics(officialMetrics)}
              resetsAt={officialResetAt}
            />
            <SettingsList>
              {officialItems.map((item) => (
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
                title="External extractors"
                description="Monthly extraction usage shared across enabled external plugins."
              />
              <UsageSummary
                label="External extractors"
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
                {externalUsage?.flatMap((worker) =>
                  worker.error
                    ? [
                        <SettingsRow key={worker.workerId} className="py-2">
                          <span className="text-sm text-destructive">
                            {worker.name} usage verification failed.
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
          External extractor usage is temporarily unavailable.
        </p>
      )}
    </div>
  )
}
