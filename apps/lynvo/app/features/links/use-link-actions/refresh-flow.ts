import type { ExtractedLink } from "~/features/links/types"
import { extractionOrchestration } from "~/lib/extraction/orchestration"
import type {
  FolderExpandOptions,
  MirrorExpandOptions,
  SoftRefreshOptions,
} from "./action-types"

export const softRefreshLink = async ({
  itemUrl,
  links,
  effects,
}: SoftRefreshOptions) => {
  try {
    const currentItem = links.find((linkItem) => linkItem.url === itemUrl)

    if (currentItem) {
      const refreshedLinks =
        await extractionOrchestration.refreshSource(currentItem)
      effects.updateLinks(itemUrl, refreshedLinks)
    }
    effects.showRefreshSuccess()
  } catch (error) {
    console.error(error)
    effects.showRefreshError()
  }
}

export const hardRefreshLink = async ({
  itemUrl,
  links,
  effects,
}: SoftRefreshOptions) => {
  const item = links.find((linkItem) => linkItem.url === itemUrl)

  try {
    const { mergedMeta, presentation } =
      await extractionOrchestration.prepareSource({
        targetUrl: itemUrl,
        links,
        existingMeta: item?.meta,
      })

    if (presentation.kind === "selectionDialog") {
      effects.openSelection({
        originalUrl: itemUrl,
        links: presentation.links,
        meta: mergedMeta,
        existingItemId: item?.id,
      })
      return
    }

    if (presentation.kind === "directSave") {
      if (item) {
        effects.updateLinks(itemUrl, [presentation.link])
      }
      effects.showRefreshSuccess()
      return
    }

    effects.showNoLinks()
  } catch (error) {
    console.error(error)
    effects.showReselectError()
  }
}

export const expandMirrorLinks = async ({
  itemUrl,
  lazyItemUrl,
  links,
  effects,
}: MirrorExpandOptions): Promise<ExtractedLink[] | null> => {
  try {
    const item = links.find((linkItem) => linkItem.url === itemUrl)
    return await extractionOrchestration.resolveMirror(item, lazyItemUrl)
  } catch (error) {
    console.error(error)
    effects.showMirrorError()
    return null
  }
}

export const expandFolderLink = async ({
  itemUrl,
  linkId,
  linkUrl,
  links,
  effects,
}: FolderExpandOptions) => {
  try {
    const currentItem = links.find((linkItem) => linkItem.url === itemUrl)
    if (!currentItem || !currentItem.extractedLinks) {
      return null
    }

    const expandedLinks = await extractionOrchestration.expandFolder({
      item: currentItem,
      linkId,
      linkUrl,
    })
    effects.updateLinks(itemUrl, expandedLinks)
    return expandedLinks
  } catch (error) {
    console.error(error)
    effects.showOptionsError()
    return null
  }
}
