import { withOpenedUrl } from "~/features/links/links.mapper"
import { getLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import type { LinkViewItem } from "~/features/links/types"
import { createUpdatedItemFromMetadata } from "./link-items"

export const createOpenedLinkItem = (item: LinkViewItem, linkUrl: string) => {
  if (!item.extractedLinks) {
    return undefined
  }

  const metadata = withOpenedUrl(getLinkViewItemMetadata(item), linkUrl)
  return createUpdatedItemFromMetadata(item, metadata)
}
