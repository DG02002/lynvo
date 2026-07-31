import type { LinkMetadataV2 } from "./types"
import { getMetadataWorkerId } from "./link-metadata-accessors"

export interface LinkSourceFields {
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
  audio?: string
  pageTitle?: string
  title?: string
  badge?: string
  workerId?: string
}

const getSourceString = (
  source: LinkMetadataV2["source"] | undefined,
  key: string
) => {
  const value = source?.[key]
  return typeof value === "string" ? value : undefined
}

const getSourceNumber = (
  source: LinkMetadataV2["source"] | undefined,
  key: string
) => {
  const value = source?.[key]
  return typeof value === "number" ? value : undefined
}

const getRangeRequest = (source: LinkMetadataV2["source"] | undefined) => {
  const value = source?.rangeRequest
  return value === "supported" || value === "unsupported" || value === "unknown"
    ? value
    : undefined
}

const getSourceStatus = (source: LinkMetadataV2["source"] | undefined) => {
  const value = source?.sourceStatus
  return value === "active" ||
    value === "maintenance" ||
    value === "degraded" ||
    value === "down"
    ? value
    : undefined
}

const getSourceCredentialKind = (
  source: LinkMetadataV2["source"] | undefined
) => {
  const value = source?.sourceCredentialKind
  return value === "domain-password" || value === "http-basic"
    ? value
    : undefined
}

export const getLinkSourceFields = (
  metadata: LinkMetadataV2
): LinkSourceFields => ({
  filename: getSourceString(metadata.source, "filename"),
  contentType: getSourceString(metadata.source, "contentType"),
  contentLength: getSourceNumber(metadata.source, "contentLength"),
  lastModified: getSourceString(metadata.source, "lastModified"),
  acceptRanges: getSourceString(metadata.source, "acceptRanges"),
  rangeRequest: getRangeRequest(metadata.source),
  pluginName: getSourceString(metadata.source, "pluginName"),
  pluginIcon: getSourceString(metadata.source, "pluginIcon"),
  pluginId: getSourceString(metadata.source, "pluginId"),
  sourceName: getSourceString(metadata.source, "sourceName"),
  sourceIconUrl: getSourceString(metadata.source, "sourceIconUrl"),
  sourceStatus: getSourceStatus(metadata.source),
  sourceVersion: getSourceString(metadata.source, "sourceVersion"),
  sourceCredentialKind: getSourceCredentialKind(metadata.source),
  audio: getSourceString(metadata.source, "audio"),
  pageTitle: getSourceString(metadata.source, "pageTitle"),
  title: getSourceString(metadata.source, "title"),
  badge: getSourceString(metadata.source, "badge"),
  workerId: getMetadataWorkerId(metadata),
})
