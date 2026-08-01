import type {
  ExtractedLink,
  MetaData,
  LinkViewItem,
} from "~/features/links/types"
import { mergeDefinedMeta } from "~/features/links/links.mapper"
import {
  getLinkViewItemSourceId,
  getLinkViewItemPluginServerId,
} from "~/features/links/link-metadata-accessors"
import { attachResolvedChildren } from "~/features/links/link-tree-metadata"
import { decideSavePresentation } from "./presentation"
import { defaultExtractionClient } from "./client"

declare global {
  interface ExtractionTransport {
    extract: (request: {
      url: string
      pluginServerId?: string
      pluginId?: string
      kind?: "source" | "node"
    }) => Promise<{ links: ExtractedLink[]; meta?: MetaData }>
    getMetadata: (request: { url: string }) => Promise<MetaData>
  }

  interface PrepareExtractionOptions {
    targetUrl: string
    links: LinkViewItem[]
    sourceMetadata?: MetaData
    existingMeta?: MetaData
  }

  interface ExtractionOrchestration {
    getSourceMetadata: (
      targetUrl: string,
      links: LinkViewItem[]
    ) => Promise<MetaData>
    prepareSource: (options: PrepareExtractionOptions) => Promise<{
      metadata: MetaData
      mergedMeta: MetaData
      presentation: ReturnType<typeof decideSavePresentation>
    }>
    refreshSource: (item: LinkViewItem) => Promise<ExtractedLink[]>
    resolveMirror: (
      item: LinkViewItem | undefined,
      lazyItemUrl: string
    ) => Promise<ExtractedLink[]>
    resolveFolder: (options: {
      folderUrl: string
      pluginServerId?: string
      pluginId?: string
    }) => Promise<ExtractedLink[]>
    expandFolder: (options: {
      item: LinkViewItem
      linkId: string
      linkUrl: string
    }) => Promise<ExtractedLink[]>
  }
}

const getSavedPluginServerId = (item: LinkViewItem | undefined) =>
  getLinkViewItemPluginServerId(item) || undefined

const getSavedSourceId = (item: LinkViewItem | undefined) =>
  getLinkViewItemSourceId(item) || undefined

export const createExtractionOrchestration = (
  transport: ExtractionTransport
): ExtractionOrchestration => {
  const getSourceMetadata = async (
    targetUrl: string,
    links: LinkViewItem[]
  ) => {
    const metadata = await transport.getMetadata({ url: targetUrl })
    const existingItem = links.find((item) => item.url === targetUrl)
    const pluginServerId = getSavedPluginServerId(existingItem)
    return pluginServerId ? { ...metadata, pluginServerId } : metadata
  }
  const extractSavedItemNode = async (
    item: LinkViewItem | undefined,
    url: string
  ) => {
    const pluginServerId = getSavedPluginServerId(item)
    return await transport.extract({
      url,
      pluginServerId,
      pluginId: getSavedSourceId(item),
      kind: pluginServerId ? "node" : undefined,
    })
  }
  const extractFolder = async (
    folderUrl: string,
    pluginServerId?: string,
    pluginId?: string
  ) =>
    (
      await transport.extract({
        url: folderUrl,
        pluginServerId,
        pluginId,
        kind: pluginServerId ? "node" : undefined,
      })
    ).links

  return {
    getSourceMetadata,
    prepareSource: async ({
      targetUrl,
      links,
      sourceMetadata,
      existingMeta,
    }) => {
      const metadata =
        sourceMetadata ?? (await getSourceMetadata(targetUrl, links))
      const existingItem = links.find((item) => item.url === targetUrl)
      const pluginServerId = getSavedPluginServerId(existingItem)
      const metadataWithPluginServer = pluginServerId
        ? { ...metadata, pluginServerId }
        : metadata
      const extraction = await transport.extract({
        url: targetUrl,
        pluginServerId,
      })
      const mergedMeta = mergeDefinedMeta(
        mergeDefinedMeta(metadataWithPluginServer, existingMeta),
        extraction.meta
      )
      return {
        metadata: metadataWithPluginServer,
        mergedMeta,
        presentation: decideSavePresentation(extraction.links),
      }
    },
    refreshSource: async (item) => {
      const result = await transport.extract({
        url: item.url,
        pluginServerId: getSavedPluginServerId(item),
        pluginId: getSavedSourceId(item),
      })
      return result.links
    },
    resolveMirror: async (item, lazyItemUrl) =>
      (await extractSavedItemNode(item, lazyItemUrl)).links,
    resolveFolder: async ({ folderUrl, pluginServerId, pluginId }) =>
      await extractFolder(folderUrl, pluginServerId, pluginId),
    expandFolder: async ({ item, linkId, linkUrl }) => {
      const resolvedChildren = await extractFolder(
        linkUrl,
        getSavedPluginServerId(item),
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
