import type {
  DraftListItem,
  ExtractedLink,
  LinkViewItem,
  MetaData,
} from "./types"
import { getLinkViewItemMetadata } from "./link-metadata-accessors"
import { toLinkViewModel } from "./link-view-models"
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

export interface DraftSelection {
  originalUrl: string
  links: ExtractedLink[]
  meta: MetaData
  isDraftMode: true
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
  selection: DraftSelection | SavedLinkSelection
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

export interface SavedLinkDraftSavedOutcome {
  kind: "draft-saved"
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
  | SavedLinkDraftSavedOutcome

export interface SavedLinkSelection {
  originalUrl: string
  links: ExtractedLink[]
  meta: MetaData
  existingItemId?: string
  isDraftMode?: boolean
  pluginDomainSuggestion?: import("~/lib/plugin-domain").PluginDomainSuggestion
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
  suggestion: import("~/lib/plugin-domain").PluginDomainSuggestion | undefined,
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

export const getDraftSelection = (item: DraftListItem): DraftSelection => ({
  originalUrl: item.url,
  links: item.extractedLinks ?? [],
  meta: item.meta,
  isDraftMode: true,
})
