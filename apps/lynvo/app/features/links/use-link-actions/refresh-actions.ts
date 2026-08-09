import { useCallback, useMemo } from "react"
import { toast } from "sonner"
import type { ExtractedLink, LinkListItem } from "~/features/links/types"
import {
  expandFolderLink,
  expandMirrorLinks,
  hardRefreshLink,
  softRefreshLink,
} from "./refresh-flow"
import type { OpenSelectionDialogOptions } from "./action-types"
import { getLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import { getDraftSelection } from "~/features/links/saved-link-interaction"
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
        } else if (outcome.kind === "refresh-succeeded") {
          toast.success("Links refreshed")
        } else if (outcome.kind === "error") {
          toast.error(outcome.message)
        }
      },
    }),
    [openSelectionDialog, updateLinks]
  )
  const savedLinks = useMemo(
    () => links.filter((item) => item.kind === "saved"),
    [links]
  )

  const handleSoftRefresh = useCallback(
    async (itemUrl: string) => {
      await runWithExtractingItem(itemUrl, () =>
        softRefreshLink({ itemUrl, links: savedLinks, reporter })
      )
    },
    [reporter, runWithExtractingItem, savedLinks]
  )

  const handleHardRefresh = useCallback(
    async (itemUrl: string) => {
      await runWithExtractingItem(itemUrl, () =>
        hardRefreshLink({
          itemUrl,
          links: savedLinks,
          reporter,
        })
      )
    },
    [reporter, runWithExtractingItem, savedLinks]
  )

  const handleShowLinks = useCallback(
    async (itemUrl: string) => {
      const item = links.find((linkItem) => linkItem.url === itemUrl)
      if (item?.kind === "draft") {
        reporter.publish({
          kind: "selection-required",
          selection: getDraftSelection(item),
        })
        return
      }
      await handleHardRefresh(itemUrl)
    },
    [handleHardRefresh, links, reporter]
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
        return cachedMirrors
      }

      return runWithExtractingItem(lazyItemUrl, async () => {
        const mirrors = await expandMirrorLinks({
          itemUrl,
          lazyItemUrl,
          links: savedLinks,
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
      savedLinks,
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
          links: savedLinks,
          reporter,
        })
      )
    },
    [extractingItems, reporter, runWithExtractingItem, savedLinks]
  )

  return {
    handleShowLinks,
    handleExpandFolder,
    handleSoftRefresh,
    handleHardRefresh,
    handleMirrorExpand,
  }
}
