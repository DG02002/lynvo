import {
  getLinkViewItemFlatMeta,
  getLinkViewItemMetadata,
} from "~/features/links/link-metadata-accessors"
import {
  appendLinkDebugLog,
  createLinkMetadata,
} from "~/features/links/link-metadata-normalization"
import type {
  ExtractedLink,
  LinkDebugLogEntry,
  LinkExtractionStatus,
  LinkMetadata,
  LinkViewItem,
} from "~/features/links/types"

export interface CreateLinkViewItemOptions {
  targetUrl: string
  title: string
  metadata: LinkMetadata
  extractionStatus?: LinkExtractionStatus
}

export interface CreateLinkUpdateOptions {
  item: LinkViewItem
  links: ExtractedLink[]
  debugLogEntry?: LinkDebugLogEntry
}

export const createLinkViewItem = ({
  targetUrl,
  title,
  metadata,
  extractionStatus,
}: CreateLinkViewItemOptions): LinkViewItem => {
  return {
    url: targetUrl,
    title,
    timestamp: Date.now(),
    updatedAt: Date.now(),
    metadata,
    extractionStatus: extractionStatus ?? { state: "complete" },
  }
}

export const createUpdatedItemFromMetadata = (
  item: LinkViewItem,
  metadata: LinkMetadata
): LinkViewItem => ({
  ...item,
  metadata,
})

export const createUpdatedItemWithLinks = ({
  item,
  links,
  debugLogEntry,
}: CreateLinkUpdateOptions): LinkViewItem => {
  const previous = getLinkViewItemMetadata(item)
  const metadata = createLinkMetadata({
    meta: getLinkViewItemFlatMeta(item),
    extractedLinks: links,
    previous,
    debugLog: debugLogEntry
      ? appendLinkDebugLog(previous, debugLogEntry)
      : undefined,
  })

  return {
    ...createUpdatedItemFromMetadata(item, metadata),
    extractionStatus: { state: "complete" },
  }
}

export const createUpdatedItemWithDebugLog = (
  item: LinkViewItem,
  entry: LinkDebugLogEntry
): LinkViewItem => {
  const metadata = getLinkViewItemMetadata(item)
  return createUpdatedItemFromMetadata(item, {
    ...metadata,
    debugLog: appendLinkDebugLog(metadata, entry),
  })
}
