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

const getNextRefreshAttempt = (item: LinkViewItem | undefined): number =>
  Math.max(
    0,
    ...(item?.metadata.debugLog ?? []).map((entry) => entry.attempt ?? 0)
  ) + 1

const createRefreshDebugLogEntry = ({
  item,
  meta,
  outcome,
  startedAt,
  nodeCount,
  ...details
}: {
  item: LinkViewItem | undefined
  meta?: MetaData
  outcome: LinkDebugLogEntry["outcome"]
  startedAt: number
  nodeCount?: number
} & Pick<
  LinkDebugLogEntry,
  "errorCode" | "detail" | "httpStatus"
>): LinkDebugLogEntry => {
  const existingMeta = item ? getLinkViewItemFlatMeta(item) : undefined
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
  if (!item) {
    return
  }
  reporter.publish({
    kind: "refresh-attempt",
    itemUrl,
    debugLogEntry: createRefreshDebugLogEntry({
      item,
      meta,
      outcome: "failed",
      startedAt,
      ...getRefreshFailureDetails(cause),
    }),
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
      reporter.publish({
        kind: "links-updated",
        itemUrl,
        links: refreshedLinks,
        debugLogEntry: createRefreshDebugLogEntry({
          item: currentItem,
          outcome: "complete",
          startedAt,
          nodeCount: refreshedLinks.length,
        }),
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
      if (item) {
        reporter.publish({
          kind: "refresh-attempt",
          itemUrl,
          debugLogEntry: createRefreshDebugLogEntry({
            item,
            meta: mergedMeta,
            outcome: "complete",
            startedAt,
            nodeCount: presentation.links.length,
          }),
        })
      }
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
      if (item) {
        reporter.publish({
          kind: "links-updated",
          itemUrl,
          links: [presentation.link],
          debugLogEntry: createRefreshDebugLogEntry({
            item,
            meta: mergedMeta,
            outcome: "complete",
            startedAt,
            nodeCount: 1,
          }),
        })
      }
      reporter.publish({ kind: "refresh-succeeded" })
      return
    }

    const message = "No playable links are available. Try another Source page."
    if (item) {
      reporter.publish({
        kind: "refresh-attempt",
        itemUrl,
        debugLogEntry: createRefreshDebugLogEntry({
          item,
          meta: mergedMeta,
          outcome: "failed",
          startedAt,
          nodeCount: 0,
          errorCode: "EMPTY_RESULT",
          detail: message,
        }),
      })
    }
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
