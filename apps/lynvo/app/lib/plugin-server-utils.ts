import type { ExtractedLink } from "~/features/links/types"
import {
  matchPluginServerUrl,
  type MediaNode,
  type PluginServerMatcher,
} from "@dg02002/lynvo-plugin-server-protocol"

export const matchUrl = (
  targetUrl: string,
  matchers: ReadonlyArray<PluginServerMatcher>
): boolean => matchPluginServerUrl(targetUrl, matchers)

const getNodeIdentityValue = (node: MediaNode) => {
  if (node.id !== undefined && node.id !== null) {
    return node.id
  }

  if (node.kind === "playable") {
    return node.url
  }

  if (node.kind === "resolvable") {
    return node.nodeUrl ?? node.resourceId
  }

  return node.label
}

const getNodeIdentity = (node: MediaNode, treePath: string) =>
  `${treePath}:${node.kind}:${getNodeIdentityValue(node)}`

interface CommonNodeFields {
  id?: ExtractedLink["id"]
  size?: ExtractedLink["size"]
  sourceName?: ExtractedLink["sourceName"]
}

interface ResolvableNodeFields extends CommonNodeFields {
  nodeUrl?: ExtractedLink["nodeUrl"]
  resourceId?: ExtractedLink["resourceId"]
  resolutionKind?: ExtractedLink["resolutionKind"]
}

interface PlayableNodeFields extends CommonNodeFields {
  expiry?: ExtractedLink["expiry"]
  expirySource?: ExtractedLink["expirySource"]
  status?: ExtractedLink["status"]
  rangeRequest?: ExtractedLink["rangeRequest"]
}

const getCommonNodeFields = (node: MediaNode): CommonNodeFields => {
  const fields: CommonNodeFields = {}
  if (node.id) {
    fields.id = node.id
  }
  if (node.size) {
    fields.size = node.size
  }
  if (node.sourceName) {
    fields.sourceName = node.sourceName
  }
  return fields
}

const getResolvableNodeFields = (
  node: Extract<MediaNode, { kind: "resolvable" }>
): ResolvableNodeFields => {
  const fields: ResolvableNodeFields = getCommonNodeFields(node)
  if (node.nodeUrl) {
    fields.nodeUrl = node.nodeUrl
  }
  if (node.resourceId) {
    fields.resourceId = node.resourceId
  }
  if (node.resolutionKind) {
    fields.resolutionKind = node.resolutionKind
  }
  return fields
}

const getPlayableNodeFields = (
  node: Extract<MediaNode, { kind: "playable" }>
): PlayableNodeFields => {
  const fields: PlayableNodeFields = getCommonNodeFields(node)
  if (node.expiry) {
    fields.expiry = node.expiry
  }
  if (node.expirySource) {
    fields.expirySource = node.expirySource
  }
  if (node.status && node.status !== "unknown") {
    fields.status = node.status
  }
  if (node.rangeRequest) {
    fields.rangeRequest = node.rangeRequest
  }
  return fields
}

const mapGroupNode = (
  node: Extract<MediaNode, { kind: "group" }>,
  treePath: string
): ExtractedLink => ({
  ...getCommonNodeFields(node),
  nodeKey: getNodeIdentity(node, treePath),
  label: node.label,
  selectable: node.selectable !== false,
  type: "folder",
  mediaNodeKind: "group",
  children: node.children.map((child, childIndex) =>
    mapNode(child, `${treePath}.${childIndex}`)
  ),
})

const mapResolvableNode = (
  node: Extract<MediaNode, { kind: "resolvable" }>,
  treePath: string
): ExtractedLink => ({
  ...getResolvableNodeFields(node),
  nodeKey: getNodeIdentity(node, treePath),
  label: node.label,
  type: "folder",
  selectable: true,
  mediaNodeKind: "resolvable",
})

const mapPlayableNode = (
  node: Extract<MediaNode, { kind: "playable" }>,
  treePath: string
): ExtractedLink => ({
  ...getPlayableNodeFields(node),
  nodeKey: getNodeIdentity(node, treePath),
  label: node.label,
  url: node.url,
  type: "file",
  mediaNodeKind: "playable",
})

const mapNode = (node: MediaNode, treePath: string): ExtractedLink => {
  if (node.kind === "group") {
    return mapGroupNode(node, treePath)
  }
  if (node.kind === "resolvable") {
    return mapResolvableNode(node, treePath)
  }
  return mapPlayableNode(node, treePath)
}

export const mapNodeToExtractedLink = (node: MediaNode): ExtractedLink =>
  mapNode(node, "0")

export const mapNodesToExtractedLinks = (
  nodes: ReadonlyArray<MediaNode>
): ExtractedLink[] =>
  nodes.map((node, nodeIndex) => mapNode(node, String(nodeIndex)))
