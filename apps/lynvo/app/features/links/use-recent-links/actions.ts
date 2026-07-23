import type { ExtractedLink, MetaData } from "~/features/links/types"

export interface RecentLinksActions {
  add: (
    url: string,
    meta?: MetaData,
    extractedLinks?: ExtractedLink[]
  ) => Promise<string | undefined>
  remove: (url: string, id?: string, silent?: boolean) => Promise<void>
  updateLinks: (url: string, links: ExtractedLink[]) => void
  markWatched: (itemUrl: string, linkUrl: string) => void
  cacheResolvedMirrors: (
    itemUrl: string,
    lazyItemUrl: string,
    mirrors: ExtractedLink[]
  ) => void
  removeLink: (itemUrl: string, linkKey: string, linkUrl: string) => void
  setPlayableItemAsCurrent: (
    itemUrl: string,
    lazyItemUrl: string,
    folderItemUrls: string[]
  ) => void
}
