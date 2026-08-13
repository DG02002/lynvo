import {
  getLynvoManifestExtension,
  getMatchedPlugin,
  type ExtractSuccessResponse,
  type PluginServerManifest,
} from "@dg02002/lynvo-plugin-server-protocol"
import { mapNodesToExtractedLinks } from "~/lib/plugin-server-utils"
import {
  decodeExtractionText,
  normalizeExtractionText,
} from "~/lib/extraction/extraction-text-normalization"
import type { ExtractionResult, MetadataResult } from "./extraction-types"

export const getPluginServerMetadata = (
  manifest: PluginServerManifest,
  pluginServerId: string,
  targetUrl?: string,
  pluginId?: string
): MetadataResult => {
  const source = pluginId
    ? getLynvoManifestExtension(manifest).plugins?.find(
        (candidate) => candidate.id === pluginId
      )
    : targetUrl
      ? getMatchedPlugin(manifest, targetUrl)
      : undefined
  const routeSourceId = source?.routesToPluginId
  const routeSource = routeSourceId
    ? getLynvoManifestExtension(manifest).plugins?.find(
        (candidate) => candidate.id === routeSourceId
      )
    : undefined

  let metadata: MetadataResult = {
    filename: "",
    pluginName: decodeExtractionText(manifest.displayName),
    pluginServerId,
  }
  if (manifest.iconUrl) {
    metadata = { ...metadata, pluginIcon: manifest.iconUrl }
  }
  if (source?.id) {
    metadata = { ...metadata, pluginId: source.id }
  }
  if (source?.displayName) {
    metadata = {
      ...metadata,
      sourceName: decodeExtractionText(source.displayName),
    }
  }
  if (source?.iconUrl) {
    metadata = { ...metadata, sourceIconUrl: source.iconUrl }
  }
  if (source?.status) {
    metadata = { ...metadata, sourceStatus: source.status }
  }
  if (source?.version) {
    metadata = { ...metadata, sourceVersion: source.version }
  }
  if (source?.credential) {
    metadata = { ...metadata, sourceCredentialKind: source.credential.kind }
  }
  if (routeSource?.displayName) {
    metadata = {
      ...metadata,
      routeSourceName: decodeExtractionText(routeSource.displayName),
    }
  }
  if (routeSource?.iconUrl) {
    metadata = { ...metadata, routeSourceIconUrl: routeSource.iconUrl }
  }
  return metadata
}

export const mapPluginServerExtractionResult = (
  resultValue: ExtractSuccessResponse,
  pluginServerId: string
): ExtractionResult => {
  const result = normalizeExtractionText(resultValue)

  const metadata: ExtractionResult["meta"] = {
    pluginName: result.plugin.displayName || result.plugin.pluginServerId,
    schemaVersion: 3,
    pluginServerId,
  }
  if (result.plugin.iconUrl) {
    metadata.pluginIcon = result.plugin.iconUrl
  }
  if (result.plugin.pluginId) {
    metadata.pluginId = result.plugin.pluginId
  }
  if (result.plugin.pluginName) {
    metadata.sourceName = result.plugin.pluginName
  }
  if (result.plugin.pluginIconUrl) {
    metadata.sourceIconUrl = result.plugin.pluginIconUrl
  }
  if (result.plugin.pageTitle) {
    metadata.pageTitle = result.plugin.pageTitle
  }
  if (result.plugin.audio) {
    metadata.audio = result.plugin.audio
  }
  return {
    links: mapNodesToExtractedLinks(result.nodes),
    meta: metadata,
  }
}
