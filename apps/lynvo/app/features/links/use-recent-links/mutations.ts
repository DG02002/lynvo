import { useCallback } from "react"
import { toast } from "sonner"
import type { ExtractedLink, MetaData } from "~/features/links/types"
import { getRecentLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import { removeLinkFromTree } from "~/features/links/link-tree-metadata"
import { withResolvedMirrors } from "~/features/links/link-playback-metadata"
import {
  createUpdatedItemFromMetadata,
  createUpdatedItemWithLinks,
} from "./recent-link-items"
import {
  createCurrentEpisodeItem,
  createWatchedLinkItem,
} from "./recent-link-playback"
import { buildRecentLinkViewItem, showSaveError } from "./recent-link-add"

const persistWithoutWaiting = (operation: Promise<void>) => {
  operation.catch((error) => console.error(error))
}

export const useRecentLinksMutations = (
  persistence: RecentLinksPersistence
) => {
  const removeRecent = useCallback(
    async (url: string, id?: string, silent = false) => {
      try {
        await persistence.delete(url, id)
        if (!silent) {
          toast.success("Link removed")
        }
      } catch {
        if (!silent) {
          toast.error("Unable to delete the link. Try again.")
        }
      }
    },
    [persistence]
  )

  const clearRecents = useCallback(async () => {
    try {
      await persistence.clear()
      toast.success("History cleared")
    } catch {
      toast.error("Unable to clear history. Try again.")
    }
  }, [persistence])

  const addRecent = useCallback(
    async (
      targetUrl: string,
      meta?: MetaData,
      extractedLinks?: ExtractedLink[]
    ) => {
      const { item } = await buildRecentLinkViewItem({
        targetUrl,
        meta,
        extractedLinks,
      })
      try {
        return (await persistence.add(item)).id
      } catch (error) {
        showSaveError(error)
        return undefined
      }
    },
    [persistence]
  )

  const updateRecentLinks = useCallback(
    (targetUrl: string, links: ExtractedLink[]) => {
      persistWithoutWaiting(
        persistence.update(targetUrl, (item) =>
          createUpdatedItemWithLinks({ item, links })
        )
      )
    },
    [persistence]
  )

  const markLinkAsWatched = useCallback(
    (itemUrl: string, linkUrl: string) => {
      persistWithoutWaiting(
        persistence.update(itemUrl, (item) =>
          createWatchedLinkItem(item, linkUrl)
        )
      )
    },
    [persistence]
  )

  const cacheResolvedMirrors = useCallback(
    (itemUrl: string, episodeUrl: string, mirrors: ExtractedLink[]) => {
      persistWithoutWaiting(
        persistence.update(itemUrl, (item) =>
          createUpdatedItemFromMetadata(
            item,
            withResolvedMirrors(
              getRecentLinkViewItemMetadata(item),
              episodeUrl,
              mirrors
            )
          )
        )
      )
    },
    [persistence]
  )

  const removeLink = useCallback(
    (itemUrl: string, linkKey: string, linkUrl: string) => {
      persistWithoutWaiting(
        persistence.update(itemUrl, (item) => {
          const metadata = getRecentLinkViewItemMetadata(item)
          return createUpdatedItemFromMetadata(item, {
            ...metadata,
            extraction: {
              ...metadata.extraction,
              extractedLinks: removeLinkFromTree(
                metadata.extraction.extractedLinks,
                linkKey
              ),
            },
            playback: {
              ...metadata.playback,
              watchedUrls: metadata.playback.watchedUrls.filter(
                (watchedUrl) => watchedUrl !== linkUrl
              ),
              watchedIds: metadata.playback.watchedIds.filter(
                (watchedId) => watchedId !== linkKey
              ),
            },
          })
        })
      )
    },
    [persistence]
  )

  const setEpisodeAsCurrent = useCallback(
    (itemUrl: string, episodeUrl: string, folderEpisodeUrls: string[]) => {
      persistWithoutWaiting(
        persistence.update(itemUrl, (item) =>
          createCurrentEpisodeItem(item, episodeUrl, folderEpisodeUrls)
        )
      )
    },
    [persistence]
  )

  return {
    removeRecent,
    clearRecents,
    addRecent,
    updateRecentLinks,
    markLinkAsWatched,
    cacheResolvedMirrors,
    removeLink,
    setEpisodeAsCurrent,
  }
}
