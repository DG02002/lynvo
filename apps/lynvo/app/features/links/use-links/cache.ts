import type { LinkViewItem } from "~/features/links/types"
import { toLinkViewItem, type SavedLink } from "~/features/links/links.mapper"

export interface SavedLinksSnapshot {
  results: SavedLink[]
}

export const linksToLinkViewItems = (
  links: SavedLink[],
  _previous: LinkViewItem[] = []
) => links.map(toLinkViewItem)
