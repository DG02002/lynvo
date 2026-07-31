import { toast } from "sonner"
import { createLinkMetadata } from "~/features/links/links.mapper"
import type { ExtractedLink, MetaData } from "~/features/links/types"
import { createRecentLinkViewItem, getRecentTitle } from "./recent-link-items"
import { fetchMetaInternal } from "./recent-link-server"

export const buildRecentLinkViewItem = async ({
  targetUrl,
  meta,
  extractedLinks,
}: {
  targetUrl: string
  meta?: MetaData
  extractedLinks?: ExtractedLink[]
}) => {
  const resolvedMeta = meta ?? (await fetchMetaInternal(targetUrl))
  const title = getRecentTitle(targetUrl, resolvedMeta)
  const metadata = createLinkMetadata({
    meta: resolvedMeta,
    extractedLinks,
  })

  return {
    title,
    metadata,
    item: createRecentLinkViewItem({ targetUrl, title, metadata }),
  }
}

export const showSaveError = (error: unknown) => {
  console.error(error)
  toast.error(
    "The link couldn’t be saved. Check account storage, then try again."
  )
}
