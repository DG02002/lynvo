import { describe, expect, it } from "vitest"
import { mapNodeToExtractedLink } from "~/lib/plugin-server-utils"
import type { MediaNode } from "@lynvo/plugin-server-protocol"

describe("mapNodeToExtractedLink", () => {
  it("maps group nodes to folder links", () => {
    const node: MediaNode = {
      kind: "group",
      id: "folder-1",
      label: "Folder 1",
      children: [
        {
          kind: "playable",
          id: "ep-1",
          label: "Playable Item 1",
          url: "https://cdn.example/file.mp4",
        },
      ],
    }

    const link = mapNodeToExtractedLink(node)

    expect(link.type).toBe("folder")
    expect(link.mediaNodeKind).toBe("group")
    expect(link.children).toHaveLength(1)
  })

  it("maps playable nodes to direct file links", () => {
    const node: MediaNode = {
      kind: "playable",
      id: "route-alpha",
      label: "Play from Source Route Alpha",
      url: "https://cdn.example/file.m3u8",
      size: "1.4 GB",
    }

    const link = mapNodeToExtractedLink(node)

    expect(link.type).toBe("file")
    expect(link.mediaNodeKind).toBe("playable")
    expect(link.url).toBe("https://cdn.example/file.m3u8")
  })

  it("does not let resolvable nodes masquerade as final playable files", () => {
    const node: MediaNode = {
      kind: "resolvable",
      id: "ep-1",
      label: "Playable Item 1",
      nodeUrl: "https://pluginServer.example/node/1",
      size: "1.1 GB",
      sourceName: "Source Beta",
    }

    const link = mapNodeToExtractedLink(node)

    expect(link.type).toBe("folder")
    expect(link.mediaNodeKind).toBe("resolvable")
    expect(link.url).toBe("https://pluginServer.example/node/1")
    expect(link.sourceName).toBe("Source Beta")
  })

  it("does not persist source-supplied presentation badges", () => {
    const link = mapNodeToExtractedLink({
      kind: "playable",
      id: "mirror-one",
      label: "Play mirror",
      url: "https://cdn.example/file.mp4",
      badge: "Provider name",
    })

    expect(link.badge).toBeUndefined()
  })
})
