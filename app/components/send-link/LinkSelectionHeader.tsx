import { HugeiconsIcon } from "@hugeicons/react"
import { AudioWave01Icon, Folder02Icon } from "@hugeicons/core-free-icons"
import { DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { PluginIcon } from "~/components/plugin-icon"

interface LinkSelectionHeaderProps {
  pluginIcon?: string
  pluginName?: string
  pageTitle?: string
  audioInfo?: string
  isDraftMode: boolean
  workerId?: string
  workerName?: string
}

export const LinkSelectionHeader = ({
  pluginIcon,
  pluginName,
  pageTitle,
  audioInfo,
  workerName,
}: LinkSelectionHeaderProps) => {
  const normalizedAudio = audioInfo
    ?.split("|")
    .flatMap((audio) => {
      const trimmedAudio = audio.trim()
      return trimmedAudio ? [trimmedAudio] : []
    })
    .join(", ")

  return (
    <DialogHeader className="z-10 min-w-0 border-b bg-popover p-4 pb-4 text-left md:p-8 md:pb-6 flex flex-col gap-2">
      {(pluginIcon || pluginName) && (
        <div className="mb-4 flex min-w-0 items-center gap-3">
          {pluginIcon || pluginName === "Bhadoo’s Google Drive Index" ? (
            <PluginIcon
              iconUrl={pluginIcon}
              pluginName={pluginName}
              className="size-12 md:size-16"
            />
          ) : (
            <div className="size-12 md:size-16 flex items-center justify-center shrink-0">
              <HugeiconsIcon
                icon={Folder02Icon}
                className="size-6 md:size-8 text-primary"
              />
            </div>
          )}
          <div className="flex min-w-0 flex-col">
            {pluginName && (
              <span className="truncate text-2xl font-normal leading-none">
                {pluginName}
              </span>
            )}
          </div>
        </div>
      )}

      {workerName && (
        <div className="text-sm sm:text-base text-foreground font-normal">
          Via {workerName}
        </div>
      )}

      {pageTitle && (
        <DialogTitle className="line-clamp-2 text-xl font-normal leading-tight text-foreground sm:text-2xl">
          {pageTitle}
        </DialogTitle>
      )}

      {normalizedAudio && (
        <div className="flex items-center gap-2 text-sm font-normal text-foreground sm:text-base">
          <HugeiconsIcon icon={AudioWave01Icon} className="size-5 shrink-0" />
          <span>{normalizedAudio}</span>
        </div>
      )}
    </DialogHeader>
  )
}
