import * as cheerio from "cheerio"
import type {
  ExtractorNode,
  ExtractSuccessResponse,
} from "@lynvo/extractor-protocol"

export const decodeExtractorText = (value: string): string =>
  cheerio.load(value, undefined, false).text()

const normalizeNodeText = (node: ExtractorNode): ExtractorNode => ({
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
  source: {
    ...result.source,
    displayName: decodeExtractorText(result.source.displayName),
    ...(result.source.sourceName
      ? { sourceName: decodeExtractorText(result.source.sourceName) }
      : {}),
    ...(result.source.pageTitle
      ? { pageTitle: decodeExtractorText(result.source.pageTitle) }
      : {}),
    ...(result.source.audio
      ? { audio: decodeExtractorText(result.source.audio) }
      : {}),
  },
  nodes: result.nodes.map(normalizeNodeText),
})
