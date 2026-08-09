import type { ExtractedLink } from "~/features/links/types"
import { getLinkViewItemFlatMeta } from "~/features/links/link-metadata-accessors"
import { extractionOrchestration } from "~/lib/extraction/orchestration"
import type {
  FolderExpandOptions,
  MirrorExpandOptions,
  SoftRefreshOptions,
} from "./action-types"

export const softRefreshLink = async ({
  itemUrl,
  links,
  reporter,
}: SoftRefreshOptions) => {
  try {
    const currentItem = links.find((linkItem) => linkItem.url === itemUrl)

    if (currentItem) {
      const refreshedLinks =
        await extractionOrchestration.refreshSource(currentItem)
      reporter.publish({
        kind: "links-updated",
        itemUrl,
        links: refreshedLinks,
      })
    }
    reporter.publish({ kind: "refresh-succeeded" })
  } catch (error) {
    console.error(error)
    reporter.publish({
      kind: "error",
      message: "The saved link couldn’t be refreshed. Try again.",
    })
  }
}

export const hardRefreshLink = async ({
  itemUrl,
  links,
  reporter,
}: SoftRefreshOptions) => {
  const item = links.find((linkItem) => linkItem.url === itemUrl)

  try {
    const { mergedMeta, presentation } =
      await extractionOrchestration.prepareSource({
        targetUrl: itemUrl,
        links,
        existingMeta: item ? getLinkViewItemFlatMeta(item) : undefined,
      })

    if (presentation.kind === "selectionDialog") {
      reporter.publish({
        kind: "selection-required",
        selection: {
          originalUrl: itemUrl,
          links: presentation.links,
          meta: mergedMeta,
          existingItemId: item?.id,
        },
      })
      return
    }

    if (presentation.kind === "directSave") {
      if (item) {
        reporter.publish({
          kind: "links-updated",
          itemUrl,
          links: [presentation.link],
        })
      }
      reporter.publish({ kind: "refresh-succeeded" })
      return
    }

    reporter.publish({
      kind: "error",
      message: "No playable links are available. Try another Source page.",
    })
  } catch (error) {
    console.error(error)
    reporter.publish({
      kind: "error",
      message: "Link choices couldn’t be loaded. Try again.",
    })
  }
}

export const expandMirrorLinks = async ({
  itemUrl,
  lazyItemUrl,
  links,
  reporter,
}: MirrorExpandOptions): Promise<ExtractedLink[] | null> => {
  try {
    const item = links.find((linkItem) => linkItem.url === itemUrl)
    return await extractionOrchestration.resolveMirror(item, lazyItemUrl)
  } catch (error) {
    console.error(error)
    reporter.publish({
      kind: "error",
      message: "Playable links couldn’t be loaded. Try again.",
    })
    return null
  }
}

export const expandFolderLink = async ({
  itemUrl,
  linkId,
  linkUrl,
  links,
  reporter,
}: FolderExpandOptions) => {
  try {
    const currentItem = links.find((linkItem) => linkItem.url === itemUrl)
    if (!currentItem) {
      return null
    }

    const expandedLinks = await extractionOrchestration.expandFolder({
      item: currentItem,
      linkId,
      linkUrl,
    })
    reporter.publish({ kind: "links-updated", itemUrl, links: expandedLinks })
    return expandedLinks
  } catch (error) {
    console.error(error)
    reporter.publish({
      kind: "error",
      message: "Playback options couldn’t be loaded. Try again.",
    })
    return null
  }
}
