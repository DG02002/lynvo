import { useCallback } from "react"
import { toast } from "sonner"
import type { ExtractedLink, MetaData } from "~/features/links/types"
import { getLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import { removeLinkFromTree } from "~/features/links/link-tree-metadata"
import { withResolvedMirrors } from "~/features/links/link-playback-metadata"
import {
  createUpdatedItemFromMetadata,
  createUpdatedItemWithLinks,
} from "./link-items"
import {
  createCurrentPlayableItem,
  createWatchedLinkItem,
} from "./link-playback"
import { buildLinkViewItem, showSaveError } from "./link-add"

const persistWithoutWaiting = (operation: Promise<void>) => {
  operation.catch((error) => console.error(error))
}

export const useLinksMutations = (persistence: LinksPersistence) => {
  const remove = useCallback(
    async (url: string, id?: string, silent = false) => {
      try {
        await persistence.delete(url, id)
        if (!silent) {
          toast.success("Link removed")
        }
      } catch {
        if (!silent) {
          toast.error("The saved link couldn’t be removed. Try again.")
        }
      }
    },
    [persistence]
  )

  const clearLinks = useCallback(async () => {
    try {
      await persistence.clear()
      toast.success("Saved links cleared")
    } catch {
      toast.error("Saved links couldn’t be cleared. Try again.")
    }
  }, [persistence])

  const addLink = useCallback(
    async (
      targetUrl: string,
      meta?: MetaData,
      extractedLinks?: ExtractedLink[]
    ) => {
      const { item } = await buildLinkViewItem({
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

  const updateLinks = useCallback(
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
    (itemUrl: string, lazyItemUrl: string, mirrors: ExtractedLink[]) => {
      persistWithoutWaiting(
        persistence.update(itemUrl, (item) =>
          createUpdatedItemFromMetadata(
            item,
            withResolvedMirrors(
              getLinkViewItemMetadata(item),
              lazyItemUrl,
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
          const metadata = getLinkViewItemMetadata(item)
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

  const setPlayableItemAsCurrent = useCallback(
    (itemUrl: string, lazyItemUrl: string, folderItemUrls: string[]) => {
      persistWithoutWaiting(
        persistence.update(itemUrl, (item) =>
          createCurrentPlayableItem(item, lazyItemUrl, folderItemUrls)
        )
      )
    },
    [persistence]
  )

  return {
    remove,
    clearLinks,
    addLink,
    updateLinks,
    markLinkAsWatched,
    cacheResolvedMirrors,
    removeLink,
    setPlayableItemAsCurrent,
  }
}
