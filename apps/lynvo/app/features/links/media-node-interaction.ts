import type { ExtractedLink } from "./types"

export interface MediaNodeInteractionState {
  kind: "group" | "resolvable" | "playable"
  isFolder: boolean
  isSelectable: boolean
  canExpand: boolean
  needsResolution: boolean
  resolutionKind?: "folder" | "mirrors"
}

const getMediaNodeKind = (
  link: ExtractedLink
): MediaNodeInteractionState["kind"] =>
  link.mediaNodeKind ??
  (link.type === "folder" &&
  !link.children?.length &&
  link.childrenResolved !== true
    ? "resolvable"
    : link.type === "folder" || link.children
      ? "group"
      : "playable")

export const getMediaNodeInteractionState = (
  link: ExtractedLink
): MediaNodeInteractionState => {
  const kind = getMediaNodeKind(link)
  const isFolder = kind !== "playable"
  const hasChildren = Boolean(link.children?.length)
  const resolutionKind =
    kind === "resolvable"
      ? (link.resolutionKind ?? (link.mediaNodeKind ? "mirrors" : "folder"))
      : undefined

  return {
    kind,
    isFolder,
    isSelectable:
      kind === "playable" || kind === "resolvable" || link.selectable === true,
    canExpand: isFolder && hasChildren,
    needsResolution:
      kind === "resolvable" && !hasChildren && link.childrenResolved !== true,
    resolutionKind,
  }
}

export const getMediaNodeKey = (link: ExtractedLink) =>
  link.nodeKey ??
  link.id ??
  link.url ??
  link.nodeUrl ??
  link.resourceId ??
  link.label

export const getMediaNodeTargetOrUndefined = (link: ExtractedLink) =>
  link.url ?? link.nodeUrl ?? link.resourceId ?? link.id

export const getMediaNodeTarget = (link: ExtractedLink): string => {
  const target = getMediaNodeTargetOrUndefined(link)
  if (!target) {
    throw new Error(`Media node ${getMediaNodeKey(link)} has no target`)
  }
  return target
}

export const isMirrorResolvableMediaNode = (link: ExtractedLink) => {
  const state = getMediaNodeInteractionState(link)
  return state.kind === "resolvable" && state.resolutionKind === "mirrors"
}
