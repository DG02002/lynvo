import {
  Folder01Icon,
  Folder02Icon,
  FolderSymlinkIcon,
} from "@hugeicons/core-free-icons"
import { toLinkViewModel } from "~/features/links/link-view-models"
import type {
  ExtractedLink,
  LinkListItem,
  LinkViewItem,
} from "~/features/links/types"

export interface FolderLevel {
  id: string
  label: string
}

export const getLinkKey = (link: ExtractedLink) => link.id ?? link.url

export const isLazyFolder = (link: ExtractedLink) =>
  link.type === "folder" &&
  !link.children?.length &&
  link.childrenResolved !== true

export const isMirrorResolvable = (link: ExtractedLink) =>
  link.mediaNodeKind === "resolvable" && link.resolutionKind !== "folder"

export const getFolderVisualState = (link: ExtractedLink, isOpen: boolean) => {
  if (isOpen) {
    return "open"
  }
  return isLazyFolder(link) ? "lazy-closed" : "closed"
}

export const getFolderIcon = (link: ExtractedLink, isOpen: boolean) => {
  const visualState = getFolderVisualState(link, isOpen)
  if (visualState === "open") {
    return Folder02Icon
  }
  return visualState === "lazy-closed" ? FolderSymlinkIcon : Folder01Icon
}

export const getResolvableSourceName = (
  link: ExtractedLink,
  item: LinkViewItem
) => {
  if (link.sourceName) {
    return link.sourceName
  }
  const view = toLinkViewModel(item)
  return view.sourceName || view.pluginName || item.url
}

export const getItemTitle = (item: LinkListItem | LinkViewItem) =>
  ("kind" in item && item.kind === "draft"
    ? item.title
    : toLinkViewModel(item).title) || new URL(item.url).hostname

export const getLinksAtFolderPath = (
  rootLinks: ExtractedLink[],
  folderPath: FolderLevel[]
) =>
  folderPath.reduce<ExtractedLink[]>((currentLinks, folder) => {
    const currentFolder = currentLinks.find(
      (link) => getLinkKey(link) === folder.id
    )
    return currentFolder?.children ?? []
  }, rootLinks)
