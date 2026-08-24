import * as React from "react"
import { Alert01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"
import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
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
import {
  clearSavedLinksOverHttp,
  previewStorageRetention,
  readStorageSettings,
  updateStorageRetention,
} from "~/lib/settings/storage-http"
import { useMinuteTimeBucket } from "~/lib/use-coarse-time-bucket"
import {
  settingsSelectContentClass,
  settingsSelectTriggerClass,
} from "./settings-layout-classes"
import { useAsyncResource } from "~/hooks/use-async-resource"

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
  const { data: usage, reload } = useAsyncResource(
    () => readStorageSettings(),
    [timeBucket]
  )
  const [isUpdatingRetention, setIsUpdatingRetention] = React.useState(false)
  const [isClearingLinks, setIsClearingLinks] = React.useState(false)
  const [isClearLinksDialogOpen, setIsClearLinksDialogOpen] =
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
    const preview = await previewStorageRetention(days)
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
      const result = await updateStorageRetention({ days, deleteExpiredLinks })
      await reload()
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

  const handleClearLinks = async () => {
    setIsClearingLinks(true)
    try {
      const result = await clearSavedLinksOverHttp()
      await reload()
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
      setIsClearingLinks(false)
    }
  }

  return (
    <SettingsPanel>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-normal tabular-nums text-foreground">
            {formatBytes(usage.enforcedBytes)} of{" "}
            {formatBytes(usage.storageLimitBytes)} used
          </span>
          <Progress value={progressPercent} />
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
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl !border-destructive !text-destructive !bg-transparent !hover:bg-transparent !hover:text-destructive !hover:border-destructive !shadow-none !active:translate-y-0 transition-colors shrink-0 px-4 text-sm font-normal"
              disabled={isClearingLinks || usage.savedLinkCount === 0}
              onClick={() => setIsClearLinksDialogOpen(true)}
            >
              Delete all
            </Button>
          </SettingsRow>
        </SettingsList>
      </div>
      <ConfirmationAlertDialog
        open={isClearLinksDialogOpen}
        onOpenChange={setIsClearLinksDialogOpen}
        title="Delete all saved links?"
        media={
          <HugeiconsIcon
            icon={Alert01Icon}
            className="mx-auto size-16 text-destructive"
          />
        }
        description="This permanently removes every saved link and its extracted link data from the account. This cannot be undone."
        confirmLabel={
          isClearingLinks ? "Deleting saved links…" : "Delete all saved links"
        }
        confirmVariant="destructive"
        disabled={isClearingLinks}
        onConfirm={() => void handleClearLinks()}
      />
      <ConfirmationAlertDialog
        open={pendingRetention !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRetention(null)
          }
        }}
        title="Delete older links?"
        description={
          <>
            Changing auto-delete to {pendingRetention?.days} days will
            permanently remove {pendingRetention?.expiredLinkCount} saved{" "}
            {pendingRetention?.expiredLinkCount === 1 ? "link" : "links"} from
            the account. This cannot be undone.
          </>
        }
        confirmLabel={
          isUpdatingRetention ? "Deleting older links…" : "Delete older links"
        }
        confirmVariant="destructive"
        disabled={isUpdatingRetention}
        onConfirm={() => {
          if (pendingRetention) {
            void applyRetentionChange(pendingRetention.days, true)
          }
        }}
      />
    </SettingsPanel>
  )
}
