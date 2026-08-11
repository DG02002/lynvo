import type {
  ExpirySource,
  RangeRequestCapability,
} from "@dg02002/lynvo-plugin-server-protocol"

export interface ExtractedLink {
  nodeKey?: string
  url?: string
  nodeUrl?: string
  resourceId?: string
  label: string
  id?: string
  badge?: string
  type?: "file" | "folder"
  children?: ExtractedLink[]
  childrenResolved?: boolean
  rangeRequest?: RangeRequestCapability
  expiry?: number // Timestamp when the link expires
  expirySource?: ExpirySource
  status?: "up" | "down"
  opened?: boolean
  size?: string // Human readable size (e.g. "1.5 GB")
  sourceName?: string
  selectable?: boolean // false for non-checkable containers
  /**
   * Internal marker used by the extraction decision layer to distinguish
   * media node kinds after they have been mapped to the user-facing
   * folder/direct-file model. UI code must not rely on this field.
   */
  mediaNodeKind?: "group" | "resolvable" | "playable"
  resolutionKind?: "folder" | "mirrors"
}

export interface LinkResponse {
  id: string
  url: string
  created_at: number
  updated_at?: number
  title?: string
  meta: LinkMetadata | string
}

export interface LinkMetadata {
  schemaVersion: 3
  source: Record<string, unknown>
  extraction: {
    extractedLinks: ExtractedLink[]
    extractedAt?: number
  }
  playback: {
    openedUrls: string[]
    openedIds: string[]
    resolvedMirrors?: Record<string, ExtractedLink[]> // lazy item URL → mirrors
  }
}

export interface MetaData {
  filename?: string
  contentType?: string
  contentLength?: number
  lastModified?: string
  rangeRequest?: RangeRequestCapability
  pluginName?: string
  pluginIcon?: string
  pluginId?: string
  sourceName?: string
  sourceIconUrl?: string
  sourceStatus?: "active" | "maintenance" | "degraded" | "down"
  sourceVersion?: string
  sourceCredentialKind?: "domain-password" | "http-basic"
  routeSourceName?: string
  routeSourceIconUrl?: string
  audio?: string
  pageTitle?: string
  title?: string
  badge?: string
  pluginServerId?: string
}

export interface LinkViewItem {
  url: string
  timestamp: number
  updatedAt?: number
  title?: string
  id?: string
  metadata: LinkMetadata
}

export interface SavedLinkListItem extends LinkViewItem {
  kind: "saved"
}

export interface DraftListItem {
  kind: "draft"
  userId: string
  url: string
  timestamp: number
  title: string
  extractedLinks?: ExtractedLink[]
  meta: MetaData
  pluginName?: string
  pluginIcon?: string
  expiresAt: number
}

export interface LinkListItemMap {
  saved: SavedLinkListItem
  draft: DraftListItem
}

export type LinkListItem = LinkListItemMap[keyof LinkListItemMap]
