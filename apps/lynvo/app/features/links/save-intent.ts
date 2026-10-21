import type {
  ExtractedLink,
  LinkWriteResult,
  LinkViewItem,
  MetaData,
} from "~/features/links/types"
import {
  parsePluginDomainCandidate,
  type PluginDomainSuggestion,
} from "~/lib/plugin-domain"
import type { SaveIntentErrorKind } from "~/lib/user-facing-error"

import type { SavedLinkSelection } from "./saved-link-interaction"
import { isProbablyValidUrl, normalizeUrl } from "./url-utils"

interface SaveIntentOperations {
  addLink: (
    url: string,
    meta?: MetaData,
    extractedLinks?: ExtractedLink[]
  ) => Promise<LinkWriteResult>
  enqueueLink: (
    savedUrl: string,
    sourceUrl?: string
  ) => Promise<LinkWriteResult>
}

export interface SaveIntentOptions extends SaveIntentOperations {
  overrideUrl?: string
  currentUrl: string
  links: LinkViewItem[]
}

interface SaveIntentErrorResult {
  kind: "error"
  errorKind: SaveIntentErrorKind
  previewMeta?: MetaData
}

interface SaveIntentDuplicateResult {
  kind: "duplicate"
  linkId: string
}

interface SaveIntentQueuedResult {
  kind: "queued"
  linkId: string
}

interface SaveIntentSavedResult {
  kind: "saved"
  linkId: string
  pluginDomainSuggestion?: PluginDomainSuggestion
  previewMeta?: MetaData
}

interface SaveIntentSelectionResult {
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

interface ConfirmSaveIntentErrorResult {
  kind: "error"
  errorKind: SaveIntentErrorKind
}

interface ConfirmSaveIntentUpdatedResult {
  kind: "updated"
  itemUrl: string
  links: ExtractedLink[]
  pluginDomainSuggestion?: PluginDomainSuggestion
  /** The update confirmed a manual selection on an existing Saved link. */
  selectionFinalized: boolean
}
interface ConfirmSaveIntentSavedResult {
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
  enqueueLink,
}: SaveIntentOptions): Promise<SaveIntentResult> => {
  const rawUrl = overrideUrl ?? currentUrl
  const targetUrl = normalizeUrl(rawUrl || "")

  if (!targetUrl) {
    return { kind: "error", errorKind: "missing-url" }
  }
  if (!isProbablyValidUrl(targetUrl)) {
    return { kind: "error", errorKind: "invalid-url" }
  }

  const pluginDomainCandidate = parsePluginDomainCandidate(targetUrl)
  const savedUrl = pluginDomainCandidate?.sanitizedUrl ?? targetUrl
  const existingItem = links.find((linkItem) => linkItem.url === savedUrl)
  if (existingItem) {
    return {
      kind: "duplicate",
      linkId: existingItem.id || existingItem.url,
    }
  }

  // Both save modes persist the save intent through the server-side
  // extraction queue first, so a refresh can never discard in-flight work.
  // Manual mode opens the selection dialog from the persisted extraction
  // once the queued link completes.
  const queuedResult =
    savedUrl === targetUrl
      ? await enqueueLink(savedUrl)
      : await enqueueLink(savedUrl, targetUrl)
  return queuedResult.kind === "saved"
    ? { kind: "queued", linkId: queuedResult.id }
    : { kind: "error", errorKind: "write-failed" }
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
      errorKind: "no-selection",
    }
  }

  if (existingItemId) {
    return {
      kind: "updated",
      itemUrl: originalUrl,
      links: selectedLinks,
      pluginDomainSuggestion,
      selectionFinalized: true,
    }
  }

  const result = await addLink(originalUrl, meta, selectedLinks)
  return result.kind === "saved"
    ? { kind: "saved", pluginDomainSuggestion }
    : { kind: "error", errorKind: "write-failed" }
}
