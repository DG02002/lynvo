export interface ExtractedLink {
  url: string
  label: string
  id?: string
  badge?: string
  type?: "file" | "folder"
  children?: ExtractedLink[]
  childrenResolved?: boolean
  rangeRequest?: "supported" | "unsupported" | "unknown"
  expiry?: number // Timestamp when the link expires
  status?: "up" | "down"
  watched?: boolean
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
  meta?: MetaData | LinkMetadata | string
  extractedLinks?: ExtractedLink[]
}

export interface LinkMetadata {
  schemaVersion: 3
  source: Record<string, unknown>
  extraction: {
    extractedLinks: ExtractedLink[]
    extractedAt?: number
  }
  playback: {
    watchedUrls: string[]
    watchedIds: string[]
    resolvedMirrors?: Record<string, ExtractedLink[]> // lazy item URL → mirrors
    newPlayableItemUrls?: string[] // playable item URLs flagged as "New"
  }
}

export interface MetaData {
  filename?: string
  contentType?: string
  contentLength?: number
  lastModified?: string
  acceptRanges?: string
  rangeRequest?: "supported" | "unsupported" | "unknown"
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
  extractedLinks?: ExtractedLink[]
  audio?: string
  pageTitle?: string
  title?: string
  badge?: string
  schemaVersion?: number
  pluginServerId?: string
}

export interface LinkViewItem {
  url: string
  timestamp: number
  updatedAt?: number
  title?: string
  id?: string
  hasFilename?: boolean
  metadata?: LinkMetadata
  meta?: MetaData
  pluginName?: string
  pluginIcon?: string
  pluginId?: string
  sourceName?: string
  sourceIconUrl?: string
  sourceStatus?: "active" | "maintenance" | "degraded" | "down"
  sourceVersion?: string
  extractedLinks?: ExtractedLink[]
  isDraft?: boolean
  draftExpiresAt?: number
}
