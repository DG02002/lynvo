import { toast } from "sonner"
import { createMetadataV2 } from "~/features/links/links.mapper"
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
  const metadata = createMetadataV2({
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
  toast.error("Unable to save the link. Try again.")
}
