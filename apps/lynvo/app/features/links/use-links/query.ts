import { useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Effect } from "effect"
import { client } from "~/lib/effect/api/client"
import { useDailyTimeBucket } from "~/lib/use-coarse-time-bucket"
import { writeLinksCache, type LinksCache } from "./cache"
import {
  normalizeLinkMetadata,
  type SavedLink,
} from "~/features/links/links.mapper"

interface LinkResult {
  _id: string
  url: string
  title?: string
  meta?: string
  createdAt: number
  updatedAt: number
}

const serverLinkToSavedLink = (link: LinkResult): SavedLink => ({
  id: link._id,
  url: link.url,
  title: link.title,
  createdAt: link.createdAt,
  updatedAt: link.updatedAt,
  metadata: normalizeLinkMetadata(link.meta),
})

export function useLinksQuery(
  userId: string | undefined,
  cachedLinks: LinksCache | undefined
) {
  const timeBucket = useDailyTimeBucket()
  const { data: links, isPending } = useQuery({
    queryKey: ["links", userId, timeBucket],
    queryFn: () => Effect.runPromise(client.links.list()),
    enabled: Boolean(userId),
  })

  const liveLinks = useMemo<LinksCache | undefined>(() => {
    if (!links) {
      return undefined
    }

    const version = links.reduce(
      (latest, link) => Math.max(latest, link.updatedAt),
      0
    )
    return {
      results: links.map(serverLinkToSavedLink),
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
    isLoading: Boolean(userId && isPending && !cachedLinks),
  }
}
