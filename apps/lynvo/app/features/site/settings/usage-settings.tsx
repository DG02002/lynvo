import * as React from "react"

import { LoadErrorRetry } from "~/components/load-error-retry"
import {
  LynvoPluginServerAvatar,
  PluginIcon,
  PluginServerAvatar,
} from "~/components/plugin-icon"
import { Button } from "~/components/ui/button"
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
  SettingsDisclosure,
  SettingsList,
  SettingsPanel,
  SettingsRow,
  SettingsHeadingText,
  SettingsUsageMeter,
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
    <SettingsUsageMeter
      title={<SettingsHeadingText as="h4">{limitLabel}</SettingsHeadingText>}
      trailing={`${remainingPercent}% remaining`}
      progress={{
        value: remainingPercent,
        label: `${label} monthly usage remaining`,
      }}
      footer={
        resetDate && (
          <span className="text-sm text-muted-foreground">
            Resets {resetDate}
          </span>
        )
      }
    />
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
  compact = false,
}: UsageReadEntry & {
  hideIcon: boolean
  compact?: boolean
}) => (
  <SettingsRow className={compact ? "py-0" : "py-2"}>
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

const partitionUsageEntries = (entries: readonly UsageReadEntry[]) => {
  const systemEntries: UsageReadEntry[] = []
  const pluginEntries: UsageReadEntry[] = []

  for (const entry of entries) {
    if (entry.iconKind === "hidden") {
      systemEntries.push(entry)
    } else {
      pluginEntries.push(entry)
    }
  }

  return { systemEntries, pluginEntries }
}

const UsageServerGroup = ({
  avatar,
  children,
  name,
}: {
  avatar: React.ReactNode
  children: React.ReactNode
  name: string
}) => (
  <SettingsDisclosure
    label={`${name} usage`}
    contentClassName="flex flex-col gap-2 pb-4"
    renderHeader={(disclosureButton) => (
      <SettingsRow className="gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {avatar}
          <SettingsHeadingText as="h3" className="truncate">
            {name}
          </SettingsHeadingText>
        </div>
        {disclosureButton}
      </SettingsRow>
    )}
  >
    {children}
  </SettingsDisclosure>
)

const UsageLoading = () => (
  <SettingsList role="status" aria-label="Loading usage">
    <SettingsRow className="flex-col items-stretch gap-3">
      <SettingsLoadingBars className="gap-3" titleWidth="lg" />
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
  lynvoPlugins: LynvoPlugin[] | null
  userId?: string
}) => {
  const timeBucket = useDailyTimeBucket()
  const availablePlugins = lynvoPlugins ?? []
  const pluginCacheKey = availablePlugins.map((plugin) => plugin.id).join(",")
  const {
    data: snapshot,
    error,
    isLoading,
    retry,
  } = useAsyncResource(
    () => readUsageSnapshot({ lynvoPlugins: availablePlugins }),
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

  const {
    systemEntries: lynvoSystemEntries,
    pluginEntries: lynvoPluginEntries,
  } = partitionUsageEntries(snapshot.lynvo.entries)

  return (
    <div className="flex flex-col gap-7">
      <SettingsPanel className="gap-2">
        <SectionHeading
          title="Built-in Plugin Server usage"
          description="The built-in Plugin Server reports usage for Lynvo Plugins."
          size="base"
        />
        <SettingsList>
          <UsageServerGroup
            name="Lynvo Plugin Server"
            avatar={
              <LynvoPluginServerAvatar
                name="Lynvo Plugin Server"
                className="size-12"
              />
            }
          >
            {lynvoPlugins === null && (
              <SettingsList>
                <SettingsRow>
                  <div className="flex flex-col items-start gap-2">
                    <p className="text-sm text-muted-foreground">
                      Lynvo Plugin Server details couldn’t be loaded. Plugin
                      names and icons may be unavailable.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.reload()}
                    >
                      Reload settings
                    </Button>
                  </div>
                </SettingsRow>
              </SettingsList>
            )}
            <UsageSummary
              label="Lynvo Plugin Server"
              remainingPercent={remainingPercentOfTotal(snapshot.lynvo.total)}
              resetsAt={snapshot.lynvo.resetsAt}
            />
            {lynvoSystemEntries.length > 0 && (
              <div className="flex flex-col">
                {lynvoSystemEntries.map((item) => (
                  <UsageItem {...item} key={item.key} hideIcon compact />
                ))}
              </div>
            )}
            {lynvoPluginEntries.length > 0 && (
              <SettingsList>
                {lynvoPluginEntries.map((item) => (
                  <UsageItem
                    {...item}
                    key={item.key}
                    icon={
                      item.iconKind === "direct" ? DIRECT_MEDIA_ICON : item.icon
                    }
                    hideIcon={item.iconKind === "hidden"}
                  />
                ))}
              </SettingsList>
            )}
          </UsageServerGroup>
        </SettingsList>
      </SettingsPanel>

      {(snapshot.custom.groups.length > 0 ||
        snapshot.custom.failures.length > 0) && (
        <SettingsPanel className="gap-2">
          <SectionHeading
            title="Custom Plugin Server usage"
            description="Each Custom Plugin Server reports the usage it tracks for your account."
            size="base"
          />
          {snapshot.custom.groups.length > 0 && (
            <SettingsList>
              {snapshot.custom.groups.map((group) => {
                const { systemEntries, pluginEntries } = partitionUsageEntries(
                  group.entries
                )

                return (
                  <UsageServerGroup
                    key={group.key}
                    name={group.serverName}
                    avatar={
                      <PluginServerAvatar
                        serverId={group.key}
                        name={group.serverName}
                        className="size-12"
                      />
                    }
                  >
                    <UsageSummary
                      label={group.serverName}
                      limitLabel="Usage limit"
                      remainingPercent={group.remainingPercent}
                      resetsAt={group.resetsAt}
                    />
                    {systemEntries.length > 0 && (
                      <div className="flex flex-col">
                        {systemEntries.map((item) => (
                          <UsageItem
                            {...item}
                            key={item.key}
                            hideIcon
                            compact
                          />
                        ))}
                      </div>
                    )}
                    {pluginEntries.length > 0 && (
                      <SettingsList>
                        {pluginEntries.map((item) => (
                          <UsageItem
                            {...item}
                            key={item.key}
                            hideIcon={false}
                          />
                        ))}
                      </SettingsList>
                    )}
                  </UsageServerGroup>
                )
              })}
            </SettingsList>
          )}
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
