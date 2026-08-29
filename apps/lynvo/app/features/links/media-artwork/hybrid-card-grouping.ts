import {
  getLinkViewItemExtractedLinks,
  getLinkViewItemMetadata,
} from "../link-metadata-accessors"
import { toLinkViewModel } from "../link-view-models"
import { getSavedLinkInteractionState } from "../saved-link-interaction"
import { parseMediaFilename } from "./media-filename-parser"
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
}

interface MutableHybridCardGroup {
  key: string
  mediaKind: "movie" | "tv" | "unmatched"
  normalizedTitle?: string
  anchorYear?: number
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

const getHybridCardIdentity = (
  label: string,
  parentFolderName?: string
): HybridCardIdentity | undefined => {
  const candidate = parseMediaFilename(label, parentFolderName)
  if (!candidate.title || !candidate.normalizedTitle) {
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
      displayTitle: candidate.title,
      year: candidate.year,
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
      const identity = getHybridCardIdentity(nodeLabel, parentFolderName)
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
        return { ...descendantIdentity, year: itemIdentity.year }
      }
      return descendantIdentity
    }
  }
  return getHybridCardIdentity(itemLabel)
}

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
    key: `${identity.mediaKind}:${identity.normalizedTitle}:${identity.year ?? ""}`,
    mediaKind: identity.mediaKind,
    normalizedTitle: identity.normalizedTitle,
    anchorYear: identity.year,
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
    return group.anchorYear === undefined
      ? { mediaKind: "tv", title: group.requestTitle }
      : {
          mediaKind: "tv",
          title: group.requestTitle,
          year: group.anchorYear,
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
  [...groups].sort((firstGroup, secondGroup) => {
    if (secondGroup.lastAddedAt !== firstGroup.lastAddedAt) {
      return secondGroup.lastAddedAt - firstGroup.lastAddedAt
    }
    return firstGroup.displayTitle.localeCompare(secondGroup.displayTitle)
  })

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

    const bucketKey = `${identity.mediaKind}:${identity.normalizedTitle}`
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
