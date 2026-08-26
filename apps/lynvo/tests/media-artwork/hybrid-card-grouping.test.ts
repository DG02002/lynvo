import { describe, expect, it } from "vitest"
import { getHybridCardGroups } from "~/features/links/media-artwork/hybrid-card-grouping"
import type { LinkListItem } from "~/features/links/types"

const createItem = (
  url: string,
  title: string,
  timestamp: number
): LinkListItem => ({
  kind: "saved",
  id: url,
  url,
  timestamp,
  title,
  metadata: {
    schemaVersion: 3,
    source: {},
    extraction: { extractedLinks: [] },
    playback: { openedUrls: [] },
  },
})

describe("getHybridCardGroups", () => {
  it("merges movie variants of the same title into one card", () => {
    const groups = getHybridCardGroups([
      createItem(
        "https://example.com/iron-man-720",
        "Iron.Man.720p.WEB-DL.mkv",
        2_000
      ),
      createItem(
        "https://example.com/iron-man-1080",
        "Iron.Man.2008.1080p.BluRay.mkv",
        1_000
      ),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.displayTitle).toBe("Iron Man (2008)")
    expect(groups[0]?.items.map((item) => item.url)).toEqual([
      "https://example.com/iron-man-720",
      "https://example.com/iron-man-1080",
    ])
    expect(groups[0]?.artworkRequest).toEqual({
      mediaKind: "movie",
      title: "Iron Man",
      year: 2008,
    })
  })

  it("merges episodes of the same show into one tv card", () => {
    const groups = getHybridCardGroups([
      createItem(
        "https://example.com/st-e01",
        "Stranger.Things.S01E01.720p.mkv",
        2_000
      ),
      createItem(
        "https://example.com/st-e02",
        "Stranger.Things.S01E02.1080p.mkv",
        1_000
      ),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.displayTitle).toBe("Stranger Things")
    expect(groups[0]?.artworkRequest).toEqual({
      mediaKind: "tv",
      title: "Stranger Things",
    })
  })

  it("keeps same-title releases with conflicting years apart", () => {
    const groups = getHybridCardGroups([
      createItem("https://example.com/dune-2021", "Dune.2021.1080p.mkv", 2_000),
      createItem("https://example.com/dune-1984", "Dune.1984.720p.mkv", 1_000),
    ])

    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.displayTitle)).toEqual([
      "Dune (2021)",
      "Dune (1984)",
    ])
  })

  it("keeps same-title shows with conflicting years apart", () => {
    const groups = getHybridCardGroups([
      createItem(
        "https://example.com/one-piece-1999",
        "One.Piece.S01E01.1999.mkv",
        2_000
      ),
      createItem(
        "https://example.com/one-piece-2023",
        "One.Piece.2023.S01E01.mkv",
        1_000
      ),
    ])

    expect(groups).toHaveLength(2)
  })

  it("keeps unrecognizable labels as single-item cards without artwork", () => {
    const groups = getHybridCardGroups([
      createItem("https://example.com/random", "file", 2_000),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.displayTitle).toBe("file")
    expect(groups[0]?.artworkRequest).toBeUndefined()
  })

  it("derives a tv identity from extracted children for show containers", () => {
    const groups = getHybridCardGroups([
      {
        ...createItem("https://example.com/reacher", "Reacher (2022)", 2_000),
        metadata: {
          schemaVersion: 3,
          source: {},
          extraction: {
            extractedLinks: [
              {
                nodeKey: "0:group:folder-S01",
                label: "Season 1",
                type: "folder",
                mediaNodeKind: "group",
                children: [
                  {
                    nodeKey: "0.0:group:quality",
                    label: "2160p HDR BluRay REMUX H.265",
                    type: "folder",
                    mediaNodeKind: "group",
                    children: [
                      {
                        nodeKey: "0.0.0:resolvable:e1",
                        url: "https://example.com/e1",
                        label:
                          "Reacher S01E01 UHD BluRay 2160p REMUX HDR HEVC.mkv",
                        type: "file",
                        mediaNodeKind: "resolvable",
                      },
                    ],
                  },
                ],
              },
            ],
          },
          playback: { openedUrls: [] },
        },
      },
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.displayTitle).toBe("Reacher")
    expect(groups[0]?.artworkRequest).toEqual({
      mediaKind: "tv",
      title: "Reacher",
    })
  })

  it("orders groups by their newest item", () => {
    const groups = getHybridCardGroups([
      createItem("https://example.com/old", "Coco.2017.mkv", 1_000),
      createItem("https://example.com/new", "Up.2009.mkv", 3_000),
      createItem("https://example.com/mid", "Alien.1979.mkv", 2_000),
    ])

    expect(groups.map((group) => group.displayTitle)).toEqual([
      "Up (2009)",
      "Alien (1979)",
      "Coco (2017)",
    ])
  })
})
