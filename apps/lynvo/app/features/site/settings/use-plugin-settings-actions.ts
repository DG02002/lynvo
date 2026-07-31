import { useQueryClient } from "@tanstack/react-query"
import { Effect } from "effect"
import { toast } from "sonner"
import { client } from "~/lib/effect/api/client"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import type { CustomPluginServerFormValues } from "./plugin-settings-schemas"
import { invalidatePluginSettings } from "./plugin-settings-queries"

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

export const usePluginSettingsActions = () => {
  const queryClient = useQueryClient()

  return {
    handleDeleteDomain: async (domainId: string) => {
      await handleDeleteDomain(domainId)
      await invalidatePluginSettings(queryClient)
    },
    handleSetDomainCredential: async (
      domainId: string,
      password: string,
      username?: string
    ) => {
      const didSave = await handleSetDomainCredential(
        domainId,
        password,
        username
      )
      if (didSave) {
        await invalidatePluginSettings(queryClient)
      }
      return didSave
    },
    handleDeleteDomainCredential: async (domainId: string) => {
      await handleDeleteDomainCredential(domainId)
      await invalidatePluginSettings(queryClient)
    },
    handleAddPluginServer: async (value: CustomPluginServerFormValues) => {
      const error = await handleAddPluginServer(value)
      if (!error) {
        await invalidatePluginSettings(queryClient)
      }
      return error
    },
    handleDeletePluginServer: async (pluginServerId: string) => {
      await handleDeletePluginServer(pluginServerId)
      await invalidatePluginSettings(queryClient)
    },
    handleTogglePluginServer: async (
      pluginServerId: string,
      currentEnabled: boolean
    ) => {
      await handleTogglePluginServer(pluginServerId, currentEnabled)
      await invalidatePluginSettings(queryClient)
    },
    handleRefreshPluginServer: async (
      pluginServerId: string,
      showFeedback = true
    ) => {
      await handleRefreshPluginServer(pluginServerId, showFeedback)
      await invalidatePluginSettings(queryClient)
    },
  }
}
