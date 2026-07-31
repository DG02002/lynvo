import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import { Progress } from "~/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "~/components/ui/select"
import { SelectTrigger } from "~/components/select-trigger"
import {
  SettingsPanel,
  SettingsList,
  SettingsRow,
  SettingsRowInfo,
} from "./settings-layout"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import { useMinuteTimeBucket } from "~/lib/use-coarse-time-bucket"
import {
  settingsSelectContentClass,
  settingsSelectTriggerClass,
} from "./settings-layout-classes"
import { client } from "~/lib/effect/api/client"

const STORAGE_USAGE_QUERY_KEY = ["settings", "storage"]

const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ["KB", "MB", "GB"] as const
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const digits = value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[unitIndex]}`
}

export function StorageSettings() {
  const timeBucket = useMinuteTimeBucket()
  const queryClient = useQueryClient()
  const { data: usage } = useQuery({
    queryKey: STORAGE_USAGE_QUERY_KEY,
    queryFn: () => Effect.runPromise(client.settings.getStorageUsage()),
  })
  const [isUpdatingRetention, setIsUpdatingRetention] = React.useState(false)
  const [isClearingRecentCards, setIsClearingRecentCards] =
    React.useState(false)
  const [pendingRetention, setPendingRetention] = React.useState<{
    days: number
    expiredLinkCount: number
  } | null>(null)

  if (!usage) {
    return (
      <SettingsPanel>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-normal text-muted-foreground">
            Loading storage usage…
          </span>
          <Progress value={0} />
        </div>
      </SettingsPanel>
    )
  }

  const usagePercent = (usage.enforcedBytes / usage.storageLimitBytes) * 100
  const progressPercent = Math.min(usagePercent, 100)

  const handleRetentionChange = async (value: string | null) => {
    if (!value) {
      return
    }
    const days = Number(value)
    const preview = await Effect.runPromise(
      client.settings.previewStorageRetention({
        query: { days, timeBucket },
      })
    )
    if (preview.expiredLinkCount > 0) {
      setPendingRetention({ days, expiredLinkCount: preview.expiredLinkCount })
      return
    }
    await applyRetentionChange(days, false)
  }

  const applyRetentionChange = async (
    days: number,
    deleteExpiredLinks: boolean
  ) => {
    setIsUpdatingRetention(true)
    try {
      const result = await Effect.runPromise(
        client.settings.updateStorageRetention({
          payload: { days, deleteExpiredLinks },
        })
      )
      await queryClient.invalidateQueries({ queryKey: STORAGE_USAGE_QUERY_KEY })
      toast.success(
        result.deletedLinks > 0
          ? `Auto-delete period updated. Removed ${result.deletedLinks} old saved links.`
          : "Auto-delete period updated"
      )
      setPendingRetention(null)
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "The auto-delete period couldn’t be updated. Try again."
        )
      )
    } finally {
      setIsUpdatingRetention(false)
    }
  }

  const handleClearRecentCards = async () => {
    setIsClearingRecentCards(true)
    try {
      const result = await Effect.runPromise(client.settings.clearRecentLinks())
      await queryClient.invalidateQueries({ queryKey: STORAGE_USAGE_QUERY_KEY })
      toast.success(
        result.deletedLinks > 0
          ? `Removed ${result.deletedLinks} saved links.`
          : "No saved links to remove"
      )
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "Saved links couldn’t be removed. Try again."
        )
      )
    } finally {
      setIsClearingRecentCards(false)
    }
  }

  return (
    <SettingsPanel>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-normal text-foreground">
            {formatBytes(usage.enforcedBytes)} of{" "}
            {formatBytes(usage.storageLimitBytes)} used
          </span>
          <Progress value={progressPercent} />
          <span className="text-xs text-muted-foreground">
            Saved links, folders, and playback details count toward this limit.
            Account security and connected-device records use approximately{" "}
            {formatBytes(usage.operationalBytes)} of additional storage.
          </span>
        </div>

        <SettingsList>
          <SettingsRow>
            <SettingsRowInfo label="Delete saved links after" />
            <Select
              value={String(usage.retentionDays)}
              onValueChange={handleRetentionChange}
              disabled={isUpdatingRetention}
            >
              <SelectTrigger className={settingsSelectTriggerClass}>
                <SelectValue>{usage.retentionDays} days</SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className={settingsSelectContentClass}>
                <SelectGroup>
                  {usage.retentionDayOptions.map((days) => (
                    <SelectItem key={days} value={String(days)}>
                      {days} days
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow>
            <SettingsRowInfo label="Delete all links" />
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl !border-destructive !text-destructive !bg-transparent !hover:bg-transparent !hover:text-destructive !hover:border-destructive !shadow-none !active:translate-y-0 transition-colors shrink-0 px-4 text-sm font-normal"
                    disabled={
                      isClearingRecentCards || usage.savedLinkCount === 0
                    }
                  >
                    Delete all
                  </Button>
                }
              />
              <AlertDialogContent className="p-10">
                <AlertDialogHeader className="place-items-center gap-4 w-full text-center">
                  <AlertDialogTitle className="w-full px-0 text-center text-2xl font-normal leading-tight sm:px-10 sm:text-3xl">
                    Delete all saved links?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-base text-center text-muted-foreground w-full">
                    This permanently removes every saved link, folder, and
                    playback detail from the account. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-col gap-3 w-full mt-4">
                  <AlertDialogAction
                    onClick={handleClearRecentCards}
                    className="w-full h-12 text-sm rounded-full"
                  >
                    Delete all saved links
                  </AlertDialogAction>
                  <AlertDialogCancel
                    variant="outline"
                    className="w-full h-12 text-sm rounded-full border-muted-foreground/20"
                  >
                    Cancel
                  </AlertDialogCancel>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </SettingsRow>
        </SettingsList>
      </div>
      <AlertDialog
        open={pendingRetention !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRetention(null)
          }
        }}
      >
        <AlertDialogContent className="p-10">
          <AlertDialogHeader className="place-items-center gap-4 w-full text-center">
            <AlertDialogTitle className="w-full px-0 text-center text-2xl font-normal leading-tight sm:px-10 sm:text-3xl">
              Delete older links?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-center text-muted-foreground w-full">
              Changing auto-delete to {pendingRetention?.days} days will
              permanently remove {pendingRetention?.expiredLinkCount} saved{" "}
              {pendingRetention?.expiredLinkCount === 1 ? "link" : "links"}
              from the account. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 w-full mt-4">
            <AlertDialogAction
              onClick={() => {
                if (pendingRetention) {
                  void applyRetentionChange(pendingRetention.days, true)
                }
              }}
              className="w-full h-12 text-sm rounded-full"
            >
              Delete older links
            </AlertDialogAction>
            <AlertDialogCancel
              variant="outline"
              className="w-full h-12 text-sm rounded-full border-muted-foreground/20"
            >
              Cancel
            </AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPanel>
  )
}
