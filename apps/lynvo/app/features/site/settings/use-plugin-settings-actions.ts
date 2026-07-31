import * as React from "react"
import { Effect } from "effect"
import { toast } from "sonner"
import { client } from "~/lib/effect/api/client"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import type { ExternalWorkerFormValues } from "./plugin-settings-schemas"
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

const getErrorMessage = (error: unknown) =>
  getUserFacingErrorMessage(error, "Something went wrong. Please try again.")

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
    toast.error(getErrorMessage(error))
  }
}

const handleDeleteWorker = async (workerId: string) => {
  try {
    const data = await Effect.runPromise(
      client.workers.delete({
        params: { workerId },
      })
    )
    showMutationToast(
      data,
      "Worker deleted successfully",
      "Unable to delete extractor. Try again."
    )
  } catch (error) {
    toast.error(getErrorMessage(error))
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
    toast.error(getErrorMessage(error))
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
    toast.error(getErrorMessage(error))
  }
}

const handleToggleWorker = async (
  workerId: string,
  currentEnabled: boolean
) => {
  try {
    const data = await Effect.runPromise(
      client.workers.toggle({
        params: { workerId },
        payload: { enabled: !currentEnabled },
      })
    )
    if (!data.success) {
      toast.error("Unable to update extractor. Try again.")
    } else if (!currentEnabled) {
      toast.success("Worker enabled")
    }
  } catch (error) {
    toast.error(getErrorMessage(error))
  }
}

const handleRefreshWorker = async (workerId: string, showFeedback = true) => {
  try {
    const data = await Effect.runPromise(
      client.workers.refresh({
        params: { workerId },
      })
    )
    if (showFeedback) {
      showMutationToast(
        data,
        "Worker manifest refreshed",
        "Unable to refresh extractor. Try again."
      )
    }
  } catch (error) {
    if (showFeedback) {
      toast.error(getErrorMessage(error))
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
            workerId: LYNVO_PLUGIN_SERVER_ID,
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
      const message = getErrorMessage(error)
      setDomainErrors((current) => ({ ...current, [pluginId]: message }))
      toast.error(message)
      return false
    } finally {
      setAddingDomainFor(null)
    }
  }

  const handleAddWorker = async (value: ExternalWorkerFormValues) => {
    try {
      const data = await Effect.runPromise(
        client.workers.create({
          payload: value,
        })
      )
      if (
        showMutationToast(
          data,
          "Worker added successfully",
          "Unable to add extractor. Check its details and try again."
        )
      ) {
        return null
      }
      return "Unable to add extractor. Check its details and try again."
    } catch (error) {
      const message = getErrorMessage(error)
      toast.error(message)
      return message
    }
  }

  return {
    addingDomainFor,
    domainErrors,
    handleAddDomain,
    handleDeleteDomain,
    handleSetDomainCredential,
    handleDeleteDomainCredential,
    handleAddWorker,
    handleDeleteWorker,
    handleToggleWorker,
    handleRefreshWorker,
  }
}
