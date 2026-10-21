import * as React from "react"
import {
  isLynvoPluginServerId,
  LYNVO_PLUGIN_SERVER_ID,
} from "~shared/constants"

import { useAsyncResource } from "~/hooks/use-async-resource"
import type { ProxyProviderState } from "~/lib/api-contracts"
import { client } from "~/lib/api/client"
import { isProxyTokenRemoval } from "~/lib/plugin-server-proxy"

import type { CustomPluginServerFormValues } from "./plugin-settings-schemas"
import type { usePluginSettingsOperations } from "./use-plugin-settings-operations"

export interface PluginDomainDraft {
  readonly domain: string
  readonly username: string
  readonly password: string
  readonly isCredentialEnabled: boolean
}

export interface PluginDomain {
  id: string
  pluginServerId: string
  pluginId: string
  domain: string
  hasCredential: boolean
}

export interface CustomPluginServer {
  id: string
  baseUrl: string
  manifest: string
  enabled: boolean
  verificationStatus: string
  proxyEnabled: boolean
  lastManifestRefreshAt?: number | null
}

export interface CreatePluginDomainInput {
  readonly domain: string
  readonly pluginId: string
  readonly username?: string
  readonly password?: string
}

export interface PluginSettingsMutationResult {
  readonly success: boolean
}

export interface PluginSettingsCommands {
  readonly createDomain: (
    input: CreatePluginDomainInput
  ) => Promise<PluginSettingsMutationResult>
  readonly deleteDomain: (
    domainId: string
  ) => Promise<PluginSettingsMutationResult>
  readonly setCredential: (
    domainId: string,
    password: string,
    username?: string
  ) => Promise<PluginSettingsMutationResult>
  readonly createPluginServer: (
    value: CustomPluginServerFormValues
  ) => Promise<PluginSettingsMutationResult>
  readonly deletePluginServer: (
    pluginServerId: string
  ) => Promise<PluginSettingsMutationResult>
  readonly togglePluginServer: (
    pluginServerId: string,
    enabled: boolean
  ) => Promise<PluginSettingsMutationResult>
  readonly refreshPluginServer: (
    pluginServerId: string
  ) => Promise<PluginSettingsMutationResult>
  readonly setProxyProviderKey: (
    token: string
  ) => Promise<PluginSettingsMutationResult>
  readonly togglePluginServerProxy: (
    pluginServerId: string,
    enabled: boolean
  ) => Promise<PluginSettingsMutationResult>
  readonly refreshProxyProviderBalance: () => Promise<PluginSettingsMutationResult>
}

export interface PluginSettingsOperation {
  readonly status: "pending" | "success" | "error"
  readonly error?: string
}

export interface ProxyProviderResource {
  readonly state: ProxyProviderState
  readonly isLoading: boolean
  readonly reload: () => Promise<void>
}

const EMPTY_PLUGIN_SERVERS: readonly CustomPluginServer[] = []
const EMPTY_DOMAINS: readonly PluginDomain[] = []

const NO_PROXY_PROVIDER_STATE: ProxyProviderState = {
  provider: "scrape-do",
  hasKey: false,
  balanceRemaining: null,
  balanceLimit: null,
  balanceCheckedAt: null,
}

const defaultCommands: PluginSettingsCommands = {
  createDomain: async (input) =>
    await client.pluginDomains.create({
      payload: { ...input, pluginServerId: LYNVO_PLUGIN_SERVER_ID },
    }),
  deleteDomain: async (domainId) =>
    await client.pluginDomains.delete({ params: { domainId } }),
  setCredential: async (domainId, password, username) =>
    await client.pluginDomains.setCredential({
      params: { domainId },
      payload: username ? { password, username } : { password },
    }),
  createPluginServer: async (value) =>
    await client.pluginServers.create({ payload: value }),
  deletePluginServer: async (pluginServerId) =>
    await client.pluginServers.delete({ params: { pluginServerId } }),
  togglePluginServer: async (pluginServerId, enabled) =>
    await client.pluginServers.toggle({
      params: { pluginServerId },
      payload: { enabled },
    }),
  refreshPluginServer: async (pluginServerId) =>
    await client.pluginServers.refresh({ params: { pluginServerId } }),
  setProxyProviderKey: async (token) =>
    await client.proxy.setKey({ payload: { token } }),
  togglePluginServerProxy: async (pluginServerId, enabled) =>
    await client.pluginServers.toggleProxy({
      params: { pluginServerId },
      payload: { enabled },
    }),
  refreshProxyProviderBalance: async () => await client.proxy.refreshBalance(),
}

export const usePluginSettingsCommands = (
  overrides?: Partial<PluginSettingsCommands>
): PluginSettingsCommands =>
  React.useMemo(() => ({ ...defaultCommands, ...overrides }), [overrides])

export const usePluginServersResource = (loadData: boolean) => {
  const {
    data: fetchedPluginServers = EMPTY_PLUGIN_SERVERS,
    reload: reloadPluginSettings,
  } = useAsyncResource(
    () =>
      loadData
        ? client.pluginServers.list()
        : Promise.resolve(EMPTY_PLUGIN_SERVERS),
    [loadData]
  )

  return {
    pluginServers: loadData ? fetchedPluginServers : EMPTY_PLUGIN_SERVERS,
    reloadPluginSettings,
  }
}

export const usePluginDomainsResource = (loadData: boolean) => {
  const { data: allDomains = EMPTY_DOMAINS } = useAsyncResource(
    () =>
      loadData ? client.pluginDomains.list() : Promise.resolve(EMPTY_DOMAINS),
    [loadData]
  )

  return React.useMemo(
    () =>
      allDomains.filter((domain) =>
        isLynvoPluginServerId(domain.pluginServerId)
      ),
    [allDomains]
  )
}

export const useProxyProviderResource = (
  loadData: boolean
): ProxyProviderResource => {
  const {
    data: state = NO_PROXY_PROVIDER_STATE,
    isLoading,
    reload,
  } = useAsyncResource(
    () =>
      loadData
        ? client.proxy.state()
        : Promise.resolve(NO_PROXY_PROVIDER_STATE),
    [loadData]
  )
  return { state, isLoading, reload }
}

interface ProxyProviderCommandsInput {
  readonly commands: PluginSettingsCommands
  readonly reloadProxyProvider: () => Promise<void>
  readonly run: ReturnType<typeof usePluginSettingsOperations>["run"]
}

export const useProxyProviderCommands = ({
  commands,
  reloadProxyProvider,
  run,
}: ProxyProviderCommandsInput) => {
  const setProxyProviderKey = React.useCallback(
    async (token: string) => {
      const isRemoving = isProxyTokenRemoval(token)
      const didComplete = await run({
        key: "proxy-key:scrape-do",
        operation: () => commands.setProxyProviderKey(token),
        messages: {
          failure: isRemoving
            ? "The proxy key couldn’t be removed. Try again."
            : "The proxy key couldn’t be saved. Try again.",
        },
        target: "server",
      })
      if (didComplete) {
        await reloadProxyProvider()
      }
      return didComplete
    },
    [commands, reloadProxyProvider, run]
  )

  const refreshProxyProviderBalance = React.useCallback(async () => {
    const didComplete = await run({
      key: "proxy-balance:scrape-do",
      operation: () => commands.refreshProxyProviderBalance(),
      messages: {
        failure: "The proxy balance couldn’t be refreshed. Try again.",
      },
      target: "server",
    })
    if (didComplete) {
      await reloadProxyProvider()
    }
  }, [commands, reloadProxyProvider, run])

  return { setProxyProviderKey, refreshProxyProviderBalance }
}
