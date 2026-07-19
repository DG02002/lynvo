import { withNewEpisodes, withWatchedUrl } from "~/features/links/links.mapper"
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

const getNewEpisodeUrls = (
  previousLinks: ExtractedLink[],
  nextLinks: ExtractedLink[]
) => {
  const previousEpisodeUrls = new Set<string>()
  for (const previousLink of previousLinks) {
    if (previousLink.type === "file") {
      previousEpisodeUrls.add(previousLink.url)
    }
  }

  const newEpisodeUrls: string[] = []
  for (const nextLink of nextLinks) {
    if (nextLink.type === "file" && !previousEpisodeUrls.has(nextLink.url)) {
      newEpisodeUrls.push(nextLink.url)
    }
  }
  return newEpisodeUrls
}

export const createSoftRefreshedItem = (
  item: RecentLinkViewItem,
  nextLinks: ExtractedLink[]
) => {
  const previousMetadata = getRecentLinkViewItemMetadata(item)
  const newEpisodeUrls = getNewEpisodeUrls(
    previousMetadata.extraction?.extractedLinks ?? [],
    nextLinks
  )

  const metadataWithNewEpisodes =
    newEpisodeUrls.length > 0
      ? withNewEpisodes(previousMetadata, newEpisodeUrls)
      : previousMetadata

  const metadata = {
    ...metadataWithNewEpisodes,
    playback: { ...metadataWithNewEpisodes.playback, resolvedMirrors: {} },
  }

  return createUpdatedItemFromMetadata(item, metadata)
}

export const createCurrentEpisodeItem = (
  item: RecentLinkViewItem,
  episodeUrl: string,
  folderEpisodeUrls: string[]
) => {
  const episodeIndex = folderEpisodeUrls.indexOf(episodeUrl)
  if (episodeIndex === -1) {
    return undefined
  }

  const previousMetadata = getRecentLinkViewItemMetadata(item)
  const watchedToMark = folderEpisodeUrls.slice(0, episodeIndex)
  const unwatchedToUnmark = folderEpisodeUrls.slice(episodeIndex)
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
