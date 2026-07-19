import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "~/lib/utils"
import { getPluginIconSource, type PluginIconSource } from "~/lib/plugin-icons"

interface PluginIconProps {
  icon?: PluginIconSource
  iconUrl?: string
  pluginName?: string
  className?: string
}

export const PluginIcon = ({
  icon,
  iconUrl,
  pluginName,
  className,
}: PluginIconProps) => {
  const resolvedIcon = icon ?? getPluginIconSource(pluginName, iconUrl)
  if (resolvedIcon?.hugeIcon) {
    return (
      <HugeiconsIcon
        icon={resolvedIcon.hugeIcon}
        className={cn("shrink-0", className)}
        aria-hidden="true"
      />
    )
  }

  if (resolvedIcon?.url) {
    return (
      <img
        src={resolvedIcon.url}
        alt=""
        className={cn("shrink-0 object-contain", className)}
        loading="lazy"
      />
    )
  }

  return null
}
