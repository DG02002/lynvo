import type {
  ExtractedLink,
  LinkMetadataV2,
  LinkResponse,
  RecentLinkViewItem,
} from "./types"
import {
  normalizeLinkMetadata,
  toLegacyMeta,
} from "./link-metadata-normalization"
import { applyWatchedState } from "./link-playback-metadata"
import { getLinkSourceFields } from "./link-source-fields"
import { getRecentLinkViewItemMetadata } from "./link-metadata-accessors"

export interface SavedLinkDTO {
  id: string
  url: string
  title?: string
  createdAt: number
  updatedAt: number
  metadata: LinkMetadataV2
}

export type SavedLink = SavedLinkDTO

export interface RecentLinkViewModel {
  id?: string
  url: string
  title?: string
  timestamp: number
  updatedAt: number
  badge?: string
  contentLength?: number
  pluginName?: string
  pluginIcon?: string
  sourceName?: string
  sourceIconUrl?: string
  sourceStatus?: "active" | "maintenance" | "degraded" | "down"
  sourceVersion?: string
  extractedLinks: ExtractedLink[]
}

export const toSavedLinkDTO = (link: LinkResponse): SavedLinkDTO => ({
  id: link.id,
  url: link.url,
  title: link.title,
  createdAt: link.created_at,
  updatedAt: link.updated_at ?? link.created_at,
  metadata: normalizeLinkMetadata(link.meta, link.extractedLinks),
})

export const toRecentLinkViewItem = (dto: SavedLink): RecentLinkViewItem => {
  const source = getLinkSourceFields(dto.metadata)
  return {
    id: dto.id,
    url: dto.url,
    title: dto.title,
    timestamp: dto.createdAt,
    updatedAt: dto.updatedAt,
    metadata: dto.metadata,
    meta: toLegacyMeta(dto.metadata),
    hasFilename: Boolean(dto.metadata.source.filename),
    pluginName: source.pluginName,
    pluginIcon: source.pluginIcon,
    sourceName: source.sourceName,
    sourceIconUrl: source.sourceIconUrl,
    sourceStatus: source.sourceStatus,
    sourceVersion: source.sourceVersion,
    extractedLinks: dto.metadata.extraction.extractedLinks,
  }
}

const toSavedLinkDTOFromRecentLinkViewItem = (
  item: RecentLinkViewItem
): SavedLinkDTO => ({
  id: item.id ?? item.url,
  url: item.url,
  title: item.title,
  createdAt: item.timestamp,
  updatedAt: item.updatedAt ?? item.timestamp,
  metadata: getRecentLinkViewItemMetadata(item),
})

export const toRecentLinkViewModel = (
  item: RecentLinkViewItem
): RecentLinkViewModel => {
  const dto = toSavedLinkDTOFromRecentLinkViewItem(item)
  const watchedUrls = new Set(dto.metadata.playback.watchedUrls)
  const watchedIds = new Set(dto.metadata.playback.watchedIds)
  const source = getLinkSourceFields(dto.metadata)

  return {
    id: dto.id,
    url: dto.url,
    title: dto.title,
    timestamp: dto.createdAt,
    updatedAt: dto.updatedAt,
    badge: source.badge,
    contentLength: source.contentLength,
    pluginName: source.pluginName,
    pluginIcon: source.pluginIcon,
    sourceName: source.sourceName,
    sourceIconUrl: source.sourceIconUrl,
    sourceStatus: source.sourceStatus,
    sourceVersion: source.sourceVersion,
    extractedLinks: applyWatchedState(
      dto.metadata.extraction.extractedLinks,
      watchedUrls,
      watchedIds
    ),
  }
}
