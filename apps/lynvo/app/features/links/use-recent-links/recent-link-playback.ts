import {
  withNewPlayableItems,
  withWatchedUrl,
} from "~/features/links/links.mapper"
import { getRecentLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import type { ExtractedLink, RecentLinkViewItem } from "~/features/links/types"
import { extractionOrchestration } from "~/lib/extraction/orchestration"
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

export const fetchExtractedLinks = async (itemUrl: string) => {
  return await extractionOrchestration.refreshSource({
    url: itemUrl,
    timestamp: Date.now(),
  })
}

const getNewPlayableItemUrls = (
  previousLinks: ExtractedLink[],
  nextLinks: ExtractedLink[]
) => {
  const previousPlayableItemUrls = new Set<string>()
  for (const previousLink of previousLinks) {
    if (previousLink.type === "file") {
      previousPlayableItemUrls.add(previousLink.url)
    }
  }

  const newPlayableItemUrls: string[] = []
  for (const nextLink of nextLinks) {
    if (
      nextLink.type === "file" &&
      !previousPlayableItemUrls.has(nextLink.url)
    ) {
      newPlayableItemUrls.push(nextLink.url)
    }
  }
  return newPlayableItemUrls
}

export const createSoftRefreshedItem = (
  item: RecentLinkViewItem,
  nextLinks: ExtractedLink[]
) => {
  const previousMetadata = getRecentLinkViewItemMetadata(item)
  const newPlayableItemUrls = getNewPlayableItemUrls(
    previousMetadata.extraction?.extractedLinks ?? [],
    nextLinks
  )

  const metadataWithNewPlayableItems =
    newPlayableItemUrls.length > 0
      ? withNewPlayableItems(previousMetadata, newPlayableItemUrls)
      : previousMetadata

  const metadata = {
    ...metadataWithNewPlayableItems,
    playback: { ...metadataWithNewPlayableItems.playback, resolvedMirrors: {} },
  }

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
