import type { ExtractedLink, LinkMetadata, LinkViewItem } from "./types"
import { applyOpenedState } from "./link-playback-metadata"
import { getLinkSourceFields } from "./link-source-fields"

export interface SavedLink {
  id: string
  url: string
  title?: string
  createdAt: number
  updatedAt: number
  metadata: LinkMetadata
}

export interface LinkViewModel {
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

export const toLinkViewItem = (dto: SavedLink): LinkViewItem => ({
  id: dto.id,
  url: dto.url,
  title: dto.title,
  timestamp: dto.createdAt,
  updatedAt: dto.updatedAt,
  metadata: dto.metadata,
})

const toSavedLinkFromLinkViewItem = (item: LinkViewItem): SavedLink => ({
  id: item.id ?? item.url,
  url: item.url,
  title: item.title,
  createdAt: item.timestamp,
  updatedAt: item.updatedAt ?? item.timestamp,
  metadata: item.metadata,
})

export const toLinkViewModel = (item: LinkViewItem): LinkViewModel => {
  const dto = toSavedLinkFromLinkViewItem(item)
  const openedUrls = new Set(dto.metadata.playback.openedUrls)
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
    extractedLinks: applyOpenedState(
      dto.metadata.extraction.extractedLinks,
      openedUrls
    ),
  }
}
