import { Schema } from "effect"

import { getLinkSourceFields } from "./link-source-fields"
import { stripOpenedFlags } from "./link-tree-metadata"
import { linkMetadataSchema } from "./storage-schemas"
import type {
  ExtractedLink,
  LinkDebugLogEntry,
  LinkMetadata,
  MetaData,
} from "./types"

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
  if (input.debugLog ?? input.previous?.debugLog) {
    metadata.debugLog = input.debugLog ?? input.previous?.debugLog
  }
  return metadata
}
