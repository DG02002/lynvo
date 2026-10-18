import * as React from "react"
import {
  isLynvoPluginServerId,
  LYNVO_PLUGIN_SERVER_ID,
} from "~shared/constants"

import { clearDismissedPluginDomainSuggestion } from "~/features/links/saved-link-interaction"
import { useAsyncResource } from "~/hooks/use-async-resource"
import type { ProxyProviderState } from "~/lib/api-contracts"
import { client } from "~/lib/api/client"
import { normalizePluginDomain } from "~/lib/plugin-domain"
import { isProxyTokenRemoval } from "~/lib/plugin-server-proxy"

import type { CustomPluginServerFormValues } from "./plugin-settings-schemas"
import { usePluginDomainDrafts } from "./use-plugin-domain-drafts"
import { usePluginSettingsOperations } from "./use-plugin-settings-operations"

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

interface CreatePluginDomainInput {
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
  readonly deleteCredential: (
    domainId: string
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

export interface UsePluginSettingsInteractionOptions {
  readonly commands?: Partial<PluginSettingsCommands>
  readonly loadData?: boolean
  readonly now?: () => number
}

const EMPTY_PLUGIN_SERVERS: readonly CustomPluginServer[] = []
const EMPTY_DOMAINS: readonly PluginDomain[] = []
const MANIFEST_FRESHNESS_MS = 15 * 60 * 1000
const NO_PROXY_PROVIDER_STATE: ProxyProviderState = {
  provider: "scrape-do",
  hasKey: false,
  balanceRemaining: null,
  balanceLimit: null,
  balanceCheckedAt: null,
}

interface ProxyProviderResource {
  readonly state: ProxyProviderState
  readonly isLoading: boolean
  readonly reload: () => Promise<void>
}

const useProxyProviderResource = (loadData: boolean): ProxyProviderResource => {
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

interface ProxyProviderCommandsInput {
  readonly commands: PluginSettingsCommands
  readonly reloadProxyProvider: () => Promise<void>
  readonly run: ReturnType<typeof usePluginSettingsOperations>["run"]
}

const useProxyProviderCommands = ({
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
          success: isRemoving ? "Proxy key removed" : "Proxy key saved",
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
        success: "Proxy balance refreshed",
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
  deleteCredential: async (domainId) =>
    await client.pluginDomains.deleteCredential({ params: { domainId } }),
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

export const usePluginSettingsInteraction = ({
  commands: overrides,
  loadData = true,
  now = Date.now,
}: UsePluginSettingsInteractionOptions = {}) => {
  const commands = React.useMemo(
    () => ({ ...defaultCommands, ...overrides }),
    [overrides]
  )
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
  const { data: allDomains = EMPTY_DOMAINS } = useAsyncResource(
    () =>
      loadData ? client.pluginDomains.list() : Promise.resolve(EMPTY_DOMAINS),
    [loadData]
  )
  const {
    state: proxyProvider,
    isLoading: proxyProviderIsLoading,
    reload: reloadProxyProvider,
  } = useProxyProviderResource(loadData)
  const pluginServers = loadData ? fetchedPluginServers : EMPTY_PLUGIN_SERVERS
  const domains = React.useMemo(
    () =>
      allDomains.filter((domain) =>
        isLynvoPluginServerId(domain.pluginServerId)
      ),
    [allDomains]
  )
  const { domainDrafts, updateDomainDraft, clearDomainDraft, getDomainDraft } =
    usePluginDomainDrafts()
  const { domainOperations, serverOperations, run } =
    usePluginSettingsOperations({ reloadPluginSettings })

  const addDomain = React.useCallback(
    async (pluginId: string) => {
      const draft = getDomainDraft(pluginId)
      const domain = draft.domain.trim()
      if (!domain) {
        return false
      }
      const didAdd = await run({
        key: pluginId,
        operation: () => {
          let input: CreatePluginDomainInput = { domain, pluginId }
          if (draft.username) {
            input = { ...input, username: draft.username }
          }
          if (draft.password) {
            input = { ...input, password: draft.password }
          }
          return commands.createDomain(input)
        },
        messages: {
          success: "Plugin domain added",
          failure: "The domain couldn’t be added. Check it and try again.",
        },
      })
      if (didAdd) {
        clearDismissedPluginDomainSuggestion({
          domain: normalizePluginDomain(domain),
          pluginId,
          pluginServerId: LYNVO_PLUGIN_SERVER_ID,
        })
        clearDomainDraft(pluginId)
      }
      return didAdd
    },
    [clearDomainDraft, commands, getDomainDraft, run]
  )

  const handleDeleteDomain = React.useCallback(
    async (domainId: string) => {
      const domain = domains.find((item) => item.id === domainId)
      const didDelete = await run({
        key: domainId,
        operation: () => commands.deleteDomain(domainId),
        messages: {
          success: "Plugin domain removed",
          failure: "The domain couldn’t be removed. Try again.",
        },
      })
      if (didDelete && domain) {
        clearDismissedPluginDomainSuggestion(domain)
      }
    },
    [commands, domains, run]
  )
  const handleSetDomainCredential = React.useCallback(
    async (domainId: string, password: string, username?: string) =>
      await run({
        key: domainId,
        operation: () => commands.setCredential(domainId, password, username),
        messages: {
          success: "Plugin password saved",
          failure: "The Plugin password couldn’t be saved. Try again.",
        },
      }),
    [commands, run]
  )
  const handleDeleteDomainCredential = React.useCallback(
    async (domainId: string) => {
      await run({
        key: domainId,
        operation: () => commands.deleteCredential(domainId),
        messages: {
          success: "Plugin password removed",
          failure: "The Plugin password couldn’t be removed. Try again.",
        },
      })
    },
    [commands, run]
  )
  const handleAddPluginServer = React.useCallback(
    async (value: CustomPluginServerFormValues) => {
      const key = `create:${value.baseUrl}`
      const didAdd = await run({
        key,
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

  const { setProxyProviderKey, refreshProxyProviderBalance } =
    useProxyProviderCommands({ commands, reloadProxyProvider, run })

  const handleTogglePluginServerProxy = React.useCallback(
    async (id: string, enabled: boolean) => {
      await run({
        key: `proxy-toggle:${id}`,
        operation: () => commands.togglePluginServerProxy(id, !enabled),
        messages: {
          success: enabled ? "Proxy disabled" : "Proxy enabled",
          failure: "The proxy setting couldn’t be updated. Try again.",
        },
        target: "server",
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
    proxyProvider,
    proxyProviderIsLoading,
    reloadProxyProvider,
    domains,
    domainDrafts,
    domainOperations,
    serverOperations,
    updateDomainDraft,
    addDomain,
    handleDeleteDomain,
    handleSetDomainCredential,
    handleDeleteDomainCredential,
    handleAddPluginServer,
    handleDeletePluginServer,
    handleRefreshPluginServer,
    setProxyProviderKey,
    handleTogglePluginServerProxy,
    refreshProxyProviderBalance,
    handleTogglePluginServer,
  }
}
