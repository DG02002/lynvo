import { createLinkMetadata } from "~/features/links/links.mapper"
import {
  getLinkViewItemFlatMeta,
  getLinkViewItemMetadata,
} from "~/features/links/link-metadata-accessors"
import type {
  ExtractedLink,
  LinkExtractionStatus,
  LinkMetadata,
  MetaData,
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
}: CreateLinkUpdateOptions): LinkViewItem => {
  const previous = getLinkViewItemMetadata(item)
  const metadata = createLinkMetadata({
    meta: getLinkViewItemFlatMeta(item),
    extractedLinks: links,
    previous,
  })

  return {
    ...createUpdatedItemFromMetadata(item, metadata),
    extractionStatus: { state: "complete" },
  }
}

export const getFilenameFromUrl = (url: string) => {
  try {
    const parsedUrl = new URL(url)
    const lastPathPart = parsedUrl.pathname.split("/").filter(Boolean).at(-1)
    return lastPathPart && lastPathPart.length > 1
      ? decodeURIComponent(lastPathPart)
      : parsedUrl.hostname
  } catch {
    return url
  }
}

export const getLinkTitle = (targetUrl: string, meta: MetaData) =>
  meta.title || meta.pageTitle || meta.filename || getFilenameFromUrl(targetUrl)
