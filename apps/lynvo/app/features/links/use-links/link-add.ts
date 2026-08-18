import { toast } from "sonner"
import { createLinkMetadata } from "~/features/links/links.mapper"
import type { ExtractedLink, MetaData } from "~/features/links/types"
import { createLinkViewItem, getLinkTitle } from "./link-items"
import { fetchMetaInternal } from "./link-server"
import {
  presentSavedLinkCommandFailure,
  SavedLinkCommandError,
} from "../saved-link-command-failure"

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
    cause instanceof SavedLinkCommandError
      ? presentSavedLinkCommandFailure(cause.failure)
      : "The link couldn’t be saved right now. Try again."
  )
}
