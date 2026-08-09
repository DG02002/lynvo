import type { ExtractedLink, LinkViewItem, MetaData } from "./types"
import {
  getLinkViewItemFlatMeta,
  getLinkViewItemMetadata,
} from "./link-metadata-accessors"
import { toLinkViewModel } from "./link-view-models"

const isMirrorResolvable = (link: ExtractedLink) =>
  link.mediaNodeKind === "resolvable" && link.resolutionKind !== "folder"

export interface SavedLinkInteractionState {
  directLink?: ExtractedLink
  isDirectLinkExpired: boolean
  isDraft: boolean
  isNew: boolean
  isResolvableContainer: boolean
}

export interface DraftSelection {
  originalUrl: string
  links: ExtractedLink[]
  meta: MetaData
  isDraftMode: true
}

export const getSavedLinkInteractionState = (
  item: LinkViewItem,
  currentTimeMs: number
): SavedLinkInteractionState => {
  const view = toLinkViewModel(item)
  const isDraft = item.isDraft === true
  const directLink =
    !isDraft &&
    view.extractedLinks.length === 1 &&
    (view.extractedLinks[0]?.type !== "folder" ||
      isMirrorResolvable(view.extractedLinks[0]))
      ? view.extractedLinks[0]
      : undefined
  const isDirectLinkExpired =
    directLink?.expiry !== undefined && directLink.expiry <= currentTimeMs
  const openedUrls = new Set(getLinkViewItemMetadata(item).playback.openedUrls)
  const isRootFolderNew =
    directLink === undefined && !isDraft && !openedUrls.has(item.url)

  return {
    directLink,
    isDirectLinkExpired,
    isDraft,
    isNew:
      !isDirectLinkExpired &&
      (directLink ? directLink.opened !== true : isRootFolderNew),
    isResolvableContainer:
      directLink !== undefined && isMirrorResolvable(directLink),
  }
}

export const getDraftSelection = (
  item: LinkViewItem
): DraftSelection | undefined => {
  if (item.isDraft !== true) {
    return undefined
  }

  const view = toLinkViewModel(item)
  return {
    originalUrl: item.url,
    links: item.extractedLinks ?? view.extractedLinks,
    meta: item.meta ?? getLinkViewItemFlatMeta(item),
    isDraftMode: true,
  }
}
