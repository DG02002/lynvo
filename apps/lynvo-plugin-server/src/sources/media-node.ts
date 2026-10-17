import {
  createPlayableNode,
  type PlayableNode,
  type RangeRequestCapability,
} from "@dg02002/lynvo-plugin-server-protocol"

interface SourcePlayableNodeOptions {
  readonly id: string
  readonly label: string
  readonly url: string
  readonly size?: string
  readonly rangeRequest?: RangeRequestCapability
}

interface SourcePlayableNodeExtras {
  size?: string
  rangeRequest?: RangeRequestCapability
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
  const hasExtras = size !== undefined || rangeRequest !== undefined
  return hasExtras ? { ...node, ...extras } : node
}
