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

export interface SavedLinkInteractionOutcome {
  kind:
    | "clear-error"
    | "error"
    | "clear-preview"
    | "preview"
    | "selection-required"
    | "selection-closed"
    | "link-focused"
    | "view-reset"
    | "links-updated"
    | "refresh-succeeded"
    | "draft-saved"
  message?: string
  meta?: MetaData
  selection?: DraftSelection | SavedLinkSelection
  linkId?: string
  itemUrl?: string
  links?: ExtractedLink[]
}

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
  links: item.extractedLinks ?? item.meta.extractedLinks ?? [],
  meta: item.meta,
  isDraftMode: true,
})
