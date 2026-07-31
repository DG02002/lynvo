import * as React from "react"
import { Effect } from "effect"
import { toast } from "sonner"
import { client } from "~/lib/effect/api/client"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import type { CustomPluginServerFormValues } from "./plugin-settings-schemas"
import { LYNVO_PLUGIN_SERVER_ID } from "~/lib/constants"

interface MutationResult {
  success: boolean
}

const showMutationToast = (
  result: MutationResult,
  successMessage: string,
  errorMessage: string
) => {
  if (result.success) {
    toast.success(successMessage)
    return true
  }

  toast.error(errorMessage)
  return false
}

const getErrorMessage = (error: unknown, fallback: string) =>
  getUserFacingErrorMessage(error, fallback)

const handleDeleteDomain = async (domainId: string) => {
  try {
    const data = await Effect.runPromise(
      client.pluginDomains.delete({
        params: { domainId },
      })
    )
    showMutationToast(
      data,
      "Plugin domain removed",
      "Unable to remove domain. Try again."
    )
  } catch (error) {
    toast.error(
      getErrorMessage(error, "The domain couldn’t be removed. Try again.")
    )
  }
}

const handleDeletePluginServer = async (pluginServerId: string) => {
  try {
    const data = await Effect.runPromise(
      client.pluginServers.delete({
        params: { pluginServerId },
      })
    )
    showMutationToast(
      data,
      "Plugin server deleted",
      "Unable to delete plugin server. Try again."
    )
  } catch (error) {
    toast.error(
      getErrorMessage(
        error,
        "The Plugin Server couldn’t be deleted. Try again."
      )
    )
  }
}

const handleAddPluginServer = async (value: CustomPluginServerFormValues) => {
  try {
    const data = await Effect.runPromise(
      client.pluginServers.create({
        payload: value,
      })
    )
    if (
      showMutationToast(
        data,
        "Plugin server added",
        "Unable to add plugin server. Check its details and try again."
      )
    ) {
      return null
    }
    return "Unable to add plugin server. Check its details and try again."
  } catch (error) {
    const message = getErrorMessage(
      error,
      "The Plugin Server couldn’t be added. Check its details and try again."
    )
    toast.error(message)
    return message
  }
}

const handleSetDomainCredential = async (
  domainId: string,
  password: string,
  username?: string
) => {
  try {
    const data = await Effect.runPromise(
      client.pluginDomains.setCredential({
        params: { domainId },
        payload: { password, ...(username ? { username } : {}) },
      })
    )
    return showMutationToast(
      data,
      "Plugin password saved",
      "Unable to save plugin password. Try again."
    )
  } catch (error) {
    toast.error(
      getErrorMessage(
        error,
        "The Plugin password couldn’t be saved. Try again."
      )
    )
    return false
  }
}

const handleDeleteDomainCredential = async (domainId: string) => {
  try {
    const data = await Effect.runPromise(
      client.pluginDomains.deleteCredential({ params: { domainId } })
    )
    showMutationToast(
      data,
      "Plugin password removed",
      "Unable to remove plugin password. Try again."
    )
  } catch (error) {
    toast.error(
      getErrorMessage(
        error,
        "The Plugin password couldn’t be removed. Try again."
      )
    )
  }
}

const handleTogglePluginServer = async (
  pluginServerId: string,
  currentEnabled: boolean
) => {
  try {
    const data = await Effect.runPromise(
      client.pluginServers.toggle({
        params: { pluginServerId },
        payload: { enabled: !currentEnabled },
      })
    )
    if (!data.success) {
      toast.error("Unable to update plugin server. Try again.")
    } else if (!currentEnabled) {
      toast.success("Plugin server enabled")
    }
  } catch (error) {
    toast.error(
      getErrorMessage(
        error,
        "The Plugin Server couldn’t be updated. Try again."
      )
    )
  }
}

const handleRefreshPluginServer = async (
  pluginServerId: string,
  showFeedback = true
) => {
  try {
    const data = await Effect.runPromise(
      client.pluginServers.refresh({
        params: { pluginServerId },
      })
    )
    if (showFeedback) {
      showMutationToast(
        data,
        "Plugin server manifest refreshed",
        "Unable to refresh plugin server. Try again."
      )
    }
  } catch (error) {
    if (showFeedback) {
      toast.error(
        getErrorMessage(
          error,
          "The Plugin Server couldn’t be refreshed. Try again."
        )
      )
    }
  }
}

export const usePluginSettingsActions = ({
  domainInputs,
  setDomainInputs,
  passwordInputs,
  setPasswordInputs,
  usernameInputs,
  setUsernameInputs,
  setPasswordProtectedInputs,
}: {
  domainInputs: Record<string, string>
  setDomainInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>
  passwordInputs: Record<string, string>
  setPasswordInputs: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >
  usernameInputs: Record<string, string>
  setUsernameInputs: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >
  setPasswordProtectedInputs: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >
}) => {
  const [addingDomainFor, setAddingDomainFor] = React.useState<string | null>(
    null
  )
  const [domainErrors, setDomainErrors] = React.useState<
    Record<string, string | undefined>
  >({})

  const handleAddDomain = async (event: React.FormEvent, pluginId: string) => {
    event.preventDefault()
    const domain = domainInputs[pluginId]?.trim()
    if (!domain) {
      return false
    }
    setDomainErrors((current) => ({ ...current, [pluginId]: undefined }))
    setAddingDomainFor(pluginId)

    try {
      const data = await Effect.runPromise(
        client.pluginDomains.create({
          payload: {
            domain,
            pluginServerId: LYNVO_PLUGIN_SERVER_ID,
            pluginId,
            username: usernameInputs[pluginId] || undefined,
            password: passwordInputs[pluginId] || undefined,
          },
        })
      )
      if (
        showMutationToast(
          data,
          "Plugin domain added",
          "Unable to add domain. Check it and try again."
        )
      ) {
        setDomainInputs((current) => ({ ...current, [pluginId]: "" }))
        setPasswordInputs((current) => ({ ...current, [pluginId]: "" }))
        setUsernameInputs((current) => ({ ...current, [pluginId]: "" }))
        setPasswordProtectedInputs((current) => ({
          ...current,
          [pluginId]: false,
        }))
        return true
      }
      return false
    } catch (error) {
      const message = getErrorMessage(
        error,
        "The domain couldn’t be added. Check it and try again."
      )
      setDomainErrors((current) => ({ ...current, [pluginId]: message }))
      toast.error(message)
      return false
    } finally {
      setAddingDomainFor(null)
    }
  }

  return {
    addingDomainFor,
    domainErrors,
    handleAddDomain,
    handleDeleteDomain,
    handleSetDomainCredential,
    handleDeleteDomainCredential,
    handleAddPluginServer,
    handleDeletePluginServer,
    handleTogglePluginServer,
    handleRefreshPluginServer,
  }
}
