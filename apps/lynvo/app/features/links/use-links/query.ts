import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Effect } from "effect"
import { client } from "~/lib/effect/api/client"
import { useDailyTimeBucket } from "~/lib/use-coarse-time-bucket"
import type { LinksCache } from "./cache"
import {
  parseLinkMetadata,
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

export const savedLinksQueryKey = (
  userId: string | undefined,
  timeBucket?: number
) =>
  timeBucket === undefined ? ["links", userId] : ["links", userId, timeBucket]

const serverLinkToSavedLink = (link: LinkResult): SavedLink | undefined => {
  try {
    return {
      id: link._id,
      url: link.url,
      title: link.title,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      metadata: parseLinkMetadata(link.meta),
    }
  } catch (error) {
    console.error("Unable to hydrate saved link", { linkId: link._id, error })
    return undefined
  }
}

export function useLinksQuery(
  userId: string | undefined,
  cachedLinks: LinksCache | undefined
) {
  const timeBucket = useDailyTimeBucket()
  const { data: snapshot, isPending } = useQuery({
    queryKey: savedLinksQueryKey(userId, timeBucket),
    queryFn: () => Effect.runPromise(client.links.list()),
    enabled: Boolean(userId),
  })

  const liveLinks = useMemo<LinksCache | undefined>(() => {
    if (!snapshot) {
      return undefined
    }

    return {
      results: snapshot.results.flatMap((link) => {
        const savedLink = serverLinkToSavedLink(link)
        return savedLink ? [savedLink] : []
      }),
      revision: snapshot.revision,
      etag: `${snapshot.revision}:${timeBucket}`,
    }
  }, [snapshot, timeBucket])

  return {
    data: liveLinks ?? cachedLinks,
    isLive: Boolean(liveLinks),
    isLoading: Boolean(userId && isPending && !cachedLinks),
  }
}
