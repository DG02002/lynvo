import type { ExtractedLink } from "./types"

export interface LinkItemActions {
  play: (target: string | ExtractedLink) => Promise<PlaybackHandoffResult>
  remove: (url: string, id?: string) => void
  showLinks: (url: string) => void
  markOpened: (itemUrl: string, linkUrl: string) => void
  removeLink?: (itemUrl: string, linkKey: string, linkUrl: string) => void
  expandFolder: (
    itemUrl: string,
    linkId: string,
    linkUrl: string
  ) => Promise<ExtractedLink[] | null>
  softRefresh: (url: string) => void
  hardRefresh: (url: string) => void
  expandMirror: (
    itemUrl: string,
    lazyItemUrl: string,
    bypassCache?: boolean
  ) => Promise<ExtractedLink[] | null>
}
