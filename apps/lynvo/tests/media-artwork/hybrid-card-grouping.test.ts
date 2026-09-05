import { describe, expect, it } from "vitest"
import {
  getHybridCardGroups,
  getSharedSeasonIdentity,
} from "~/features/links/media-artwork/hybrid-card-grouping"
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

const createEpisodeItem = (
  url: string,
  title: string,
  timestamp: number,
  extractedLinks: LinkListItem["metadata"]["extraction"]["extractedLinks"]
): LinkListItem => ({
  ...createItem(url, title, timestamp),
  metadata: {
    schemaVersion: 3,
    source: {},
    extraction: { extractedLinks },
    playback: { openedUrls: [] },
  },
})

describe("getHybridCardGroups", () => {
  it("merges movie variants of the same title into one card", () => {
    const groups = getHybridCardGroups([
      createItem(
        "https://example.com/sample-man-720",
        "Sample.Man.720p.WEB-DL.mkv",
        2_000
      ),
      createItem(
        "https://example.com/sample-man-1080",
        "Sample.Man.2008.1080p.BluRay.mkv",
        1_000
      ),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.displayTitle).toBe("Sample Man (2008)")
    expect(groups[0]?.items.map((item) => item.url)).toEqual([
      "https://example.com/sample-man-720",
      "https://example.com/sample-man-1080",
    ])
    expect(groups[0]?.artworkRequest).toEqual({
      mediaKind: "movie",
      title: "Sample Man",
      year: 2008,
    })
  })

  it("merges episodes of the same show into one tv card", () => {
    const groups = getHybridCardGroups([
      createItem(
        "https://example.com/st-e01",
        "Sample.Things.S01E01.720p.mkv",
        2_000
      ),
      createItem(
        "https://example.com/st-e02",
        "Sample.Things.S01E02.1080p.mkv",
        1_000
      ),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.displayTitle).toBe("Sample Things S01")
    expect(groups[0]?.artworkRequest).toEqual({
      mediaKind: "tv",
      title: "Sample Things",
      seasonNumber: 1,
    })
  })

  it("keeps episodes of different seasons in separate cards", () => {
    const groups = getHybridCardGroups([
      createItem(
        "https://example.com/st-s01e01",
        "Show.S01E01.720p.mkv",
        3_000
      ),
      createItem(
        "https://example.com/st-s02e01",
        "Show.S02E01.1080p.mkv",
        2_000
      ),
      createItem(
        "https://example.com/st-s01e02",
        "Show.S01E02.1080p.mkv",
        1_000
      ),
    ])

    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.displayTitle)).toEqual([
      "Show S01",
      "Show S02",
    ])
    expect(groups[0]?.items.map((item) => item.url)).toEqual([
      "https://example.com/st-s01e01",
      "https://example.com/st-s01e02",
    ])
  })

  it("keeps same-title releases with conflicting years apart", () => {
    const groups = getHybridCardGroups([
      createItem(
        "https://example.com/feature-2021",
        "Feature.2021.1080p.mkv",
        2_000
      ),
      createItem(
        "https://example.com/feature-1984",
        "Feature.1984.720p.mkv",
        1_000
      ),
    ])

    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.displayTitle)).toEqual([
      "Feature (2021)",
      "Feature (1984)",
    ])
  })

  it("keeps same-title shows with conflicting years apart", () => {
    const groups = getHybridCardGroups([
      createItem(
        "https://example.com/sample-piece-1999",
        "Sample.Piece.S01E01.1999.mkv",
        2_000
      ),
      createItem(
        "https://example.com/sample-piece-2023",
        "Sample.Piece.2023.S01E01.mkv",
        1_000
      ),
    ])

    expect(groups).toHaveLength(2)
  })

  it("merges a saved show container with a direct episode save", () => {
    const episodeLabel = "Legend.of.Vox.Machina.S04E01.One.Year.Later.1080p.mkv"
    const groups = getHybridCardGroups([
      createEpisodeItem(
        "https://example.com/vox-container",
        "The Legend of Vox Machina (2022)",
        2_000,
        [
          {
            nodeKey: "quality",
            label: "AVC 1080p WEB-DL H264",
            type: "folder",
            mediaNodeKind: "group",
            children: [
              {
                nodeKey: "episode",
                url: "https://example.com/vox-container/episode",
                label: episodeLabel,
                type: "file",
                mediaNodeKind: "resolvable",
              },
            ],
          },
        ]
      ),
      createEpisodeItem(
        "https://example.com/vox-episode",
        "The Legend of Vox Machina (2022)",
        1_000,
        [
          {
            nodeKey: "episode",
            url: "https://example.com/vox-episode/media",
            label: episodeLabel,
            type: "file",
            mediaNodeKind: "playable",
          },
        ]
      ),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.items.map((item) => item.url)).toEqual([
      "https://example.com/vox-container",
      "https://example.com/vox-episode",
    ])
  })

  it("uses a compatible saved title for a mirror-resolvable container", () => {
    const groups = getHybridCardGroups([
      createEpisodeItem(
        "https://example.com/vox-mirror",
        "The Legend of Vox Machina (2022)",
        2_000,
        [
          {
            nodeKey: "episode",
            url: "https://example.com/vox-mirror/media",
            label: "Legend.of.Vox.Machina.S04E01.One.Year.Later.1080p.mkv",
            type: "folder",
            mediaNodeKind: "resolvable",
            resolutionKind: "mirrors",
          },
        ]
      ),
    ])

    expect(groups[0]?.displayTitle).toBe("The Legend of Vox Machina (2022) S04")
    expect(groups[0]?.artworkRequest).toEqual({
      mediaKind: "tv",
      title: "The Legend of Vox Machina",
      year: 2022,
      seasonNumber: 4,
    })
  })

  it("keeps unrecognizable labels as single-item cards without artwork", () => {
    const groups = getHybridCardGroups([
      createItem("https://example.com/random", "file", 2_000),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.displayTitle).toBe("file")
    expect(groups[0]?.artworkRequest).toBeUndefined()
  })

  it("ignores quality-tag descendants without a year when identifying a card", () => {
    const groups = getHybridCardGroups([
      {
        ...createItem(
          "https://mirror.sample-site.cl/feature-2026-hindi-line-v2-hdtc-full-movie/",
          "Feature (2026) V2 HQ-HDTC [Hindi] (LiNE) 1080p 720p & 480p Multi Audio [x264/HEVC] | Full Movie",
          2_000
        ),
        metadata: {
          schemaVersion: 3,
          source: {},
          extraction: {
            extractedLinks: [
              {
                nodeKey: "0:resolvable:samplecdn-1",
                url: "https://example.com/480p",
                label: "480p⚡",
                type: "folder",
                size: "820MB",
                mediaNodeKind: "resolvable",
              },
              {
                nodeKey: "5:resolvable:sampledrive-6",
                url: "https://example.com/hq-rip",
                label: "HQ-Rip 1080p",
                type: "folder",
                size: "10.5GB",
                mediaNodeKind: "resolvable",
              },
            ],
          },
          playback: { openedUrls: [] },
        },
      },
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.displayTitle).toBe("Feature (2026)")
    expect(groups[0]?.artworkRequest).toEqual({
      mediaKind: "movie",
      title: "Feature",
      year: 2026,
    })
  })

  it("ignores resolved mirror descendants when identifying a card", () => {
    const groups = getHybridCardGroups([
      {
        ...createItem(
          "https://mirror.sample-site.cl/feature-2026-hindi-line-v2-hdtc-full-movie/",
          "Feature (2026) V2 HQ-HDTC [Hindi] (LiNE) 1080p 720p & 480p Multi Audio [x264/HEVC] | Full Movie",
          2_000
        ),
        metadata: {
          schemaVersion: 3,
          source: {},
          extraction: {
            extractedLinks: [
              {
                nodeKey: "0:resolvable:samplecdn-1",
                url: "https://example.com/480p",
                label: "480p⚡",
                type: "folder",
                size: "820MB",
                mediaNodeKind: "resolvable",
                resolutionKind: "mirrors",
              },
              {
                nodeKey: "2:resolvable:samplemount-3",
                url: "https://example.com/720p-x264",
                label: "720p x264",
                type: "folder",
                childrenResolved: true,
                children: [
                  {
                    nodeKey: "0:resolvable:samplecloud-1",
                    url: "https://example.com/direct",
                    label: "Direct",
                    type: "folder",
                    mediaNodeKind: "resolvable",
                    resolutionKind: "mirrors",
                  },
                  {
                    nodeKey: "1:resolvable:sampledrive-2",
                    url: "https://example.com/drive",
                    label: "Drive",
                    type: "folder",
                    mediaNodeKind: "resolvable",
                    resolutionKind: "mirrors",
                  },
                ],
                mediaNodeKind: "resolvable",
                resolutionKind: "folder",
              },
            ],
          },
          playback: { openedUrls: [] },
        },
      },
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.displayTitle).toBe("Feature (2026)")
    expect(groups[0]?.items).toHaveLength(1)
  })

  it("derives a tv identity from extracted children for show containers", () => {
    const groups = getHybridCardGroups([
      {
        ...createItem("https://example.com/warden", "Warden (2022)", 2_000),
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
                          "Warden S01E01 UHD BluRay 2160p REMUX HDR HEVC.mkv",
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
    expect(groups[0]?.displayTitle).toBe("Warden (2022) S01")
    expect(groups[0]?.artworkRequest).toEqual({
      mediaKind: "tv",
      title: "Warden",
      year: 2022,
      seasonNumber: 1,
    })
  })

  it("keeps a mixed folder as its own card titled by the folder name", () => {
    const groups = getHybridCardGroups([
      {
        ...createItem(
          "https://example.com/oya-team-2026/",
          "OYA-TEAM 2026",
          2_000
        ),
        metadata: {
          schemaVersion: 3,
          source: {},
          extraction: {
            extractedLinks: [
              {
                nodeKey: "0:resolvable:dangers",
                url: "https://example.com/dangers",
                label:
                  "[ToonsHub].The.Dangers.in.My.Heart.S02.1080p.AMZN.WEB-DL.DDP2.0.H.264.Dual.Audio.English-Sub.[BATCH].zip",
                type: "file",
                mediaNodeKind: "resolvable",
              },
              {
                nodeKey: "1:resolvable:antman",
                url: "https://example.com/antman",
                label:
                  "Ant-Man.and.the.Wasp.2018.1080p.BluRay.x265.HEVC.10bit.AAC.7.1.Tigole.mkv",
                type: "file",
                mediaNodeKind: "resolvable",
              },
              {
                nodeKey: "2:group:mentalist-s03",
                label:
                  "The Mentalist (2008) Season 3 S03 (1080p AMZN WEB-DL x265 HEVC 10bit EAC3 6.0 RZeroX) [QxR]",
                type: "folder",
                mediaNodeKind: "group",
                children: [
                  {
                    nodeKey: "2.0:resolvable:s03e01",
                    url: "https://example.com/s03e01",
                    label:
                      "The Mentalist (2008) - S03E01 - Red Sky at Night (1080p AMZN WEB-DL x265 RZeroX).mkv",
                    type: "file",
                    mediaNodeKind: "resolvable",
                  },
                ],
              },
              {
                nodeKey: "3:group:tigers",
                label: "tigers",
                type: "folder",
                mediaNodeKind: "group",
                children: [],
              },
            ],
          },
          playback: { openedUrls: [] },
        },
      },
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.displayTitle).toBe("OYA-TEAM 2026")
    expect(groups[0]?.artworkRequest).toBeUndefined()
    expect(groups[0]?.items).toHaveLength(1)
  })

  it("keeps multi-season containers as folder cards", () => {
    const groups = getHybridCardGroups([
      {
        ...createItem(
          "https://example.com/mentalist-complete/",
          "The Mentalist Complete",
          2_000
        ),
        metadata: {
          schemaVersion: 3,
          source: {},
          extraction: {
            extractedLinks: [
              {
                nodeKey: "0:group:s02",
                label: "The Mentalist Season 2 S02",
                type: "folder",
                mediaNodeKind: "group",
                children: [
                  {
                    nodeKey: "0.0:resolvable:e1",
                    url: "https://example.com/s02e01",
                    label: "The.Mentalist.S02E01.1080p.mkv",
                    type: "file",
                    mediaNodeKind: "resolvable",
                  },
                ],
              },
              {
                nodeKey: "1:group:s03",
                label: "The Mentalist Season 3 S03",
                type: "folder",
                mediaNodeKind: "group",
                children: [
                  {
                    nodeKey: "1.0:resolvable:e1",
                    url: "https://example.com/s03e01",
                    label: "The.Mentalist.S03E01.1080p.mkv",
                    type: "file",
                    mediaNodeKind: "resolvable",
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
    expect(groups[0]?.displayTitle).toBe("The Mentalist Complete")
    expect(groups[0]?.artworkRequest).toBeUndefined()
  })

  it("keeps the saved title year when extracted episodes identify a show", () => {
    const groups = getHybridCardGroups([
      {
        ...createItem(
          "https://sample-hd.example/show-series-164/",
          "Sample Show (2015)",
          2_000
        ),
        metadata: {
          schemaVersion: 3,
          source: { pageTitle: "Sample Show (2015)" },
          extraction: {
            extractedLinks: [
              {
                label: "Season 1",
                type: "folder",
                mediaNodeKind: "group",
                children: [
                  {
                    label: "AVC 1080p WEB-DL H264",
                    type: "folder",
                    mediaNodeKind: "group",
                    children: [
                      {
                        label:
                          "Sample.Show.S01E01.1080p.PROV.WEB-DL.DDP2.0.H.264-SampleTag.Com.mkv",
                        type: "folder",
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
    expect(groups[0]?.artworkRequest).toEqual({
      mediaKind: "tv",
      title: "Sample Show",
      year: 2015,
      seasonNumber: 1,
    })
  })

  it("orders groups by their newest item", () => {
    const groups = getHybridCardGroups([
      createItem("https://example.com/old", "Alpha.2017.mkv", 1_000),
      createItem("https://example.com/new", "Beta.2009.mkv", 3_000),
      createItem("https://example.com/mid", "Gamma.1979.mkv", 2_000),
    ])

    expect(groups.map((group) => group.displayTitle)).toEqual([
      "Beta (2009)",
      "Gamma (1979)",
      "Alpha (2017)",
    ])
  })
})

describe("getSharedSeasonIdentity", () => {
  it("identifies a folder whose links are episodes of one season", () => {
    const identity = getSharedSeasonIdentity([
      "Can.This.Love.Be.Translated.S01E02.Episode.2.1080p.NF.WEB-DL.DD+5.1.Atmos.H.265-CPTN5DW.mkv",
      "Can.This.Love.Be.Translated.S01E01.Episode.1.1080p.NF.WEB-DL.DD+5.1.Atmos.H.265-CPTN5DW.mkv",
    ])

    expect(identity).toEqual({
      requestTitle: "Can This Love Be Translated",
      normalizedTitle: "can this love be translated",
      seasonNumber: 1,
      displayTitle: "Can This Love Be Translated S01",
    })
  })

  it("returns undefined when seasons differ", () => {
    const identity = getSharedSeasonIdentity([
      "Sample.Things.S01E01.720p.mkv",
      "Sample.Things.S02E01.720p.mkv",
    ])

    expect(identity).toBeUndefined()
  })

  it("returns undefined when shows differ", () => {
    const identity = getSharedSeasonIdentity([
      "Sample.Things.S01E01.720p.mkv",
      "Other.Things.S01E01.720p.mkv",
    ])

    expect(identity).toBeUndefined()
  })

  it("returns undefined when any link is not an episode", () => {
    const identity = getSharedSeasonIdentity([
      "Sample.Things.S01E01.720p.mkv",
      "Sample.Things.Season.2.1080p.WEB-DL",
    ])

    expect(identity).toBeUndefined()
  })

  it("returns undefined for an empty folder", () => {
    expect(getSharedSeasonIdentity([])).toBeUndefined()
  })

  it("ignores sidecar files when identifying a season folder", () => {
    const identity = getSharedSeasonIdentity([
      "Can.This.Love.Be.Translated.S01E01.1080p.NF.WEB-DL.mkv",
      "Can.This.Love.Be.Translated.S01E01.1080p.NF.WEB-DL.srt",
      "poster.jpg",
      "season.nfo",
    ])

    expect(identity?.displayTitle).toBe("Can This Love Be Translated S01")
  })
})
