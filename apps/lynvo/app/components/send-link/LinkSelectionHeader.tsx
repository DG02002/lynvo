import { HugeiconsIcon } from "@hugeicons/react"
import { AudioWave01Icon } from "@hugeicons/core-free-icons"
import { DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { PluginIcon } from "~/components/plugin-icon"

interface LinkSelectionHeaderProps {
  pluginIcon?: string
  pluginName?: string
  pageTitle?: string
  audioInfo?: string
  isDraftMode: boolean
  pluginServerId?: string
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
          <PluginIcon
            iconUrl={pluginIcon}
            fallback="source"
            className="size-10 md:size-12"
          />
          <div className="flex min-w-0 flex-col">
            {pluginName && (
              <span className="truncate text-lg font-normal leading-tight md:text-xl">
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
        <DialogTitle className="line-clamp-2 text-base font-normal leading-tight text-foreground sm:text-lg">
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
