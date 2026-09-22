import { Result, Schema } from "effect"

import type { PluginDomainSuggestion } from "~/lib/plugin-domain"

import { getLinkViewItemMetadata } from "./link-metadata-accessors"
import { toLinkViewModel } from "./link-view-models"
import {
  getMediaNodeInteractionState,
  isMirrorResolvableMediaNode,
} from "./media-node-interaction"
import type { ExtractedLink, LinkViewItem, MetaData } from "./types"

export interface SavedLinkInteractionState {
  directLink?: ExtractedLink
  isDirectLinkExpired: boolean
  isNew: boolean
  isResolvableContainer: boolean
}

export const SAVED_LINK_REFRESH_ERROR_MESSAGE =
  "The saved link couldn’t be refreshed. Try again."

export type SavedLinkInteractionError =
  | { kind: "duplicate" }
  | { kind: "unsupported"; message: string }
  | { kind: "generic"; message: string }

interface SavedLinkClearErrorOutcome {
  kind: "clear-error"
}

interface SavedLinkErrorOutcome {
  kind: "error"
  error: SavedLinkInteractionError
}

interface SavedLinkClearPreviewOutcome {
  kind: "clear-preview"
}

interface SavedLinkPreviewOutcome {
  kind: "preview"
  meta: MetaData
}

interface SavedLinkSelectionRequiredOutcome {
  kind: "selection-required"
  selection: SavedLinkSelection
}

interface SavedLinkSelectionClosedOutcome {
  kind: "selection-closed"
}

interface SavedLinkFocusedOutcome {
  kind: "link-focused"
  linkId: string
}

interface SavedLinkViewResetOutcome {
  kind: "view-reset"
}

interface SavedLinksUpdatedOutcome {
  kind: "links-updated"
  itemUrl: string
  links: ExtractedLink[]
}

interface SavedLinkRefreshSucceededOutcome {
  kind: "refresh-succeeded"
}

type SavedLinkInteractionOutcome =
  | SavedLinkClearErrorOutcome
  | SavedLinkErrorOutcome
  | SavedLinkClearPreviewOutcome
  | SavedLinkPreviewOutcome
  | SavedLinkSelectionRequiredOutcome
  | SavedLinkSelectionClosedOutcome
  | SavedLinkFocusedOutcome
  | SavedLinkViewResetOutcome
  | SavedLinksUpdatedOutcome
  | SavedLinkRefreshSucceededOutcome

export interface SavedLinkSelection {
  originalUrl: string
  links: ExtractedLink[]
  meta: MetaData
  existingItemId?: string
  pluginDomainSuggestion?: PluginDomainSuggestion
}

export interface SavedLinkInteractionReporter {
  publish: (outcome: SavedLinkInteractionOutcome) => void
}

export const reportSavedLinkError = (
  reporter: SavedLinkInteractionReporter,
  error: SavedLinkInteractionError
): void => {
  reporter.publish({
    kind: "error",
    error,
  })
}

export const reportGenericSavedLinkError = (
  reporter: SavedLinkInteractionReporter,
  message: string
): void => {
  reportSavedLinkError(reporter, { kind: "generic", message })
}

export const getSavedLinkRefreshErrorMessage = (
  error: SavedLinkInteractionError
): string =>
  error.kind === "generic" ? error.message : SAVED_LINK_REFRESH_ERROR_MESSAGE

export interface PluginDomainIdentity {
  pluginServerId: string
  pluginId: string
  domain: string
}

const PLUGIN_DOMAIN_SUGGESTION_DISMISSALS_STORAGE_KEY =
  "lynvo:plugin-domain-suggestion-dismissals"
const pluginDomainSuggestionDismissalsSchema = Schema.Array(Schema.String)

const getPluginDomainSuggestionKey = (
  suggestion: PluginDomainIdentity
): string =>
  JSON.stringify([
    suggestion.pluginServerId,
    suggestion.pluginId,
    suggestion.domain,
  ])

const readDismissedPluginDomainSuggestions = (): Set<string> => {
  try {
    const stored = globalThis.sessionStorage.getItem(
      PLUGIN_DOMAIN_SUGGESTION_DISMISSALS_STORAGE_KEY
    )
    if (!stored) {
      return new Set()
    }
    const parsed = Schema.decodeUnknownResult(
      pluginDomainSuggestionDismissalsSchema
    )(JSON.parse(stored))
    return Result.isFailure(parsed) ? new Set() : new Set(parsed.success)
  } catch {
    // SAFETY: Private browsing and server rendering can make sessionStorage
    // unavailable; an in-memory offer remains safe in those environments.
    return new Set()
  }
}

export const dismissPluginDomainSuggestion = (
  suggestion: PluginDomainSuggestion
): void => {
  try {
    const dismissed = readDismissedPluginDomainSuggestions()
    dismissed.add(getPluginDomainSuggestionKey(suggestion))
    globalThis.sessionStorage.setItem(
      PLUGIN_DOMAIN_SUGGESTION_DISMISSALS_STORAGE_KEY,
      JSON.stringify([...dismissed])
    )
  } catch {
    // SAFETY: A storage failure should not turn a failed add into a UI error.
  }
}

export const clearDismissedPluginDomainSuggestion = (
  suggestion: PluginDomainSuggestion
): void => {
  try {
    const dismissed = readDismissedPluginDomainSuggestions()
    if (!dismissed.delete(getPluginDomainSuggestionKey(suggestion))) {
      return
    }
    globalThis.sessionStorage.setItem(
      PLUGIN_DOMAIN_SUGGESTION_DISMISSALS_STORAGE_KEY,
      JSON.stringify([...dismissed])
    )
  } catch {
    // SAFETY: A storage failure should not turn a successful add into a UI error.
  }
}

export const shouldOfferPluginDomainSuggestion = async (
  suggestion: PluginDomainSuggestion | undefined,
  listDomains: () => Promise<readonly PluginDomainIdentity[]>
) => {
  if (
    !suggestion ||
    readDismissedPluginDomainSuggestions().has(
      getPluginDomainSuggestionKey(suggestion)
    )
  ) {
    return undefined
  }
  const domains = await listDomains()
  const isConfigured = domains.some(
    (domain) =>
      domain.pluginServerId === suggestion.pluginServerId &&
      domain.pluginId === suggestion.pluginId &&
      domain.domain === suggestion.domain
  )
  return isConfigured ? undefined : suggestion
}

export const getSavedLinkInteractionState = (
  item: LinkViewItem,
  currentTimeMs: number
): SavedLinkInteractionState => {
  const view = toLinkViewModel(item)
  const directLink =
    view.extractedLinks.length === 1 &&
    (!getMediaNodeInteractionState(view.extractedLinks[0]).isFolder ||
      isMirrorResolvableMediaNode(view.extractedLinks[0]))
      ? view.extractedLinks[0]
      : undefined
  const isDirectLinkExpired =
    directLink?.expiry !== undefined && directLink.expiry <= currentTimeMs
  const openedUrls = new Set(getLinkViewItemMetadata(item).playback.openedUrls)
  const isRootFolderNew = directLink === undefined && !openedUrls.has(item.url)

  return {
    directLink,
    isDirectLinkExpired,
    isNew:
      !isDirectLinkExpired &&
      (directLink ? directLink.opened !== true : isRootFolderNew),
    isResolvableContainer:
      directLink !== undefined && isMirrorResolvableMediaNode(directLink),
  }
}
