import {
  createPlayableNode,
  type PlayableNode,
} from "@dg02002/lynvo-plugin-server-protocol"

interface SourcePlayableNodeOptions {
  readonly id: string
  readonly label: string
  readonly url: string
  readonly size?: string
}

export const createSourcePlayableNode = ({
  size,
  ...input
}: SourcePlayableNodeOptions): PlayableNode => {
  const node = createPlayableNode({
    ...input,
    status: "unknown",
  })
  if (size === undefined) {
    return node
  }
  return { ...node, size }
}
