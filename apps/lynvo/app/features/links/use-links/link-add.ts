import { showErrorToast } from "~/lib/toast-notifications"
import { createLinkMetadata } from "~/features/links/links.mapper"
import type {
  ExtractedLink,
  LinkExtractionStatus,
  MetaData,
} from "~/features/links/types"
import {
  createLinkViewItem,
  getFilenameFromUrl,
  getLinkTitle,
} from "./link-items"
import { fetchMetaInternal } from "./link-server"
import {
  presentSavedLinkCommandFailure,
  SavedLinkCommandError,
} from "../saved-link-command-failure"

export const buildLinkViewItem = async ({
  targetUrl,
  meta,
  extractedLinks,
  extractionStatus,
}: {
  targetUrl: string
  meta?: MetaData
  extractedLinks?: ExtractedLink[]
  extractionStatus?: LinkExtractionStatus
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
    item: createLinkViewItem({
      targetUrl,
      title,
      metadata,
      extractionStatus,
    }),
  }
}

export const buildQueuedLinkViewItem = async (targetUrl: string) =>
  buildLinkViewItem({
    targetUrl,
    meta: { title: getFilenameFromUrl(targetUrl) },
    extractedLinks: [],
    extractionStatus: { state: "queued" },
  })

export const showSaveError = (cause: unknown) => {
  console.error(cause)
  showErrorToast({
    title: "Couldn’t save the link",
    description:
      cause instanceof SavedLinkCommandError
        ? presentSavedLinkCommandFailure(cause.failure)
        : "Unable to save link. Try again.",
  })
}
