import { InformationCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ReactNode } from "react"

import { Button } from "~/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
import { cn } from "~/lib/utils"

interface PluginInfoPopoverProps {
  pluginName: string
  description?: string
  version?: string
  usageMultiplier?: number
  proxyCreditUsage?: string
  projectUrl?: string
}

export function PluginInfoPopover({
  pluginName,
  description,
  version,
  usageMultiplier,
  proxyCreditUsage,
  projectUrl,
}: PluginInfoPopoverProps) {
  const hasUsageHint = usageMultiplier !== undefined && usageMultiplier > 1
  if (
    !description &&
    !version &&
    !hasUsageHint &&
    !proxyCreditUsage &&
    !projectUrl
  ) {
    return null
  }

  let usageHint: ReactNode = null
  if (proxyCreditUsage) {
    usageHint = <p>Proxy usage: {proxyCreditUsage}</p>
  } else if (hasUsageHint) {
    usageHint = <p>Might use up to {usageMultiplier}x usage per extraction</p>
  }

  return (
    <Popover>
      <PopoverTrigger
        // Touch has no hover: the popover stays a tap target there while
        // pointer users keep the familiar hover reveal.
        openOnHover
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`${pluginName} info`}
            className="shrink-0"
          />
        }
      >
        <HugeiconsIcon
          icon={InformationCircleIcon}
          className={cn(
            "size-4",
            hasUsageHint
              ? "text-warning-foreground"
              : "text-muted-foreground group-hover/button:text-foreground"
          )}
        />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64">
        <div className="flex min-w-0 flex-col gap-1">
          {description && <p>{description}</p>}
          {version && (
            <p className="text-muted-foreground">Version {version}</p>
          )}
          {usageHint}
          {projectUrl && (
            <a
              href={projectUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all font-medium underline underline-offset-2"
            >
              {projectUrl}
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
