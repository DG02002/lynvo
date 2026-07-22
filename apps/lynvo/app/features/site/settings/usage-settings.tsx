import * as React from "react"
import { useQuery } from "convex/react"
import { Effect } from "effect"
import { api } from "../../../../convex/_generated/api"
import { useDailyTimeBucket } from "~/lib/use-coarse-time-bucket"
import { Progress } from "~/components/ui/progress"
import { Skeleton } from "~/components/ui/skeleton"
import { client } from "~/lib/effect/api/client"
import {
  SectionHeading,
  SettingsList,
  SettingsPanel,
  SettingsRow,
} from "./settings-layout"

const formatValue = (value: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)

const UsageMetricRow = ({ metric }: { metric: UsageMetric }) => {
  const progress = Math.min((metric.used / metric.limit) * 100, 100)
  const remaining = Math.max(metric.limit - metric.used, 0)
  return (
    <SettingsRow className="flex-col items-stretch gap-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-foreground">{metric.label}</span>
        <span className="shrink-0 text-sm text-muted-foreground">
          {formatValue(remaining)} {metric.unit} remaining
        </span>
      </div>
      <Progress value={progress} aria-label={`${metric.label} usage`} />
      <span className="text-xs text-muted-foreground">
        {formatValue(metric.used)} of {formatValue(metric.limit)} {metric.unit}{" "}
        used {metric.period}
      </span>
    </SettingsRow>
  )
}

const UsageLoading = () => (
  <SettingsList>
    <SettingsRow className="flex-col items-stretch gap-3">
      <Skeleton className="h-4 w-48" />
      <Progress value={0} />
    </SettingsRow>
  </SettingsList>
)

export const UsageSettings = () => {
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
        }
      }
    )
    return () => {
      isCurrent = false
    }
  }, [])

  return (
    <div className="flex flex-col gap-7">
      <SettingsPanel>
        <SectionHeading
          title="Official plugins"
          description="Usage is enforced by Lynvo for extraction work performed by official plugins."
        />
        {officialUsage ? (
          <SettingsList>
            {officialUsage.metrics.map((metric) => (
              <UsageMetricRow key={metric.id} metric={metric} />
            ))}
          </SettingsList>
        ) : (
          <UsageLoading />
        )}
      </SettingsPanel>

      <SettingsPanel>
        <SectionHeading
          title="External extractors"
          description="Each extractor defines and enforces the limits attached to your saved API credential."
        />
        {externalUsageFailed ? (
          <SettingsList>
            <SettingsRow>
              <span className="text-sm text-destructive">
                External extractor usage is temporarily unavailable.
              </span>
            </SettingsRow>
          </SettingsList>
        ) : externalUsage === undefined ? (
          <UsageLoading />
        ) : externalUsage.length === 0 ? (
          <SettingsList>
            <SettingsRow>
              <span className="text-sm text-muted-foreground">
                No enabled external extractors.
              </span>
            </SettingsRow>
          </SettingsList>
        ) : (
          <div className="flex flex-col gap-6">
            {externalUsage.map((worker) => (
              <div key={worker.workerId} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-foreground">
                  {worker.name}
                </h3>
                {worker.error ? (
                  <SettingsList>
                    <SettingsRow>
                      <span className="text-sm text-destructive">
                        Usage verification failed. Refresh this extractor from
                        Plugins settings.
                      </span>
                    </SettingsRow>
                  </SettingsList>
                ) : (
                  <SettingsList>
                    {worker.metrics.map((metric) => (
                      <UsageMetricRow
                        key={`${worker.workerId}:${metric.id}`}
                        metric={metric}
                      />
                    ))}
                  </SettingsList>
                )}
              </div>
            ))}
          </div>
        )}
      </SettingsPanel>
    </div>
  )
}
