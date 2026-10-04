import type { MediaArtworkIdentity } from "~shared/api-contracts"

import type {
  ExtractedLink,
  LinkDebugLogEntry,
  MetaData,
} from "~/features/links/types"

export interface UpdateLinksOptions {
  debugLogEntry?: LinkDebugLogEntry
  /** True when the links came from a confirmed selection-dialog choice. */
  selectionFinalized?: boolean
}

export interface LinksActions {
  add: (
    url: string,
    meta?: MetaData,
    extractedLinks?: ExtractedLink[]
  ) => Promise<string | undefined>
  enqueue: (url: string) => Promise<string | undefined>
  remove: (url: string, id?: string, silent?: boolean) => Promise<void>
  updateLinks: (
    url: string,
    links: ExtractedLink[],
    options?: UpdateLinksOptions
  ) => void
  appendDebugLog: (url: string, debugLogEntry: LinkDebugLogEntry) => void
  markOpened: (itemUrl: string, linkUrl: string) => void
  cacheResolvedMirrors: (
    itemUrl: string,
    lazyItemUrl: string,
    mirrors: ExtractedLink[]
  ) => void
  removeLink: (itemUrl: string, linkKey: string, linkUrl: string) => void
  setArtwork: (itemUrl: string, identity: MediaArtworkIdentity) => void
}
