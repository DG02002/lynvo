import type { ExtractedLink, LinkMetadata, MetaData } from "./types"
import { getLinkSourceFields } from "./link-source-fields"
import {
  collectOpened,
  mergeUnique,
  stripOpenedFlags,
} from "./link-tree-metadata"

interface ParsedMetadata extends MetaData {
  schemaVersion?: number
  source?: Partial<LinkMetadata["source"]>
  extraction?: Partial<LinkMetadata["extraction"]>
  playback?: Partial<LinkMetadata["playback"]>
  extractedAt?: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const parseMetadata = (value: unknown): ParsedMetadata => {
  if (!value) {
    return {}
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown
      return isRecord(parsed) ? (parsed as ParsedMetadata) : {}
    } catch {
      return {}
    }
  }

  return isRecord(value) ? (value as ParsedMetadata) : {}
}

export const normalizeLinkMetadata = (
  metadata: unknown,
  topLevelExtractedLinks?: ExtractedLink[]
): LinkMetadata => {
  const parsed = parseMetadata(metadata)
  const existing = parsed.schemaVersion === 3 ? parsed : undefined
  const extractedLinks =
    existing?.extraction?.extractedLinks ??
    parsed.extractedLinks ??
    topLevelExtractedLinks ??
    []
  const openedFromLinks = collectOpened(extractedLinks)

  return {
    schemaVersion: 3,
    source: {
      ...existing?.source,
      pluginName: existing?.source?.pluginName ?? parsed.pluginName,
      pluginIcon: existing?.source?.pluginIcon ?? parsed.pluginIcon,
      pluginId: existing?.source?.pluginId ?? parsed.pluginId,
      sourceName: existing?.source?.sourceName ?? parsed.sourceName,
      sourceIconUrl: existing?.source?.sourceIconUrl ?? parsed.sourceIconUrl,
      sourceStatus: existing?.source?.sourceStatus ?? parsed.sourceStatus,
      sourceVersion: existing?.source?.sourceVersion ?? parsed.sourceVersion,
      sourceCredentialKind:
        existing?.source?.sourceCredentialKind ?? parsed.sourceCredentialKind,
      filename: existing?.source?.filename ?? parsed.filename,
      contentType: existing?.source?.contentType ?? parsed.contentType,
      contentLength: existing?.source?.contentLength ?? parsed.contentLength,
      lastModified: existing?.source?.lastModified ?? parsed.lastModified,
      rangeRequest: existing?.source?.rangeRequest ?? parsed.rangeRequest,
      pageTitle: existing?.source?.pageTitle ?? parsed.pageTitle,
      title: existing?.source?.title ?? parsed.title,
      badge: existing?.source?.badge ?? parsed.badge,
      audio: existing?.source?.audio ?? parsed.audio,
      pluginServerId:
        (typeof existing?.source?.pluginServerId === "string"
          ? existing.source.pluginServerId
          : undefined) ?? parsed.pluginServerId,
    },
    extraction: {
      extractedLinks: stripOpenedFlags(extractedLinks),
      extractedAt:
        existing?.extraction?.extractedAt ??
        parsed.extractedAt ??
        (extractedLinks.length > 0 ? Date.now() : undefined),
    },
    playback: {
      openedUrls: mergeUnique(
        existing?.playback?.openedUrls,
        openedFromLinks.openedUrls
      ),
      openedIds: mergeUnique(
        existing?.playback?.openedIds,
        openedFromLinks.openedIds
      ),
      resolvedMirrors: existing?.playback?.resolvedMirrors ?? {},
    },
  }
}

export const toFlatMeta = (metadata: LinkMetadata): MetaData => {
  const source = getLinkSourceFields(metadata)
  return {
    ...metadata.source,
    extractedLinks: metadata.extraction.extractedLinks,
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
}): LinkMetadata => {
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
      extractedLinks: stripOpenedFlags(
        input.extractedLinks ?? base.extraction.extractedLinks
      ),
      extractedAt: Date.now(),
    },
    playback: input.previous?.playback ?? base.playback,
  }
}
