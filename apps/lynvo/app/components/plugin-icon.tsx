import {
  CodesandboxIcon,
  GeometricShapes01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "~/lib/utils"
import { getPluginIconSource, type PluginIconSource } from "~/lib/plugin-icons"

interface PluginIconProps {
  icon?: PluginIconSource
  iconUrl?: string
  fallback?: "extractor" | "source"
  className?: string
}

export const PluginIcon = ({
  icon,
  iconUrl,
  fallback = "source",
  className,
}: PluginIconProps) => {
  const resolvedIcon = icon ?? getPluginIconSource(iconUrl)
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

  return (
    <HugeiconsIcon
      icon={fallback === "extractor" ? CodesandboxIcon : GeometricShapes01Icon}
      className={cn("shrink-0 text-foreground", className)}
      aria-hidden="true"
      data-icon-fallback={fallback}
    />
  )
}
