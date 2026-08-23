import { useCallback, useEffect, useMemo, useState } from "react"
import { Effect } from "effect"
import { toast } from "sonner"
import type {
  ExtractedLink,
  MetaData,
  LinkViewItem,
} from "~/features/links/types"
import { getLinkViewItemFlatMeta } from "~/features/links/link-metadata-accessors"
import { createPluginDomainSuggestion } from "~/features/links/plugin-domain-suggestion"
import { parsePluginDomainCandidate } from "~/lib/plugin-domain"
import { confirmSelectedLinks, saveLink } from "./save-flow"
import type { SelectionDialogState } from "./interaction-state"
import type { OpenSelectionDialogOptions } from "./action-types"
import {
  clearHighlightAfterDelay,
  resetSaveView,
  vibrateSaveStart,
  vibrateSaveSuccess,
} from "./save-feedback"
import { getSaveErrorMessage } from "./save-error-message"
import { client } from "~/lib/effect/api/client"
import type { PluginDomainSuggestion } from "~/lib/plugin-domain"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import type { SavedLinkInteractionReporter } from "~/features/links/saved-link-interaction"
import { shouldOfferPluginDomainSuggestion } from "~/features/links/saved-link-interaction"
import type {
  ConfirmSaveIntentResult,
  SaveIntentResult,
} from "~/features/links/save-intent"

export const useSaveActions = ({
  url,
  links,
  addLink,
  enqueueLink,
  updateLinks,
  openSelectionDialog,
  setExtractionPreview,
  closeSelectionDialog,
  selectionDialogState,
  setError,
  setCurrentUrl,
  setHighlightedId,
  shouldAutoSaveAllLinks,
}: {
  url: string
  links: LinkViewItem[]
  addLink: (
    url: string,
    meta?: MetaData,
    extractedLinks?: ExtractedLink[]
  ) => Promise<string | undefined>
  enqueueLink: (url: string) => Promise<string | undefined>
  updateLinks: (url: string, links: ExtractedLink[]) => void
  openSelectionDialog: (options: OpenSelectionDialogOptions) => void
  setExtractionPreview: (preview: { meta: MetaData } | null) => void
  closeSelectionDialog: () => void
  selectionDialogState: SelectionDialogState
  setError: (error: string | null) => void
  setCurrentUrl: (url: string) => void
  setHighlightedId: (id: string | null) => void
  shouldAutoSaveAllLinks: boolean
}) => {
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingPluginDomain, setIsAddingPluginDomain] = useState(false)
  const [pluginDomainSuggestion, setPluginDomainSuggestion] =
    useState<PluginDomainSuggestion | null>(null)
  const [pendingQueuedLinkIds, setPendingQueuedLinkIds] = useState<
    ReadonlySet<string>
  >(() => new Set())
  const reporter = useMemo<SavedLinkInteractionReporter>(
    () => ({
      publish: (outcome) => {
        switch (outcome.kind) {
          case "clear-error":
            setError(null)
            break
          case "error":
            setError(outcome.message)
            break
          case "clear-preview":
            setExtractionPreview(null)
            break
          case "preview":
            setExtractionPreview({ meta: outcome.meta })
            break
          case "selection-required":
            openSelectionDialog(outcome.selection)
            break
          case "selection-closed":
            closeSelectionDialog()
            break
          case "link-focused":
            setHighlightedId(outcome.linkId)
            clearHighlightAfterDelay(setHighlightedId)
            break
          case "view-reset":
            resetSaveView({ setCurrentUrl })
            break
          case "links-updated":
            updateLinks(outcome.itemUrl, outcome.links)
            toast.success("Links updated")
            break
          default:
            break
        }
      },
    }),
    [
      closeSelectionDialog,
      openSelectionDialog,
      setCurrentUrl,
      setError,
      setExtractionPreview,
      setHighlightedId,
      updateLinks,
    ]
  )

  const offerPluginDomainSuggestion = useCallback(
    async (suggestion: PluginDomainSuggestion | undefined) => {
      try {
        const offeredSuggestion = await shouldOfferPluginDomainSuggestion(
          suggestion,
          () => Effect.runPromise(client.pluginDomains.list({}))
        )
        if (offeredSuggestion) {
          setPluginDomainSuggestion(offeredSuggestion)
        }
      } catch (error) {
        console.error(error)
      }
    },
    []
  )

  useEffect(() => {
    if (pluginDomainSuggestion) {
      return
    }

    const completedQueuedItem = links.find((item) => {
      const extractionState = item.extractionStatus?.state
      return (
        item.id !== undefined &&
        pendingQueuedLinkIds.has(item.id) &&
        (extractionState === "complete" || extractionState === "failed")
      )
    })
    if (!completedQueuedItem?.id) {
      return
    }
    const completedQueuedLinkId = completedQueuedItem.id

    setPendingQueuedLinkIds((currentIds) => {
      const nextIds = new Set(currentIds)
      nextIds.delete(completedQueuedLinkId)
      return nextIds
    })

    if (completedQueuedItem.extractionStatus?.state !== "complete") {
      return
    }

    void offerPluginDomainSuggestion(
      createPluginDomainSuggestion(
        parsePluginDomainCandidate(completedQueuedItem.url),
        getLinkViewItemFlatMeta(completedQueuedItem)
      )
    )
  }, [
    links,
    offerPluginDomainSuggestion,
    pendingQueuedLinkIds,
    pluginDomainSuggestion,
  ])

  const applySaveIntentResult = (
    result: SaveIntentResult
  ): PluginDomainSuggestion | undefined => {
    if ("previewMeta" in result && result.previewMeta) {
      reporter.publish({ kind: "preview", meta: result.previewMeta })
    }

    switch (result.kind) {
      case "error":
        reporter.publish({ kind: "error", message: result.message })
        reporter.publish({ kind: "clear-preview" })
        return undefined
      case "duplicate":
        reporter.publish({ kind: "error", message: result.message })
        reporter.publish({ kind: "link-focused", linkId: result.linkId })
        return undefined
      case "selection-required":
        reporter.publish({
          kind: "selection-required",
          selection: result.selection,
        })
        return result.selection.pluginDomainSuggestion
      case "queued":
        setPendingQueuedLinkIds((currentIds) => {
          const nextIds = new Set(currentIds)
          nextIds.add(result.linkId)
          return nextIds
        })
        reporter.publish({ kind: "link-focused", linkId: result.linkId })
        reporter.publish({ kind: "view-reset" })
        reporter.publish({ kind: "clear-preview" })
        vibrateSaveSuccess()
        return undefined
      case "saved":
        reporter.publish({ kind: "link-focused", linkId: result.linkId })
        reporter.publish({ kind: "view-reset" })
        reporter.publish({ kind: "clear-preview" })
        vibrateSaveSuccess()
        return result.pluginDomainSuggestion
    }
  }

  const applyConfirmSaveIntentResult = (
    result: ConfirmSaveIntentResult
  ): PluginDomainSuggestion | undefined => {
    switch (result.kind) {
      case "error":
        reporter.publish({ kind: "error", message: result.message })
        return undefined
      case "updated":
        reporter.publish({
          kind: "links-updated",
          itemUrl: result.itemUrl,
          links: result.links,
        })
        reporter.publish({ kind: "selection-closed" })
        reporter.publish({ kind: "view-reset" })
        vibrateSaveSuccess()
        return result.pluginDomainSuggestion
      case "saved":
        reporter.publish({ kind: "selection-closed" })
        reporter.publish({ kind: "view-reset" })
        vibrateSaveSuccess()
        return result.pluginDomainSuggestion
    }
  }

  const handleSave = async (overrideUrl?: string) => {
    if (isSaving) {
      return
    }
    setIsSaving(true)

    try {
      if ((overrideUrl ?? url).trim()) {
        vibrateSaveStart()
      }
      reporter.publish({ kind: "clear-error" })
      reporter.publish({ kind: "clear-preview" })
      const result = await saveLink({
        overrideUrl,
        currentUrl: url,
        links,
        addLink,
        enqueueLink,
        shouldAutoSaveAllLinks,
      })
      await offerPluginDomainSuggestion(applySaveIntentResult(result))
    } catch (error) {
      console.error(error)
      reporter.publish({ kind: "clear-preview" })
      reporter.publish({ kind: "error", message: getSaveErrorMessage(error) })
    } finally {
      setIsSaving(false)
    }
  }

  const confirmSelection = async (selectedLinks: ExtractedLink[]) => {
    setIsSaving(true)
    try {
      const {
        originalUrl,
        meta,
        existingItemId,
        pluginDomainSuggestion: selectionSuggestion,
      } = selectionDialogState

      const result = await confirmSelectedLinks({
        selectedLinks,
        originalUrl,
        meta,
        existingItemId,
        addLink,
        pluginDomainSuggestion: selectionSuggestion,
      })
      await offerPluginDomainSuggestion(applyConfirmSaveIntentResult(result))
    } catch (error) {
      console.error(error)
      reporter.publish({
        kind: "error",
        message: "Unable to save the selected links. Try again.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const dismissPluginDomainSuggestion = () => {
    setPluginDomainSuggestion(null)
  }

  const addSuggestedPluginDomain = async () => {
    if (!pluginDomainSuggestion || isAddingPluginDomain) {
      return
    }

    setIsAddingPluginDomain(true)
    try {
      await Effect.runPromise(
        client.pluginDomains.create({
          payload: {
            domain: pluginDomainSuggestion.domain,
            pluginServerId: pluginDomainSuggestion.pluginServerId,
            pluginId: pluginDomainSuggestion.pluginId,
            username: pluginDomainSuggestion.username,
            password: pluginDomainSuggestion.password,
          },
        })
      )
      toast.success(`${pluginDomainSuggestion.pluginName} domain added`)
      setPluginDomainSuggestion(null)
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(
          error,
          "Unable to add the plugin domain. Try again."
        )
      )
    } finally {
      setIsAddingPluginDomain(false)
    }
  }

  return {
    isSaving,
    handleSave,
    confirmSelection,
    pluginDomainDialog: {
      suggestion: pluginDomainSuggestion,
      isAdding: isAddingPluginDomain,
      add: addSuggestedPluginDomain,
      dismiss: dismissPluginDomainSuggestion,
    },
  }
}
