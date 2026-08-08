import { ThreeDViewIcon, Video01Icon } from "@hugeicons/core-free-icons"

export interface PluginIconSource {
  hugeIcon?: typeof ThreeDViewIcon
  url?: string
}

export const DIRECT_MEDIA_ICON: PluginIconSource = {
  hugeIcon: Video01Icon,
}

export const getPluginIconSource = (
  iconUrl?: string
): PluginIconSource | undefined => (iconUrl ? { url: iconUrl } : undefined)
