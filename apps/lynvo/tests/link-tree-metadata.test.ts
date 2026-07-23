import { describe, expect, it } from "vitest"
import { attachResolvedChildren } from "~/features/links/link-tree-metadata"

describe("attachResolvedChildren", () => {
  it("updates a nested node without mutating the source tree", () => {
    const source = [
      {
        id: "folder",
        url: "https://example.com/folder",
        label: "Folder",
        type: "folder" as const,
        children: [
          {
            id: "playable-item",
            url: "https://example.com/playable-item",
            label: "Playable Item",
            type: "folder" as const,
          },
        ],
      },
    ]
    const resolvedChildren = [
      {
        url: "https://cdn.example/playable-item.mp4",
        label: "Playable Item file",
      },
    ]

    const result = attachResolvedChildren({
      links: source,
      linkId: "playable-item",
      linkUrl: "https://example.com/playable-item",
      resolvedChildren,
    })

    expect(result[0].children?.[0].children).toEqual(resolvedChildren)
    expect(source[0].children[0].children).toBeUndefined()
  })
})
