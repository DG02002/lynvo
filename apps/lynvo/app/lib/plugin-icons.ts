import type { ThreeDViewIcon } from "@hugeicons/core-free-icons"

export interface PluginIconSource {
  hugeIcon?: typeof ThreeDViewIcon
  url?: string
}

export const DIRECT_MEDIA_ICON: PluginIconSource = {
  url: "/lynvo-plugin-server-assets/icons/sources/direct-media.png",
}

export const getPluginIconSource = (
  iconUrl?: string
): PluginIconSource | undefined => (iconUrl ? { url: iconUrl } : undefined)
