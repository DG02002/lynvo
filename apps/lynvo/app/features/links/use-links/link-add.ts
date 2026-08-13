import { toast } from "sonner"
import { createLinkMetadata } from "~/features/links/links.mapper"
import type { ExtractedLink, MetaData } from "~/features/links/types"
import { createLinkViewItem, getLinkTitle } from "./link-items"
import { fetchMetaInternal } from "./link-server"

export const buildLinkViewItem = async ({
  targetUrl,
  meta,
  extractedLinks,
}: {
  targetUrl: string
  meta?: MetaData
  extractedLinks?: ExtractedLink[]
}) => {
  const resolvedMeta = meta ?? (await fetchMetaInternal(targetUrl))
  const title = getLinkTitle(targetUrl, resolvedMeta)
  const metadata = createLinkMetadata({
    meta: resolvedMeta,
    extractedLinks,
  })

  return {
    title,
    metadata,
    item: createLinkViewItem({ targetUrl, title, metadata }),
  }
}

export const showSaveError = (cause: unknown) => {
  console.error(cause)
  toast.error(
    "The link couldn’t be saved. Check account storage, then try again."
  )
}
