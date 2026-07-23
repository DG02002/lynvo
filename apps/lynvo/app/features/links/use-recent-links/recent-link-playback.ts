import { withWatchedUrl } from "~/features/links/links.mapper"
import { getRecentLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import type { RecentLinkViewItem } from "~/features/links/types"
import { createUpdatedItemFromMetadata } from "./recent-link-items"

export const createWatchedLinkItem = (
  item: RecentLinkViewItem,
  linkUrl: string
) => {
  if (!item.extractedLinks) {
    return undefined
  }

  const metadata = withWatchedUrl(getRecentLinkViewItemMetadata(item), linkUrl)
  return createUpdatedItemFromMetadata(item, metadata)
}

export const createCurrentPlayableItem = (
  item: RecentLinkViewItem,
  lazyItemUrl: string,
  folderItemUrls: string[]
) => {
  const playableItemIndex = folderItemUrls.indexOf(lazyItemUrl)
  if (playableItemIndex === -1) {
    return undefined
  }

  const previousMetadata = getRecentLinkViewItemMetadata(item)
  const watchedToMark = folderItemUrls.slice(0, playableItemIndex)
  const unwatchedToUnmark = folderItemUrls.slice(playableItemIndex)
  const currentWatched = new Set(previousMetadata.playback?.watchedUrls ?? [])

  for (const url of watchedToMark) {
    currentWatched.add(url)
  }
  for (const url of unwatchedToUnmark) {
    currentWatched.delete(url)
  }

  const metadata = {
    ...previousMetadata,
    playback: {
      ...previousMetadata.playback,
      watchedUrls: [...currentWatched],
    },
  }

  return createUpdatedItemFromMetadata(item, metadata)
}
