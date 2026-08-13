import * as cheerio from "cheerio"
import type {
  MediaNode,
  ExtractSuccessResponse,
} from "@dg02002/lynvo-plugin-server-protocol"

export const decodeExtractionText = (value: string): string =>
  cheerio.load(value, undefined, false).text()

const normalizeNodeText = (node: MediaNode): MediaNode => {
  const normalized = { ...node, label: decodeExtractionText(node.label) }
  if (node.badge) {
    normalized.badge = decodeExtractionText(node.badge)
  }
  if (node.size) {
    normalized.size = decodeExtractionText(node.size)
  }
  if (node.sourceName) {
    normalized.sourceName = decodeExtractionText(node.sourceName)
  }
  if (normalized.kind === "group") {
    normalized.children = normalized.children.map(normalizeNodeText)
  }
  return normalized
}

export const normalizeExtractionText = (
  result: ExtractSuccessResponse
): ExtractSuccessResponse => {
  const plugin = {
    ...result.plugin,
    displayName: decodeExtractionText(result.plugin.displayName),
  }
  if (result.plugin.pluginName) {
    plugin.pluginName = decodeExtractionText(result.plugin.pluginName)
  }
  if (result.plugin.pageTitle) {
    plugin.pageTitle = decodeExtractionText(result.plugin.pageTitle)
  }
  if (result.plugin.audio) {
    plugin.audio = decodeExtractionText(result.plugin.audio)
  }
  return { ...result, plugin, nodes: result.nodes.map(normalizeNodeText) }
}
