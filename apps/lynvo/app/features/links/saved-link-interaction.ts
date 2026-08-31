import type { ExtractedLink, LinkViewItem, MetaData } from "./types"
import { getLinkViewItemMetadata } from "./link-metadata-accessors"
import { toLinkViewModel } from "./link-view-models"
import type { PluginDomainSuggestion } from "~/lib/plugin-domain"
import {
  getMediaNodeInteractionState,
  isMirrorResolvableMediaNode,
} from "./media-node-interaction"

export interface SavedLinkInteractionState {
  directLink?: ExtractedLink
  isDirectLinkExpired: boolean
  isNew: boolean
  isResolvableContainer: boolean
}

export interface SavedLinkClearErrorOutcome {
  kind: "clear-error"
}

export interface SavedLinkErrorOutcome {
  kind: "error"
  message: string
}

export interface SavedLinkClearPreviewOutcome {
  kind: "clear-preview"
}

export interface SavedLinkPreviewOutcome {
  kind: "preview"
  meta: MetaData
}

export interface SavedLinkSelectionRequiredOutcome {
  kind: "selection-required"
  selection: SavedLinkSelection
}

export interface SavedLinkSelectionClosedOutcome {
  kind: "selection-closed"
}

export interface SavedLinkFocusedOutcome {
  kind: "link-focused"
  linkId: string
}

export interface SavedLinkViewResetOutcome {
  kind: "view-reset"
}

export interface SavedLinksUpdatedOutcome {
  kind: "links-updated"
  itemUrl: string
  links: ExtractedLink[]
}

export interface SavedLinkRefreshSucceededOutcome {
  kind: "refresh-succeeded"
}

export type SavedLinkInteractionOutcome =
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

export interface PluginDomainIdentity {
  pluginServerId: string
  pluginId: string
  domain: string
}

export const shouldOfferPluginDomainSuggestion = async (
  suggestion: PluginDomainSuggestion | undefined,
  listDomains: () => Promise<readonly PluginDomainIdentity[]>
) => {
  if (!suggestion) {
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
