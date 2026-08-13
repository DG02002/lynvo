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
    const link: ExtractedLink = {
      nodeKey: getNodeIdentity(node, treePath),
      label: node.label,
      selectable: node.selectable !== false,
      type: "folder",
      mediaNodeKind: "group",
      children: node.children.map((child, childIndex) =>
        mapNode(child, `${treePath}.${childIndex}`)
      ),
    }
    if (node.id) {
      link.id = node.id
    }
    if (node.size) {
      link.size = node.size
    }
    if (node.sourceName) {
      link.sourceName = node.sourceName
    }
    return link
  }
  if (node.kind === "resolvable") {
    const link: ExtractedLink = {
      nodeKey: getNodeIdentity(node, treePath),
      label: node.label,
      type: "folder",
      selectable: true,
      mediaNodeKind: "resolvable",
    }
    if (node.id) {
      link.id = node.id
    }
    if (node.size) {
      link.size = node.size
    }
    if (node.sourceName) {
      link.sourceName = node.sourceName
    }
    if (node.nodeUrl) {
      link.nodeUrl = node.nodeUrl
    }
    if (node.resourceId) {
      link.resourceId = node.resourceId
    }
    if (node.resolutionKind) {
      link.resolutionKind = node.resolutionKind
    }
    return link
  }
  const link: ExtractedLink = {
    nodeKey: getNodeIdentity(node, treePath),
    label: node.label,
    url: node.url,
    type: "file",
    mediaNodeKind: "playable",
  }
  if (node.id) {
    link.id = node.id
  }
  if (node.size) {
    link.size = node.size
  }
  if (node.sourceName) {
    link.sourceName = node.sourceName
  }
  if (node.expiry) {
    link.expiry = node.expiry
  }
  if (node.expirySource) {
    link.expirySource = node.expirySource
  }
  if (node.status && node.status !== "unknown") {
    link.status = node.status
  }
  if (node.rangeRequest) {
    link.rangeRequest = node.rangeRequest
  }
  return link
}

export const mapNodeToExtractedLink = (node: MediaNode): ExtractedLink =>
  mapNode(node, "0")

export const mapNodesToExtractedLinks = (
  nodes: ReadonlyArray<MediaNode>
): ExtractedLink[] =>
  nodes.map((node, nodeIndex) => mapNode(node, String(nodeIndex)))
