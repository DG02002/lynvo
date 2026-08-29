import type { ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { InformationCircleIcon } from "@hugeicons/core-free-icons"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"

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
            className={
              hasUsageHint
                ? "inline-flex shrink-0 items-center justify-center text-yellow-500 transition-colors hover:text-yellow-600 focus-visible:outline-none dark:text-yellow-400 dark:hover:text-yellow-300"
                : "inline-flex shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
            }
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
