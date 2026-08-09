import type {
  DraftListItem,
  ExtractedLink,
  LinkViewItem,
  MetaData,
} from "./types"
import { getLinkViewItemMetadata } from "./link-metadata-accessors"
import { toLinkViewModel } from "./link-view-models"

const isMirrorResolvable = (link: ExtractedLink) =>
  link.mediaNodeKind === "resolvable" && link.resolutionKind !== "folder"

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

export const getSavedLinkInteractionState = (
  item: LinkViewItem,
  currentTimeMs: number
): SavedLinkInteractionState => {
  const view = toLinkViewModel(item)
  const directLink =
    view.extractedLinks.length === 1 &&
    (view.extractedLinks[0]?.type !== "folder" ||
      isMirrorResolvable(view.extractedLinks[0]))
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
      directLink !== undefined && isMirrorResolvable(directLink),
  }
}

export const getDraftSelection = (item: DraftListItem): DraftSelection => ({
  originalUrl: item.url,
  links: item.extractedLinks ?? item.meta.extractedLinks ?? [],
  meta: item.meta,
  isDraftMode: true,
})
