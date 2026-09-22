import { InformationCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ReactNode } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

import { settingsWarningTextClass } from "./settings-layout-classes"

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
          <button
            type="button"
            aria-label={`${pluginName} info`}
            className={cn(
              "inline-flex shrink-0 items-center justify-center transition-colors focus-visible:outline-none",
              hasUsageHint
                ? cn(
                    settingsWarningTextClass,
                    "hover:text-yellow-900 dark:hover:text-yellow-100"
                  )
                : "text-muted-foreground hover:text-foreground"
            )}
          />
        }
      >
        <HugeiconsIcon icon={InformationCircleIcon} className="size-4" />
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-1 py-2 text-left">
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
