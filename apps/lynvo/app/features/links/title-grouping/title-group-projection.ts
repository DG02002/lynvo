import { getLinkViewItemExtractedLinks } from "~/features/links/link-metadata-accessors"
import { getLinkSourceFields } from "~/features/links/link-source-fields"
import type { LinkSourceFields } from "~/features/links/link-source-fields"
import { getMediaNodeTargetOrUndefined } from "~/features/links/media-node-interaction"
import type { LinkListItem, ExtractedLink } from "~/features/links/types"
import {
  getSaveDateGroupKey,
  getSaveDateGroupLabel,
} from "~/lib/save-date-groups"
import { parseMediaFilename } from "./filename-media-parser"

interface SourceOccurrence {
  readonly node: ExtractedLink
  readonly nodePath: string
  readonly parentFolderName?: string
}

interface EntryDetails {
  readonly mediaKind: "movie" | "tv-season" | "unmatched"
  readonly identityKey: string
  readonly entryKey: string
  readonly kind: TitleEntryProjection["kind"]
  readonly displayTitle: string
  readonly displayLabel: string
  readonly seasonNumber?: number
  readonly episodeStart?: number
  readonly episodeEnd?: number
}

interface MutableTitleEntryProjection {
  id?: string
  entryKey: string
  kind: TitleEntryProjection["kind"]
  seasonNumber?: number
  episodeStart?: number
  episodeEnd?: number
  displayLabel: string
  metadataState: TitleEntryProjection["metadataState"]
  stillPath?: string
  sources: SourceVariantProjection[]
}

interface MutableTitleGroupProjection {
  id?: string
  identityKey: string
  mediaKind: TitleGroupProjection["mediaKind"]
  displayTitle: string
  year?: number
  seasonNumber?: number
  metadataState: TitleGroupProjection["metadataState"]
  posterPath?: string
  backdropPath?: string
  overview?: string
  lastAddedAt: number
  sourceCount: number
  entries: MutableTitleEntryProjection[]
}

const URL_LIKE_LABEL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i

const isUrlLikeLabel = (label: string | undefined): boolean => {
  const trimmedLabel = label?.trim()
  return Boolean(trimmedLabel) && URL_LIKE_LABEL_PATTERN.test(trimmedLabel!)
}

const getDecodedUrlNameSegment = (candidate: string): string | undefined => {
  if (!isUrlLikeLabel(candidate)) {
    return undefined
  }
  try {
    const pathSegments = new URL(candidate.trim()).pathname
      .split("/")
      .filter(Boolean)
    const lastSegment = pathSegments.at(-1)
    if (!lastSegment) {
      return undefined
    }
    const decodedSegment = decodeURIComponent(lastSegment).trim()
    return decodedSegment || undefined
  } catch {
    return undefined
  }
}

const getCleanNodeLabel = (
  node: ExtractedLink,
  item: LinkListItem,
  sourceFields: LinkSourceFields
): string => {
  const nodeLabel = node.label?.trim()
  if (nodeLabel && !isUrlLikeLabel(nodeLabel)) {
    return nodeLabel
  }
  const filename = sourceFields.filename?.trim()
  if (filename && !isUrlLikeLabel(filename)) {
    return filename
  }
  const urlNameSegment =
    getDecodedUrlNameSegment(nodeLabel ?? "") ??
    getDecodedUrlNameSegment(item.title ?? "") ??
    getDecodedUrlNameSegment(item.url)
  if (urlNameSegment) {
    return urlNameSegment
  }
  const pageTitle = sourceFields.pageTitle?.trim()
  if (pageTitle && !isUrlLikeLabel(pageTitle)) {
    return pageTitle
  }
  const itemTitle = item.title?.trim()
  if (itemTitle && !isUrlLikeLabel(itemTitle)) {
    return itemTitle
  }
  return "Saved link"
}

const getSourceLabel = (
  item: LinkListItem,
  node: ExtractedLink,
  sourceFields: LinkSourceFields
): string => getCleanNodeLabel(node, item, sourceFields)

const getSourceName = (
  item: LinkListItem,
  sourceFields: ReturnType<typeof getLinkSourceFields>
): string =>
  sourceFields.sourceName ||
  sourceFields.pluginName ||
  item.title ||
  "Saved link"

const getSourceOccurrences = (
  nodes: readonly ExtractedLink[],
  parentFolderName: string | undefined,
  pathPrefix: string
): SourceOccurrence[] => {
  const occurrences: SourceOccurrence[] = []

  nodes.forEach((node, nodeIndex) => {
    const nodePath = pathPrefix
      ? `${pathPrefix}/${nodeIndex}`
      : String(nodeIndex)
    const children = node.children ?? []
    const nodeFolderContext = [parentFolderName, node.label]
      .filter((value): value is string => Boolean(value))
      .join(" ")

    if (children.length === 0) {
      occurrences.push({
        node,
        nodePath,
        parentFolderName,
      })
      return
    }

    const childOccurrences = getSourceOccurrences(
      children,
      nodeFolderContext,
      nodePath
    )
    const hasConfidentChild = childOccurrences.some((occurrence) => {
      const candidate = parseMediaFilename(
        occurrence.node.label,
        occurrence.parentFolderName
      )
      return (
        candidate.kind === "movie" ||
        candidate.kind === "episode" ||
        candidate.kind === "episode-range" ||
        candidate.kind === "season"
      )
    })

    if (hasConfidentChild) {
      occurrences.push(...childOccurrences)
      return
    }

    occurrences.push({
      node,
      nodePath,
      parentFolderName,
    })
  })

  return occurrences
}

const getRootOccurrences = (item: LinkListItem): SourceOccurrence[] => {
  const extractedLinks = getLinkViewItemExtractedLinks(item)
  if (extractedLinks.length > 0) {
    return getSourceOccurrences(extractedLinks, undefined, "")
  }

  const sourceFields = getLinkSourceFields(item.metadata)
  const rootOccurrence: SourceOccurrence = {
    node: {
      nodeKey: `saved-link:${item.id}:root`,
      url: item.url,
      label: "",
      type: "file",
      mediaNodeKind: "playable",
    },
    nodePath: "root",
  }
  return [
    {
      ...rootOccurrence,
      node: {
        ...rootOccurrence.node,
        label: getCleanNodeLabel(rootOccurrence.node, item, sourceFields),
      },
    },
  ]
}

const toEntryDetails = (
  candidate: MediaClassificationCandidate,
  occurrenceKey: string,
  cleanLabel: string
): EntryDetails => {
  if (
    candidate.kind === "movie" &&
    candidate.normalizedTitle &&
    candidate.title
  ) {
    return {
      mediaKind: "movie",
      identityKey: `movie:${candidate.normalizedTitle}:${candidate.year ?? "unknown"}`,
      entryKey: "movie",
      kind: "movie",
      displayTitle: candidate.title,
      displayLabel: candidate.title,
    }
  }

  if (
    (candidate.kind === "episode" || candidate.kind === "episode-range") &&
    candidate.normalizedTitle &&
    candidate.title &&
    candidate.seasonNumber !== undefined &&
    candidate.episodeNumber !== undefined
  ) {
    const rangeSuffix =
      candidate.kind === "episode-range"
        ? `-${candidate.episodeEnd ?? candidate.episodeNumber}`
        : ""
    return {
      mediaKind: "tv-season",
      identityKey: `tv-season:${candidate.normalizedTitle}:${candidate.seasonNumber}`,
      entryKey: `episode:${candidate.seasonNumber}:${candidate.episodeNumber}${rangeSuffix}`,
      kind: candidate.kind,
      displayTitle: candidate.title,
      displayLabel:
        candidate.kind === "episode-range"
          ? `Episodes ${candidate.episodeNumber}–${candidate.episodeEnd}`
          : `Episode ${candidate.episodeNumber}`,
      seasonNumber: candidate.seasonNumber,
      episodeStart: candidate.episodeNumber,
      episodeEnd: candidate.episodeEnd,
    }
  }

  if (
    candidate.kind === "season" &&
    candidate.normalizedTitle &&
    candidate.title &&
    candidate.seasonNumber !== undefined
  ) {
    return {
      mediaKind: "tv-season",
      identityKey: `tv-season:${candidate.normalizedTitle}:${candidate.seasonNumber}`,
      entryKey: `container:season:${candidate.seasonNumber}`,
      kind: "container",
      displayTitle: candidate.title,
      displayLabel: `Season ${candidate.seasonNumber}`,
      seasonNumber: candidate.seasonNumber,
    }
  }

  return {
    mediaKind: "unmatched",
    identityKey: `unmatched:${occurrenceKey}`,
    entryKey: `source:${occurrenceKey}`,
    kind: "unknown",
    displayTitle: cleanLabel,
    displayLabel: cleanLabel,
  }
}

const createSourceVariant = (
  item: LinkListItem,
  occurrence: SourceOccurrence,
  sourceFields: LinkSourceFields
): SourceVariantProjection => {
  const savedLinkId = item.id ?? "pending"
  const occurrenceKey = `${savedLinkId}:${occurrence.nodePath}`
  const nodeKey = occurrence.node.nodeKey || occurrence.node.id || occurrenceKey
  return {
    savedLinkId,
    occurrenceKey,
    nodeKey,
    nodePath: occurrence.nodePath,
    label: getSourceLabel(item, occurrence.node, sourceFields),
    sourceName: occurrence.node.sourceName || getSourceName(item, sourceFields),
    quality: occurrence.node.badge || sourceFields.badge,
    size: occurrence.node.size,
    status: occurrence.node.status,
    mediaNodeKind: occurrence.node.mediaNodeKind,
    resolutionKind: occurrence.node.resolutionKind,
    target: getMediaNodeTargetOrUndefined(occurrence.node),
    node: occurrence.node,
    timestamp: item.timestamp,
  }
}

const getOrCreateEntry = (
  group: MutableTitleGroupProjection,
  details: ReturnType<typeof toEntryDetails>,
  isQueued = false
): MutableTitleEntryProjection => {
  const existingEntry = group.entries.find(
    (entry) => entry.entryKey === details.entryKey
  )
  if (existingEntry) {
    return existingEntry
  }

  const isPending = isQueued || details.mediaKind !== "unmatched"
  const entry: MutableTitleEntryProjection = {
    entryKey: details.entryKey,
    kind: details.kind,
    seasonNumber: details.seasonNumber,
    episodeStart: details.episodeStart,
    episodeEnd: details.episodeEnd,
    displayLabel: details.displayLabel,
    metadataState: isPending ? "pending" : "unavailable",
    sources: [],
  }
  group.entries.push(entry)
  return entry
}

const getOrCreateGroup = (
  groups: Map<string, MutableTitleGroupProjection>,
  details: ReturnType<typeof toEntryDetails>,
  candidate: MediaClassificationCandidate,
  timestamp: number,
  isQueued = false
): MutableTitleGroupProjection => {
  const existingGroup = groups.get(details.identityKey)
  if (existingGroup) {
    existingGroup.lastAddedAt = Math.max(existingGroup.lastAddedAt, timestamp)
    return existingGroup
  }

  const isPending = isQueued || details.mediaKind !== "unmatched"
  const group: MutableTitleGroupProjection = {
    identityKey: details.identityKey,
    mediaKind: details.mediaKind,
    displayTitle: details.displayTitle,
    year: candidate.year,
    seasonNumber: candidate.seasonNumber,
    metadataState: isPending ? "pending" : "unavailable",
    lastAddedAt: timestamp,
    sourceCount: 0,
    entries: [],
  }
  groups.set(details.identityKey, group)
  return group
}

const sortGroups = (
  groups: readonly TitleGroupProjection[]
): TitleGroupProjection[] =>
  [...groups].sort((firstGroup, secondGroup) => {
    if (secondGroup.lastAddedAt !== firstGroup.lastAddedAt) {
      return secondGroup.lastAddedAt - firstGroup.lastAddedAt
    }
    return firstGroup.displayTitle.localeCompare(secondGroup.displayTitle)
  })

export const projectTitleGroups = (
  items: readonly LinkListItem[],
  currentTimeMs = Date.now()
): TitleProjection => {
  const groups = new Map<string, MutableTitleGroupProjection>()

  for (const item of items) {
    if (!item.id) {
      continue
    }
    const isQueued = item.extractionStatus?.state === "queued"
    const sourceFields = getLinkSourceFields(item.metadata)
    for (const occurrence of getRootOccurrences(item)) {
      const candidate = parseMediaFilename(
        occurrence.node.label,
        occurrence.parentFolderName
      )
      const occurrenceKey = `${item.id}:${occurrence.nodePath}`
      const details = toEntryDetails(
        candidate,
        occurrenceKey,
        getCleanNodeLabel(occurrence.node, item, sourceFields)
      )
      const group = getOrCreateGroup(
        groups,
        details,
        candidate,
        item.timestamp,
        isQueued
      )
      const entry = getOrCreateEntry(group, details, isQueued)
      entry.sources.push(createSourceVariant(item, occurrence, sourceFields))
      group.sourceCount += 1
    }
  }

  const confidentGroups = sortGroups(
    [...groups.values()].filter((group) => group.mediaKind !== "unmatched")
  )
  const unmatchedGroups = sortGroups(
    [...groups.values()].filter((group) => group.mediaKind === "unmatched")
  )
  const dateGroups = new Map<string, TitleDateGroupProjection>()
  for (const group of confidentGroups) {
    const key = getSaveDateGroupKey(group.lastAddedAt, currentTimeMs)
    const existingDateGroup = dateGroups.get(key)
    if (existingDateGroup) {
      dateGroups.set(key, {
        ...existingDateGroup,
        groups: sortGroups([...existingDateGroup.groups, group]),
      })
      continue
    }
    dateGroups.set(key, {
      key,
      label: getSaveDateGroupLabel(group.lastAddedAt, currentTimeMs),
      groups: [group],
    })
  }

  return {
    dateGroups: [...dateGroups.values()],
    unmatchedGroups,
  }
}
