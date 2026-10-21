import * as React from "react"
import { LYNVO_PLUGIN_SERVER_ID } from "~shared/constants"

import { clearDismissedPluginDomainSuggestion } from "~/features/links/saved-link-interaction"
import { normalizePluginDomain } from "~/lib/plugin-domain"

import {
  usePluginDomainsResource,
  usePluginSettingsCommands,
  type CreatePluginDomainInput,
  type PluginSettingsCommands,
} from "./plugin-settings-interaction"
import { usePluginDomainDrafts } from "./use-plugin-domain-drafts"
import { usePluginSettingsOperations } from "./use-plugin-settings-operations"

interface UsePluginDomainSettingsOptions {
  readonly commands?: Partial<PluginSettingsCommands>
  readonly loadData?: boolean
  readonly reloadPluginSettings?: () => Promise<void>
}

export const usePluginDomainSettings = ({
  commands: commandOverrides,
  loadData = true,
  reloadPluginSettings = async () => {},
}: UsePluginDomainSettingsOptions = {}) => {
  const commands = usePluginSettingsCommands(commandOverrides)
  const domains = usePluginDomainsResource(loadData)
  const { domainDrafts, updateDomainDraft, clearDomainDraft, getDomainDraft } =
    usePluginDomainDrafts()
  const { domainOperations, run } = usePluginSettingsOperations({
    reloadPluginSettings,
  })

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
          let input: CreatePluginDomainInput = {
            domain,
            pluginId,
          }
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

  return {
    domains,
    domainDrafts,
    domainOperations,
    updateDomainDraft,
    addDomain,
    handleDeleteDomain,
    handleSetDomainCredential,
  }
}
