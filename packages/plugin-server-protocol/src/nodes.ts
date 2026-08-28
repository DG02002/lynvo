import type {
  ExpirySource,
  GroupNode,
  MediaNode,
  PlayableNode,
  RangeRequestCapability,
  ResolvableNode,
} from "./models.js"

export interface PlayableNodeInput {
  readonly url: string
  readonly label: string
  readonly id?: string
  readonly badge?: string
  readonly size?: string
  readonly sourceName?: string
  readonly expiry?: number
  readonly expirySource?: ExpirySource
  readonly status?: "up" | "down" | "unknown"
  readonly rangeRequest?: RangeRequestCapability
}

export const createPlayableNode = (input: PlayableNodeInput): PlayableNode => ({
  kind: "playable",
  ...input,
})

export interface ResolvableNodeInput {
  readonly label: string
  readonly nodeUrl?: string
  readonly resourceId?: string
  readonly resolutionKind?: "folder" | "mirrors"
  readonly id?: string
  readonly badge?: string
  readonly size?: string
  readonly sourceName?: string
}

export const createResolvableNode = (
  input: ResolvableNodeInput
): ResolvableNode => ({
  kind: "resolvable",
  ...input,
})

export interface GroupNodeInput {
  readonly label: string
  readonly children: readonly MediaNode[]
  readonly selectable?: boolean
  readonly id?: string
  readonly badge?: string
  readonly size?: string
  readonly sourceName?: string
}

export const createGroupNode = (input: GroupNodeInput): GroupNode => ({
  kind: "group",
  ...input,
})
