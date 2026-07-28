import { ThreeDViewIcon } from "@hugeicons/core-free-icons"

export interface PluginIconSource {
  hugeIcon?: typeof ThreeDViewIcon
  url?: string
}

export const getPluginIconSource = (
  iconUrl?: string
): PluginIconSource | undefined => (iconUrl ? { url: iconUrl } : undefined)
