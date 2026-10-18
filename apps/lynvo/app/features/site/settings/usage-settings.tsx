import { LoadErrorRetry } from "~/components/load-error-retry"
import { PluginIcon, PluginServerAvatar } from "~/components/plugin-icon"
import { Progress } from "~/components/ui/progress"
import { useAsyncResource } from "~/hooks/use-async-resource"
import { DIRECT_MEDIA_ICON } from "~/lib/plugin-icons"
import { clampPercentage } from "~/lib/usage/usage-read"
import { readUsageSnapshot } from "~/lib/usage/usage-read-adapters"
import { useDailyTimeBucket } from "~/lib/use-coarse-time-bucket"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

import type { LynvoPlugin } from "./plugin-settings-data"
import { getSettingsDataCacheKey } from "./settings-data-cache"
import {
  SectionHeading,
  SettingsLoadingBars,
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
  limitLabel = "Monthly usage limit",
  remainingPercent,
  resetsAt,
}: {
  label: string
  limitLabel?: string
  remainingPercent: number
  resetsAt?: string
}) => {
  const resetDate = formatResetDate(resetsAt)

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-normal text-foreground">{limitLabel}</h2>
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
    ? clampPercentage(Math.round(100 - (total.used / total.limit) * 100))
    : 0

const UsageItem = ({
  icon,
  iconUrl,
  hideIcon,
  name,
  used,
  limit,
}: UsageReadEntry & {
  hideIcon: boolean
}) => (
  <SettingsRow className="py-2">
    <div className="flex min-w-0 items-center gap-2.5">
      {!hideIcon && (
        <PluginIcon icon={icon} iconUrl={iconUrl} className="size-6" />
      )}
      <span className="truncate text-sm text-foreground">{name}</span>
    </div>
    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
      {formatCompactCount(used)}/{formatCount(limit)}
    </span>
  </SettingsRow>
)

const UsageLoading = () => (
  <SettingsList role="status" aria-label="Loading usage">
    <SettingsRow className="flex-col items-stretch gap-3">
      <SettingsLoadingBars className="gap-3" titleWidthClassName="w-48" />
    </SettingsRow>
  </SettingsList>
)

const UsageLoadError = ({
  error,
  isRetrying,
  onRetry,
}: {
  error: unknown
  isRetrying: boolean
  onRetry: () => void
}) => (
  <SettingsList>
    <SettingsRow className="flex-col items-stretch gap-3 py-2">
      <LoadErrorRetry
        isRetrying={isRetrying}
        message={getUserFacingErrorMessage(
          error,
          "Usage couldn’t be loaded just now. Check the connection, then try again."
        )}
        onRetry={onRetry}
      />
    </SettingsRow>
  </SettingsList>
)

export const UsageSettings = ({
  lynvoPlugins,
  userId,
}: {
  lynvoPlugins: LynvoPlugin[]
  userId?: string
}) => {
  const timeBucket = useDailyTimeBucket()
  const pluginCacheKey = lynvoPlugins.map((plugin) => plugin.id).join(",")
  const {
    data: snapshot,
    error,
    isLoading,
    retry,
  } = useAsyncResource(
    () => readUsageSnapshot({ lynvoPlugins }),
    [timeBucket, pluginCacheKey],
    {
      cacheKey: userId
        ? getSettingsDataCacheKey("usage", userId, pluginCacheKey)
        : undefined,
    }
  )

  if (!snapshot) {
    return (
      <div className="flex flex-col gap-7">
        {error !== undefined ? (
          <UsageLoadError
            error={error}
            isRetrying={isLoading}
            onRetry={retry}
          />
        ) : (
          <UsageLoading />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-7">
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
              icon={item.iconKind === "direct" ? DIRECT_MEDIA_ICON : item.icon}
              hideIcon={item.iconKind === "hidden"}
            />
          ))}
        </SettingsList>
      </SettingsPanel>

      {(snapshot.custom.groups.length > 0 ||
        snapshot.custom.failures.length > 0) && (
        <SettingsPanel className="gap-4">
          <SectionHeading
            title="Custom Plugin Server usage"
            description="Each Custom Plugin Server reports the usage it tracks for your account."
          />
          {snapshot.custom.groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <PluginServerAvatar
                  serverId={group.key}
                  name={group.serverName}
                  className="size-10"
                />
                <span className="text-base font-normal text-foreground">
                  {group.serverName}
                </span>
              </div>
              <UsageSummary
                label={group.serverName}
                limitLabel="Usage limit"
                remainingPercent={group.remainingPercent}
                resetsAt={group.resetsAt}
              />
              <SettingsList>
                {group.entries.map((item) => (
                  <UsageItem
                    {...item}
                    key={item.key}
                    hideIcon={item.iconKind === "hidden"}
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

      {error !== undefined && (
        <UsageLoadError error={error} isRetrying={isLoading} onRetry={retry} />
      )}
    </div>
  )
}
