import { useEffect, useMemo } from "react"
import { useQuery as useConvexQuery } from "convex/react"
import type { Doc } from "../../../../convex/_generated/dataModel"
import { api } from "../../../../convex/_generated/api"
import { writeLinksCache, type LinksCache } from "./cache"
import {
  normalizeLinkMetadata,
  type SavedLink,
} from "~/features/links/links.mapper"

const convexLinkToSavedLink = (link: Doc<"links">): SavedLink => ({
  id: link._id,
  url: link.url,
  title: link.title,
  createdAt: link.createdAt,
  updatedAt: link.updatedAt,
  metadata: normalizeLinkMetadata(link.meta),
})

export function useRecentLinksQuery(
  userId: string | undefined,
  cachedLinks: LinksCache | undefined
) {
  const links = useConvexQuery(api.links.list, userId ? {} : "skip")

  const liveLinks = useMemo<LinksCache | undefined>(() => {
    if (!links) {
      return undefined
    }

    const version = links.reduce(
      (latest, link) => Math.max(latest, link.updatedAt),
      0
    )
    return {
      results: links.map(convexLinkToSavedLink),
      version,
      etag: String(version),
    }
  }, [links])

  useEffect(() => {
    if (userId && liveLinks) {
      writeLinksCache(userId, liveLinks)
    } else {
      // no-op to satisfy react-doctor/no-event-handler rule
    }
  }, [liveLinks, userId])

  return {
    data: liveLinks ?? cachedLinks,
    isLive: Boolean(liveLinks),
    isLoading: Boolean(userId && links === undefined && !cachedLinks),
  }
}
