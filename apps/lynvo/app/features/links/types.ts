import type {
  ExpirySource,
  JsonValue,
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
  mediaNodeKind: "group" | "resolvable" | "playable"
  resolutionKind?: "folder" | "mirrors"
}

export interface LinkExtractionStatus {
  state: "queued" | "running" | "complete" | "failed"
  error?: string
}

/** One credential-free communication record with a Plugin Server. */
export interface LinkDebugLogEntry {
  at: number
  pluginServerId?: string
  pluginId?: string
  outcome: "complete" | "failed" | "pending" | "requeued"
  errorCode?: string
  /** The Plugin Server's unmodified error text; never credentials. */
  detail?: string
  httpStatus?: number
  nodeCount?: number
  durationMs?: number
  attempt?: number
}

export interface LinkMetadata {
  schemaVersion: 3
  source: Record<string, JsonValue>
  extraction: {
    extractedLinks: ExtractedLink[]
    extractedAt?: number
  }
  playback: {
    openedUrls: string[]
    resolvedMirrors?: Record<string, ExtractedLink[]> // lazy item URL → mirrors
  }
  /** Bounded, newest-last record of Plugin Server communication. */
  debugLog?: LinkDebugLogEntry[]
  /** Authoritative artwork identity; by-id lookups never re-guess. */
  artwork?: MediaArtworkIdentity
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
  extractionStatus?: LinkExtractionStatus
}

export interface SavedLinkListItem extends LinkViewItem {
  kind: "saved"
}

export interface LinkListItemMap {
  saved: SavedLinkListItem
}

export type LinkListItem = LinkListItemMap[keyof LinkListItemMap]
