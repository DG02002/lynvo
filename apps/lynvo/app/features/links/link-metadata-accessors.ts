import type { LinkMetadata, MetaData, RecentLinkViewItem } from "./types"
import {
  normalizeLinkMetadata,
  toFlatMeta,
} from "./link-metadata-normalization"

export const getMetadataPluginServerId = (
  metadata: LinkMetadata | MetaData | undefined
) => {
  if (!metadata) {
    return undefined
  }

  if ("source" in metadata) {
    const pluginServerId = metadata.source.pluginServerId
    return typeof pluginServerId === "string" ? pluginServerId : undefined
  }

  return metadata.pluginServerId
}

export const getRecentLinkViewItemPluginServerId = (
  item: RecentLinkViewItem | undefined
) =>
  item
    ? getMetadataPluginServerId(getRecentLinkViewItemMetadata(item))
    : undefined

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
): LinkMetadata =>
  item.metadata ?? normalizeLinkMetadata(item.meta, item.extractedLinks)

export const getRecentLinkViewItemFlatMeta = (
  item: RecentLinkViewItem
): MetaData => toFlatMeta(getRecentLinkViewItemMetadata(item))

export const getRecentLinkViewItemExtractedLinks = (item: RecentLinkViewItem) =>
  getRecentLinkViewItemMetadata(item).extraction.extractedLinks
