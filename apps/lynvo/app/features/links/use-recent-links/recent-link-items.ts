import { createLinkMetadata, toFlatMeta } from "~/features/links/links.mapper"
import {
  getRecentLinkViewItemFlatMeta,
  getRecentLinkViewItemMetadata,
} from "~/features/links/link-metadata-accessors"
import type {
  ExtractedLink,
  LinkMetadata,
  MetaData,
  RecentLinkViewItem,
} from "~/features/links/types"

export interface CreateRecentLinkViewItemOptions {
  targetUrl: string
  title: string
  metadata: LinkMetadata
}

export interface CreateLinkUpdateOptions {
  item: RecentLinkViewItem
  links: ExtractedLink[]
}

const getSourceString = (metadata: LinkMetadata, key: string) => {
  const value = metadata.source[key]
  return typeof value === "string" ? value : undefined
}

const getSourceStatus = (metadata: LinkMetadata) => {
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
    meta: toFlatMeta(metadata),
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
  metadata: LinkMetadata
): RecentLinkViewItem => ({
  ...item,
  metadata,
  meta: toFlatMeta(metadata),
  extractedLinks: metadata.extraction.extractedLinks,
})

export const createUpdatedItemWithLinks = ({
  item,
  links,
}: CreateLinkUpdateOptions) => {
  const previous = getRecentLinkViewItemMetadata(item)
  const metadata = createLinkMetadata({
    meta: getRecentLinkViewItemFlatMeta(item),
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
