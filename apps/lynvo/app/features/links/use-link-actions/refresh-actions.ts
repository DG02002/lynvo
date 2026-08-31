import { useCallback, useMemo } from "react"
import { showErrorToast } from "~/lib/toast-notifications"
import type { ExtractedLink, LinkListItem } from "~/features/links/types"
import {
  expandFolderLink,
  expandMirrorLinks,
  hardRefreshLink,
  softRefreshLink,
} from "./refresh-flow"
import type { OpenSelectionDialogOptions } from "./action-types"
import { getLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import { isPlayableLinkFresh } from "~/features/links/link-playback-metadata"
import type { SavedLinkInteractionReporter } from "~/features/links/saved-link-interaction"

export const useRefreshActions = ({
  links,
  updateLinks,
  cacheResolvedMirrors,
  openSelectionDialog,
  extractingItems,
  runWithExtractingItem,
}: {
  links: LinkListItem[]
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
  const reporter = useMemo<SavedLinkInteractionReporter>(
    () => ({
      publish: (outcome) => {
        if (outcome.kind === "selection-required") {
          openSelectionDialog(outcome.selection)
        } else if (outcome.kind === "links-updated") {
          updateLinks(outcome.itemUrl, outcome.links)
        } else if (outcome.kind === "error") {
          showErrorToast({
            title: "Couldn’t refresh the link",
            description: outcome.message,
          })
        }
      },
    }),
    [openSelectionDialog, updateLinks]
  )

  const handleSoftRefresh = useCallback(
    async (itemUrl: string) => {
      await runWithExtractingItem(itemUrl, () =>
        softRefreshLink({ itemUrl, links, reporter })
      )
    },
    [links, reporter, runWithExtractingItem]
  )

  const handleHardRefresh = useCallback(
    async (itemUrl: string) => {
      await runWithExtractingItem(itemUrl, () =>
        hardRefreshLink({
          itemUrl,
          links,
          reporter,
        })
      )
    },
    [links, reporter, runWithExtractingItem]
  )

  const handleShowLinks = useCallback(
    async (itemUrl: string) => {
      await handleHardRefresh(itemUrl)
    },
    [handleHardRefresh]
  )

  const handleMirrorExpand = useCallback(
    async (
      itemUrl: string,
      lazyItemUrl: string,
      bypassCache = false
    ): Promise<ExtractedLink[] | null> => {
      if (extractingItems.has(lazyItemUrl)) {
        return null
      }

      const item = links.find((linkItem) => linkItem.url === itemUrl)
      const cachedMirrors =
        item?.kind === "saved"
          ? getLinkViewItemMetadata(item).playback.resolvedMirrors?.[
              lazyItemUrl
            ]
          : undefined
      if (cachedMirrors && !bypassCache) {
        const freshCachedMirrors = cachedMirrors.filter((mirror) =>
          isPlayableLinkFresh(mirror)
        )
        if (freshCachedMirrors.length > 0) {
          return freshCachedMirrors
        }
      }

      return runWithExtractingItem(lazyItemUrl, async () => {
        const mirrors = await expandMirrorLinks({
          itemUrl,
          lazyItemUrl,
          links,
          reporter,
        })
        if (mirrors) {
          cacheResolvedMirrors(itemUrl, lazyItemUrl, mirrors)
        }
        return mirrors
      })
    },
    [
      cacheResolvedMirrors,
      extractingItems,
      links,
      reporter,
      runWithExtractingItem,
    ]
  )

  const handleExpandFolder = useCallback(
    async (itemUrl: string, linkId: string, linkUrl: string) => {
      if (extractingItems.has(linkUrl)) {
        return null
      }

      return await runWithExtractingItem(linkUrl, () =>
        expandFolderLink({
          itemUrl,
          linkId,
          linkUrl,
          links,
          reporter,
        })
      )
    },
    [extractingItems, links, reporter, runWithExtractingItem]
  )

  return {
    handleShowLinks,
    handleExpandFolder,
    handleSoftRefresh,
    handleHardRefresh,
    handleMirrorExpand,
  }
}
