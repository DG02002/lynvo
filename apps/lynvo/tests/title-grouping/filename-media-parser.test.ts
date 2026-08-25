import { describe, expect, it } from "vitest"
import {
  getDemoLazyFolderChildren,
  getDemoMirrorLinks,
  getDemoSavedLinkSeeds,
} from "~/features/links/dev-demo-data"
import { parseMediaFilename } from "~/features/links/title-grouping/filename-media-parser"

describe("parseMediaFilename", () => {
  it("classifies representative movie filenames", () => {
    const cases = [
      {
        filename:
          "Backrooms (2026) 2160p 10bit HDR10+ DV iTunes WEB-DL HEVC...mkv",
        title: "Backrooms",
        year: 2026,
      },
      {
        filename: "Insidious-6.2026.1080p.HEVC.HDTC...mkv",
        title: "Insidious 6",
        year: 2026,
      },
      {
        filename: "Blade Runner (1982) Final Cut V2...mkv",
        title: "Blade Runner",
        year: 1982,
      },
      {
        filename: "Chennai.Love.Story.2026.720p...mkv",
        title: "Chennai Love Story",
        year: 2026,
      },
      {
        filename: "Deadpool & Wolverine (2024) 1080p...mkv",
        title: "Deadpool & Wolverine",
        year: 2024,
      },
      {
        filename: "Thor - The Dark World (2013) 4K...mkv",
        title: "Thor - The Dark World",
        year: 2013,
      },
      {
        filename: "When Marnie Was There 2014 (BD Remux...)",
        title: "When Marnie Was There",
        year: 2014,
      },
    ]

    for (const testCase of cases) {
      const candidate = parseMediaFilename(testCase.filename)

      expect(candidate).toMatchObject({
        kind: "movie",
        title: testCase.title,
        year: testCase.year,
      })
    }
  })

  it("classifies representative episode and range filenames", () => {
    expect(
      parseMediaFilename(
        "Pokemon.The.Series.S04E01.A.Goldenrod.Opportunity...mkv"
      )
    ).toMatchObject({
      kind: "episode",
      title: "Pokemon The Series",
      seasonNumber: 4,
      episodeNumber: 1,
    })

    expect(parseMediaFilename("High School DxD - S01E01")).toMatchObject({
      kind: "episode",
      title: "High School DxD",
      seasonNumber: 1,
      episodeNumber: 1,
    })

    expect(
      parseMediaFilename("Mob Psycho 100 III (2022) S03E01...mkv")
    ).toMatchObject({
      kind: "episode",
      title: "Mob Psycho 100 III",
      year: 2022,
      seasonNumber: 3,
      episodeNumber: 1,
    })

    expect(
      parseMediaFilename("Naruto Shippuden (2007) S06[E129-143]...")
    ).toMatchObject({
      kind: "episode-range",
      title: "Naruto Shippuden",
      year: 2007,
      seasonNumber: 6,
      episodeNumber: 129,
      episodeEnd: 143,
    })
  })

  it("keeps TMDB demo titles parseable", () => {
    const demoSeeds = getDemoSavedLinkSeeds()
    const loadedFolderEpisode = demoSeeds[1]?.extractedLinks[0]?.children?.[0]
    const mirrorLink = getDemoMirrorLinks()[0]
    const lazyFolderChild = getDemoLazyFolderChildren()[0]?.children?.[0]

    expect(parseMediaFilename(demoSeeds[0]?.meta.filename ?? "")).toMatchObject(
      {
        kind: "movie",
        title: "The Dark Knight",
        year: 2008,
      }
    )
    expect(parseMediaFilename(loadedFolderEpisode?.label ?? "")).toMatchObject({
      kind: "episode",
      title: "Stranger Things",
      seasonNumber: 1,
      episodeNumber: 1,
      year: 2016,
    })
    expect(
      parseMediaFilename(demoSeeds[2]?.extractedLinks[0]?.label ?? "")
    ).toMatchObject({
      kind: "movie",
      title: "The Matrix",
      year: 1999,
    })
    expect(
      parseMediaFilename(demoSeeds[3]?.extractedLinks[0]?.label ?? "")
    ).toMatchObject({
      kind: "movie",
      title: "The Lord of the Rings: The Fellowship of the Ring",
      year: 2001,
    })
    expect(parseMediaFilename(mirrorLink?.label ?? "")).toMatchObject({
      kind: "movie",
      title: "The Matrix",
      year: 1999,
    })
    expect(parseMediaFilename(lazyFolderChild?.label ?? "")).toMatchObject({
      kind: "movie",
      title: "The Lord of the Rings: The Two Towers",
      year: 2002,
    })
  })

  it("recognizes season-only names and folder context", () => {
    expect(parseMediaFilename("Oshi no Ko Season 1 BluRay...")).toMatchObject({
      kind: "season",
      title: "Oshi no Ko",
      seasonNumber: 1,
    })

    expect(parseMediaFilename("[Salieri] Gachiakuta S1 - BD...")).toMatchObject(
      {
        kind: "season",
        title: "Gachiakuta",
        seasonNumber: 1,
      }
    )

    const folderCandidate = parseMediaFilename(
      "Chilling_Adventures_of_Sabrina_2020_S04_720p..."
    )
    expect(folderCandidate).toMatchObject({
      kind: "season",
      title: "Chilling Adventures of Sabrina",
      year: 2020,
      seasonNumber: 4,
    })

    expect(
      parseMediaFilename("Episode 02.mkv", "Chilling Adventures of Sabrina S04")
    ).toMatchObject({
      kind: "episode",
      title: "Chilling Adventures of Sabrina",
      seasonNumber: 4,
      episodeNumber: 2,
    })

    expect(
      parseMediaFilename(
        "Chilling Adventures of Sabrina S04E02...mkv",
        "Chilling Adventures of Sabrina S04"
      )
    ).toMatchObject({
      kind: "episode",
      title: "Chilling Adventures of Sabrina",
      seasonNumber: 4,
      episodeNumber: 2,
    })
  })

  it("supports marker separators and case variants", () => {
    expect(parseMediaFilename("Show Name s04 e01.mkv")).toMatchObject({
      kind: "episode",
      seasonNumber: 4,
      episodeNumber: 1,
    })
    expect(parseMediaFilename("Show Name S04_E01.mkv")).toMatchObject({
      kind: "episode",
      seasonNumber: 4,
      episodeNumber: 1,
    })
    expect(parseMediaFilename("Show Name season 4.mkv")).toMatchObject({
      kind: "season",
      seasonNumber: 4,
    })
    expect(parseMediaFilename("Show Name S4.mkv")).toMatchObject({
      kind: "season",
      seasonNumber: 4,
    })
  })

  it("does not infer episodes from technical or release numbers", () => {
    const technicalCandidate = parseMediaFilename(
      "Show Name 2160p 10bit HDR10+ WEB-DL HEVC 7.1.mkv"
    )
    expect(technicalCandidate.kind).not.toBe("episode")
    expect(technicalCandidate.kind).not.toBe("episode-range")
    expect(technicalCandidate.episodeNumber).toBeUndefined()
    expect(technicalCandidate.seasonNumber).toBeUndefined()

    const releaseCandidate = parseMediaFilename(
      "[Release129] Show Name 1080p 10bit.mkv"
    )
    expect(releaseCandidate.kind).not.toBe("episode")
    expect(releaseCandidate.episodeNumber).toBeUndefined()
  })

  it("returns ambiguous candidates for malformed or repeated markers", () => {
    expect(parseMediaFilename("Show Name S01E.mkv")).toMatchObject({
      kind: "ambiguous",
      rawText: "Show Name S01E.mkv",
    })
    expect(parseMediaFilename("Show Name SxxEyy.mkv")).toMatchObject({
      kind: "ambiguous",
    })
    expect(parseMediaFilename("Show Name S01E01 S01E02.mkv")).toMatchObject({
      kind: "ambiguous",
    })
  })

  it("returns unmatched candidates when there is no useful title signal", () => {
    expect(parseMediaFilename("")).toMatchObject({
      kind: "unknown",
      rawText: "",
    })
    expect(parseMediaFilename("video.mkv")).toMatchObject({
      kind: "unknown",
      rawText: "video.mkv",
    })
    expect(parseMediaFilename("[Group] 1080p.mkv")).toMatchObject({
      kind: "unknown",
    })
  })
})
