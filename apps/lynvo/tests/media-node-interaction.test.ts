import { describe, expect, it } from "vitest"
import {
  getMediaNodeInteractionState,
  isMirrorResolvableMediaNode,
} from "~/features/links/media-node-interaction"
import { mapNodeToExtractedLink } from "~/lib/plugin-server-utils"

describe("media node interaction", () => {
  it("preserves protocol kinds through extraction decisions", () => {
    const group = mapNodeToExtractedLink({
      kind: "group",
      label: "Season",
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

  it("decodes legacy folder and playable shapes at the interaction boundary", () => {
    expect(
      getMediaNodeInteractionState({
        label: "Folder",
        url: "https://example.com/folder",
        type: "folder",
        children: [],
        childrenResolved: true,
      }).kind
    ).toBe("group")
    expect(
      getMediaNodeInteractionState({
        label: "Video",
        url: "https://example.com/video",
      }).kind
    ).toBe("playable")
  })
})
