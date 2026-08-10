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

const getNodeIdentity = (node: MediaNode, treePath: string) =>
  `${treePath}:${node.kind}:${node.id ?? (node.kind === "playable" ? node.url : node.kind === "resolvable" ? (node.nodeUrl ?? node.resourceId) : node.label)}`

const mapNode = (node: MediaNode, treePath: string): ExtractedLink => {
  if (node.kind === "group") {
    return {
      nodeKey: getNodeIdentity(node, treePath),
      ...(node.id ? { id: node.id } : {}),
      label: node.label,
      ...(node.size ? { size: node.size } : {}),
      ...(node.sourceName ? { sourceName: node.sourceName } : {}),
      selectable: node.selectable !== false,
      type: "folder",
      mediaNodeKind: "group",
      children: node.children.map((child, childIndex) =>
        mapNode(child, `${treePath}.${childIndex}`)
      ),
    }
  }
  if (node.kind === "resolvable") {
    return {
      nodeKey: getNodeIdentity(node, treePath),
      ...(node.id ? { id: node.id } : {}),
      label: node.label,
      ...(node.size ? { size: node.size } : {}),
      ...(node.sourceName ? { sourceName: node.sourceName } : {}),
      ...(node.nodeUrl ? { nodeUrl: node.nodeUrl } : {}),
      ...(node.resourceId ? { resourceId: node.resourceId } : {}),
      type: "folder",
      selectable: true,
      mediaNodeKind: "resolvable",
      ...(node.resolutionKind ? { resolutionKind: node.resolutionKind } : {}),
    }
  }
  return {
    nodeKey: getNodeIdentity(node, treePath),
    ...(node.id ? { id: node.id } : {}),
    label: node.label,
    ...(node.size ? { size: node.size } : {}),
    ...(node.sourceName ? { sourceName: node.sourceName } : {}),
    url: node.url,
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

export const mapNodeToExtractedLink = (node: MediaNode): ExtractedLink =>
  mapNode(node, "0")

export const mapNodesToExtractedLinks = (
  nodes: ReadonlyArray<MediaNode>
): ExtractedLink[] =>
  nodes.map((node, nodeIndex) => mapNode(node, String(nodeIndex)))
