import { useState } from "react"
import { Effect } from "effect"
import { toast } from "sonner"
import type {
  ExtractedLink,
  MetaData,
  LinkViewItem,
} from "~/features/links/types"
import { writeDraft } from "~/components/links/DraftManager"
import { confirmSelectedLinks, saveLink } from "./save-flow"
import type { SelectionDialogState } from "./interaction-state"
import type { OpenSelectionDialogOptions } from "./action-types"
import { createSaveFlowEffects } from "./save-flow-effects"
import { getSaveErrorMessage } from "./save-error-message"
import { client } from "~/lib/effect/api/client"
import type { PluginDomainSuggestion } from "~/lib/plugin-domain"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

export const useSaveActions = ({
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
  const effects = createSaveFlowEffects({
    setError,
    setExtractionPreview,
    openSelectionDialog,
    closeSelectionDialog,
    setCurrentUrl,
    setHighlightedId,
    setSortOrder,
    setCurrentPage,
  })

  const handleSave = async (overrideUrl?: string) => {
    if (isSaving) {
      return
    }
    setIsSaving(true)

    try {
      const result = await saveLink({
        overrideUrl,
        currentUrl: url,
        links,
        addLink,
        effects,
      })
      await offerPluginDomainSuggestion(result?.pluginDomainSuggestion)
    } catch (error) {
      console.error(error)
      effects.clearPreview()
      effects.showError(getSaveErrorMessage(error))
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
        updateLinks,
        effects,
        pluginDomainSuggestion: selectionSuggestion,
      })
      await offerPluginDomainSuggestion(result.pluginDomainSuggestion)
    } catch (error) {
      console.error(error)
      effects.showError("Unable to save the selected links. Try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const saveSelectionDraft = () => {
    const { originalUrl, links, meta } = selectionDialogState
    if (links.length > 0) {
      writeDraft(originalUrl, links, meta)
      toast.success("Draft saved")
    }
    closeSelectionDialog()
  }

  async function offerPluginDomainSuggestion(
    suggestion: PluginDomainSuggestion | undefined
  ) {
    if (!suggestion) {
      return
    }

    try {
      const domains = await Effect.runPromise(client.pluginDomains.list({}))
      const isConfigured = domains.some(
        (domain) =>
          domain.pluginServerId === suggestion.pluginServerId &&
          domain.pluginId === suggestion.pluginId &&
          domain.domain === suggestion.domain
      )
      if (!isConfigured) {
        setPluginDomainSuggestion(suggestion)
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
