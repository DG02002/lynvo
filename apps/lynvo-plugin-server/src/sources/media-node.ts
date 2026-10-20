import {
  createPlayableNode,
  type PlayableNode,
  type MediaNode,
  type RangeRequestCapability,
} from "@dg02002/lynvo-plugin-server-protocol"

import { isVideoFile } from "./video-file"

interface SourcePlayableNodeOptions {
  readonly id: string
  readonly label: string
  readonly url: string
  readonly size?: string | undefined
  readonly rangeRequest?: RangeRequestCapability | undefined
}

interface SourcePlayableNodeExtras {
  size?: string
  rangeRequest?: RangeRequestCapability
}

export type SourceFolderNodeInput =
  | {
      readonly kind: "folder"
      readonly id: string
      readonly label: string
      readonly nodeUrl: string
    }
  | {
      readonly kind: "file"
      readonly id: string
      readonly label: string
      readonly mediaUrl: () => string
      readonly size?: string | undefined
      readonly rangeRequest?: RangeRequestCapability | undefined
    }

export const readRangeRequestCapability = (
  response: Pick<Response, "status" | "headers">
): RangeRequestCapability => {
  if (response.status === 206 && response.headers.has("content-range")) {
    return "supported"
  }
  if (response.status === 200) {
    return "unsupported"
  }
  return "unknown"
}

export const createSourcePlayableNode = ({
  size,
  rangeRequest,
  ...input
}: SourcePlayableNodeOptions): PlayableNode => {
  const node = createPlayableNode({
    ...input,
    status: "unknown",
  })
  // Absent fields stay off the node instead of writing explicit undefined
  // values the protocol serializer would still carry.
  const extras: SourcePlayableNodeExtras = {}
  if (size !== undefined) {
    extras.size = size
  }
  if (rangeRequest !== undefined) {
    extras.rangeRequest = rangeRequest
  }
  return Object.keys(extras).length > 0 ? { ...node, ...extras } : node
}

export const createSourceFolderNodes = (
  items: readonly SourceFolderNodeInput[]
): MediaNode[] =>
  items.flatMap<MediaNode>((item) => {
    if (item.kind === "folder") {
      return [
        {
          kind: "resolvable" as const,
          id: item.id,
          label: item.label,
          nodeUrl: item.nodeUrl,
          resolutionKind: "folder" as const,
        },
      ]
    }
    if (!isVideoFile(item.label)) {
      return []
    }
    return [
      createSourcePlayableNode({
        id: item.id,
        label: item.label,
        url: item.mediaUrl(),
        size: item.size,
        rangeRequest: item.rangeRequest,
      }),
    ]
  })
