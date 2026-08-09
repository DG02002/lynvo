import type { LinkMetadata, MetaData, LinkViewItem } from "./types"
import { toFlatMeta } from "./link-metadata-normalization"

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

export const getLinkViewItemPluginServerId = (
  item: LinkViewItem | undefined
) =>
  item ? getMetadataPluginServerId(getLinkViewItemMetadata(item)) : undefined

export const getLinkViewItemSourceId = (item: LinkViewItem | undefined) => {
  if (!item) {
    return undefined
  }
  const pluginId = getLinkViewItemMetadata(item).source.pluginId
  return typeof pluginId === "string" ? pluginId : undefined
}

export const getLinkViewItemMetadata = (item: LinkViewItem): LinkMetadata =>
  item.metadata

export const getLinkViewItemFlatMeta = (item: LinkViewItem): MetaData =>
  toFlatMeta(getLinkViewItemMetadata(item))

export const getLinkViewItemExtractedLinks = (item: LinkViewItem) =>
  getLinkViewItemMetadata(item).extraction.extractedLinks
