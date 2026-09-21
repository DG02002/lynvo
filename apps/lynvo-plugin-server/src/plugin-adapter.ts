import {
  type PluginServerMatcher,
  type PluginCredential,
  type ExtractSuccessResponse,
  type ExtractRequest,
} from "@dg02002/lynvo-plugin-server-protocol"

import { PLUGIN_SERVER_ID, PLUGIN_SERVER_NAME } from "./constants"

export interface PluginAdapterOptions {
  request: ExtractRequest
  targetUrl: string
  plugin: LynvoPluginDefinition
  publicAssetOrigin?: string
}

export interface LynvoPluginDefinition {
  id: string
  displayName: string
  description: string
  homepage: string
  iconPath?: string
  status: "active" | "maintenance" | "degraded" | "down"
  version: string
  matchStrategy?: "static" | "probe"
  matchers?: PluginServerMatcher[]
  credential?: PluginCredential
  discovery?: { confidence: "pattern" | "verified" }
  extract: (options: PluginAdapterOptions) => Promise<ExtractSuccessResponse>
}

export const createPluginResponseMetadata = (
  plugin: LynvoPluginDefinition,
  publicAssetOrigin?: string,
  pageTitle?: string
): ExtractSuccessResponse["plugin"] => {
  const base = {
    pluginServerId: PLUGIN_SERVER_ID,
    displayName: PLUGIN_SERVER_NAME,
    pluginId: plugin.id,
    pluginName: plugin.displayName,
  }
  const withIcon =
    publicAssetOrigin && plugin.iconPath
      ? { ...base, pluginIconUrl: `${publicAssetOrigin}${plugin.iconPath}` }
      : base
  const withTitle = pageTitle ? { ...withIcon, pageTitle } : withIcon
  return withTitle
}
