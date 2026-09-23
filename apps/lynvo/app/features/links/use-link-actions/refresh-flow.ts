import { getLinkViewItemFlatMeta } from "~/features/links/link-metadata-accessors"
import {
  reportGenericSavedLinkError,
  SAVED_LINK_REFRESH_ERROR_MESSAGE,
} from "~/features/links/saved-link-interaction"
import type {
  ExtractedLink,
  LinkDebugLogEntry,
  LinkViewItem,
  MetaData,
} from "~/features/links/types"
import { ApiClientError } from "~/lib/api/client"
import { extractionOrchestration } from "~/lib/extraction/orchestration"

import type {
  FolderExpandOptions,
  MirrorExpandOptions,
  SoftRefreshOptions,
} from "./action-types"
import { getExtractionErrorMessage } from "./extraction-error-message"

const reportRefreshFailure = (
  reporter: SoftRefreshOptions["reporter"],
  cause: unknown,
  fallbackMessage: string
): void => {
  console.error(cause)
  reportGenericSavedLinkError(
    reporter,
    getExtractionErrorMessage(cause, fallbackMessage)
  )
}

const getRefreshFailureDetails = (
  cause: unknown
): Pick<LinkDebugLogEntry, "errorCode" | "detail" | "httpStatus"> => {
  if (cause instanceof ApiClientError) {
    return {
      errorCode: cause.body?.message ?? cause._tag,
      detail: cause.message,
      httpStatus: cause.status,
    }
  }
  if (cause instanceof Error) {
    return { errorCode: cause.name, detail: cause.message }
  }
  return {
    errorCode: "UNKNOWN_FAILURE",
    detail: "The extraction request failed.",
  }
}

type RefreshDebugLogDetails = Pick<
  LinkDebugLogEntry,
  "errorCode" | "detail" | "httpStatus"
>

type RefreshDebugLogOptions = {
  item: LinkViewItem
  meta?: MetaData
  outcome: LinkDebugLogEntry["outcome"]
  startedAt: number
  nodeCount?: number
} & RefreshDebugLogDetails

const getNextRefreshAttempt = (item: LinkViewItem): number =>
  Math.max(
    0,
    ...(item.metadata.debugLog ?? []).map((entry) => entry.attempt ?? 0)
  ) + 1

const createRefreshDebugLogEntry = ({
  item,
  meta,
  outcome,
  startedAt,
  nodeCount,
  ...details
}: RefreshDebugLogOptions): LinkDebugLogEntry => {
  const existingMeta = getLinkViewItemFlatMeta(item)
  return {
    at: Date.now(),
    pluginServerId: meta?.pluginServerId ?? existingMeta?.pluginServerId,
    pluginId: meta?.pluginId ?? existingMeta?.pluginId,
    outcome,
    attempt: getNextRefreshAttempt(item),
    durationMs: Math.max(0, Date.now() - startedAt),
    nodeCount,
    ...details,
  }
}

type RefreshAttemptPublicationOptions = Omit<RefreshDebugLogOptions, "item"> & {
  reporter: SoftRefreshOptions["reporter"]
  itemUrl: string
  item: LinkViewItem | undefined
}

const publishRefreshAttempt = ({
  reporter,
  itemUrl,
  item,
  meta,
  outcome,
  startedAt,
  nodeCount,
  ...details
}: RefreshAttemptPublicationOptions): void => {
  if (!item) {
    return
  }
  reporter.publish({
    kind: "refresh-attempt",
    itemUrl,
    debugLogEntry: createRefreshDebugLogEntry({
      item,
      meta,
      outcome,
      startedAt,
      nodeCount,
      ...details,
    }),
  })
}

const publishUpdatedLinks = ({
  reporter,
  itemUrl,
  item,
  links,
  meta,
  startedAt,
}: {
  reporter: SoftRefreshOptions["reporter"]
  itemUrl: string
  item: LinkViewItem | undefined
  links: ExtractedLink[]
  meta?: MetaData
  startedAt: number
}): void => {
  if (!item) {
    return
  }
  reporter.publish({
    kind: "links-updated",
    itemUrl,
    links,
    debugLogEntry: createRefreshDebugLogEntry({
      item,
      meta,
      outcome: "complete",
      startedAt,
      nodeCount: links.length,
    }),
  })
}

const appendRefreshFailureLog = ({
  reporter,
  itemUrl,
  item,
  cause,
  startedAt,
  meta,
}: {
  reporter: SoftRefreshOptions["reporter"]
  itemUrl: string
  item: LinkViewItem | undefined
  cause: unknown
  startedAt: number
  meta?: MetaData
}): void => {
  publishRefreshAttempt({
    reporter,
    itemUrl,
    item,
    meta,
    outcome: "failed",
    startedAt,
    ...getRefreshFailureDetails(cause),
  })
}

export const softRefreshLink = async ({
  itemUrl,
  links,
  reporter,
}: SoftRefreshOptions) => {
  const startedAt = Date.now()
  const currentItem = links.find((linkItem) => linkItem.url === itemUrl)
  try {
    if (currentItem) {
      const refreshedLinks =
        await extractionOrchestration.refreshSource(currentItem)
      publishUpdatedLinks({
        reporter,
        itemUrl,
        item: currentItem,
        links: refreshedLinks,
        startedAt,
      })
    }
    reporter.publish({ kind: "refresh-succeeded" })
  } catch (error) {
    appendRefreshFailureLog({
      reporter,
      itemUrl,
      item: currentItem,
      cause: error,
      startedAt,
    })
    reportRefreshFailure(reporter, error, SAVED_LINK_REFRESH_ERROR_MESSAGE)
  }
}

export const hardRefreshLink = async ({
  itemUrl,
  links,
  reporter,
}: SoftRefreshOptions) => {
  const item = links.find((linkItem) => linkItem.url === itemUrl)
  const startedAt = Date.now()

  try {
    const { mergedMeta, presentation } =
      await extractionOrchestration.prepareSource({
        targetUrl: itemUrl,
        links,
        existingMeta: item ? getLinkViewItemFlatMeta(item) : undefined,
      })

    if (presentation.kind === "selectionDialog") {
      publishRefreshAttempt({
        reporter,
        itemUrl,
        item,
        meta: mergedMeta,
        outcome: "pending",
        startedAt,
        nodeCount: presentation.links.length,
      })
      reporter.publish({
        kind: "selection-required",
        selection: {
          originalUrl: itemUrl,
          links: presentation.links,
          meta: mergedMeta,
          existingItemId: item?.id,
        },
      })
      return
    }

    if (presentation.kind === "directSave") {
      publishUpdatedLinks({
        reporter,
        itemUrl,
        item,
        links: [presentation.link],
        meta: mergedMeta,
        startedAt,
      })
      reporter.publish({ kind: "refresh-succeeded" })
      return
    }

    const message = "No playable links are available. Try another Source page."
    publishRefreshAttempt({
      reporter,
      itemUrl,
      item,
      meta: mergedMeta,
      outcome: "failed",
      startedAt,
      nodeCount: 0,
      errorCode: "EMPTY_RESULT",
      detail: message,
    })
    reportGenericSavedLinkError(reporter, message)
  } catch (error) {
    appendRefreshFailureLog({
      reporter,
      itemUrl,
      item,
      cause: error,
      startedAt,
    })
    reportRefreshFailure(
      reporter,
      error,
      "Link choices couldn’t be loaded. Try again."
    )
  }
}

export const expandMirrorLinks = async ({
  itemUrl,
  lazyItemUrl,
  links,
  reporter,
}: MirrorExpandOptions): Promise<ExtractedLink[] | null> => {
  try {
    const item = links.find((linkItem) => linkItem.url === itemUrl)
    return await extractionOrchestration.resolveMirror(item, lazyItemUrl)
  } catch (error) {
    reportRefreshFailure(
      reporter,
      error,
      "Playable links couldn’t be loaded. Try again."
    )
    return null
  }
}

export const expandFolderLink = async ({
  itemUrl,
  linkId,
  linkUrl,
  links,
  reporter,
}: FolderExpandOptions) => {
  try {
    const currentItem = links.find((linkItem) => linkItem.url === itemUrl)
    if (!currentItem) {
      return null
    }

    const expandedLinks = await extractionOrchestration.expandFolder({
      item: currentItem,
      linkId,
      linkUrl,
    })
    reporter.publish({ kind: "links-updated", itemUrl, links: expandedLinks })
    return expandedLinks
  } catch (error) {
    reportRefreshFailure(
      reporter,
      error,
      "Playback options couldn’t be loaded. Try again."
    )
    return null
  }
}
