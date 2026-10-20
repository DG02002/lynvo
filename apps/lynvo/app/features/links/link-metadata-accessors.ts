import { Result, Schema } from "effect"

import { DIRECT_MEDIA_PLUGIN_ID } from "~/lib/constants"

import { toFlatMeta } from "./link-metadata-normalization"
import { getMetadataPluginServerId } from "./link-source-fields"
import type { LinkMetadata, MetaData, LinkViewItem } from "./types"

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

// Direct Media items are the playable URL itself: re-extraction would probe
// the same URL again, so they offer no refresh.
export const isDirectMediaItem = (item: LinkViewItem | undefined): boolean =>
  getLinkViewItemSourceId(item) === DIRECT_MEDIA_PLUGIN_ID

export const getLinkViewItemMetadata = (item: LinkViewItem): LinkMetadata =>
  item.metadata

export const getLinkViewItemFlatMeta = (item: LinkViewItem): MetaData =>
  toFlatMeta(getLinkViewItemMetadata(item))

export const getLinkViewItemExtractedLinks = (item: LinkViewItem) =>
  getLinkViewItemMetadata(item).extraction.extractedLinks
