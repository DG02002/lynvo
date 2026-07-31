import type { LinkMetadataV2, MetaData, RecentLinkViewItem } from "./types"
import {
  normalizeLinkMetadata,
  toLegacyMeta,
} from "./link-metadata-normalization"

export const getMetadataWorkerId = (
  metadata: LinkMetadataV2 | MetaData | undefined
) => {
  if (!metadata) {
    return undefined
  }

  if ("source" in metadata) {
    const workerId = metadata.source.workerId
    return typeof workerId === "string" ? workerId : undefined
  }

  return metadata.workerId
}

export const getRecentLinkViewItemWorkerId = (
  item: RecentLinkViewItem | undefined
) =>
  item ? getMetadataWorkerId(getRecentLinkViewItemMetadata(item)) : undefined

export const getRecentLinkViewItemSourceId = (
  item: RecentLinkViewItem | undefined
) => {
  if (!item) {
    return undefined
  }
  const pluginId = getRecentLinkViewItemMetadata(item).source.pluginId
  return typeof pluginId === "string" ? pluginId : undefined
}

export const getRecentLinkViewItemMetadata = (
  item: RecentLinkViewItem
): LinkMetadataV2 =>
  item.metadata ?? normalizeLinkMetadata(item.meta, item.extractedLinks)

export const getRecentLinkViewItemLegacyMeta = (
  item: RecentLinkViewItem
): MetaData => toLegacyMeta(getRecentLinkViewItemMetadata(item))

export const getRecentLinkViewItemExtractedLinks = (item: RecentLinkViewItem) =>
  getRecentLinkViewItemMetadata(item).extraction.extractedLinks
