import { showErrorToast } from "~/lib/toast-notifications"
import type {
  ExtractedLink,
  LinkMetadata,
  LinkViewItem,
  MetaData,
} from "~/features/links/types"
import { getLinkViewItemMetadata } from "~/features/links/link-metadata-accessors"
import { removeLinkFromTree } from "~/features/links/link-tree-metadata"
import { withResolvedMirrors } from "~/features/links/link-playback-metadata"
import { linkMetadataSchema } from "~/features/links/storage-schemas"
import { Schema } from "effect"
import {
  createUpdatedItemFromMetadata,
  createUpdatedItemWithLinks,
} from "./link-items"
import { createOpenedLinkItem } from "./link-playback"
import {
  buildLinkViewItem,
  buildQueuedLinkViewItem,
  showSaveError,
} from "./link-add"
import { isTemporaryLinkId } from "./links-store"
import { linksDataApi, type SavedLinkApiMetadataOperation } from "./api"

const toJsonMetadata = (metadata: LinkMetadata): LinkMetadata =>
  Schema.decodeUnknownSync(linkMetadataSchema)(
    JSON.parse(JSON.stringify(metadata))
  )

export interface LinksMutationTargets {
  readonly store: LinksSnapshotStore
  readonly runExclusive: <Result>(
    operation: () => Promise<Result>
  ) => Promise<Result>
  readonly onSettled: () => void
}

export const createLinksMutations = ({
  store,
  runExclusive,
  onSettled,
}: LinksMutationTargets) => {
  const settleAndRefetch = () => {
    onSettled()
  }

  const remove = async (
    itemUrl: string,
    itemId?: string,
    silent = false
  ): Promise<void> => {
    try {
      await runExclusive(async () => {
        const item = store.findVisibleItemByUrl(itemUrl, itemId)
        if (!item?.id) {
          return
        }
        if (isTemporaryLinkId(item.id)) {
          store.discardPendingAdd(item.id)
          return
        }
        if (!store.beginRemove(item.id)) {
          return
        }
        try {
          await linksDataApi.deleteById({ id: item.id })
        } catch (error) {
          settleAndRefetch()
          throw error
        }
      })
      settleAndRefetch()
    } catch {
      if (!silent) {
        showErrorToast({
          title: "Couldn’t remove the link",
          description: "The saved link couldn’t be removed. Try again.",
        })
      }
    }
  }

  const persistLink = async (
    targetUrl: string,
    item: LinkViewItem
  ): Promise<string | undefined> => {
    try {
      return await runExclusive(async () => {
        const temporaryItem = store.beginAdd(item)
        try {
          const result = await linksDataApi.createOrUpdate({
            operationId: crypto.randomUUID(),
            url: targetUrl,
            title: temporaryItem.title ?? targetUrl,
            meta: JSON.stringify(toJsonMetadata(temporaryItem.metadata)),
            extractionState:
              temporaryItem.extractionStatus?.state === "queued"
                ? "queued"
                : undefined,
          })
          if (result.id) {
            store.settleAdd(temporaryItem.id, result.id, result.dataVersion)
          }
          settleAndRefetch()
          return result.id ?? undefined
        } catch (error) {
          store.discardPendingAdd(temporaryItem.id)
          settleAndRefetch()
          throw error
        }
      })
    } catch (error) {
      showSaveError(error)
      return undefined
    }
  }

  const addLink = async (
    targetUrl: string,
    meta?: MetaData,
    extractedLinks?: ExtractedLink[]
  ): Promise<string | undefined> => {
    const { item } = await buildLinkViewItem({
      targetUrl,
      meta,
      extractedLinks,
    })
    return await persistLink(targetUrl, item)
  }

  const enqueueLink = async (
    targetUrl: string
  ): Promise<string | undefined> => {
    const { item } = await buildQueuedLinkViewItem(targetUrl)
    return await persistLink(targetUrl, item)
  }

  const toApiOperation = (
    operation: LinkMetadataOperation,
    expectedExtraction: readonly ExtractedLink[] | undefined
  ): SavedLinkApiMetadataOperation | undefined => {
    switch (operation.kind) {
      case "markOpened": {
        const { linkUrl } = operation
        return linkUrl ? { kind: "markOpened", linkUrl } : undefined
      }
      case "setArtwork": {
        const { providerId, title, year } = operation
        return providerId !== undefined && title !== undefined
          ? { kind: "setArtwork", providerId, title, year }
          : undefined
      }
      case "cacheMirrors": {
        const { lazyItemUrl, mirrors } = operation
        return lazyItemUrl && mirrors
          ? {
              kind: "cacheMirrors",
              lazyItemUrl,
              mirrorsJson: JSON.stringify(mirrors),
            }
          : undefined
      }
      case "removeExtractedLink": {
        const { linkKey, linkUrl } = operation
        return linkKey && linkUrl
          ? { kind: "removeExtractedLink", linkKey, linkUrl }
          : undefined
      }
      case "replaceExtraction": {
        const { extractedLinks } = operation
        return extractedLinks && expectedExtraction
          ? {
              kind: "replaceExtraction",
              expectedExtractionJson: JSON.stringify(expectedExtraction),
              extractedLinksJson: JSON.stringify(extractedLinks),
            }
          : undefined
      }
    }
  }

  const runMetadataUpdate = async (
    itemUrl: string,
    metadataOperation: LinkMetadataOperation,
    updateVisibleItem: (item: LinkViewItem) => LinkViewItem
  ): Promise<void> => {
    await runExclusive(async () => {
      const currentItem = store.findVisibleItemByUrl(itemUrl)
      if (!currentItem?.id || isTemporaryLinkId(currentItem.id)) {
        return
      }
      const expectedExtraction =
        metadataOperation.kind === "replaceExtraction"
          ? currentItem.metadata.extraction.extractedLinks
          : undefined
      const updatedItem = store.beginUpdate(currentItem.id, updateVisibleItem)
      if (!updatedItem) {
        return
      }
      const apiOperation = toApiOperation(metadataOperation, expectedExtraction)
      if (!apiOperation) {
        settleAndRefetch()
        return
      }
      try {
        await linksDataApi.applyMetadataOperation({
          operationId: crypto.randomUUID(),
          id: currentItem.id,
          operation: apiOperation,
        })
      } finally {
        settleAndRefetch()
      }
    }).catch((error) => console.error(error))
  }

  const updateLinks = (targetUrl: string, links: ExtractedLink[]): void => {
    void runMetadataUpdate(
      targetUrl,
      { kind: "replaceExtraction", extractedLinks: links },
      (item) => createUpdatedItemWithLinks({ item, links })
    )
  }

  const markLinkAsOpened = (itemUrl: string, linkUrl: string): void => {
    void runMetadataUpdate(itemUrl, { kind: "markOpened", linkUrl }, (item) =>
      createOpenedLinkItem(item, linkUrl)
    )
  }

  const cacheResolvedMirrors = (
    itemUrl: string,
    lazyItemUrl: string,
    mirrors: ExtractedLink[]
  ): void => {
    void runMetadataUpdate(
      itemUrl,
      { kind: "cacheMirrors", lazyItemUrl, mirrors },
      (item) =>
        createUpdatedItemFromMetadata(
          item,
          withResolvedMirrors(
            getLinkViewItemMetadata(item),
            lazyItemUrl,
            mirrors
          )
        )
    )
  }

  const setArtwork = (
    itemUrl: string,
    identity: MediaArtworkIdentity
  ): void => {
    const operation: LinkMetadataOperation = {
      kind: "setArtwork",
      providerId: identity.providerId,
      title: identity.title,
      year: identity.year,
    }
    void runMetadataUpdate(itemUrl, operation, (item) => item)
  }

  const removeLink = (
    itemUrl: string,
    linkKey: string,
    linkUrl: string
  ): void => {
    void runMetadataUpdate(
      itemUrl,
      { kind: "removeExtractedLink", linkKey, linkUrl },
      (item) => {
        const metadata = getLinkViewItemMetadata(item)
        return createUpdatedItemFromMetadata(item, {
          ...metadata,
          extraction: {
            ...metadata.extraction,
            extractedLinks: removeLinkFromTree(
              metadata.extraction.extractedLinks,
              linkKey
            ),
          },
          playback: {
            ...metadata.playback,
            openedUrls: metadata.playback.openedUrls.filter(
              (openedUrl) => openedUrl !== linkUrl
            ),
          },
        })
      }
    )
  }

  return {
    remove,
    addLink,
    enqueueLink,
    updateLinks,
    markLinkAsOpened,
    cacheResolvedMirrors,
    setArtwork,
    removeLink,
  }
}
