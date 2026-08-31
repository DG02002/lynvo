import {
  getLinkViewItemExtractedLinks,
  getLinkViewItemMetadata,
} from "../link-metadata-accessors"
import { toLinkViewModel } from "../link-view-models"
import { getSavedLinkInteractionState } from "../saved-link-interaction"
import { isNonMediaFilename, parseMediaFilename } from "./media-filename-parser"
import type { ExtractedLink, LinkListItem } from "../types"
import {
  getSaveDateGroupKey,
  getSaveDateGroupLabel,
} from "~/lib/save-date-groups"

interface HybridCardIdentity {
  readonly mediaKind: "movie" | "tv"
  readonly normalizedTitle: string
  readonly requestTitle: string
  readonly displayTitle: string
  readonly year?: number
  readonly seasonNumber?: number
}

interface HybridCardIdentityOptions {
  // Descendant labels are quality tags ("HQ-Rip 1080p") and mirror names
  // ("Direct"), so they may only identify a card when the parse is confident:
  // a movie needs a year and a tv label an explicit episode/season marker.
  readonly requireConfidentParse?: boolean
}

interface MutableHybridCardGroup {
  key: string
  mediaKind: "movie" | "tv" | "unmatched"
  normalizedTitle?: string
  anchorYear?: number
  anchorSeason?: number
  requestTitle?: string
  displayTitle: string
  lastAddedAt: number
  items: LinkListItem[]
}

interface HybridCardGroupDateSection {
  readonly key: string
  readonly label: string
  readonly groups: readonly HybridCardGroup[]
}

export const getHybridItemLabel = (item: LinkListItem): string => {
  const interactionState = getSavedLinkInteractionState(item, Date.now())
  const directLinkLabel = interactionState.directLink?.label
  if (directLinkLabel) {
    return directLinkLabel
  }
  return toLinkViewModel(item).title || new URL(item.url).hostname
}

const getTwoDigitSeasonLabel = (seasonNumber: number): string =>
  String(seasonNumber).padStart(2, "0")

const getTvDisplayTitle = (
  title: string,
  year: number | undefined,
  seasonNumber: number | undefined
) => {
  const yearLabel = year === undefined ? "" : ` (${year})`
  const seasonLabel =
    seasonNumber === undefined
      ? ""
      : ` S${getTwoDigitSeasonLabel(seasonNumber)}`
  return `${title}${yearLabel}${seasonLabel}`
}

const getHybridCardIdentity = (
  label: string,
  parentFolderName?: string,
  { requireConfidentParse = false }: HybridCardIdentityOptions = {}
): HybridCardIdentity | undefined => {
  const candidate = parseMediaFilename(label, parentFolderName)
  if (!candidate.title || !candidate.normalizedTitle) {
    return undefined
  }
  if (requireConfidentParse && candidate.confidence !== "high") {
    return undefined
  }

  if (candidate.kind === "movie") {
    return {
      mediaKind: "movie",
      normalizedTitle: candidate.normalizedTitle,
      requestTitle: candidate.title,
      displayTitle: candidate.year
        ? `${candidate.title} (${candidate.year})`
        : candidate.title,
      year: candidate.year,
    }
  }

  if (
    candidate.kind === "episode" ||
    candidate.kind === "episode-range" ||
    candidate.kind === "season"
  ) {
    return {
      mediaKind: "tv",
      normalizedTitle: candidate.normalizedTitle,
      requestTitle: candidate.title,
      displayTitle: getTvDisplayTitle(
        candidate.title,
        candidate.year,
        candidate.seasonNumber
      ),
      year: candidate.year,
      seasonNumber: candidate.seasonNumber,
    }
  }

  return undefined
}

const findConfidentDescendantIdentity = (
  nodes: readonly ExtractedLink[],
  parentFolderName?: string
): HybridCardIdentity | undefined => {
  for (const node of nodes) {
    const nodeLabel = node.label?.trim()
    const children = node.children ?? []
    if (nodeLabel) {
      const identity = getHybridCardIdentity(nodeLabel, parentFolderName, {
        requireConfidentParse: true,
      })
      if (identity && (identity.mediaKind === "tv" || children.length === 0)) {
        return identity
      }
    }
    if (children.length === 0) {
      continue
    }
    const childFolderName = [parentFolderName, nodeLabel]
      .filter((value): value is string => Boolean(value))
      .join(" ")
    const descendantIdentity = findConfidentDescendantIdentity(
      children,
      childFolderName
    )
    if (descendantIdentity) {
      return descendantIdentity
    }
  }
  return undefined
}

const getHybridItemIdentity = (
  item: LinkListItem,
  itemLabel: string
): HybridCardIdentity | undefined => {
  const extractedLinks = getLinkViewItemExtractedLinks(item)
  if (extractedLinks.length > 0) {
    const descendantIdentity = findConfidentDescendantIdentity(extractedLinks)
    if (descendantIdentity) {
      const itemIdentity = getHybridCardIdentity(itemLabel)
      if (
        descendantIdentity.year === undefined &&
        itemIdentity?.year !== undefined &&
        itemIdentity.normalizedTitle === descendantIdentity.normalizedTitle
      ) {
        return withAdoptedYear(descendantIdentity, itemIdentity.year)
      }
      return descendantIdentity
    }
  }
  return getHybridCardIdentity(itemLabel)
}

const withAdoptedYear = (
  identity: HybridCardIdentity,
  year: number
): HybridCardIdentity => ({
  ...identity,
  year,
  displayTitle:
    identity.mediaKind === "movie"
      ? `${identity.requestTitle} (${year})`
      : getTvDisplayTitle(identity.requestTitle, year, identity.seasonNumber),
})

const toUnmatchedGroup = (
  item: LinkListItem,
  label: string
): MutableHybridCardGroup => ({
  key: `item:${item.id ?? item.url}`,
  mediaKind: "unmatched",
  displayTitle: label,
  lastAddedAt: item.timestamp,
  items: [item],
})

const getHybridGroupKey = (identity: HybridCardIdentity): string => {
  const seasonSegment =
    identity.seasonNumber === undefined
      ? ""
      : `:S${getTwoDigitSeasonLabel(identity.seasonNumber)}`
  return `${identity.mediaKind}:${identity.normalizedTitle}:${identity.year ?? ""}${seasonSegment}`
}

const findOrAdoptYearGroup = (
  bucket: MutableHybridCardGroup[],
  identity: HybridCardIdentity
): MutableHybridCardGroup => {
  if (identity.year === undefined) {
    const mostRecentGroup = bucket.at(-1)
    if (mostRecentGroup) {
      return mostRecentGroup
    }
  } else {
    const matchingYearGroup = bucket.find(
      (group) => group.anchorYear === identity.year
    )
    if (matchingYearGroup) {
      return matchingYearGroup
    }
    const soleUndefinedYearGroup =
      bucket.length === 1 && bucket[0]?.anchorYear === undefined
        ? bucket[0]
        : undefined
    if (soleUndefinedYearGroup) {
      soleUndefinedYearGroup.anchorYear = identity.year
      soleUndefinedYearGroup.displayTitle = identity.displayTitle
      return soleUndefinedYearGroup
    }
  }

  const createdGroup: MutableHybridCardGroup = {
    key: getHybridGroupKey(identity),
    mediaKind: identity.mediaKind,
    normalizedTitle: identity.normalizedTitle,
    anchorYear: identity.year,
    anchorSeason: identity.seasonNumber,
    requestTitle: identity.requestTitle,
    displayTitle: identity.displayTitle,
    lastAddedAt: 0,
    items: [],
  }
  bucket.push(createdGroup)
  return createdGroup
}

const getGroupArtworkRequest = (
  group: MutableHybridCardGroup
): MediaArtworkRequest | undefined => {
  if (group.mediaKind === "unmatched" || !group.requestTitle) {
    return undefined
  }
  // A stored identity is authoritative: resolve by immutable id and skip
  // title matching entirely.
  const storedArtwork = group.items.find(
    (item) => getLinkViewItemMetadata(item).artwork !== undefined
  )?.metadata.artwork
  if (storedArtwork) {
    return {
      // The stored pick's kind is authoritative: a movie id and a tv id can
      // collide numerically, so by-id lookups must not guess from the
      // filename classification.
      mediaKind: storedArtwork.mediaKind ?? group.mediaKind,
      title: storedArtwork.title,
      providerId: storedArtwork.providerId,
      year: storedArtwork.year,
    }
  }
  if (group.mediaKind === "tv") {
    return {
      mediaKind: "tv",
      title: group.requestTitle,
      year: group.anchorYear,
      seasonNumber: group.anchorSeason,
    }
  }
  return {
    mediaKind: "movie",
    title: group.requestTitle,
    year: group.anchorYear,
  }
}

const toImmutableGroup = (group: MutableHybridCardGroup): HybridCardGroup => ({
  key: group.key,
  displayTitle: group.displayTitle,
  artworkRequest: getGroupArtworkRequest(group),
  lastAddedAt: group.lastAddedAt,
  items: group.items,
})

const sortGroups = (groups: readonly HybridCardGroup[]): HybridCardGroup[] =>
  groups.toSorted((firstGroup, secondGroup) => {
    if (secondGroup.lastAddedAt !== firstGroup.lastAddedAt) {
      return secondGroup.lastAddedAt - firstGroup.lastAddedAt
    }
    return firstGroup.displayTitle.localeCompare(secondGroup.displayTitle)
  })

export const getSharedSeasonIdentity = (
  labels: readonly string[],
  parentFolderName?: string
): SharedSeasonIdentity | undefined => {
  const mediaLabels = labels.filter((label) => !isNonMediaFilename(label))
  if (mediaLabels.length === 0) {
    return undefined
  }

  let sharedIdentity: SharedSeasonIdentity | undefined
  for (const label of mediaLabels) {
    const candidate = parseMediaFilename(label, parentFolderName)
    const isEpisode =
      candidate.kind === "episode" || candidate.kind === "episode-range"
    if (
      !isEpisode ||
      !candidate.title ||
      !candidate.normalizedTitle ||
      candidate.seasonNumber === undefined
    ) {
      return undefined
    }
    if (sharedIdentity === undefined) {
      sharedIdentity = {
        requestTitle: candidate.title,
        normalizedTitle: candidate.normalizedTitle,
        year: candidate.year,
        seasonNumber: candidate.seasonNumber,
        displayTitle: getTvDisplayTitle(
          candidate.title,
          candidate.year,
          candidate.seasonNumber
        ),
      }
      continue
    }
    if (
      candidate.normalizedTitle !== sharedIdentity.normalizedTitle ||
      candidate.seasonNumber !== sharedIdentity.seasonNumber
    ) {
      return undefined
    }
  }
  return sharedIdentity
}

export const getHybridCardGroups = (
  items: readonly LinkListItem[]
): readonly HybridCardGroup[] => {
  const titleBuckets = new Map<string, MutableHybridCardGroup[]>()
  const unmatchedGroups: MutableHybridCardGroup[] = []
  const sortedItems = items.toSorted(
    (firstItem, secondItem) => secondItem.timestamp - firstItem.timestamp
  )

  for (const item of sortedItems) {
    const itemLabel = getHybridItemLabel(item)
    const identity = getHybridItemIdentity(item, itemLabel)

    if (!identity) {
      unmatchedGroups.push(toUnmatchedGroup(item, itemLabel))
      continue
    }

    const bucketKey = `${identity.mediaKind}:${identity.normalizedTitle}:${identity.seasonNumber ?? ""}`
    const bucket = titleBuckets.get(bucketKey) ?? []
    const targetGroup = findOrAdoptYearGroup(bucket, identity)
    targetGroup.items.push(item)
    targetGroup.lastAddedAt = Math.max(targetGroup.lastAddedAt, item.timestamp)
    titleBuckets.set(bucketKey, bucket)
  }

  return sortGroups([
    ...[...titleBuckets.values()].flat().map(toImmutableGroup),
    ...unmatchedGroups.map(toImmutableGroup),
  ])
}

export const getHybridCardGroupSections = (
  groups: readonly HybridCardGroup[],
  currentTimeMs = Date.now()
): readonly HybridCardGroupDateSection[] => {
  const dateGroups = new Map<string, HybridCardGroupDateSection>()
  for (const group of groups) {
    const key = getSaveDateGroupKey(group.lastAddedAt, currentTimeMs)
    const existingDateGroup = dateGroups.get(key)
    if (existingDateGroup) {
      dateGroups.set(key, {
        ...existingDateGroup,
        groups: [...existingDateGroup.groups, group],
      })
      continue
    }
    dateGroups.set(key, {
      key,
      label: getSaveDateGroupLabel(group.lastAddedAt, currentTimeMs),
      groups: [group],
    })
  }
  return [...dateGroups.values()]
}
