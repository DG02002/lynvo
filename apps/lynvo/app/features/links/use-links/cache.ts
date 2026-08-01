import type { LinkViewItem } from "~/features/links/types"
import { z } from "zod"
import { LINKS_MAX_COUNT } from "../../../../convex/constants"
import {
  toLinkViewItem,
  createLinkMetadata,
  toFlatMeta,
  type SavedLink,
} from "~/features/links/links.mapper"
import {
  linksCacheEnvelopeSchema,
  storedLinkSchema,
  storedSavedLinkSchema,
} from "~/features/links/storage-schemas"

export const LINKS_MAX_LIMIT = LINKS_MAX_COUNT
export const LINKS_KEY = "lynvo:links:v1"
const SYNCED_LINKS_KEY_PREFIX = "lynvo:links:sync:v1:"

export type LinksCache = {
  results: SavedLink[]
  version: number
  etag: string
}

function linksCacheKey(userId: string) {
  return `${SYNCED_LINKS_KEY_PREFIX}${userId}`
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
    console.error("Unable to read the synced links cache", error)
    localStorage.removeItem(linksCacheKey(userId))
  }
  return undefined
}

export function writeLinksCache(userId: string, cache: LinksCache) {
  try {
    localStorage.setItem(linksCacheKey(userId), JSON.stringify(cache))
  } catch (error) {
    console.error("Unable to write the synced links cache", error)
  }
}

const toSavedLink = (
  value: z.infer<typeof storedSavedLinkSchema>
): SavedLink => ({
  id: value.id,
  url: value.url,
  title: value.title,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
  metadata: value.metadata,
})

export function readLocalLinks(): LinkViewItem[] {
  if (typeof window === "undefined") {
    return []
  }
  try {
    const savedLinks = localStorage.getItem(LINKS_KEY)
    if (!savedLinks) {
      return []
    }
    const parsed: unknown = JSON.parse(savedLinks)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.flatMap((value) => {
      const item = storedLinkSchema.safeParse(value)
      return item.success
        ? [
            {
              ...item.data,
              extractedLinks: undefined,
            } as LinkViewItem,
          ]
        : []
    })
  } catch (error) {
    console.error("Unable to read links", error)
    localStorage.removeItem(LINKS_KEY)
    return []
  }
}

export function linksToLinkViewItems(
  links: SavedLink[],
  previous: LinkViewItem[] = []
) {
  return links.map((link) => {
    const item = toLinkViewItem(link)
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
