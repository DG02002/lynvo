import { getLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import { withOpenedUrl } from "~/features/links/link-playback-metadata"
import type { LinkViewItem } from "~/features/links/types"

import { createUpdatedItemFromMetadata } from "./link-items"

export const createOpenedLinkItem = (item: LinkViewItem, linkUrl: string) => {
  const metadata = withOpenedUrl(getLinkViewItemMetadata(item), linkUrl)
  return createUpdatedItemFromMetadata(item, metadata)
}
