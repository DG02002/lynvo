import { createLinkMetadata } from "~/features/links/link-metadata-normalization"
import { getFilenameFromUrl, getLinkTitle } from "~/features/links/link-title"
import type {
  ExtractedLink,
  LinkExtractionStatus,
  MetaData,
} from "~/features/links/types"
import { showErrorToast } from "~/lib/toast-notifications"

import {
  presentSavedLinkCommandFailure,
  SavedLinkCommandError,
} from "../saved-link-command-failure"
import { createLinkViewItem } from "./link-items"
import { fetchMetaInternal } from "./link-server"

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
