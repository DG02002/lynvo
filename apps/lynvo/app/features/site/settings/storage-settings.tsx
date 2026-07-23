import * as React from "react"
import { useConvex, useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { api } from "../../../../convex/_generated/api"
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
  const convex = useConvex()
  const usage = useQuery(api.users.getStorageUsage, {})
  const updateRetentionDays = useMutation(api.users.updateStorageRetentionDays)
  const clearRecentCards = useMutation(api.users.clearRecentCards)
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
            Loading storage usage
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
    const preview = await convex.query(api.users.previewStorageRetentionDays, {
      days,
      timeBucket,
    })
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
      const result = await updateRetentionDays({ days, deleteExpiredLinks })
      toast.success(
        result.deletedLinks > 0
          ? `Auto-delete window updated. Removed ${result.deletedLinks} old recent cards.`
          : "Auto-delete window updated"
      )
      setPendingRetention(null)
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(error, "Could not update auto-delete window")
      )
    } finally {
      setIsUpdatingRetention(false)
    }
  }

  const handleClearRecentCards = async () => {
    setIsClearingRecentCards(true)
    try {
      const result = await clearRecentCards({})
      toast.success(
        result.deletedLinks > 0
          ? `Removed ${result.deletedLinks} recent cards.`
          : "No recent cards to remove"
      )
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(error, "Could not remove recent cards")
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
            App-managed storage is quota-enforced. Authentication and device
            records use an additional estimated{" "}
            {formatBytes(usage.operationalBytes)}.
          </span>
        </div>

        <SettingsList>
          <SettingsRow>
            <SettingsRowInfo label="Auto-delete recent cards older than" />
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
                    Clear history?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-base text-center text-muted-foreground w-full">
                    This will remove all recent links from your history. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-col gap-3 w-full mt-4">
                  <AlertDialogAction
                    onClick={handleClearRecentCards}
                    className="w-full h-12 text-sm rounded-full"
                  >
                    Clear History
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
              Changing auto-delete to {pendingRetention?.days} days will remove{" "}
              {pendingRetention?.expiredLinkCount} older recent{" "}
              {pendingRetention?.expiredLinkCount === 1 ? "card" : "cards"} from
              your account. This action cannot be undone.
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
              Delete Older Links
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
