import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import { toast } from "sonner"
import { LYNVO_PLUGIN_SERVER_ID } from "~/lib/constants"
import { client } from "~/lib/effect/api/client"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import { invalidatePluginSettings } from "./plugin-settings-queries"

export interface PluginDomainDraft {
  readonly domain: string
  readonly username: string
  readonly password: string
  readonly isCredentialEnabled: boolean
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
}

export interface PluginSettingsOperation {
  readonly status: "pending" | "success" | "error"
  readonly error?: string
}

export interface UsePluginSettingsInteractionOptions {
  readonly commands?: PluginSettingsCommands
}

const EMPTY_DOMAIN_DRAFT: PluginDomainDraft = {
  domain: "",
  username: "",
  password: "",
  isCredentialEnabled: false,
}

const pluginSettingsCommands: PluginSettingsCommands = {
  createDomain: async (input) =>
    await Effect.runPromise(
      client.pluginDomains.create({
        payload: {
          ...input,
          pluginServerId: LYNVO_PLUGIN_SERVER_ID,
        },
      })
    ),
}

export const usePluginSettingsInteraction = ({
  commands = pluginSettingsCommands,
}: UsePluginSettingsInteractionOptions = {}) => {
  const queryClient = useQueryClient()
  const [domainDrafts, setDomainDrafts] = React.useState<
    Record<string, PluginDomainDraft>
  >({})
  const [domainOperations, setDomainOperations] = React.useState<
    Record<string, PluginSettingsOperation>
  >({})
  const pendingDomainIds = React.useRef(new Set<string>())

  const updateDomainDraft = React.useCallback(
    (pluginId: string, update: Partial<PluginDomainDraft>) => {
      setDomainDrafts((current) => {
        const next = { ...(current[pluginId] ?? EMPTY_DOMAIN_DRAFT), ...update }
        return {
          ...current,
          [pluginId]: next.isCredentialEnabled
            ? next
            : { ...next, username: "", password: "" },
        }
      })
    },
    []
  )

  const addDomain = React.useCallback(
    async (pluginId: string): Promise<boolean> => {
      if (pendingDomainIds.current.has(pluginId)) {
        return false
      }
      const draft = domainDrafts[pluginId] ?? EMPTY_DOMAIN_DRAFT
      const domain = draft.domain.trim()
      if (!domain) {
        return false
      }
      pendingDomainIds.current.add(pluginId)
      setDomainOperations((current) => ({
        ...current,
        [pluginId]: { status: "pending" },
      }))
      try {
        const result = await commands.createDomain({
          domain,
          pluginId,
          ...(draft.username ? { username: draft.username } : {}),
          ...(draft.password ? { password: draft.password } : {}),
        })
        if (!result.success) {
          const error = "Unable to add domain. Check it and try again."
          setDomainOperations((current) => ({
            ...current,
            [pluginId]: { status: "error", error },
          }))
          toast.error(error)
          return false
        }
        await invalidatePluginSettings(queryClient)
        setDomainDrafts((current) => ({
          ...current,
          [pluginId]: EMPTY_DOMAIN_DRAFT,
        }))
        setDomainOperations((current) => ({
          ...current,
          [pluginId]: { status: "success" },
        }))
        toast.success("Plugin domain added")
        return true
      } catch (error) {
        const message = getUserFacingErrorMessage(
          error,
          "The domain couldn’t be added. Check it and try again."
        )
        setDomainOperations((current) => ({
          ...current,
          [pluginId]: { status: "error", error: message },
        }))
        toast.error(message)
        return false
      } finally {
        pendingDomainIds.current.delete(pluginId)
      }
    },
    [commands, domainDrafts, queryClient]
  )

  return { domainDrafts, domainOperations, updateDomainDraft, addDomain }
}
