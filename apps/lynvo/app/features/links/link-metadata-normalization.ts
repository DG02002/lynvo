import type { ExtractedLink, LinkMetadata, MetaData } from "./types"
import { getLinkSourceFields } from "./link-source-fields"
import { stripOpenedFlags } from "./link-tree-metadata"
import { linkMetadataSchema } from "./storage-schemas"

export const parseLinkMetadata = (metadata: unknown): LinkMetadata => {
  const parsed: unknown =
    typeof metadata === "string" ? JSON.parse(metadata) : metadata
  return linkMetadataSchema.parse(parsed)
}

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
}): LinkMetadata => ({
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
    openedIds: [],
    resolvedMirrors: {},
  },
})
