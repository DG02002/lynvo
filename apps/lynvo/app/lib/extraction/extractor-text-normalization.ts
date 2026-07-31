import * as cheerio from "cheerio"
import type {
  MediaNode,
  ExtractSuccessResponse,
} from "@lynvo/plugin-server-protocol"

export const decodeExtractorText = (value: string): string =>
  cheerio.load(value, undefined, false).text()

const normalizeNodeText = (node: MediaNode): MediaNode => ({
  ...node,
  label: decodeExtractorText(node.label),
  ...(node.badge ? { badge: decodeExtractorText(node.badge) } : {}),
  ...(node.size ? { size: decodeExtractorText(node.size) } : {}),
  ...(node.sourceName
    ? { sourceName: decodeExtractorText(node.sourceName) }
    : {}),
  ...(node.kind === "group"
    ? { children: node.children.map(normalizeNodeText) }
    : {}),
})

export const normalizeExtractorText = (
  result: ExtractSuccessResponse
): ExtractSuccessResponse => ({
  ...result,
  plugin: {
    ...result.plugin,
    displayName: decodeExtractorText(result.plugin.displayName),
    ...(result.plugin.pluginName
      ? { pluginName: decodeExtractorText(result.plugin.pluginName) }
      : {}),
    ...(result.plugin.pageTitle
      ? { pageTitle: decodeExtractorText(result.plugin.pageTitle) }
      : {}),
    ...(result.plugin.audio
      ? { audio: decodeExtractorText(result.plugin.audio) }
      : {}),
  },
  nodes: result.nodes.map(normalizeNodeText),
})
