import type { ExtractedLink } from "~/features/links/types"
import { matchExtractorUrl } from "@lynvo/extractor-protocol"
import type { WorkerMatcher, WorkerNode } from "./effect/extractor-schema"

export const matchUrl = (
  targetUrl: string,
  matchers: ReadonlyArray<WorkerMatcher>
): boolean => matchExtractorUrl(targetUrl, matchers)

export const mapNodeToExtractedLink = (node: WorkerNode): ExtractedLink => {
  if (node.kind === "group") {
    return {
      id: node.id,
      label: node.label,
      ...(node.size ? { size: node.size } : {}),
      ...(node.sourceName ? { sourceName: node.sourceName } : {}),
      selectable: node.selectable !== false,
      type: "folder",
      url: "",
      workerNodeKind: "group",
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
      workerNodeKind: "resolvable",
    }
  }
  return {
    id: node.id,
    label: node.label,
    ...(node.size ? { size: node.size } : {}),
    ...(node.sourceName ? { sourceName: node.sourceName } : {}),
    url: node.url ?? "",
    type: "file",
    workerNodeKind: "playable",
    ...(node.expiry ? { expiry: node.expiry } : {}),
    ...(node.status && node.status !== "unknown"
      ? { status: node.status }
      : {}),
  }
}
