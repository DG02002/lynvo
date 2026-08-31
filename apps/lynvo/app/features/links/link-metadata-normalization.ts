import type {
  ExtractedLink,
  LinkDebugLogEntry,
  LinkMetadata,
  MetaData,
} from "./types"
import { getLinkSourceFields } from "./link-source-fields"
import { stripOpenedFlags } from "./link-tree-metadata"
import { linkMetadataSchema } from "./storage-schemas"
import { Schema } from "effect"

export const parseLinkMetadata = (metadata: string): LinkMetadata =>
  Schema.decodeUnknownSync(linkMetadataSchema)(JSON.parse(metadata))

export const toFlatMeta = (metadata: LinkMetadata): MetaData => {
  const source = getLinkSourceFields(metadata)
  return {
    ...metadata.source,
    filename: source.filename,
    contentType: source.contentType,
    contentLength: source.contentLength,
    lastModified: source.lastModified,
    rangeRequest: source.rangeRequest,
    pluginName: source.pluginName,
    pluginIcon: source.pluginIcon,
    pluginId: source.pluginId,
    sourceName: source.sourceName,
    sourceIconUrl: source.sourceIconUrl,
    sourceStatus: source.sourceStatus,
    sourceVersion: source.sourceVersion,
    sourceCredentialKind: source.sourceCredentialKind,
    audio: source.audio,
    pageTitle: source.pageTitle,
    title: source.title,
    badge: source.badge,
    pluginServerId: source.pluginServerId,
  }
}

export const mergeDefinedMeta = (
  base: MetaData | undefined,
  override: MetaData | undefined
): MetaData => ({
  ...base,
  ...Object.fromEntries(
    Object.entries(override ?? {}).filter(([, value]) => value !== undefined)
  ),
})

export const LINK_DEBUG_LOG_ENTRY_LIMIT = 20

export const appendLinkDebugLog = (
  previous: LinkMetadata | undefined,
  entry: LinkDebugLogEntry
): LinkDebugLogEntry[] =>
  [...(previous?.debugLog ?? []), entry].slice(-LINK_DEBUG_LOG_ENTRY_LIMIT)

export const createLinkMetadata = (input: {
  meta?: MetaData
  extractedLinks?: ExtractedLink[]
  previous?: LinkMetadata
  debugLog?: LinkDebugLogEntry[]
}): LinkMetadata => {
  const metadata: LinkMetadata = {
    schemaVersion: 3,
    source: {
      ...input.previous?.source,
      ...Object.fromEntries(
        Object.entries(input.meta ?? {}).filter(
          ([, value]) => value !== undefined
        )
      ),
    },
    extraction: {
      extractedLinks: stripOpenedFlags(input.extractedLinks ?? []),
      extractedAt: Date.now(),
    },
    playback: input.previous?.playback ?? {
      openedUrls: [],
      resolvedMirrors: {},
    },
  }
  if (input.debugLog) {
    metadata.debugLog = input.debugLog
  }
  return metadata
}
