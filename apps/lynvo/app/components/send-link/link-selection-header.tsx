import { AudioWave01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ExpandableFilename } from "~/components/expandable-filename"
import { PluginIcon } from "~/components/plugin-icon"
import { DialogHeader, DialogTitle } from "~/components/ui/dialog"

interface LinkSelectionHeaderProps {
  pluginIcon?: string
  pluginName?: string
  pageTitle?: string
  audioInfo?: string
}

export const LinkSelectionHeader = ({
  pluginIcon,
  pluginName,
  pageTitle,
  audioInfo,
}: LinkSelectionHeaderProps) => {
  const normalizedAudio = audioInfo
    ?.split("|")
    .flatMap((audio) => {
      const trimmedAudio = audio.trim()
      return trimmedAudio ? [trimmedAudio] : []
    })
    .join(", ")

  return (
    <DialogHeader variant="sheet" className="z-10 min-w-0 text-left">
      {(pluginIcon || pluginName) && (
        <div className="mb-4 flex min-w-0 items-center gap-3">
          <PluginIcon iconUrl={pluginIcon} className="size-10 md:size-12" />
          <div className="flex min-w-0 flex-col">
            {pluginName && (
              <span className="truncate text-lg font-normal leading-tight md:text-xl">
                {pluginName}
              </span>
            )}
          </div>
        </div>
      )}

      {pageTitle ? (
        <DialogTitle aria-label={pageTitle} size="quiet">
          <ExpandableFilename value={pageTitle} />
        </DialogTitle>
      ) : (
        <DialogTitle className="sr-only">Select links</DialogTitle>
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
