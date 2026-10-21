import * as React from "react"

import {
  usePluginServersResource,
  usePluginSettingsCommands,
  type CustomPluginServer,
  type PluginSettingsCommands,
} from "./plugin-settings-interaction"
import type { CustomPluginServerFormValues } from "./plugin-settings-schemas"
import { usePluginSettingsOperations } from "./use-plugin-settings-operations"

const MANIFEST_FRESHNESS_MS = 15 * 60 * 1000

interface StaleManifestRefreshInput {
  readonly loadData: boolean
  readonly now: () => number
  readonly pluginServers: readonly CustomPluginServer[]
  readonly refreshPluginServer: (
    id: string,
    feedback?: boolean
  ) => Promise<void>
}

const useStaleManifestRefresh = ({
  loadData,
  now,
  pluginServers,
  refreshPluginServer,
}: StaleManifestRefreshInput): void => {
  React.useEffect(() => {
    if (!loadData) {
      return
    }
    for (const server of pluginServers) {
      const stale =
        !server.lastManifestRefreshAt ||
        now() - server.lastManifestRefreshAt >= MANIFEST_FRESHNESS_MS
      if (stale || server.verificationStatus !== "verified") {
        void refreshPluginServer(server.id, false)
      }
    }
  }, [loadData, now, pluginServers, refreshPluginServer])
}

export interface UsePluginServerSettingsOptions {
  readonly commands?: Partial<PluginSettingsCommands>
  readonly loadData?: boolean
  readonly now?: () => number
}

export const usePluginServerSettings = ({
  commands: commandOverrides,
  loadData = true,
  now = Date.now,
}: UsePluginServerSettingsOptions = {}) => {
  const commands = usePluginSettingsCommands(commandOverrides)
  const { pluginServers, reloadPluginSettings } =
    usePluginServersResource(loadData)
  const { serverOperations, run } = usePluginSettingsOperations({
    reloadPluginSettings,
  })

  const handleAddPluginServer = React.useCallback(
    async (value: CustomPluginServerFormValues) => {
      const didAdd = await run({
        key: `create:${value.baseUrl}`,
        operation: () => commands.createPluginServer(value),
        messages: {
          success: "Plugin server added",
          failure:
            "The Plugin Server couldn’t be added. Check its details and try again.",
        },
        target: "server",
      })
      return didAdd
        ? null
        : "The Plugin Server couldn’t be added. Check its details and try again."
    },
    [commands, run]
  )

  const handleDeletePluginServer = React.useCallback(
    async (id: string) => {
      await run({
        key: id,
        operation: () => commands.deletePluginServer(id),
        messages: {
          success: "Plugin server deleted",
          failure: "The Plugin Server couldn’t be deleted. Try again.",
        },
        target: "server",
      })
    },
    [commands, run]
  )

  const handleTogglePluginServer = React.useCallback(
    async (id: string, enabled: boolean) => {
      await run({
        key: id,
        operation: () => commands.togglePluginServer(id, !enabled),
        messages: {
          success: enabled ? undefined : "Plugin server enabled",
          failure: "The Plugin Server couldn’t be updated. Try again.",
        },
        target: "server",
      })
    },
    [commands, run]
  )

  const handleRefreshPluginServer = React.useCallback(
    async (id: string, feedback = true) => {
      await run({
        key: `refresh:${id}`,
        operation: () => commands.refreshPluginServer(id),
        messages: {
          success: "Plugin server manifest refreshed",
          failure: "The Plugin Server couldn’t be refreshed. Try again.",
        },
        target: "server",
        feedback,
      })
    },
    [commands, run]
  )

  useStaleManifestRefresh({
    loadData,
    now,
    pluginServers,
    refreshPluginServer: handleRefreshPluginServer,
  })

  return {
    pluginServers,
    reloadPluginSettings,
    serverOperations: serverOperations,
    handleAddPluginServer,
    handleDeletePluginServer,
    handleRefreshPluginServer,
    handleTogglePluginServer,
  }
}
