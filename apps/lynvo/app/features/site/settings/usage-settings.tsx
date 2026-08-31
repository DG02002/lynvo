import { PluginIcon } from "~/components/plugin-icon"
import { Progress } from "~/components/ui/progress"
import { Skeleton } from "~/components/ui/skeleton"
import { readUsageSnapshot } from "~/lib/usage/usage-read-adapters"
import { DIRECT_MEDIA_ICON } from "~/lib/plugin-icons"
import { useDailyTimeBucket } from "~/lib/use-coarse-time-bucket"
import { useAsyncResource } from "~/hooks/use-async-resource"
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
  remainingPercent,
  resetsAt,
}: {
  label: string
  remainingPercent: number
  resetsAt?: string
}) => {
  const resetDate = formatResetDate(resetsAt)

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-normal text-foreground">
          Monthly usage limit
        </h2>
        <span className="shrink-0 text-base font-normal tabular-nums text-foreground">
          {remainingPercent}% remaining
        </span>
      </div>
      <Progress
        value={remainingPercent}
        aria-label={`${label} monthly usage remaining`}
      />
      {resetDate && (
        <span className="text-sm text-muted-foreground">
          Resets {resetDate}
        </span>
      )}
    </div>
  )
}

const remainingPercentOfTotal = (total: UsageReadTotal): number =>
  total.limit > 0
    ? Math.max(Math.round(100 - (total.used / total.limit) * 100), 0)
    : 0

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
  const { data: snapshot } = useAsyncResource(
    () => readUsageSnapshot({ lynvoPlugins }),
    [timeBucket]
  )

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
            description="One monthly allowance shared across all Lynvo Plugins, plus a separate daily limit."
          />
          <UsageSummary
            label="Lynvo Plugin Server"
            remainingPercent={remainingPercentOfTotal(snapshot.lynvo.total)}
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
              description="Each Custom Plugin Server keeps its own monthly usage."
            />
            {snapshot.custom.groups.map((group) => (
              <div key={group.key} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <PluginIcon
                    iconUrl={group.iconUrl}
                    fallback="plugin-server"
                    className="size-10 shrink-0 text-foreground"
                  />
                  <span className="text-base font-normal text-foreground">
                    {group.serverName}
                  </span>
                </div>
                <UsageSummary
                  label={group.serverName}
                  remainingPercent={group.remainingPercent}
                  resetsAt={group.resetsAt}
                />
                <SettingsList>
                  {group.entries.map((item) => (
                    <UsageItem
                      {...item}
                      key={item.key}
                      hideIcon={item.iconKind === "hidden"}
                      fallback="source"
                    />
                  ))}
                </SettingsList>
              </div>
            ))}
            {snapshot.custom.failures.length > 0 && (
              <SettingsList>
                {snapshot.custom.failures.map((failure) => (
                  <SettingsRow key={failure} className="py-2">
                    <span className="text-sm text-destructive">{failure}</span>
                  </SettingsRow>
                ))}
              </SettingsList>
            )}
          </SettingsPanel>
        )}
      </>
    </div>
  )
}
