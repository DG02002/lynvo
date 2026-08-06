import type { ExtractedLink, MetaData } from "~/features/links/types"

export interface LinksActions {
  add: (
    url: string,
    meta?: MetaData,
    extractedLinks?: ExtractedLink[]
  ) => Promise<string | undefined>
  remove: (url: string, id?: string, silent?: boolean) => Promise<void>
  updateLinks: (url: string, links: ExtractedLink[]) => void
  markOpened: (itemUrl: string, linkUrl: string) => void
  cacheResolvedMirrors: (
    itemUrl: string,
    lazyItemUrl: string,
    mirrors: ExtractedLink[]
  ) => void
  removeLink: (itemUrl: string, linkKey: string, linkUrl: string) => void
}
