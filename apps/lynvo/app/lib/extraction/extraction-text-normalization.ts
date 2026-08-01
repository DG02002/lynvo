import * as cheerio from "cheerio"
import type {
  MediaNode,
  ExtractSuccessResponse,
} from "@dg02002/lynvo-plugin-server-protocol"

export const decodeExtractionText = (value: string): string =>
  cheerio.load(value, undefined, false).text()

const normalizeNodeText = (node: MediaNode): MediaNode => ({
  ...node,
  label: decodeExtractionText(node.label),
  ...(node.badge ? { badge: decodeExtractionText(node.badge) } : {}),
  ...(node.size ? { size: decodeExtractionText(node.size) } : {}),
  ...(node.sourceName
    ? { sourceName: decodeExtractionText(node.sourceName) }
    : {}),
  ...(node.kind === "group"
    ? { children: node.children.map(normalizeNodeText) }
    : {}),
})

export const normalizeExtractionText = (
  result: ExtractSuccessResponse
): ExtractSuccessResponse => ({
  ...result,
  plugin: {
    ...result.plugin,
    displayName: decodeExtractionText(result.plugin.displayName),
    ...(result.plugin.pluginName
      ? { pluginName: decodeExtractionText(result.plugin.pluginName) }
      : {}),
    ...(result.plugin.pageTitle
      ? { pageTitle: decodeExtractionText(result.plugin.pageTitle) }
      : {}),
    ...(result.plugin.audio
      ? { audio: decodeExtractionText(result.plugin.audio) }
      : {}),
  },
  nodes: result.nodes.map(normalizeNodeText),
})
