import { InformationCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ReactNode } from "react"

import { Button } from "~/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

interface PluginInfoTooltipProps {
  pluginName: string
  description?: string
  version?: string
  usageMultiplier?: number
  proxyCreditUsage?: string
  projectUrl?: string
}

export function PluginInfoTooltip({
  pluginName,
  description,
  version,
  usageMultiplier,
  proxyCreditUsage,
  projectUrl,
}: PluginInfoTooltipProps) {
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
    <Tooltip>
      <TooltipTrigger
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
      </TooltipTrigger>
      <TooltipContent variant="rich">
        {description && <p>{description}</p>}
        {version && <p>Version {version}</p>}
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
      </TooltipContent>
    </Tooltip>
  )
}
