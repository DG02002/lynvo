import { useMemo } from "react"
import { useQuery } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import { useDailyTimeBucket } from "~/lib/use-coarse-time-bucket"
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

export const useLinksQuery = (userId: string | undefined) => {
  const timeBucket = useDailyTimeBucket()
  const snapshot = useQuery(api.links.list, userId ? { timeBucket } : "skip")

  const liveLinks = useMemo(() => {
    if (!snapshot) {
      return undefined
    }

    return {
      results: snapshot.results.flatMap((link) => {
        const savedLink = serverLinkToSavedLink(link)
        return savedLink ? [savedLink] : []
      }),
    }
  }, [snapshot, timeBucket])

  return {
    data: liveLinks,
    isLive: Boolean(liveLinks),
    isLoading: Boolean(userId && snapshot === undefined),
  }
}
