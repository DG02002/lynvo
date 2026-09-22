export const DAY_MS = 24 * 60 * 60 * 1_000
export const LYNVO_PLUGIN_SERVER_ID = "lynvo:dev.lynvo.plugin-server"

export const isLynvoPluginServerId = (pluginServerId: string | undefined) =>
  pluginServerId === LYNVO_PLUGIN_SERVER_ID
