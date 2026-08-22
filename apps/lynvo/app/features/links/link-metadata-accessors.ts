import type { LinkMetadata, MetaData, LinkViewItem } from "./types"
import { toFlatMeta } from "./link-metadata-normalization"
import { Result, Schema } from "effect"

export const getMetadataPluginServerId = (
  metadata: LinkMetadata | MetaData | undefined
) => {
  if (!metadata) {
    return undefined
  }

  if ("source" in metadata) {
    const pluginServerId = Schema.decodeUnknownResult(Schema.String)(
      metadata.source.pluginServerId
    )
    return Result.isSuccess(pluginServerId) ? pluginServerId.success : undefined
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
  const pluginId = Schema.decodeUnknownResult(Schema.String)(
    getLinkViewItemMetadata(item).source.pluginId
  )
  return Result.isSuccess(pluginId) ? pluginId.success : undefined
}

export const getLinkViewItemMetadata = (item: LinkViewItem): LinkMetadata =>
  item.metadata

export const getLinkViewItemFlatMeta = (item: LinkViewItem): MetaData =>
  toFlatMeta(getLinkViewItemMetadata(item))

export const getLinkViewItemExtractedLinks = (item: LinkViewItem) =>
  getLinkViewItemMetadata(item).extraction.extractedLinks
