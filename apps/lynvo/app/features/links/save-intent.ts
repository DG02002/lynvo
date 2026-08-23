import { extractionOrchestration } from "~/lib/extraction/orchestration"
import type { PluginDomainSuggestion } from "~/lib/plugin-domain"
import { parsePluginDomainCandidate } from "~/lib/plugin-domain"
import type {
  ExtractedLink,
  LinkViewItem,
  MetaData,
} from "~/features/links/types"
import type { SavedLinkSelection } from "./saved-link-interaction"
import { isProbablyValidUrl, normalizeUrl } from "./url-utils"
import { createPluginDomainSuggestion } from "./plugin-domain-suggestion"

export interface SaveIntentOperations {
  addLink: (
    url: string,
    meta?: MetaData,
    extractedLinks?: ExtractedLink[]
  ) => Promise<string | undefined>
  enqueueLink: (url: string) => Promise<string | undefined>
}

export interface SaveIntentOptions extends SaveIntentOperations {
  overrideUrl?: string
  currentUrl: string
  links: LinkViewItem[]
  shouldAutoSaveAllLinks: boolean
}

export interface SaveIntentErrorResult {
  kind: "error"
  message: string
  previewMeta?: MetaData
}

export interface SaveIntentDuplicateResult {
  kind: "duplicate"
  linkId: string
  message: "Link already exists."
}

export interface SaveIntentQueuedResult {
  kind: "queued"
  linkId: string
}

export interface SaveIntentSavedResult {
  kind: "saved"
  linkId: string
  pluginDomainSuggestion?: PluginDomainSuggestion
  previewMeta?: MetaData
}

export interface SaveIntentSelectionResult {
  kind: "selection-required"
  selection: SavedLinkSelection
  previewMeta: MetaData
}

export type SaveIntentResult =
  | SaveIntentErrorResult
  | SaveIntentDuplicateResult
  | SaveIntentQueuedResult
  | SaveIntentSavedResult
  | SaveIntentSelectionResult

export interface ConfirmSaveIntentOptions {
  selectedLinks: ExtractedLink[]
  originalUrl: string
  meta: MetaData
  existingItemId?: string
  addLink: SaveIntentOperations["addLink"]
  pluginDomainSuggestion?: PluginDomainSuggestion
}

export interface ConfirmSaveIntentErrorResult {
  kind: "error"
  message: string
}

export interface ConfirmSaveIntentUpdatedResult {
  kind: "updated"
  itemUrl: string
  links: ExtractedLink[]
  pluginDomainSuggestion?: PluginDomainSuggestion
}

export interface ConfirmSaveIntentSavedResult {
  kind: "saved"
  pluginDomainSuggestion?: PluginDomainSuggestion
}

export type ConfirmSaveIntentResult =
  | ConfirmSaveIntentErrorResult
  | ConfirmSaveIntentUpdatedResult
  | ConfirmSaveIntentSavedResult

export const resolveSaveIntent = async ({
  overrideUrl,
  currentUrl,
  links,
  addLink,
  enqueueLink,
  shouldAutoSaveAllLinks,
}: SaveIntentOptions): Promise<SaveIntentResult> => {
  const rawUrl = overrideUrl ?? currentUrl
  const targetUrl = normalizeUrl(rawUrl || "")

  if (!targetUrl) {
    return { kind: "error", message: "Enter a URL." }
  }
  if (!isProbablyValidUrl(targetUrl)) {
    return { kind: "error", message: "Enter a valid URL." }
  }

  const pluginDomainCandidate = parsePluginDomainCandidate(targetUrl)
  const savedUrl = pluginDomainCandidate?.sanitizedUrl ?? targetUrl
  const existingItem = links.find((linkItem) => linkItem.url === savedUrl)
  if (existingItem) {
    return {
      kind: "duplicate",
      linkId: existingItem.id || existingItem.url,
      message: "Link already exists.",
    }
  }

  if (shouldAutoSaveAllLinks) {
    const queuedId = await enqueueLink(savedUrl)
    return queuedId
      ? { kind: "queued", linkId: queuedId }
      : { kind: "error", message: "Unable to save link. Try again." }
  }

  const metadata = await extractionOrchestration.getSourceMetadata(
    targetUrl,
    links
  )

  if (metadata.filename?.toLowerCase().endsWith(".rar")) {
    return {
      kind: "error",
      message: "RAR archives cannot be saved as individual files.",
      previewMeta: metadata,
    }
  }

  const { mergedMeta, presentation } =
    await extractionOrchestration.prepareSource({
      targetUrl,
      links,
      sourceMetadata: metadata,
    })
  const pluginDomainSuggestion = createPluginDomainSuggestion(
    pluginDomainCandidate,
    mergedMeta
  )

  if (presentation.kind === "error") {
    return {
      kind: "error",
      message: presentation.message,
      previewMeta: metadata,
    }
  }

  if (presentation.kind === "selectionDialog") {
    return {
      kind: "selection-required",
      selection: {
        originalUrl: savedUrl,
        pluginDomainSuggestion,
        links: presentation.links,
        meta: mergedMeta,
      },
      previewMeta: metadata,
    }
  }

  const newId = await addLink(savedUrl, mergedMeta, [presentation.link])
  return newId
    ? {
        kind: "saved",
        linkId: newId,
        pluginDomainSuggestion,
        previewMeta: metadata,
      }
    : {
        kind: "error",
        message: "Unable to save link. Try again.",
        previewMeta: metadata,
      }
}

export const confirmSaveIntent = async ({
  selectedLinks,
  originalUrl,
  meta,
  existingItemId,
  addLink,
  pluginDomainSuggestion,
}: ConfirmSaveIntentOptions): Promise<ConfirmSaveIntentResult> => {
  if (selectedLinks.length === 0) {
    return {
      kind: "error",
      message: "Select at least one link.",
    }
  }

  if (existingItemId) {
    return {
      kind: "updated",
      itemUrl: originalUrl,
      links: selectedLinks,
      pluginDomainSuggestion,
    }
  }

  const newId = await addLink(originalUrl, meta, selectedLinks)
  return newId
    ? { kind: "saved", pluginDomainSuggestion }
    : { kind: "error", message: "Unable to save selected links. Try again." }
}
