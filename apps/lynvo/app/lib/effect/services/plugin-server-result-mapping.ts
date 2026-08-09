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

  return {
    filename: "",
    pluginName: decodeExtractionText(manifest.displayName),
    ...(manifest.iconUrl ? { pluginIcon: manifest.iconUrl } : {}),
    ...(source?.id ? { pluginId: source.id } : {}),
    ...(source?.displayName
      ? { sourceName: decodeExtractionText(source.displayName) }
      : {}),
    ...(source?.iconUrl ? { sourceIconUrl: source.iconUrl } : {}),
    ...(source?.status ? { sourceStatus: source.status } : {}),
    ...(source?.version ? { sourceVersion: source.version } : {}),
    ...(source?.credential
      ? { sourceCredentialKind: source.credential.kind }
      : {}),
    ...(routeSource?.displayName
      ? { routeSourceName: decodeExtractionText(routeSource.displayName) }
      : {}),
    ...(routeSource?.iconUrl
      ? { routeSourceIconUrl: routeSource.iconUrl }
      : {}),
    pluginServerId,
  }
}

export const mapPluginServerExtractionResult = (
  resultValue: ExtractSuccessResponse,
  pluginServerId: string
): ExtractionResult => {
  const result = normalizeExtractionText(resultValue)

  return {
    links: mapNodesToExtractedLinks(result.nodes),
    meta: {
      pluginName: result.plugin.displayName || result.plugin.pluginServerId,
      ...(result.plugin.iconUrl ? { pluginIcon: result.plugin.iconUrl } : {}),
      ...(result.plugin.pluginId ? { pluginId: result.plugin.pluginId } : {}),
      ...(result.plugin.pluginName
        ? { sourceName: result.plugin.pluginName }
        : {}),
      ...(result.plugin.pluginIconUrl
        ? { sourceIconUrl: result.plugin.pluginIconUrl }
        : {}),
      ...(result.plugin.pageTitle
        ? { pageTitle: result.plugin.pageTitle }
        : {}),
      ...(result.plugin.audio ? { audio: result.plugin.audio } : {}),
      schemaVersion: 3,
      pluginServerId,
    },
  }
}
