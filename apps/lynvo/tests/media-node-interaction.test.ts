import { describe, expect, it } from "vitest"
import {
  getMediaNodeInteractionState,
  getMediaNodeKey,
  getMediaNodeTargetOrUndefined,
  isMirrorResolvableMediaNode,
} from "~/features/links/media-node-interaction"
import { applyOpenedState } from "~/features/links/link-playback-metadata"
import { mapNodeToExtractedLink } from "~/lib/plugin-server-utils"

describe("media node interaction", () => {
  it("preserves protocol kinds through extraction decisions", () => {
    const group = mapNodeToExtractedLink({
      kind: "group",
      label: "Season",
      mediaNodeKind: "group",
      selectable: false,
      children: [],
    })
    const resolvable = mapNodeToExtractedLink({
      kind: "resolvable",
      label: "Mirrors",
      nodeUrl: "https://example.com/node",
      resolutionKind: "mirrors",
    })
    const playable = mapNodeToExtractedLink({
      kind: "playable",
      label: "Episode",
      url: "https://example.com/video",
    })

    expect(getMediaNodeInteractionState(group)).toMatchObject({
      kind: "group",
      isFolder: true,
      isSelectable: false,
    })
    expect(getMediaNodeInteractionState(resolvable)).toMatchObject({
      kind: "resolvable",
      needsResolution: true,
      resolutionKind: "mirrors",
    })
    expect(isMirrorResolvableMediaNode(resolvable)).toBe(true)
    expect(getMediaNodeInteractionState(playable)).toMatchObject({
      kind: "playable",
      isFolder: false,
      isSelectable: true,
    })
  })

  it("gives identifier-less groups distinct stable tree identities", () => {
    const group = mapNodeToExtractedLink({
      kind: "group",
      label: "Season",
      children: [
        { kind: "group", label: "Episodes", children: [] },
        { kind: "group", label: "Episodes", children: [] },
      ],
    })

    const firstChild = group.children?.[0]
    const secondChild = group.children?.[1]
    expect(firstChild).toBeDefined()
    expect(secondChild).toBeDefined()
    if (!firstChild || !secondChild) {
      throw new Error("Expected both group children")
    }
    expect(getMediaNodeKey(firstChild)).not.toBe(getMediaNodeKey(secondChild))
  })

  it("uses the node id as the target for group nodes without urls", () => {
    const group = mapNodeToExtractedLink({
      kind: "group",
      id: "folder-S01",
      label: "Season 1",
      children: [],
    })
    expect(getMediaNodeTargetOrUndefined(group)).toBe("folder-S01")
  })

  it("round-trips opened state for id-only group nodes", () => {
    const group = mapNodeToExtractedLink({
      kind: "group",
      id: "folder-S01",
      label: "Season 1",
      children: [],
    })
    const target = getMediaNodeTargetOrUndefined(group)
    expect(target).toBeDefined()
    const [openedGroup] = applyOpenedState([group], new Set([target ?? ""]))
    expect(openedGroup.opened).toBe(true)
  })

  it("has no target for identifier-less groups", () => {
    const group = mapNodeToExtractedLink({
      kind: "group",
      label: "Season",
      children: [],
    })
    expect(getMediaNodeTargetOrUndefined(group)).toBeUndefined()
  })

  it("keeps resolved empty folders as non-expanding groups", () => {
    expect(
      getMediaNodeInteractionState({
        label: "Folder",
        url: "https://example.com/folder",
        type: "folder",
        mediaNodeKind: "group",
        children: [],
        childrenResolved: true,
      })
    ).toMatchObject({ kind: "group", canExpand: false, isSelectable: false })
  })
})
