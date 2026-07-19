import { useCallback, useMemo } from "react"
import type { ExtractedLink, RecentLinkViewItem } from "~/features/links/types"
import {
  expandFolderLink,
  expandMirrorLinks,
  hardRefreshLink,
  softRefreshLink,
} from "./refresh-flow"
import type { OpenSelectionDialogOptions } from "./action-types"
import {
  getRecentLinkViewItemExtractedLinks,
  getRecentLinkViewItemLegacyMeta,
  getRecentLinkViewItemMetadata,
} from "~/features/links/link-metadata-accessors"
import { createRefreshFlowEffects } from "./refresh-flow-effects"

export const useRefreshActions = ({
  recents,
  updateRecentLinks,
  cacheResolvedMirrors,
  openSelectionDialog,
  extractingItems,
  runWithExtractingItem,
}: {
  recents: RecentLinkViewItem[]
  updateRecentLinks: (url: string, links: ExtractedLink[]) => void
  cacheResolvedMirrors: (
    itemUrl: string,
    episodeUrl: string,
    mirrors: ExtractedLink[]
  ) => void
  openSelectionDialog: (options: OpenSelectionDialogOptions) => void
  extractingItems: Set<string>
  runWithExtractingItem: <T>(
    itemKey: string,
    task: () => Promise<T>
  ) => Promise<T>
}) => {
  const effects = useMemo(
    () =>
      createRefreshFlowEffects({
        updateRecentLinks,
        openSelectionDialog,
        extractingItems,
        runWithExtractingItem,
      }),
    [
      extractingItems,
      openSelectionDialog,
      runWithExtractingItem,
      updateRecentLinks,
    ]
  )

  const handleSoftRefresh = useCallback(
    async (itemUrl: string) => {
      await effects.runExtracting(itemUrl, () =>
        softRefreshLink({ itemUrl, recents, effects })
      )
    },
    [effects, recents]
  )

  const handleHardRefresh = useCallback(
    async (itemUrl: string) => {
      await effects.runExtracting(itemUrl, () =>
        hardRefreshLink({
          itemUrl,
          recents,
          effects,
        })
      )
    },
    [effects, recents]
  )

  const handleShowLinks = useCallback(
    async (itemUrl: string) => {
      const item = recents.find((recentItem) => recentItem.url === itemUrl)
      if (item?.isDraft) {
        effects.openSelection({
          originalUrl: item.url,
          links:
            item.extractedLinks ?? getRecentLinkViewItemExtractedLinks(item),
          meta: item.meta ?? getRecentLinkViewItemLegacyMeta(item),
          isDraftMode: true,
        })
        return
      }
      await handleHardRefresh(itemUrl)
    },
    [effects, handleHardRefresh, recents]
  )

  const handleMirrorExpand = useCallback(
    async (
      itemUrl: string,
      episodeUrl: string,
      bypassCache = false
    ): Promise<ExtractedLink[] | null> => {
      if (effects.isExtracting(episodeUrl)) {
        return null
      }

      const item = recents.find((recentItem) => recentItem.url === itemUrl)
      const cachedMirrors = item
        ? getRecentLinkViewItemMetadata(item).playback.resolvedMirrors?.[
            episodeUrl
          ]
        : undefined
      if (cachedMirrors && !bypassCache) {
        return cachedMirrors
      }

      return effects.runExtracting(episodeUrl, async () => {
        const mirrors = await expandMirrorLinks({
          itemUrl,
          episodeUrl,
          recents,
          effects,
        })
        if (mirrors) {
          cacheResolvedMirrors(itemUrl, episodeUrl, mirrors)
        }
        return mirrors
      })
    },
    [cacheResolvedMirrors, effects, recents]
  )

  const handleExpandFolder = useCallback(
    async (itemUrl: string, linkId: string, linkUrl: string) => {
      if (effects.isExtracting(linkUrl)) {
        return null
      }

      return await effects.runExtracting(linkUrl, () =>
        expandFolderLink({
          itemUrl,
          linkId,
          linkUrl,
          recents,
          effects,
        })
      )
    },
    [effects, recents]
  )

  return {
    handleShowLinks,
    handleExpandFolder,
    handleSoftRefresh,
    handleHardRefresh,
    handleMirrorExpand,
  }
}
