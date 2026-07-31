import type {
  ExtractedLink,
  MetaData,
  RecentLinkViewItem,
} from "~/features/links/types"
import { mergeDefinedMeta } from "~/features/links/links.mapper"
import {
  getRecentLinkViewItemSourceId,
  getRecentLinkViewItemWorkerId,
} from "~/features/links/link-metadata-accessors"
import { attachResolvedChildren } from "~/features/links/link-tree-metadata"
import { decideSavePresentation } from "./presentation"
import { defaultExtractionClient } from "./client"

declare global {
  interface ExtractionTransport {
    extract: (request: {
      url: string
      workerId?: string
      pluginId?: string
      kind?: "source" | "node"
    }) => Promise<{ links: ExtractedLink[]; meta?: MetaData }>
    getMetadata: (request: { url: string }) => Promise<MetaData>
  }

  interface PrepareExtractionOptions {
    targetUrl: string
    recents: RecentLinkViewItem[]
    sourceMetadata?: MetaData
    existingMeta?: MetaData
  }

  interface ExtractionOrchestration {
    getSourceMetadata: (
      targetUrl: string,
      recents: RecentLinkViewItem[]
    ) => Promise<MetaData>
    prepareSource: (options: PrepareExtractionOptions) => Promise<{
      metadata: MetaData
      mergedMeta: MetaData
      presentation: ReturnType<typeof decideSavePresentation>
    }>
    refreshSource: (item: RecentLinkViewItem) => Promise<ExtractedLink[]>
    resolveMirror: (
      item: RecentLinkViewItem | undefined,
      lazyItemUrl: string
    ) => Promise<ExtractedLink[]>
    resolveFolder: (options: {
      folderUrl: string
      workerId?: string
      pluginId?: string
    }) => Promise<ExtractedLink[]>
    expandFolder: (options: {
      item: RecentLinkViewItem
      linkId: string
      linkUrl: string
    }) => Promise<ExtractedLink[]>
  }
}

const getSavedWorkerId = (item: RecentLinkViewItem | undefined) =>
  getRecentLinkViewItemWorkerId(item) || undefined

const getSavedSourceId = (item: RecentLinkViewItem | undefined) =>
  getRecentLinkViewItemSourceId(item) || undefined

export const createExtractionOrchestration = (
  transport: ExtractionTransport
): ExtractionOrchestration => {
  const getSourceMetadata = async (
    targetUrl: string,
    recents: RecentLinkViewItem[]
  ) => {
    const metadata = await transport.getMetadata({ url: targetUrl })
    const existingItem = recents.find((item) => item.url === targetUrl)
    const workerId = getSavedWorkerId(existingItem)
    return workerId ? { ...metadata, workerId } : metadata
  }
  const extractSavedItemNode = async (
    item: RecentLinkViewItem | undefined,
    url: string
  ) => {
    const workerId = getSavedWorkerId(item)
    return await transport.extract({
      url,
      workerId,
      pluginId: getSavedSourceId(item),
      kind: workerId ? "node" : undefined,
    })
  }
  const extractFolder = async (
    folderUrl: string,
    workerId?: string,
    pluginId?: string
  ) =>
    (
      await transport.extract({
        url: folderUrl,
        workerId,
        pluginId,
        kind: workerId ? "node" : undefined,
      })
    ).links

  return {
    getSourceMetadata,
    prepareSource: async ({
      targetUrl,
      recents,
      sourceMetadata,
      existingMeta,
    }) => {
      const metadata =
        sourceMetadata ?? (await getSourceMetadata(targetUrl, recents))
      const existingItem = recents.find((item) => item.url === targetUrl)
      const workerId = getSavedWorkerId(existingItem)
      const metadataWithWorker = workerId ? { ...metadata, workerId } : metadata
      const extraction = await transport.extract({ url: targetUrl, workerId })
      const mergedMeta = mergeDefinedMeta(
        mergeDefinedMeta(metadataWithWorker, existingMeta),
        extraction.meta
      )
      return {
        metadata: metadataWithWorker,
        mergedMeta,
        presentation: decideSavePresentation(extraction.links),
      }
    },
    refreshSource: async (item) => {
      const result = await transport.extract({
        url: item.url,
        workerId: getSavedWorkerId(item),
        pluginId: getSavedSourceId(item),
      })
      return result.links
    },
    resolveMirror: async (item, lazyItemUrl) =>
      (await extractSavedItemNode(item, lazyItemUrl)).links,
    resolveFolder: async ({ folderUrl, workerId, pluginId }) =>
      await extractFolder(folderUrl, workerId, pluginId),
    expandFolder: async ({ item, linkId, linkUrl }) => {
      const resolvedChildren = await extractFolder(
        linkUrl,
        getSavedWorkerId(item),
        getSavedSourceId(item)
      )
      return attachResolvedChildren({
        links: item.extractedLinks ?? [],
        linkId,
        linkUrl,
        resolvedChildren,
      })
    },
  }
}

export const extractionOrchestration = createExtractionOrchestration(
  defaultExtractionClient
)
