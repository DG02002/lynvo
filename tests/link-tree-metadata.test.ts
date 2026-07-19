import { describe, expect, it } from "vitest"
import { attachResolvedChildren } from "~/features/links/link-tree-metadata"

describe("attachResolvedChildren", () => {
  it("updates a nested node without mutating the source tree", () => {
    const source = [
      {
        id: "season",
        url: "https://example.com/season",
        label: "Season",
        type: "folder" as const,
        children: [
          {
            id: "episode",
            url: "https://example.com/episode",
            label: "Episode",
            type: "folder" as const,
          },
        ],
      },
    ]
    const resolvedChildren = [
      { url: "https://cdn.example/episode.mp4", label: "Episode file" },
    ]

    const result = attachResolvedChildren({
      links: source,
      linkId: "episode",
      linkUrl: "https://example.com/episode",
      resolvedChildren,
    })

    expect(result[0].children?.[0].children).toEqual(resolvedChildren)
    expect(source[0].children[0].children).toBeUndefined()
  })
})
