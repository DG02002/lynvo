import * as React from "react"

import {
  usePluginServersResource,
  usePluginSettingsCommands,
  useProxyProviderCommands,
  useProxyProviderResource,
  type PluginSettingsCommands,
} from "./plugin-settings-interaction"
import { usePluginSettingsOperations } from "./use-plugin-settings-operations"

interface UseProxySettingsOptions {
  readonly commands?: Partial<PluginSettingsCommands>
  readonly loadData?: boolean
}

export const useProxySettings = ({
  commands: commandOverrides,
  loadData = true,
}: UseProxySettingsOptions = {}) => {
  const commands = usePluginSettingsCommands(commandOverrides)
  const { pluginServers, reloadPluginSettings } =
    usePluginServersResource(loadData)
  const {
    state: proxyProvider,
    isLoading: proxyProviderIsLoading,
    reload: reloadProxyProvider,
  } = useProxyProviderResource(loadData)
  const { serverOperations, run } = usePluginSettingsOperations({
    reloadPluginSettings,
  })
  const { setProxyProviderKey, refreshProxyProviderBalance } =
    useProxyProviderCommands({ commands, reloadProxyProvider, run })

  const handleTogglePluginServerProxy = React.useCallback(
    async (id: string, enabled: boolean) => {
      await run({
        key: `proxy-toggle:${id}`,
        operation: () => commands.togglePluginServerProxy(id, !enabled),
        messages: {
          failure: "The proxy setting couldn’t be updated. Try again.",
        },
        target: "server",
      })
    },
    [commands, run]
  )

  return {
    pluginServers,
    proxyProvider,
    proxyProviderIsLoading,
    setProxyProviderKey,
    handleTogglePluginServerProxy,
    refreshProxyProviderBalance,
    serverOperations,
  }
}
