import { GoogleDriveIcon } from "@hugeicons/core-free-icons"

export interface PluginIconSource {
  hugeIcon?: typeof GoogleDriveIcon
  url?: string
}

export const BUILT_IN_PLUGIN_ICONS: Readonly<Record<string, PluginIconSource>> =
  {
    "Bhadoo’s Google Drive Index": { hugeIcon: GoogleDriveIcon },
  }

export const getPluginIconSource = (
  pluginName?: string,
  iconUrl?: string
): PluginIconSource | undefined => {
  const builtInIcon = pluginName ? BUILT_IN_PLUGIN_ICONS[pluginName] : undefined
  if (builtInIcon) {
    return builtInIcon
  }

  return iconUrl ? { url: iconUrl } : undefined
}
