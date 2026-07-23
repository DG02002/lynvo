import type { ExtractedLink } from "~/features/links/types"
import { extractionOrchestration } from "~/lib/extraction/orchestration"
import type {
  FolderExpandOptions,
  MirrorExpandOptions,
  SoftRefreshOptions,
} from "./action-types"

export const softRefreshLink = async ({
  itemUrl,
  recents,
  effects,
}: SoftRefreshOptions) => {
  try {
    const currentItem = recents.find((recentItem) => recentItem.url === itemUrl)

    if (currentItem) {
      const links = await extractionOrchestration.refreshSource(currentItem)
      effects.updateLinks(itemUrl, links)
    }
    effects.showRefreshSuccess()
  } catch (error) {
    console.error(error)
    effects.showRefreshError()
  }
}

export const hardRefreshLink = async ({
  itemUrl,
  recents,
  effects,
}: SoftRefreshOptions) => {
  const item = recents.find((recentItem) => recentItem.url === itemUrl)

  try {
    const { mergedMeta, presentation } =
      await extractionOrchestration.prepareSource({
        targetUrl: itemUrl,
        recents,
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
  recents,
  effects,
}: MirrorExpandOptions): Promise<ExtractedLink[] | null> => {
  try {
    const item = recents.find((recentItem) => recentItem.url === itemUrl)
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
  recents,
  effects,
}: FolderExpandOptions) => {
  try {
    const currentItem = recents.find((recentItem) => recentItem.url === itemUrl)
    if (!currentItem || !currentItem.extractedLinks) {
      return null
    }

    const links = await extractionOrchestration.expandFolder({
      item: currentItem,
      linkId,
      linkUrl,
    })
    effects.updateLinks(itemUrl, links)
    return links
  } catch (error) {
    console.error(error)
    effects.showOptionsError()
    return null
  }
}
