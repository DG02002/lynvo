import { createMetadataV2, toLegacyMeta } from "~/features/links/links.mapper"
import {
  getRecentLinkViewItemLegacyMeta,
  getRecentLinkViewItemMetadata,
} from "~/features/links/link-metadata-accessors"
import type {
  ExtractedLink,
  LinkMetadataV2,
  MetaData,
  RecentLinkViewItem,
} from "~/features/links/types"

export interface CreateRecentLinkViewItemOptions {
  targetUrl: string
  title: string
  metadata: LinkMetadataV2
}

export interface CreateLinkUpdateOptions {
  item: RecentLinkViewItem
  links: ExtractedLink[]
}

const getSourceString = (metadata: LinkMetadataV2, key: string) => {
  const value = metadata.source[key]
  return typeof value === "string" ? value : undefined
}

const getSourceStatus = (metadata: LinkMetadataV2) => {
  const value = metadata.source.sourceStatus
  return value === "active" ||
    value === "maintenance" ||
    value === "degraded" ||
    value === "down"
    ? value
    : undefined
}

export const createRecentLinkViewItem = ({
  targetUrl,
  title,
  metadata,
}: CreateRecentLinkViewItemOptions): RecentLinkViewItem => {
  return {
    url: targetUrl,
    title,
    timestamp: Date.now(),
    updatedAt: Date.now(),
    hasFilename: Boolean(metadata.source.filename),
    metadata,
    meta: toLegacyMeta(metadata),
    pluginName: getSourceString(metadata, "pluginName"),
    pluginIcon: getSourceString(metadata, "pluginIcon"),
    sourceName: getSourceString(metadata, "sourceName"),
    sourceIconUrl: getSourceString(metadata, "sourceIconUrl"),
    sourceStatus: getSourceStatus(metadata),
    sourceVersion: getSourceString(metadata, "sourceVersion"),
    extractedLinks: metadata.extraction.extractedLinks,
  }
}

export const createUpdatedItemFromMetadata = (
  item: RecentLinkViewItem,
  metadata: LinkMetadataV2
): RecentLinkViewItem => ({
  ...item,
  metadata,
  meta: toLegacyMeta(metadata),
  extractedLinks: metadata.extraction.extractedLinks,
})

export const createUpdatedItemWithLinks = ({
  item,
  links,
}: CreateLinkUpdateOptions) => {
  const previous = getRecentLinkViewItemMetadata(item)
  const metadata = createMetadataV2({
    meta: getRecentLinkViewItemLegacyMeta(item),
    extractedLinks: links,
    previous,
  })

  return {
    ...createUpdatedItemFromMetadata(item, metadata),
    extractedLinks: metadata.extraction.extractedLinks,
  }
}

export const getFilenameFromUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url)
    const lastPathPart = parsedUrl.pathname.split("/").at(-1)
    return lastPathPart && lastPathPart.length > 1
      ? decodeURIComponent(lastPathPart)
      : parsedUrl.hostname
  } catch {
    return url
  }
}

export const getRecentTitle = (targetUrl: string, meta: MetaData) =>
  meta.title || meta.pageTitle || meta.filename || getFilenameFromUrl(targetUrl)
