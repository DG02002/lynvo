import type { ExtractedLink } from "~/features/links/types"
import { matchPluginServerUrl } from "@dg02002/lynvo-plugin-server-protocol"
import type {
  MediaNode,
  PluginServerMatcher,
} from "@dg02002/lynvo-plugin-server-protocol"

export const matchUrl = (
  targetUrl: string,
  matchers: ReadonlyArray<PluginServerMatcher>
): boolean => matchPluginServerUrl(targetUrl, matchers)

export const mapNodeToExtractedLink = (node: MediaNode): ExtractedLink => {
  if (node.kind === "group") {
    return {
      id: node.id,
      label: node.label,
      ...(node.size ? { size: node.size } : {}),
      ...(node.sourceName ? { sourceName: node.sourceName } : {}),
      selectable: node.selectable !== false,
      type: "folder",
      url: "",
      mediaNodeKind: "group",
      children: (node.children ?? []).map(mapNodeToExtractedLink),
    }
  }
  if (node.kind === "resolvable") {
    return {
      id: node.id,
      label: node.label,
      ...(node.size ? { size: node.size } : {}),
      ...(node.sourceName ? { sourceName: node.sourceName } : {}),
      url: node.nodeUrl ?? "",
      type: "folder",
      selectable: true,
      mediaNodeKind: "resolvable",
      ...(node.resolutionKind ? { resolutionKind: node.resolutionKind } : {}),
    }
  }
  return {
    id: node.id,
    label: node.label,
    ...(node.size ? { size: node.size } : {}),
    ...(node.sourceName ? { sourceName: node.sourceName } : {}),
    url: node.url ?? "",
    type: "file",
    mediaNodeKind: "playable",
    ...(node.expiry ? { expiry: node.expiry } : {}),
    ...(node.expirySource ? { expirySource: node.expirySource } : {}),
    ...(node.status && node.status !== "unknown"
      ? { status: node.status }
      : {}),
    ...(node.rangeRequest ? { rangeRequest: node.rangeRequest } : {}),
  }
}
