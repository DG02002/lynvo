import type { RegisteredPluginServer } from "./extraction-types"

export const PLUGIN_SERVER_VERIFICATION_STATUS = {
  down: "down",
  verified: "verified",
} as const

export const isPluginServerUsable = (
  pluginServer: Pick<RegisteredPluginServer, "enabled" | "verificationStatus">
): boolean =>
  pluginServer.enabled &&
  pluginServer.verificationStatus === PLUGIN_SERVER_VERIFICATION_STATUS.verified
