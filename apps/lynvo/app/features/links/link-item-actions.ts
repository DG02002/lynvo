import type { ExtractedLink, LinkViewItem } from "./types"

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
  /** Opens the link selection dialog to re-choose which links to keep. */
  chooseLinks?: (item: LinkViewItem) => void
  /** Stores the authoritative artwork identity for a saved link. */
  setArtwork?: (itemUrl: string, identity: MediaArtworkIdentity) => void
}
