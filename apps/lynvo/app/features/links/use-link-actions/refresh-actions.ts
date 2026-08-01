import { useCallback, useMemo } from "react"
import type { ExtractedLink, LinkViewItem } from "~/features/links/types"
import {
  expandFolderLink,
  expandMirrorLinks,
  hardRefreshLink,
  softRefreshLink,
} from "./refresh-flow"
import type { OpenSelectionDialogOptions } from "./action-types"
import {
  getLinkViewItemExtractedLinks,
  getLinkViewItemFlatMeta,
  getLinkViewItemMetadata,
} from "~/features/links/link-metadata-accessors"
import { createRefreshFlowEffects } from "./refresh-flow-effects"

export const useRefreshActions = ({
  links,
  updateLinks,
  cacheResolvedMirrors,
  openSelectionDialog,
  extractingItems,
  runWithExtractingItem,
}: {
  links: LinkViewItem[]
  updateLinks: (url: string, links: ExtractedLink[]) => void
  cacheResolvedMirrors: (
    itemUrl: string,
    lazyItemUrl: string,
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
        updateLinks,
        openSelectionDialog,
        extractingItems,
        runWithExtractingItem,
      }),
    [extractingItems, openSelectionDialog, runWithExtractingItem, updateLinks]
  )

  const handleSoftRefresh = useCallback(
    async (itemUrl: string) => {
      await effects.runExtracting(itemUrl, () =>
        softRefreshLink({ itemUrl, links, effects })
      )
    },
    [effects, links]
  )

  const handleHardRefresh = useCallback(
    async (itemUrl: string) => {
      await effects.runExtracting(itemUrl, () =>
        hardRefreshLink({
          itemUrl,
          links,
          effects,
        })
      )
    },
    [effects, links]
  )

  const handleShowLinks = useCallback(
    async (itemUrl: string) => {
      const item = links.find((linkItem) => linkItem.url === itemUrl)
      if (item?.isDraft) {
        effects.openSelection({
          originalUrl: item.url,
          links: item.extractedLinks ?? getLinkViewItemExtractedLinks(item),
          meta: item.meta ?? getLinkViewItemFlatMeta(item),
          isDraftMode: true,
        })
        return
      }
      await handleHardRefresh(itemUrl)
    },
    [effects, handleHardRefresh, links]
  )

  const handleMirrorExpand = useCallback(
    async (
      itemUrl: string,
      lazyItemUrl: string,
      bypassCache = false
    ): Promise<ExtractedLink[] | null> => {
      if (effects.isExtracting(lazyItemUrl)) {
        return null
      }

      const item = links.find((linkItem) => linkItem.url === itemUrl)
      const cachedMirrors = item
        ? getLinkViewItemMetadata(item).playback.resolvedMirrors?.[lazyItemUrl]
        : undefined
      if (cachedMirrors && !bypassCache) {
        return cachedMirrors
      }

      return effects.runExtracting(lazyItemUrl, async () => {
        const mirrors = await expandMirrorLinks({
          itemUrl,
          lazyItemUrl,
          links,
          effects,
        })
        if (mirrors) {
          cacheResolvedMirrors(itemUrl, lazyItemUrl, mirrors)
        }
        return mirrors
      })
    },
    [cacheResolvedMirrors, effects, links]
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
          links,
          effects,
        })
      )
    },
    [effects, links]
  )

  return {
    handleShowLinks,
    handleExpandFolder,
    handleSoftRefresh,
    handleHardRefresh,
    handleMirrorExpand,
  }
}
