import { useQuery } from "@tanstack/react-query"
import { PluginIcon } from "~/components/plugin-icon"
import { Progress } from "~/components/ui/progress"
import { Skeleton } from "~/components/ui/skeleton"
import { readUsageSnapshot } from "~/lib/usage/usage-read-adapters"
import { DIRECT_MEDIA_ICON } from "~/lib/plugin-icons"
import { useDailyTimeBucket } from "~/lib/use-coarse-time-bucket"
import type { LynvoPlugin } from "./plugin-settings-data"
import {
  SectionHeading,
  SettingsList,
  SettingsPanel,
  SettingsRow,
} from "./settings-layout"

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

const formatCount = (value: number): string => COUNT_FORMATTER.format(value)

const formatCompactCount = (value: number): string =>
  Number.isInteger(value) && value >= 0 && value < 10
    ? String(value).padStart(2, "0")
    : formatCount(value)

const formatResetDate = (resetsAt?: string): string | undefined =>
  resetsAt ? RESET_DATE_FORMATTER.format(new Date(resetsAt)) : undefined

const UsageSummary = ({
  label,
  total,
  resetsAt,
}: {
  label: string
  total: UsageReadTotal
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
  used,
  limit,
}: UsageReadEntry & {
  hideIcon: boolean
  fallback: "plugin-server" | "source"
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
      {formatCompactCount(used)}/{formatCount(limit)}
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
  const { data: snapshot } = useQuery({
    queryKey: ["settings", "usage", timeBucket],
    queryFn: () => readUsageSnapshot({ lynvoPlugins, timeBucket }),
  })

  if (!snapshot) {
    return (
      <div className="flex flex-col gap-7">
        <UsageLoading />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-7">
      <>
        <SettingsPanel className="gap-4">
          <SectionHeading
            title="Lynvo Plugin Server usage"
            description="One monthly allowance shared across Lynvo Plugins and Direct Media, plus a separate daily limit."
          />
          <UsageSummary
            label="Lynvo Plugin Server"
            total={snapshot.lynvo.total}
            resetsAt={snapshot.lynvo.resetsAt}
          />
          <SettingsList>
            {snapshot.lynvo.entries.map((item) => (
              <UsageItem
                {...item}
                key={item.key}
                icon={
                  item.iconKind === "direct" ? DIRECT_MEDIA_ICON : item.icon
                }
                hideIcon={item.iconKind === "hidden"}
                fallback="source"
              />
            ))}
          </SettingsList>
        </SettingsPanel>

        {(snapshot.custom.groups.length > 0 ||
          snapshot.custom.failures.length > 0) && (
          <SettingsPanel className="gap-4">
            <SectionHeading
              title="Custom Plugin Server usage"
              description="Each Custom Plugin Server has separate usage limits."
            />
            {snapshot.custom.groups.map((group) => (
              <div key={group.key} className="flex flex-col gap-3">
                <UsageSummary
                  label={`${group.serverName} · ${group.period} ${group.unit}`}
                  total={group.total}
                  resetsAt={group.resetsAt}
                />
                <SettingsList>
                  {group.entries.map((item) => (
                    <UsageItem
                      {...item}
                      key={item.key}
                      hideIcon={item.iconKind === "hidden"}
                      fallback={
                        item.iconKind === "plugin-server"
                          ? "plugin-server"
                          : "source"
                      }
                    />
                  ))}
                </SettingsList>
              </div>
            ))}
            <SettingsList>
              {snapshot.custom.failures.map((failure) => (
                <SettingsRow key={failure} className="py-2">
                  <span className="text-sm text-destructive">{failure}</span>
                </SettingsRow>
              ))}
            </SettingsList>
          </SettingsPanel>
        )}
      </>
    </div>
  )
}
