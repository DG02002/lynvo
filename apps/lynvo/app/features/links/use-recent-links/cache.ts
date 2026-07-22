import type { RecentLinkViewItem } from "~/features/links/types"
import { RECENT_LINKS_MAX_COUNT } from "../../../../convex/constants"
import {
  toRecentLinkViewItem,
  toSavedLinkDTO,
  createMetadataV2,
  normalizeLinkMetadata,
  toLegacyMeta,
  type SavedLink,
} from "~/features/links/links.mapper"

export const RECENTS_MAX_LIMIT = RECENT_LINKS_MAX_COUNT
export const RECENTS_KEY = "sl2jp:recents:v1"
const SYNCED_RECENTS_KEY_PREFIX = "sl2jp:recents:sync:v1:"

export type LinksCache = {
  results: SavedLink[]
  version: number
  etag: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const optionalString = (value: unknown) =>
  typeof value === "string" ? value : undefined

const optionalNumber = (value: unknown) =>
  typeof value === "number" ? value : undefined

function linksCacheKey(userId: string) {
  return `${SYNCED_RECENTS_KEY_PREFIX}${userId}`
}

export function readLinksCache(userId?: string): LinksCache | undefined {
  if (!userId || typeof window === "undefined") {
    return undefined
  }
  try {
    const raw = localStorage.getItem(linksCacheKey(userId))
    if (!raw) {
      return undefined
    }
    const parsed: unknown = JSON.parse(raw)
    if (isRecord(parsed) && Array.isArray(parsed.results)) {
      return {
        results: parsed.results.map(toSavedLink),
        version: optionalNumber(parsed.version) ?? 0,
        etag: optionalString(parsed.etag) ?? "",
      }
    }
  } catch (error) {
    console.error("Unable to read the synced recent-links cache", error)
    localStorage.removeItem(linksCacheKey(userId))
  }
  return undefined
}

export function writeLinksCache(userId: string, cache: LinksCache) {
  try {
    localStorage.setItem(linksCacheKey(userId), JSON.stringify(cache))
  } catch (error) {
    console.error("Unable to write the synced recent-links cache", error)
  }
}

function toSavedLink(value: unknown): SavedLink {
  if (!isRecord(value)) {
    return toSavedLinkDTO({
      id: "",
      url: "",
      created_at: 0,
    })
  }

  if (
    typeof value.id === "string" &&
    typeof value.url === "string" &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number" &&
    value.metadata
  ) {
    return {
      id: value.id,
      url: value.url,
      title: optionalString(value.title),
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
      metadata: normalizeLinkMetadata(value.metadata),
    }
  }

  return toSavedLinkDTO({
    id: optionalString(value.id) ?? "",
    url: optionalString(value.url) ?? "",
    title: optionalString(value.title),
    created_at: optionalNumber(value.created_at) ?? 0,
    updated_at: optionalNumber(value.updated_at),
    meta: value.meta as any,
    extractedLinks: undefined,
  })
}

export function readLocalRecents(): RecentLinkViewItem[] {
  if (typeof window === "undefined") {
    return []
  }
  try {
    const savedRecents = localStorage.getItem(RECENTS_KEY)
    if (!savedRecents) {
      return []
    }
    const parsed = JSON.parse(savedRecents)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.map((item: RecentLinkViewItem) => ({
      ...item,
      extractedLinks: undefined,
    }))
  } catch (error) {
    console.error("Unable to read recent links", error)
    localStorage.removeItem(RECENTS_KEY)
    return []
  }
}

export function linksToRecentLinkViewItems(
  links: SavedLink[],
  previous: RecentLinkViewItem[] = []
) {
  return links.map((link) => {
    const item = toRecentLinkViewItem(link)
    const existing = previous.find(
      (p) => p.id === item.id || p.url === item.url
    )
    if (existing?.extractedLinks && (item.extractedLinks?.length ?? 0) === 0) {
      const metadata = createMetadataV2({
        meta: item.meta,
        extractedLinks: existing.extractedLinks,
        previous: item.metadata,
      })
      return {
        ...item,
        metadata,
        meta: toLegacyMeta(metadata),
        extractedLinks: metadata.extraction.extractedLinks,
      }
    }
    return item
  })
}
