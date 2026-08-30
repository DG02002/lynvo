import * as React from "react"
import { showErrorToast, showSuccessToast } from "~/lib/toast-notifications"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import type {
  PluginSettingsMutationResult,
  PluginSettingsOperation,
} from "./plugin-settings-interaction"

export interface PluginSettingsRunInput {
  key: string
  operation: () => Promise<PluginSettingsMutationResult>
  messages: { success?: string; failure: string }
  target?: "domain" | "server"
  feedback?: boolean
}

interface UsePluginSettingsOperationsOptions {
  reloadPluginSettings: () => Promise<void>
}

const failureMessage = (cause: unknown, fallback: string) =>
  getUserFacingErrorMessage(cause, fallback)

export const usePluginSettingsOperations = ({
  reloadPluginSettings,
}: UsePluginSettingsOperationsOptions) => {
  const [domainOperations, setDomainOperations] = React.useState<
    Record<string, PluginSettingsOperation>
  >({})
  const [serverOperations, setServerOperations] = React.useState<
    Record<string, PluginSettingsOperation>
  >({})
  const pendingOperationKeysRef = React.useRef(new Set<string>())

  const run = React.useCallback(
    async ({
      key,
      operation,
      messages,
      target = "domain",
      feedback = true,
    }: PluginSettingsRunInput) => {
      if (pendingOperationKeysRef.current.has(key)) {
        return false
      }
      pendingOperationKeysRef.current.add(key)
      const setter =
        target === "domain" ? setDomainOperations : setServerOperations
      setter((current) => ({ ...current, [key]: { status: "pending" } }))
      try {
        const result = await operation()
        if (!result.success) {
          throw new Error(messages.failure)
        }
        await reloadPluginSettings()
        setter((current) => ({ ...current, [key]: { status: "success" } }))
        if (feedback && messages.success) {
          showSuccessToast({ title: messages.success })
        }
        return true
      } catch (error) {
        const message = failureMessage(error, messages.failure)
        setter((current) => ({
          ...current,
          [key]: { status: "error", error: message },
        }))
        if (feedback) {
          showErrorToast({ title: message })
        }
        return false
      } finally {
        pendingOperationKeysRef.current.delete(key)
      }
    },
    [reloadPluginSettings]
  )

  return { domainOperations, serverOperations, run }
}
