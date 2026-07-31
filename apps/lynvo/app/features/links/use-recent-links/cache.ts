import type { RecentLinkViewItem } from "~/features/links/types"
import { RECENT_LINKS_MAX_COUNT } from "../../../../convex/constants"
import {
  toRecentLinkViewItem,
  toSavedLinkDTO,
  createLinkMetadata,
  normalizeLinkMetadata,
  toFlatMeta,
  type SavedLink,
} from "~/features/links/links.mapper"
import {
  linksCacheEnvelopeSchema,
  storedRecentLinkSchema,
  storedSavedLinkSchema,
} from "~/features/links/storage-schemas"

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
    const result = linksCacheEnvelopeSchema.safeParse(parsed)
    if (result.success) {
      return {
        results: result.data.results.flatMap((value) => {
          const savedLink = storedSavedLinkSchema.safeParse(value)
          return savedLink.success ? [toSavedLink(savedLink.data)] : []
        }),
        version: result.data.version,
        etag: result.data.etag,
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
    meta: normalizeLinkMetadata(value.meta),
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
    const parsed: unknown = JSON.parse(savedRecents)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.flatMap((value) => {
      const item = storedRecentLinkSchema.safeParse(value)
      return item.success
        ? [
            {
              ...item.data,
              extractedLinks: undefined,
            } as RecentLinkViewItem,
          ]
        : []
    })
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
      const metadata = createLinkMetadata({
        meta: item.meta,
        extractedLinks: existing.extractedLinks,
        previous: item.metadata,
      })
      return {
        ...item,
        metadata,
        meta: toFlatMeta(metadata),
        extractedLinks: metadata.extraction.extractedLinks,
      }
    }
    return item
  })
}
