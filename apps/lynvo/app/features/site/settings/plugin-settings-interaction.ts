import * as React from "react"
import { Effect } from "effect"
import { LYNVO_PLUGIN_SERVER_ID } from "~/lib/constants"
import { client } from "~/lib/effect/api/client"
import { useAsyncResource } from "~/hooks/use-async-resource"
import { usePluginDomainDrafts } from "./use-plugin-domain-drafts"
import { usePluginSettingsOperations } from "./use-plugin-settings-operations"
import type { CustomPluginServerFormValues } from "./plugin-settings-schemas"

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
  hasProxyKey: boolean
  proxyBalanceRemaining?: number | null
  proxyBalanceLimit?: number | null
  lastManifestRefreshAt?: number | null
}

export interface ProxyKeyMutationResult {
  readonly remaining: number | null
  readonly limit: number | null
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
  readonly setPluginServerProxyKey: (
    pluginServerId: string,
    token: string
  ) => Promise<PluginSettingsMutationResult & ProxyKeyMutationResult>
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

const defaultCommands: PluginSettingsCommands = {
  createDomain: async (input) =>
    await Effect.runPromise(
      client.pluginDomains.create({
        payload: { ...input, pluginServerId: LYNVO_PLUGIN_SERVER_ID },
      })
    ),
  deleteDomain: async (domainId) =>
    await Effect.runPromise(
      client.pluginDomains.delete({ params: { domainId } })
    ),
  setCredential: async (domainId, password, username) =>
    await Effect.runPromise(
      client.pluginDomains.setCredential({
        params: { domainId },
        payload: username ? { password, username } : { password },
      })
    ),
  deleteCredential: async (domainId) =>
    await Effect.runPromise(
      client.pluginDomains.deleteCredential({ params: { domainId } })
    ),
  createPluginServer: async (value) =>
    await Effect.runPromise(client.pluginServers.create({ payload: value })),
  deletePluginServer: async (pluginServerId) =>
    await Effect.runPromise(
      client.pluginServers.delete({ params: { pluginServerId } })
    ),
  togglePluginServer: async (pluginServerId, enabled) =>
    await Effect.runPromise(
      client.pluginServers.toggle({
        params: { pluginServerId },
        payload: { enabled },
      })
    ),
  refreshPluginServer: async (pluginServerId) =>
    await Effect.runPromise(
      client.pluginServers.refresh({ params: { pluginServerId } })
    ),
  setPluginServerProxyKey: async (pluginServerId, token) =>
    await Effect.runPromise(
      client.pluginServers.setProxyKey({
        params: { pluginServerId },
        payload: { token },
      })
    ),
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
        ? Effect.runPromise(client.pluginServers.list())
        : Promise.resolve(EMPTY_PLUGIN_SERVERS),
    [loadData]
  )
  const { data: allDomains = EMPTY_DOMAINS } = useAsyncResource(
    () =>
      loadData
        ? Effect.runPromise(client.pluginDomains.list({}))
        : Promise.resolve(EMPTY_DOMAINS),
    [loadData]
  )
  const pluginServers = loadData ? fetchedPluginServers : EMPTY_PLUGIN_SERVERS
  const domains = React.useMemo(
    () =>
      allDomains.filter(
        (domain) => domain.pluginServerId === LYNVO_PLUGIN_SERVER_ID
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
        clearDomainDraft(pluginId)
      }
      return didAdd
    },
    [clearDomainDraft, commands, getDomainDraft, run]
  )

  const handleDeleteDomain = React.useCallback(
    async (domainId: string) => {
      await run({
        key: domainId,
        operation: () => commands.deleteDomain(domainId),
        messages: {
          success: "Plugin domain removed",
          failure: "The domain couldn’t be removed. Try again.",
        },
      })
    },
    [commands, run]
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

  const handleSetPluginServerProxyKey = React.useCallback(
    async (id: string, token: string) => {
      const balance = await run({
        key: `proxy-key:${id}`,
        operation: () => commands.setPluginServerProxyKey(id, token),
        messages: {
          success:
            token.trim() === "" ? "Proxy key removed" : "Proxy key saved",
          failure: "The proxy key couldn’t be saved. Try again.",
        },
        target: "server",
      })
      return balance
    },
    [commands, run]
  )

  React.useEffect(() => {
    if (!loadData) {
      return
    }
    for (const server of pluginServers) {
      const stale =
        !server.lastManifestRefreshAt ||
        now() - server.lastManifestRefreshAt >= MANIFEST_FRESHNESS_MS
      if (stale || server.verificationStatus !== "verified") {
        void handleRefreshPluginServer(server.id, false)
      }
    }
  }, [handleRefreshPluginServer, loadData, now, pluginServers])

  return {
    pluginServers,
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
    handleSetPluginServerProxyKey,
    handleTogglePluginServer,
  }
}
