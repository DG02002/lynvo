import type { ExtractedLink, LinkMetadataV2, MetaData } from "./types"
import { getMetadataWorkerId } from "./link-metadata-accessors"
import { getLinkSourceFields } from "./link-source-fields"
import {
  collectWatched,
  mergeUnique,
  stripWatchedFlags,
} from "./link-tree-metadata"

interface LegacyMetadata extends MetaData {
  schemaVersion?: number
  source?: Partial<LinkMetadataV2["source"]>
  extraction?: Partial<LinkMetadataV2["extraction"]>
  playback?: Partial<LinkMetadataV2["playback"]>
  extractedAt?: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const parseMetadata = (value: unknown): LegacyMetadata => {
  if (!value) {
    return {}
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown
      return isRecord(parsed) ? (parsed as LegacyMetadata) : {}
    } catch {
      return {}
    }
  }

  return isRecord(value) ? (value as LegacyMetadata) : {}
}

export const normalizeLinkMetadata = (
  metadata: unknown,
  topLevelExtractedLinks?: ExtractedLink[]
): LinkMetadataV2 => {
  const legacy = parseMetadata(metadata)
  const existingV2 = legacy.schemaVersion === 2 ? legacy : undefined
  const extractedLinks =
    existingV2?.extraction?.extractedLinks ??
    legacy.extractedLinks ??
    topLevelExtractedLinks ??
    []
  const watchedFromLinks = collectWatched(extractedLinks)

  return {
    schemaVersion: 2,
    source: {
      ...existingV2?.source,
      pluginName: existingV2?.source?.pluginName ?? legacy.pluginName,
      pluginIcon: existingV2?.source?.pluginIcon ?? legacy.pluginIcon,
      sourceId: existingV2?.source?.sourceId ?? legacy.sourceId,
      sourceName: existingV2?.source?.sourceName ?? legacy.sourceName,
      sourceIconUrl: existingV2?.source?.sourceIconUrl ?? legacy.sourceIconUrl,
      sourceStatus: existingV2?.source?.sourceStatus ?? legacy.sourceStatus,
      sourceVersion: existingV2?.source?.sourceVersion ?? legacy.sourceVersion,
      filename: existingV2?.source?.filename ?? legacy.filename,
      contentType: existingV2?.source?.contentType ?? legacy.contentType,
      contentLength: existingV2?.source?.contentLength ?? legacy.contentLength,
      lastModified: existingV2?.source?.lastModified ?? legacy.lastModified,
      acceptRanges: existingV2?.source?.acceptRanges ?? legacy.acceptRanges,
      rangeRequest: existingV2?.source?.rangeRequest ?? legacy.rangeRequest,
      pageTitle: existingV2?.source?.pageTitle ?? legacy.pageTitle,
      title: existingV2?.source?.title ?? legacy.title,
      badge: existingV2?.source?.badge ?? legacy.badge,
      audio: existingV2?.source?.audio ?? legacy.audio,
      workerId: getMetadataWorkerId(existingV2) ?? legacy.workerId,
    },
    extraction: {
      extractedLinks: stripWatchedFlags(extractedLinks),
      extractedAt:
        existingV2?.extraction?.extractedAt ??
        legacy.extractedAt ??
        (extractedLinks.length > 0 ? Date.now() : undefined),
    },
    playback: {
      watchedUrls: mergeUnique(
        existingV2?.playback?.watchedUrls,
        watchedFromLinks.watchedUrls
      ),
      watchedIds: mergeUnique(
        existingV2?.playback?.watchedIds,
        watchedFromLinks.watchedIds
      ),
      resolvedMirrors: existingV2?.playback?.resolvedMirrors ?? {},
      newPlayableItemUrls: existingV2?.playback?.newPlayableItemUrls ?? [],
    },
  }
}

export const toLegacyMeta = (metadata: LinkMetadataV2): MetaData => {
  const source = getLinkSourceFields(metadata)
  return {
    ...metadata.source,
    extractedLinks: metadata.extraction.extractedLinks,
    filename: source.filename,
    contentType: source.contentType,
    contentLength: source.contentLength,
    lastModified: source.lastModified,
    acceptRanges: source.acceptRanges,
    rangeRequest: source.rangeRequest,
    pluginName: source.pluginName,
    pluginIcon: source.pluginIcon,
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    sourceIconUrl: source.sourceIconUrl,
    sourceStatus: source.sourceStatus,
    sourceVersion: source.sourceVersion,
    audio: source.audio,
    pageTitle: source.pageTitle,
    title: source.title,
    badge: source.badge,
    workerId: source.workerId,
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

export const createMetadataV2 = (input: {
  meta?: MetaData
  extractedLinks?: ExtractedLink[]
  previous?: LinkMetadataV2
}): LinkMetadataV2 => {
  const base = normalizeLinkMetadata(input.meta, input.extractedLinks)
  const definedBaseSource = Object.fromEntries(
    Object.entries(base.source).filter(([, value]) => value !== undefined)
  )

  return {
    ...base,
    source: {
      ...input.previous?.source,
      ...definedBaseSource,
    },
    extraction: {
      extractedLinks: stripWatchedFlags(
        input.extractedLinks ?? base.extraction.extractedLinks
      ),
      extractedAt: Date.now(),
    },
    playback: input.previous?.playback ?? base.playback,
  }
}
