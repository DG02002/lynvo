import { bhadooGoogleDriveIndexPlugin } from "./bhadoo-google-drive-index"
import { onedriveIndexPlugin } from "./onedrive-index"
import { nativeDirectLinkPlugin } from "./direct"
import type { Plugin } from "./types"

export const plugins = [bhadooGoogleDriveIndexPlugin, onedriveIndexPlugin]

export const getPluginById = (pluginId: string): Plugin | undefined =>
  plugins.find((plugin) => plugin.id === pluginId)

export async function getPluginForUrl(url: string): Promise<Plugin> {
  const results = await Promise.all(
    plugins.map(async (plugin) => ({
      plugin,
      canHandle: await plugin.canHandle(url),
    }))
  )

  const match = results.find((r) => r.canHandle)
  return match ? match.plugin : nativeDirectLinkPlugin
}
