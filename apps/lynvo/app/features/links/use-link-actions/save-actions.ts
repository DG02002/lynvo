import { useMemo, useState } from "react"
import { Effect } from "effect"
import { toast } from "sonner"
import type {
  ExtractedLink,
  MetaData,
  LinkViewItem,
} from "~/features/links/types"
import { writeDraft } from "~/features/links/drafts"
import { confirmSelectedLinks, saveLink } from "./save-flow"
import type { SelectionDialogState } from "./interaction-state"
import type { OpenSelectionDialogOptions } from "./action-types"
import { clearHighlightAfterDelay, resetSaveView } from "./save-feedback"
import { getSaveErrorMessage } from "./save-error-message"
import { client } from "~/lib/effect/api/client"
import type { PluginDomainSuggestion } from "~/lib/plugin-domain"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"
import type { SavedLinkInteractionReporter } from "~/features/links/saved-link-interaction"
import { shouldOfferPluginDomainSuggestion } from "~/features/links/saved-link-interaction"

export const useSaveActions = ({
  userId,
  url,
  links,
  addLink,
  updateLinks,
  openSelectionDialog,
  setExtractionPreview,
  closeSelectionDialog,
  selectionDialogState,
  setError,
  setCurrentUrl,
  setHighlightedId,
  setSortOrder,
  setCurrentPage,
}: {
  userId: string
  url: string
  links: LinkViewItem[]
  addLink: (
    url: string,
    meta?: MetaData,
    extractedLinks?: ExtractedLink[]
  ) => Promise<string | undefined>
  updateLinks: (url: string, links: ExtractedLink[]) => void
  openSelectionDialog: (options: OpenSelectionDialogOptions) => void
  setExtractionPreview: (preview: { meta: MetaData } | null) => void
  closeSelectionDialog: () => void
  selectionDialogState: SelectionDialogState
  setError: (error: string | null) => void
  setCurrentUrl: (url: string) => void
  setHighlightedId: (id: string | null) => void
  setSortOrder: (order: "newest" | "oldest") => void
  setCurrentPage: (page: number) => void
}) => {
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingPluginDomain, setIsAddingPluginDomain] = useState(false)
  const [pluginDomainSuggestion, setPluginDomainSuggestion] =
    useState<PluginDomainSuggestion | null>(null)
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
            setSortOrder("newest")
            setCurrentPage(1)
            clearHighlightAfterDelay(setHighlightedId)
            break
          case "view-reset":
            resetSaveView({ setCurrentUrl, setSortOrder, setCurrentPage })
            break
          case "links-updated":
            updateLinks(outcome.itemUrl, outcome.links)
            toast.success("Links updated")
            break
          case "draft-saved":
            toast.success("Draft saved")
            break
          default:
            break
        }
      },
    }),
    [
      closeSelectionDialog,
      openSelectionDialog,
      setCurrentPage,
      setCurrentUrl,
      setError,
      setExtractionPreview,
      setHighlightedId,
      setSortOrder,
      updateLinks,
    ]
  )

  const handleSave = async (overrideUrl?: string) => {
    if (isSaving) {
      return
    }
    setIsSaving(true)

    try {
      const result = await saveLink({
        userId,
        overrideUrl,
        currentUrl: url,
        links,
        addLink,
        reporter,
      })
      await offerPluginDomainSuggestion(result?.pluginDomainSuggestion)
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
        userId,
        selectedLinks,
        originalUrl,
        meta,
        existingItemId,
        addLink,
        reporter,
        pluginDomainSuggestion: selectionSuggestion,
      })
      await offerPluginDomainSuggestion(result.pluginDomainSuggestion)
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

  const saveSelectionDraft = () => {
    const { originalUrl, links, meta } = selectionDialogState
    if (links.length > 0) {
      writeDraft(userId, originalUrl, links, meta)
      reporter.publish({ kind: "draft-saved" })
    }
    closeSelectionDialog()
  }

  const offerPluginDomainSuggestion = async (
    suggestion: PluginDomainSuggestion | undefined
  ) => {
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
    saveSelectionDraft,
    pluginDomainDialog: {
      suggestion: pluginDomainSuggestion,
      isAdding: isAddingPluginDomain,
      add: addSuggestedPluginDomain,
      dismiss: dismissPluginDomainSuggestion,
    },
  }
}
