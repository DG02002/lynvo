import {
  getLynvoManifestExtension,
  getMatchedPlugin,
  type ExtractSuccessResponse,
  type PluginMetadata,
  type PluginServerManifest,
} from "@dg02002/lynvo-plugin-server-protocol"
import { mapNodesToExtractedLinks } from "~/lib/plugin-server-utils"
import {
  decodeExtractionText,
  normalizeExtractionText,
} from "~/lib/extraction/extraction-text-normalization"
import type {
  ExtractionMetadata,
  ExtractionResult,
  MetadataResult,
} from "./extraction-types"

interface GetPluginServerMetadataInput {
  manifest: PluginServerManifest
  pluginServerId: string
  targetUrl?: string
  pluginId?: string
}

interface MutablePluginServerMetadata {
  filename: string
  pluginName: string
  pluginServerId: string
  pluginIcon?: string
  pluginId?: string
  sourceName?: string
  sourceIconUrl?: string
  sourceStatus?: "active" | "maintenance" | "degraded" | "down"
  sourceVersion?: string
  sourceCredentialKind?: "domain-password" | "http-basic"
  routeSourceName?: string
  routeSourceIconUrl?: string
}

const addPluginSourceIdentity = (
  metadata: MutablePluginServerMetadata,
  source: PluginMetadata | undefined
): void => {
  if (source?.id) {
    metadata.pluginId = source.id
  }
  if (source?.displayName) {
    metadata.sourceName = decodeExtractionText(source.displayName)
  }
  if (source?.iconUrl) {
    metadata.sourceIconUrl = source.iconUrl
  }
}

const addPluginSourceStatus = (
  metadata: MutablePluginServerMetadata,
  source: PluginMetadata | undefined
): void => {
  if (source?.status) {
    metadata.sourceStatus = source.status
  }
  if (source?.version) {
    metadata.sourceVersion = source.version
  }
  if (source?.credential) {
    metadata.sourceCredentialKind = source.credential.kind
  }
}

const addRouteSourceMetadata = (
  metadata: MutablePluginServerMetadata,
  routeSource: PluginMetadata | undefined
): void => {
  if (routeSource?.displayName) {
    metadata.routeSourceName = decodeExtractionText(routeSource.displayName)
  }
  if (routeSource?.iconUrl) {
    metadata.routeSourceIconUrl = routeSource.iconUrl
  }
}

const createPluginServerMetadata = (
  manifest: PluginServerManifest,
  pluginServerId: string
): MutablePluginServerMetadata => {
  const metadata: MutablePluginServerMetadata = {
    filename: "",
    pluginName: decodeExtractionText(manifest.displayName),
    pluginServerId,
  }
  if (manifest.iconUrl) {
    metadata.pluginIcon = manifest.iconUrl
  }
  return metadata
}

const getRouteSource = (
  manifest: PluginServerManifest,
  source: PluginMetadata | undefined
): PluginMetadata | undefined => {
  const routeSourceId = source?.routesToPluginId
  if (!routeSourceId) {
    return undefined
  }
  return getLynvoManifestExtension(manifest).plugins?.find(
    (candidate) => candidate.id === routeSourceId
  )
}

const addExtractionPluginMetadata = (
  metadata: ExtractionMetadata,
  plugin: ExtractSuccessResponse["plugin"],
  source: PluginMetadata | undefined
): void => {
  if (plugin.iconUrl) {
    metadata.pluginIcon = plugin.iconUrl
  }
  const sourceId = plugin.pluginId || source?.id
  if (sourceId) {
    metadata.pluginId = sourceId
  }
  const sourceName = plugin.pluginName || source?.displayName
  if (sourceName) {
    metadata.sourceName = decodeExtractionText(sourceName)
  }
  const sourceIconUrl = plugin.pluginIconUrl || source?.iconUrl
  if (sourceIconUrl) {
    metadata.sourceIconUrl = sourceIconUrl
  }
}

const addExtractionSourceDetails = (
  metadata: ExtractionMetadata,
  plugin: ExtractSuccessResponse["plugin"],
  source: PluginMetadata | undefined
): void => {
  if (source?.status) {
    metadata.sourceStatus = source.status
  }
  if (source?.version) {
    metadata.sourceVersion = source.version
  }
  if (source?.credential) {
    metadata.sourceCredentialKind = source.credential.kind
  }
  if (plugin.pageTitle) {
    metadata.pageTitle = plugin.pageTitle
  }
  if (plugin.audio) {
    metadata.audio = plugin.audio
  }
}

const getPluginMetadataSource = (
  manifest: PluginServerManifest,
  targetUrl: string | undefined,
  pluginId: string | undefined
): PluginMetadata | undefined => {
  if (pluginId) {
    return getLynvoManifestExtension(manifest).plugins?.find(
      (candidate) => candidate.id === pluginId
    )
  }

  if (targetUrl) {
    return getMatchedPlugin(manifest, targetUrl)
  }

  return undefined
}

export const getPluginServerMetadata = ({
  manifest,
  pluginServerId,
  targetUrl,
  pluginId,
}: GetPluginServerMetadataInput): MetadataResult => {
  const source = getPluginMetadataSource(manifest, targetUrl, pluginId)
  const routeSource = getRouteSource(manifest, source)
  const metadata = createPluginServerMetadata(manifest, pluginServerId)
  addPluginSourceIdentity(metadata, source)
  addPluginSourceStatus(metadata, source)
  addRouteSourceMetadata(metadata, routeSource)
  return metadata
}

export const mapPluginServerExtractionResult = (
  resultValue: ExtractSuccessResponse,
  pluginServerId: string,
  source?: PluginMetadata
): ExtractionResult => {
  const result = normalizeExtractionText(resultValue)

  const metadata: ExtractionMetadata = {
    pluginName: result.plugin.displayName || result.plugin.pluginServerId,
    schemaVersion: 3,
    pluginServerId,
  }
  addExtractionPluginMetadata(metadata, result.plugin, source)
  addExtractionSourceDetails(metadata, result.plugin, source)
  const links = mapNodesToExtractedLinks(result.nodes)
  if (resultValue.pending) {
    return { links, meta: metadata, pending: resultValue.pending }
  }
  return { links, meta: metadata }
}
